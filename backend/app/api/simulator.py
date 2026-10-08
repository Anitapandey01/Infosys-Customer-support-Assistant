import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from app.models.database import SessionLocal
from app.models.simulator import (
    Scenario,
    Session,
    Conversation,
    Message,
)

from app.services.analysis_service import analyze_customer_message
from app.services.simulator_service import generate_customer_turn
from app.services.simulator_state import initial_state
from app.services.scenario_service import (
    SCENARIOS,
    get_scenario_brief,
)
from app.services.persona_service import get_persona_brief
from app.services.knowledge_recommendation_service import (
    recommend_knowledge,
)
from app.services.escalation_service import (
    calculate_escalation_risk,
)
from app.services.post_interaction_summary_service import (
    build_post_interaction_summary,
)


router = APIRouter(
    prefix="/simulator",
    tags=["Customer Simulator"],
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

class SimulatorStartRequest(BaseModel):
    session_label: str
    persona: str
    scenario: str
    initial_emotion: str
    issue_severity: int
    patience_level: int
    expected_resolution: str


class SimulatorMessageRequest(BaseModel):
    session_id: int
    agent_response: str


# ============================================================
# TASK 6 HELPER
# ============================================================

def _build_escalation_result(
    message: str,
    analysis: dict,
    conversation_history: list[dict],
) -> dict:
    frustration_level = analysis.get(
        "frustration_level",
        0,
    )

    sentiment = analysis.get(
        "sentiment",
        "Neutral",
    )

    return calculate_escalation_risk(
        message=message,
        frustration_level=frustration_level,
        sentiment=sentiment,
        conversation_history=conversation_history,
    )


# ============================================================
# ENDPOINT 1: START SIMULATION
# ============================================================

@router.post("/start")
def start_simulator_session(
    request: SimulatorStartRequest,
    db: DBSession = Depends(get_db),
):
    try:
        get_scenario_brief(request.scenario)

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    try:
        get_persona_brief(request.persona)

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    scenario_key = request.scenario.strip().lower()

    if scenario_key not in SCENARIOS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported scenario: {scenario_key}",
        )

    scenario_data = SCENARIOS[scenario_key]

    scenario_row = Scenario(
        title=(
            request.session_label
            or f"Scenario - {scenario_key.title()}"
        ),
        category=scenario_key,
        difficulty="Medium",
        objective=(
            request.expected_resolution
            or scenario_data.get(
                "resolution_condition"
            )
        ),
        description=scenario_data.get(
            "opening_complaint"
        ),
        is_active=True,
    )

    db.add(scenario_row)
    db.flush()

    session_row = Session(
        scenario_id=scenario_row.scenario_id,
        start_time=datetime.utcnow(),
        status="In Progress",
    )

    db.add(session_row)
    db.flush()

    start_state = initial_state(
        persona=request.persona,
        initial_emotion=request.initial_emotion,
        issue_severity=request.issue_severity,
        patience_level=request.patience_level,
    )

    opening_message = scenario_data[
        "opening_complaint"
    ]

    opening_analysis = analyze_customer_message(
        message=opening_message,
        conversation_history=[],
    )

    opening_knowledge = recommend_knowledge(
        message=opening_message,
        conversation_history=[],
        number_of_recommendations=3,
    )

    opening_analysis[
        "knowledge_recommendations"
    ] = opening_knowledge.get(
        "recommendations",
        [],
    )

    opening_analysis[
        "knowledge_message"
    ] = opening_knowledge.get(
        "message",
        "",
    )

    opening_escalation = _build_escalation_result(
        message=opening_message,
        analysis=opening_analysis,
        conversation_history=[],
    )

    conversation_row = Conversation(
        session_id=session_row.session_id,

        intent=opening_analysis[
            "intent"
        ],

        sentiment=opening_analysis[
            "sentiment"
        ],

        resolution_status="Unresolved",

        escalation_risk=opening_escalation[
            "risk_level"
        ],

        created_at=datetime.utcnow(),
    )

    db.add(conversation_row)
    db.flush()

    customer_msg = Message(
        conversation_id=conversation_row.conversation_id,
        sender_type="Customer",
        message_text=opening_message,
        timestamp=datetime.utcnow(),
        message_type="Text",
    )

    db.add(customer_msg)

    system_state_msg = Message(
        conversation_id=conversation_row.conversation_id,
        sender_type="AI",
        message_text=json.dumps(
            {
                "persona": request.persona,
                "scenario": scenario_key,
                "state": start_state,
            }
        ),
        timestamp=datetime.utcnow(),
        message_type="System",
    )

    db.add(system_state_msg)

    db.commit()

    return {
        "session_id": session_row.session_id,

        "conversation_id": (
            conversation_row.conversation_id
        ),

        "customer_message": opening_message,

        "analysis": opening_analysis,

        "escalation": opening_escalation,

        "state": start_state,

        "turn": 1,
    }


