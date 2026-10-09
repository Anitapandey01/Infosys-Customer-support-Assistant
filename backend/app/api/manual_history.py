import hashlib
import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DBSession

from app.models.database import SessionLocal
from app.models.simulator import (
    Scenario,
    Session,
    Conversation,
    Message,
)


router = APIRouter(
    prefix="/manual",
    tags=["Manual Mode History"],
)


# ============================================================
# DATABASE DEPENDENCY
# ============================================================

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# ============================================================
# REQUEST MODELS
# ============================================================

class ManualMessageRequest(BaseModel):
    sender: str
    text: str
    timestamp: str | None = None


class SaveManualInteractionRequest(BaseModel):
    conversation: list[ManualMessageRequest] = Field(
        default_factory=list
    )

    analysis: dict[str, Any] | None = None

    status: str = "Completed"

    title: str = "Manual Mode Interaction"


# ============================================================
# CONVERSATION FINGERPRINT
# ============================================================

def _conversation_fingerprint(items: list[ManualMessageRequest]) -> str:
    normalized = []
    for item in items:
        text = " ".join((item.text or "").strip().lower().split())
        sender = (item.sender or "").strip().lower()
        if text:
            normalized.append(f"{sender}:{text}")
    return hashlib.sha256("\n".join(normalized).encode("utf-8")).hexdigest()


def _saved_message_fingerprint(messages: list[Message]) -> str:
    normalized = []
    for message in messages:
        if message.message_type == "System":
            continue
        text = " ".join((message.message_text or "").strip().lower().split())
        sender = (message.sender_type or "").strip().lower()
        if text:
            normalized.append(f"{sender}:{text}")
    return hashlib.sha256("\n".join(normalized).encode("utf-8")).hexdigest()


# ============================================================
# SAVE MANUAL INTERACTION
# ============================================================

@router.post("/save")
def save_manual_interaction(
    request: SaveManualInteractionRequest,
    db: DBSession = Depends(get_db),
):
    if not request.conversation:
        raise HTTPException(
            status_code=400,
            detail="Cannot save an empty Manual Mode interaction.",
        )

    # --------------------------------------------------------
    # DO NOT CREATE DUPLICATE SAVED CONVERSATIONS
    # --------------------------------------------------------
    requested_fingerprint = _conversation_fingerprint(request.conversation)

    existing_rows = (
        db.query(Session, Conversation)
        .join(Conversation, Conversation.session_id == Session.session_id)
        .join(Scenario, Scenario.scenario_id == Session.scenario_id)
        .filter(Scenario.category == "manual")
        .filter(Session.status == "Completed")
        .order_by(Session.session_id.desc())
        .all()
    )

    for existing_session, existing_conversation in existing_rows:
        existing_messages = (
            db.query(Message)
            .filter(Message.conversation_id == existing_conversation.conversation_id)
            .order_by(Message.message_id.asc())
            .all()
        )
        if _saved_message_fingerprint(existing_messages) == requested_fingerprint:
            return {
                "success": True,
                "duplicate": True,
                "message": "This conversation is already saved.",
                "session_id": existing_session.session_id,
                "conversation_id": existing_conversation.conversation_id,
                "status": existing_session.status,
            }

    # --------------------------------------------------------
    # FIND EXISTING MANUAL SCENARIO OR CREATE ONE
    # --------------------------------------------------------

    scenario_row = (
        db.query(Scenario)
        .filter(
            Scenario.category == "manual"
        )
        .first()
    )

    if not scenario_row:
        scenario_row = Scenario(
            title="Manual Mode Interaction",
            category="manual",
            difficulty="Medium",
            objective="Review and improve customer support performance.",
            description="Conversation created from Manual Mode.",
            is_active=True,
        )

        db.add(scenario_row)
        db.flush()

    # --------------------------------------------------------
    # CREATE SESSION
    # --------------------------------------------------------

    session_row = Session(
        scenario_id=scenario_row.scenario_id,
        start_time=datetime.utcnow(),
        end_time=datetime.utcnow(),
        status=request.status or "Completed",
    )

    db.add(session_row)
    db.flush()

    # --------------------------------------------------------
    # ANALYSIS VALUES
    # --------------------------------------------------------

    analysis = request.analysis or {}

    intent = (
        analysis.get("intent")
        or analysis.get("intent_name")
        or "general_inquiry"
    )

    sentiment = (
        analysis.get("sentiment")
        or "Neutral"
    )

    escalation = analysis.get(
        "escalation"
    )

    if isinstance(escalation, dict):
        escalation_risk = (
            escalation.get("risk_level")
            or escalation.get("risk")
            or analysis.get(
                "escalation_risk",
                "Low",
            )
        )
    else:
        escalation_risk = (
            analysis.get(
                "escalation_risk",
                "Low",
            )
        )

    resolution_status = (
        analysis.get(
            "resolution_status"
        )
        or "Completed"
    )

    # --------------------------------------------------------
    # CREATE CONVERSATION
    # --------------------------------------------------------

    conversation_row = Conversation(
        session_id=session_row.session_id,
        intent=str(intent),
        sentiment=str(sentiment),
        resolution_status=str(
            resolution_status
        ),
        escalation_risk=str(
            escalation_risk
        ),
        created_at=datetime.utcnow(),
    )

    db.add(conversation_row)
    db.flush()

    # --------------------------------------------------------
    # SAVE ALL MESSAGES
    # --------------------------------------------------------

    for item in request.conversation:

        text = item.text.strip()

        if not text:
            continue

        sender = (
            item.sender.strip().lower()
        )

        if sender in {
            "customer",
            "ai_customer",
            "user",
        }:
            sender_type = "Customer"

        elif sender in {
            "agent",
            "support agent",
            "support_agent",
        }:
            sender_type = "Support Agent"

        else:
            sender_type = item.sender.strip()

        db.add(
            Message(
                conversation_id=(
                    conversation_row.conversation_id
                ),
                sender_type=sender_type,
                message_text=text,
                timestamp=datetime.utcnow(),
                message_type="Text",
            )
        )

    # --------------------------------------------------------
    # STORE TASK 8 ANALYSIS AS SYSTEM MESSAGE
    #
    # This allows us to retrieve the complete saved report
    # later without changing the existing database schema.
    # --------------------------------------------------------

    db.add(
        Message(
            conversation_id=(
                conversation_row.conversation_id
            ),
            sender_type="AI",
            message_text=json.dumps(
                {
                    "type": "manual_post_interaction_summary",
                    "title": request.title,
                    "analysis": analysis,
                },
                default=str,
            ),
            timestamp=datetime.utcnow(),
            message_type="System",
        )
    )

    db.commit()

    return {
        "success": True,
        "message": (
            "Manual Mode interaction saved successfully."
        ),
        "session_id": session_row.session_id,
        "conversation_id": (
            conversation_row.conversation_id
        ),
        "status": session_row.status,
    }


