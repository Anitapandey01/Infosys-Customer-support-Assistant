"""
Task 8 - Post-Interaction Summary & Performance Analytics API Router.

Provides endpoints for session completion, post-interaction report generation,
and aggregated performance analytics.
"""

from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DBSession

from app.models.database import SessionLocal
from app.models.simulator import Session, SessionSummary
from app.services.summary_service import (
    generate_session_summary,
    generate_conversation_summary,
)
from app.services.analytics_service import (
    calculate_performance_analytics,
)

router = APIRouter(
    prefix="/api",
    tags=["Task 8 - Summary & Analytics"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================================================
# REQUEST MODELS
# ============================================================================

class CompleteSessionRequest(BaseModel):
    resolution_status: str | None = Field(
        default=None,
        description="Optional explicit final resolution status: Resolved, Unresolved, Escalated.",
    )


class AdhocSummaryRequest(BaseModel):
    messages: list[dict[str, Any]] = Field(
        ...,
        description="List of conversation messages between customer and agent.",
    )
    session_id: str | int | None = Field(
        default=None,
        description="Optional session identifier.",
    )
    scenario_title: str | None = Field(
        default=None,
        description="Optional title or category of scenario.",
    )
    resolution_status: str | None = Field(
        default=None,
        description="Optional initial/final status.",
    )


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/analytics/performance")
def get_performance_analytics_endpoint(
    db: DBSession = Depends(get_db),
):
    """
    Returns aggregated performance analytics across all sessions.
    """
    try:
        return calculate_performance_analytics(db)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to calculate performance analytics: {exc}",
        )


@router.get("/sessions/{session_id}/summary")
def get_session_summary_endpoint(
    session_id: int,
    db: DBSession = Depends(get_db),
):
    """
    Returns or computes the post-interaction summary for a session.
    """
    try:
        return generate_session_summary(session_id=session_id, db=db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate session summary: {exc}",
        )


@router.post("/sessions/{session_id}/complete")
def complete_session_endpoint(
    session_id: int,
    request: CompleteSessionRequest | None = None,
    db: DBSession = Depends(get_db),
):
    """
    Completes a support session, calculates post-interaction metrics, and persists the summary report.
    """
    override_status = request.resolution_status if request else None
    try:
        return generate_session_summary(
            session_id=session_id,
            db=db,
            override_status=override_status,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to complete session: {exc}",
        )


@router.post("/sessions/summary")
def generate_adhoc_summary_endpoint(
    request: AdhocSummaryRequest,
):
    """
    Generates a post-interaction summary for client-provided conversation messages
    (used for Manual Mode and Replay Mode).
    """
    try:
        return generate_conversation_summary(
            messages=request.messages,
            session_id=request.session_id,
            scenario_title=request.scenario_title,
            initial_status=request.resolution_status,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate adhoc conversation summary: {exc}",
        )


@router.get("/sessions/completed")
def get_completed_sessions_endpoint(
    db: DBSession = Depends(get_db),
):
    """
    Returns a list of all completed sessions and their high-level summary scores.
    """
    try:
        sessions = (
            db.query(Session)
            .filter(Session.status == "Completed")
            .order_by(Session.session_id.desc())
            .all()
        )
        summaries = db.query(SessionSummary).all()
        summary_map = {s.session_id: s for s in summaries if s.session_id is not None}

        result = []
        for s in sessions:
            summ = summary_map.get(s.session_id)
            result.append({
                "session_id": s.session_id,
                "scenario_title": summ.scenario_title if summ else "Simulator Session",
                "primary_issue": summ.primary_issue if summ else "General Inquiry",
                "resolution_status": summ.resolution_status if summ else "Resolved",
                "resolution_quality_score": (
                    summ.resolution_quality_score if summ else (s.overall_score or 75.0)
                ),
                "communication_quality": summ.communication_quality if summ else "Good",
                "created_at": (
                    summ.created_at.isoformat()
                    if summ and summ.created_at
                    else (s.end_time.isoformat() if s.end_time else None)
                ),
            })
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch completed sessions: {exc}",
        )
