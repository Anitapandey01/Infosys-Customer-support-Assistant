"""
Task 8 - Post-Interaction Summary and Performance Report Service.

Builds a structured post-interaction summary from the completed
customer-support conversation without changing Tasks 4-7.
"""

from __future__ import annotations

from typing import Any


# ============================================================
# TASK 8 - SUPPORTED VALUES
# ============================================================

SUPPORTED_OUTCOMES = {
    "Resolved",
    "Escalated",
    "Unresolved",
}

SUPPORTED_RISK_LEVELS = {
    "Low",
    "Medium",
    "High",
    "Critical",
}


# ============================================================
# TEXT HELPERS
# ============================================================

def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _normalize_text(value: Any) -> str:
    return " ".join(
        _clean_text(value).lower().split()
    )


def _safe_int(
    value: Any,
    default: int = 0,
) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(
    value: Any,
    default: float = 0.0,
) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


# ============================================================
# MESSAGE HELPERS
# ============================================================

def _customer_messages(
    conversation_history: list[dict[str, Any]] | None,
) -> list[str]:

    if not conversation_history:
        return []

    messages: list[str] = []

    for item in conversation_history:
        sender_type = _normalize_text(
            item.get("sender_type")
        )

        message_text = _clean_text(
            item.get("message_text")
        )

        if (
            sender_type in {
                "customer",
                "ai_customer",
                "user",
            }
            and message_text
        ):
            messages.append(message_text)

    return messages


def _agent_messages(
    conversation_history: list[dict[str, Any]] | None,
) -> list[str]:

    if not conversation_history:
        return []

    messages: list[str] = []

    for item in conversation_history:
        sender_type = _normalize_text(
            item.get("sender_type")
        )

        message_text = _clean_text(
            item.get("message_text")
        )

        if (
            sender_type in {
                "support agent",
                "agent",
                "assistant",
            }
            and message_text
        ):
            messages.append(message_text)

    return messages


# ============================================================
# OUTCOME
# ============================================================

def determine_interaction_outcome(
    resolution_status: str | None = None,
    session_status: str | None = None,
    is_resolved: bool = False,
    is_escalated: bool = False,
) -> str:

    if is_resolved:
        return "Resolved"

    if is_escalated:
        return "Escalated"

    normalized_resolution = _normalize_text(
        resolution_status
    )

    normalized_session = _normalize_text(
        session_status
    )

    if normalized_resolution == "resolved":
        return "Resolved"

    if normalized_resolution == "escalated":
        return "Escalated"

    if normalized_session == "completed":
        if normalized_resolution == "unresolved":
            return "Unresolved"

    return "Unresolved"


# ============================================================
# PERFORMANCE SCORE
# ============================================================

def calculate_performance_score(
    communication_score: float = 0.0,
    resolution_score: float = 0.0,
    empathy_score: float = 0.0,
    knowledge_score: float = 0.0,
) -> dict[str, Any]:

    scores = {
        "communication": max(
            0.0,
            min(100.0, _safe_float(communication_score)),
        ),
        "resolution": max(
            0.0,
            min(100.0, _safe_float(resolution_score)),
        ),
        "empathy": max(
            0.0,
            min(100.0, _safe_float(empathy_score)),
        ),
        "knowledge": max(
            0.0,
            min(100.0, _safe_float(knowledge_score)),
        ),
    }

    overall_score = round(
        (
            scores["communication"]
            + scores["resolution"]
            + scores["empathy"]
            + scores["knowledge"]
        )
        / 4,
        2,
    )

    return {
        **scores,
        "overall": overall_score,
    }


# ============================================================
# SUMMARY
# ============================================================

def build_post_interaction_summary(
    conversation_history: list[dict[str, Any]] | None = None,
    intent: str = "general_inquiry",
    sentiment: str = "Neutral",
    emotion: str = "neutral",
    frustration_level: int = 0,
    satisfaction_trend: str = "Stable",
    escalation_risk: str = "Low",
    resolution_status: str | None = None,
    session_status: str | None = None,
    is_resolved: bool = False,
    is_escalated: bool = False,
) -> dict[str, Any]:

    customer_messages = _customer_messages(
        conversation_history
    )

    agent_messages = _agent_messages(
        conversation_history
    )

    outcome = determine_interaction_outcome(
        resolution_status=resolution_status,
        session_status=session_status,
        is_resolved=is_resolved,
        is_escalated=is_escalated,
    )

    frustration = max(
        0,
        min(
            10,
            _safe_int(frustration_level),
        ),
    )

    normalized_risk = _clean_text(
        escalation_risk
    )

    if normalized_risk not in SUPPORTED_RISK_LEVELS:
        normalized_risk = "Low"

    return {
        "interaction_summary": {
            "intent": _clean_text(intent),
            "emotion": _clean_text(emotion),
            "sentiment": _clean_text(sentiment),
            "frustration_level": frustration,
            "satisfaction_trend": _clean_text(
                satisfaction_trend
            ),
            "escalation_risk": normalized_risk,
            "outcome": outcome,
        },
        "conversation_metrics": {
            "total_messages": len(
                conversation_history or []
            ),
            "customer_messages": len(
                customer_messages
            ),
            "agent_messages": len(
                agent_messages
            ),
        },
        "performance_score": calculate_performance_score(),
    }