# ============================================================
# LIST ALL SAVED MANUAL INTERACTIONS
# ============================================================

@router.get("/history/all")
def get_saved_interactions(
    db: DBSession = Depends(get_db),
):
    """Return completed saved conversations from Manual and Simulator modes.

    Existing duplicate rows are collapsed by their actual conversation content,
    while the newest session is retained for reporting.
    """
    rows = (
        db.query(Session, Conversation, Scenario)
        .join(Conversation, Conversation.session_id == Session.session_id)
        .join(Scenario, Scenario.scenario_id == Session.scenario_id)
        .filter(Session.status == "Completed")
        .order_by(Session.session_id.desc())
        .all()
    )

    result = []
    seen_fingerprints = set()

    for session_row, conversation_row, scenario_row in rows:
        messages = (
            db.query(Message)
            .filter(Message.conversation_id == conversation_row.conversation_id)
            .order_by(Message.message_id.asc())
            .all()
        )

        fingerprint = _saved_message_fingerprint(messages)
        if fingerprint in seen_fingerprints:
            continue
        seen_fingerprints.add(fingerprint)

        customer_count = 0
        agent_count = 0
        saved_analysis = None

        for message in messages:
            if message.message_type == "System":
                try:
                    payload = json.loads(message.message_text)
                    if payload.get("type") == "manual_post_interaction_summary":
                        saved_analysis = payload.get("analysis")
                except Exception:
                    pass
                continue

            sender = (message.sender_type or "").lower()
            if sender == "customer":
                customer_count += 1
            elif sender in {"support agent", "agent"}:
                agent_count += 1

        mode = "manual" if str(scenario_row.category).lower() == "manual" else "simulator"

        result.append({
            "session_id": session_row.session_id,
            "conversation_id": conversation_row.conversation_id,
            "mode": mode,
            "scenario_title": scenario_row.title,
            "scenario_category": scenario_row.category,
            "status": session_row.status,
            "start_time": session_row.start_time.isoformat() if session_row.start_time else None,
            "end_time": session_row.end_time.isoformat() if session_row.end_time else None,
            "intent": conversation_row.intent,
            "sentiment": conversation_row.sentiment,
            "resolution_status": conversation_row.resolution_status,
            "escalation_risk": conversation_row.escalation_risk,
            "customer_message_count": customer_count,
            "agent_message_count": agent_count,
            "analysis": saved_analysis,
        })

    return {"count": len(result), "interactions": result}

# ============================================================
# GET SAVED MANUAL INTERACTION
# ============================================================

@router.get("/{session_id}")
def get_manual_interaction(
    session_id: int,
    db: DBSession = Depends(get_db),
):
    session_row = (
        db.query(Session)
        .filter(
            Session.session_id == session_id
        )
        .first()
    )

    if not session_row:
        raise HTTPException(
            status_code=404,
            detail="Manual interaction not found.",
        )

    conversation_row = (
        db.query(Conversation)
        .filter(
            Conversation.session_id
            == session_id
        )
        .first()
    )

    if not conversation_row:
        raise HTTPException(
            status_code=404,
            detail="Saved conversation not found.",
        )

    scenario_row = (
        db.query(Scenario)
        .filter(Scenario.scenario_id == session_row.scenario_id)
        .first()
    )

    messages = (
        db.query(Message)
        .filter(
            Message.conversation_id
            == conversation_row.conversation_id
        )
        .order_by(
            Message.message_id.asc()
        )
        .all()
    )

    conversation = []

    saved_summary = None

    for message in messages:

        if message.message_type == "System":

            try:
                payload = json.loads(
                    message.message_text
                )

                if (
                    payload.get("type")
                    == "manual_post_interaction_summary"
                ):
                    saved_summary = payload.get(
                        "analysis"
                    )

            except Exception:
                pass

            continue

        conversation.append(
            {
                "id": message.message_id,
                "sender": (
                    "customer"
                    if message.sender_type.lower()
                    == "customer"
                    else "agent"
                ),
                "text": message.message_text,
                "timestamp": (
                    message.timestamp.isoformat()
                    if message.timestamp
                    else None
                ),
            }
        )

    return {
        "session_id": session_id,
        "conversation_id": (
            conversation_row.conversation_id
        ),
        "status": session_row.status,
        "conversation": conversation,
        "analysis": saved_summary,
    }