# ============================================================
# ENDPOINT 2: NEXT CUSTOMER TURN
# ============================================================

@router.post("/message")
def send_simulator_message(
    request: SimulatorMessageRequest,
    db: DBSession = Depends(get_db),
):
    session_row = (
        db.query(Session)
        .filter(
            Session.session_id
            == request.session_id
        )
        .first()
    )

    if not session_row:
        raise HTTPException(
            status_code=404,
            detail="Simulator session not found",
        )

    conversation_row = (
        db.query(Conversation)
        .filter(
            Conversation.session_id
            == session_row.session_id
        )
        .first()
    )

    if not conversation_row:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found for session",
        )

    scenario_row = (
        db.query(Scenario)
        .filter(
            Scenario.scenario_id
            == session_row.scenario_id
        )
        .first()
    )

    all_messages = (
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

    current_state = None
    persona = "calm"

    scenario_key = (
        scenario_row.category
        if scenario_row
        else "refund"
    )

    for message in reversed(all_messages):

        if message.message_type != "System":
            continue

        try:
            payload = json.loads(
                message.message_text
            )

            current_state = payload.get(
                "state"
            )

            persona = payload.get(
                "persona",
                persona,
            )

            scenario_key = payload.get(
                "scenario",
                scenario_key,
            )

            break

        except Exception:
            continue

    if not current_state:

        current_state = initial_state(
            persona,
            "neutral",
            3,
            3,
        )

    dialogue_history = [
        {
            "sender_type": message.sender_type,
            "message_text": message.message_text,
        }
        for message in all_messages
        if message.message_type != "System"
    ]

    agent_msg = Message(
        conversation_id=conversation_row.conversation_id,
        sender_type="Support Agent",
        message_text=request.agent_response,
        timestamp=datetime.utcnow(),
        message_type="Text",
    )

    db.add(agent_msg)
    db.flush()

    turn_result = generate_customer_turn(
        persona=persona,
        scenario=scenario_key,
        state=current_state,
        conversation_history=dialogue_history,
        agent_response=request.agent_response,
    )

    customer_message = turn_result[
        "customer_message"
    ]

    updated_state = turn_result[
        "updated_state"
    ]

    is_resolved = turn_result[
        "is_resolved"
    ]

    is_simulator_escalated = turn_result[
        "is_escalated"
    ]

    customer_analysis = analyze_customer_message(
        message=customer_message,
        conversation_history=dialogue_history,
    )

    knowledge_result = recommend_knowledge(
        message=customer_message,
        conversation_history=dialogue_history,
        number_of_recommendations=3,
    )

    customer_analysis[
        "knowledge_recommendations"
    ] = knowledge_result.get(
        "recommendations",
        [],
    )

    customer_analysis[
        "knowledge_message"
    ] = knowledge_result.get(
        "message",
        "",
    )

    escalation_result = _build_escalation_result(
        message=customer_message,
        analysis=customer_analysis,
        conversation_history=dialogue_history,
    )

    customer_msg_row = Message(
        conversation_id=conversation_row.conversation_id,
        sender_type="Customer",
        message_text=customer_message,
        timestamp=datetime.utcnow(),
        message_type="Text",
    )

    db.add(customer_msg_row)

    system_state_row = Message(
        conversation_id=conversation_row.conversation_id,
        sender_type="AI",
        message_text=json.dumps(
            {
                "persona": persona,
                "scenario": scenario_key,
                "state": updated_state,
            }
        ),
        timestamp=datetime.utcnow(),
        message_type="System",
    )

    db.add(system_state_row)

    conversation_row.intent = customer_analysis[
        "intent"
    ]

    conversation_row.sentiment = customer_analysis[
        "sentiment"
    ]

    conversation_row.escalation_risk = (
        escalation_result[
            "risk_level"
        ]
    )

    if is_resolved:

        session_row.status = "Completed"

        session_row.end_time = datetime.utcnow()

        conversation_row.resolution_status = (
            "Resolved"
        )

    elif is_simulator_escalated:

        session_row.status = "Completed"

        session_row.end_time = datetime.utcnow()

        conversation_row.resolution_status = (
            "Escalated"
        )

    customer_turns = (
        sum(
            1
            for message in dialogue_history
            if str(
                message["sender_type"]
            ).lower()
            == "customer"
        )
        + 1
    )

    db.commit()

    return {
        "session_id": session_row.session_id,

        "customer_message": customer_message,

        "analysis": customer_analysis,

        "escalation": escalation_result,

        "state": updated_state,

        "turn": customer_turns,

        "is_resolved": is_resolved,

        "is_escalated": is_simulator_escalated,
    }


# ============================================================
# ENDPOINT 3: HISTORY
# ============================================================

@router.get("/{session_id}/history")
def get_simulator_history(
    session_id: int,
    db: DBSession = Depends(get_db),
):
    session_row = (
        db.query(Session)
        .filter(
            Session.session_id
            == session_id
        )
        .first()
    )

    if not session_row:
        raise HTTPException(
            status_code=404,
            detail="Simulator session not found",
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

        return {
            "session_id": session_id,
            "status": session_row.status,
            "messages": [],
        }

    messages = (
        db.query(Message)
        .filter(
            Message.conversation_id
            == conversation_row.conversation_id,
            Message.message_type
            != "System",
        )
        .order_by(
            Message.message_id.asc()
        )
        .all()
    )

    return {
        "session_id": session_id,

        "status": session_row.status,

        "escalation_risk": (
            conversation_row.escalation_risk
        ),

        "messages": [
            {
                "message_id": message.message_id,
                "sender_type": message.sender_type,
                "message_text": message.message_text,
                "message_type": message.message_type,
                "timestamp": message.timestamp,
            }
            for message in messages
        ],
    }


# ============================================================
# TASK 8 - POST-INTERACTION PERFORMANCE SUMMARY
# ============================================================

@router.get("/{session_id}/post-interaction-summary")
def get_post_interaction_summary(
    session_id: int,
    db: DBSession = Depends(get_db),
):
    # --------------------------------------------------------
    # LOOKUP SESSION
    # --------------------------------------------------------

    session_row = (
        db.query(Session)
        .filter(
            Session.session_id
            == session_id
        )
        .first()
    )

    if not session_row:
        raise HTTPException(
            status_code=404,
            detail="Simulator session not found",
        )

    # --------------------------------------------------------
    # LOOKUP CONVERSATION
    # --------------------------------------------------------

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
            detail="Conversation not found for session",
        )

    # --------------------------------------------------------
    # FETCH ACTUAL CONVERSATION MESSAGES
    #
    # System messages are excluded because they contain
    # simulator state rather than customer-agent interaction.
    # --------------------------------------------------------

    messages = (
        db.query(Message)
        .filter(
            Message.conversation_id
            == conversation_row.conversation_id,
            Message.message_type
            != "System",
        )
        .order_by(
            Message.message_id.asc()
        )
        .all()
    )

    conversation_history = [
        {
            "sender_type": message.sender_type,
            "message_text": message.message_text,
        }
        for message in messages
    ]

    # --------------------------------------------------------
    # DERIVE LATEST CUSTOMER ANALYSIS
    #
    # Task 8 uses the existing Task 4 analysis service.
    # No Task 4 code is changed.
    # --------------------------------------------------------

    customer_messages = [
        message
        for message in messages
        if str(
            message.sender_type
        ).strip().lower()
        in {
            "customer",
            "ai_customer",
            "user",
        }
    ]

    latest_customer_message = (
        customer_messages[-1].message_text
        if customer_messages
        else ""
    )

    latest_analysis = {}

    if latest_customer_message:
        latest_analysis = analyze_customer_message(
            message=latest_customer_message,
            conversation_history=conversation_history,
        )

    # --------------------------------------------------------
    # TASK 8 INPUTS
    # --------------------------------------------------------

    intent = (
        conversation_row.intent
        or latest_analysis.get(
            "intent",
            "general_inquiry",
        )
    )

    sentiment = (
        conversation_row.sentiment
        or latest_analysis.get(
            "sentiment",
            "Neutral",
        )
    )

    emotion = latest_analysis.get(
        "emotion",
        "neutral",
    )

    frustration_level = latest_analysis.get(
        "frustration_level",
        0,
    )

    satisfaction_trend = latest_analysis.get(
        "satisfaction_trend",
        "Stable",
    )

    escalation_risk = (
        conversation_row.escalation_risk
        or "Low"
    )

    resolution_status = (
        conversation_row.resolution_status
        or "Unresolved"
    )

    session_status = (
        session_row.status
        or "In Progress"
    )

    is_resolved = (
        resolution_status
        == "Resolved"
    )

    is_escalated = (
        resolution_status
        == "Escalated"
    )

    # --------------------------------------------------------
    # BUILD TASK 8 SUMMARY
    # --------------------------------------------------------

    summary = build_post_interaction_summary(
        conversation_history=conversation_history,
        intent=intent,
        sentiment=sentiment,
        emotion=emotion,
        frustration_level=frustration_level,
        satisfaction_trend=satisfaction_trend,
        escalation_risk=escalation_risk,
        resolution_status=resolution_status,
        session_status=session_status,
        is_resolved=is_resolved,
        is_escalated=is_escalated,
    )

    # --------------------------------------------------------
    # RETURN TASK 8 RESPONSE
    # --------------------------------------------------------

    return {
        "session_id": session_id,
        "status": session_row.status,
        "summary": summary,
    }