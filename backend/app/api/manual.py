from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
)

from app.services.analysis_service import analyze_customer_message
from app.services.coaching_service import generate_coaching
from app.services.escalation_service import calculate_escalation_risk
from app.services.knowledge_recommendation_service import (
    recommend_knowledge,
)


router = APIRouter(
    prefix="/api",
    tags=["Manual Mode"],
)


# ============================================================================
# REQUEST / RESPONSE MODELS
# ============================================================================


class ManualAnalyzeRequest(BaseModel):
    """
    Manual Mode request.

    The frontend may send either camelCase or snake_case names.
    """

    model_config = ConfigDict(
        populate_by_name=True,
    )

    customer_message: str = Field(
        ...,
        min_length=1,
        validation_alias=AliasChoices(
            "customerMessage",
            "message",
            "customer_message",
        ),
        description="Current customer message.",
    )

    conversation_history: list[dict[str, Any]] = Field(
        default_factory=list,
        validation_alias=AliasChoices(
            "conversationHistory",
            "conversation_history",
        ),
        description=(
            "Previous completed conversation messages. "
            "Messages must alternate between customer and support agent."
        ),
    )

    last_agent_message: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "lastAgentMessage",
            "last_agent_message",
        ),
        description=(
            "Optional latest support-agent response. "
            "Used when the frontend keeps it separately from history."
        ),
    )


class ManualAnalyzeResponse(BaseModel):
    customer_message: str
    analysis: dict[str, Any]
    escalation: dict[str, Any]
    coaching: dict[str, Any]
    knowledge_recommendations: list[dict[str, Any]]
    knowledge_message: str


# ============================================================================
# NORMALIZATION HELPERS
# ============================================================================


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""

    return str(value).strip()


def _get_sender(message: dict[str, Any]) -> str:
    sender = (
        message.get("sender_type")
        or message.get("sender")
        or message.get("role")
        or ""
    )

    return _normalize_text(sender).lower()


def _get_message_text(message: dict[str, Any]) -> str:
    value = (
        message.get("message_text")
        or message.get("message")
        or message.get("text")
        or message.get("content")
        or ""
    )

    return _normalize_text(value)


def _is_customer_message(message: dict[str, Any]) -> bool:
    sender = _get_sender(message)

    return (
        "customer" in sender
        or sender in {
            "user",
            "client",
            "customer_message",
        }
    )


def _is_agent_message(message: dict[str, Any]) -> bool:
    sender = _get_sender(message)

    return (
        "agent" in sender
        or "support" in sender
        or sender in {
            "assistant",
            "representative",
            "rep",
            "staff",
        }
    )


# ============================================================================
# CONVERSATION NORMALIZATION
# ============================================================================


def _normalize_conversation_history(
    conversation_history: list[dict[str, Any]],
) -> list[dict[str, str]]:
    """
    Normalize frontend conversation objects into:

        {
            "sender_type": "customer" | "agent",
            "message_text": "..."
        }

    Unknown sender types are ignored rather than being guessed.
    """

    normalized: list[dict[str, str]] = []

    for item in conversation_history:
        if not isinstance(item, dict):
            continue

        text = _get_message_text(item)

        if not text:
            continue

        if _is_customer_message(item):
            sender_type = "customer"

        elif _is_agent_message(item):
            sender_type = "agent"

        else:
            # Do not hallucinate a sender.
            continue

        normalized.append(
            {
                "sender_type": sender_type,
                "message_text": text,
            }
        )

    return normalized


def _build_full_conversation(
    current_message: str,
    conversation_history: list[dict[str, Any]],
    last_agent_message: str | None,
) -> list[dict[str, str]]:
    """
    Build the complete conversation.

    IMPORTANT:

    A new customer message is appended only after the previous
    conversation has an agent response.

    This gives Manual Mode the same turn structure as Simulator:

        Turn 1
        Customer
        Support Agent

        Turn 2
        Customer
        Support Agent

        Turn 3
        Customer
        Support Agent

    The current agent response is NOT invented here.
    """

    normalized = _normalize_conversation_history(
        conversation_history
    )

    if last_agent_message:
        agent_text = _normalize_text(
            last_agent_message
        )

        if agent_text:
            already_exists = any(
                item["sender_type"] == "agent"
                and item["message_text"] == agent_text
                for item in normalized
            )

            if not already_exists:
                normalized.append(
                    {
                        "sender_type": "agent",
                        "message_text": agent_text,
                    }
                )

    # ------------------------------------------------------------------
    # TURN VALIDATION
    # ------------------------------------------------------------------

    if normalized:
        last_sender = normalized[-1]["sender_type"]

        if last_sender == "customer":
            raise HTTPException(
                status_code=409,
                detail=(
                    "The previous customer message has not received "
                    "a support-agent response yet. Manual Mode requires "
                    "Customer → Support Agent before the next customer turn."
                ),
            )

    normalized.append(
        {
            "sender_type": "customer",
            "message_text": current_message,
        }
    )

    return normalized


# ============================================================================
# MESSAGE EXTRACTION
# ============================================================================


def _customer_messages(
    conversation: list[dict[str, str]],
) -> list[str]:
    return [
        item["message_text"]
        for item in conversation
        if item["sender_type"] == "customer"
    ]


def _agent_messages(
    conversation: list[dict[str, str]],
) -> list[str]:
    return [
        item["message_text"]
        for item in conversation
        if item["sender_type"] == "agent"
    ]


def _current_customer_message(
    conversation: list[dict[str, str]],
) -> str:
    for item in reversed(conversation):
        if item["sender_type"] == "customer":
            return item["message_text"]

    return ""


# ============================================================================
# PHRASE MATCHING
# ============================================================================


def _contains_any(
    text: str,
    phrases: list[str],
) -> bool:
    lowered = text.lower()

    return any(
        phrase.lower() in lowered
        for phrase in phrases
    )


def _count_matching_messages(
    messages: list[str],
    phrases: list[str],
) -> int:
    count = 0

    for message in messages:
        if _contains_any(
            message,
            phrases,
        ):
            count += 1

    return count


# ============================================================================
# REAL-WORLD CUSTOMER SIGNALS
# ============================================================================


URGENCY_PHRASES = [
    "immediately",
    "right now",
    "as soon as possible",
    "urgent",
    "urgently",
    "need it now",
    "need my money",
    "want my money back",
    "give me my money",
    "refund now",
    "fix this now",
]


FRUSTRATION_PHRASES = [
    "what the hell",
    "what are you saying",
    "what are you talking about",
    "this makes no sense",
    "this is ridiculous",
    "this is frustrating",
    "frustrated",
    "annoyed",
    "upset",
    "angry",
    "fed up",
    "not helping",
    "you are not helping",
    "you're not helping",
    "why are you",
    "why don't you",
    "why dont you",
    "how many times",
    "i already told you",
    "i told you",
    "i have already told you",
]


HOSTILE_PHRASES = [
    "idiot",
    "stupid",
    "fool",
    "useless",
    "shut up",
    "worst",
    "damn",
    "wtf",
]


ESCALATION_PHRASES = [
    "supervisor",
    "manager",
    "human",
    "human agent",
    "escalate",
    "escalation",
    "contact someone",
    "contact your manager",
    "contact supervisor",
    "speak to a supervisor",
    "speak to manager",
]


UNRESOLVED_PHRASES = [
    "still",
    "not resolved",
    "hasn't been resolved",
    "has not been resolved",
    "not fixed",
    "not fixed yet",
    "waiting",
    "haven't received",
    "have not received",
    "nothing happened",
    "no one is helping",
    "nobody is helping",
    "not helping",
]


REPEATED_REQUEST_PHRASES = [
    "again",
    "already asked",
    "asked twice",
    "twice",
    "multiple times",
    "several times",
    "i told you",
    "i already told you",
    "already contacted",
]


POOR_AGENT_RESPONSE_PHRASES = [
    "you will have to wait",
    "there is nothing i can do",
    "nothing i can do",
    "can't help",
    "cannot help",
    "not my problem",
    "you need to wait",
    "just wait",
    "nothing we can do",
    "no idea",
    "i don't know",
]


NEGATIVE_PHRASES = [
    "frustrated",
    "frustrating",
    "angry",
    "upset",
    "disappointed",
    "annoyed",
    "unhappy",
    "ridiculous",
    "terrible",
    "awful",
    "bad",
    "hate",
    "not helping",
    "not resolved",
    "not fixed",
    "what the hell",
]


# ============================================================================
# CONVERSATION CONTEXT
# ============================================================================


def _detect_customer_context(
    conversation: list[dict[str, str]],
) -> dict[str, Any]:
    """
    Detect observable conversation signals.

    No assumptions are made about the customer's internal state.
    Only explicit conversation evidence is used.
    """

    customers = _customer_messages(
        conversation
    )

    agents = _agent_messages(
        conversation
    )

    current_message = _current_customer_message(
        conversation
    )

    customer_text = " ".join(
        customers
    ).lower()

    agent_text = " ".join(
        agents
    ).lower()

    current_lower = current_message.lower()

    repeated_request_count = _count_matching_messages(
        customers,
        REPEATED_REQUEST_PHRASES,
    )

    unresolved_count = _count_matching_messages(
        customers,
        UNRESOLVED_PHRASES,
    )

    urgency_count = _count_matching_messages(
        customers,
        URGENCY_PHRASES,
    )

    frustration_count = _count_matching_messages(
        customers,
        FRUSTRATION_PHRASES,
    )

    hostile_count = _count_matching_messages(
        customers,
        HOSTILE_PHRASES,
    )

    escalation_count = _count_matching_messages(
        customers,
        ESCALATION_PHRASES,
    )

    negative_count = _count_matching_messages(
        customers,
        NEGATIVE_PHRASES,
    )

    previous_poor_agent_response = (
        _count_matching_messages(
            agents,
            POOR_AGENT_RESPONSE_PHRASES,
        )
    )

    current_has_urgency = _contains_any(
        current_lower,
        URGENCY_PHRASES,
    )

    current_has_frustration = _contains_any(
        current_lower,
        FRUSTRATION_PHRASES,
    )

    current_has_hostility = _contains_any(
        current_lower,
        HOSTILE_PHRASES,
    )

    current_has_escalation = _contains_any(
        current_lower,
        ESCALATION_PHRASES,
    )

    current_is_negative = _contains_any(
        current_lower,
        NEGATIVE_PHRASES,
    )

    return {
        "customer_turn_count": len(customers),
        "agent_turn_count": len(agents),

        "repeated_request_count": repeated_request_count,
        "unresolved_count": unresolved_count,
        "urgency_count": urgency_count,
        "frustration_count": frustration_count,
        "hostile_count": hostile_count,
        "escalation_count": escalation_count,
        "negative_count": negative_count,

        "previous_poor_agent_response_count": (
            previous_poor_agent_response
        ),

        "previous_poor_agent_response": (
            previous_poor_agent_response > 0
        ),

        "current_has_urgency": current_has_urgency,
        "current_has_frustration": current_has_frustration,
        "current_has_hostility": current_has_hostility,
        "current_has_escalation": current_has_escalation,
        "current_is_negative": current_is_negative,

        "has_urgent_request": (
            urgency_count > 0
        ),

        "has_hostile_language": (
            hostile_count > 0
        ),

        "has_escalation_request": (
            escalation_count > 0
        ),

        "has_negative_context": (
            negative_count > 0
            or hostile_count > 0
        ),

        "has_repeated_unresolved_issue": (
            repeated_request_count > 0
            or unresolved_count >= 2
        ),

        "current_is_resolved": (
            _contains_any(
                current_lower,
                [
                    "thank",
                    "resolved",
                    "confirmed",
                    "appreciate",
                    "fixed",
                    "helpful",
                    "satisfied",
                    "great",
                ],
            )
            and not _contains_any(
                current_lower,
                [
                    "not resolved",
                    "still not",
                    "still haven't",
                    "still have not",
                    "unresolved",
                    "no one is helping",
                    "nobody is helping",
                ],
            )
        ),

        "customer_text": customer_text,
        "agent_text": agent_text,
    }


# ============================================================================
# FRUSTRATION / SENTIMENT CORRECTION
# ============================================================================


def _calculate_conversation_frustration(
    analysis: dict[str, Any],
    context: dict[str, Any],
) -> int:
    """
    Calculate a conversation-aware frustration score.

    The model's score is used as a baseline, but explicit observable
    conversation evidence can increase it.

    The purpose is NOT to manufacture emotion.

    The purpose is to prevent an obviously low semantic score from
    erasing strong signals explicitly present in the conversation.
    """

    try:
        model_score = float(
            analysis.get(
                "frustration_level",
                0,
            )
            or 0
        )
    except (
        TypeError,
        ValueError,
    ):
        model_score = 0.0

    model_score = max(
        0.0,
        min(
            model_score,
            10.0,
        ),
    )

    score = model_score

    # ------------------------------------------------------------------
    # CURRENT-TURN SIGNALS
    # ------------------------------------------------------------------

    if context["current_has_frustration"]:
        score = max(
            score,
            4.0,
        )

    if context["current_is_negative"]:
        score = max(
            score,
            4.0,
        )

    if context["current_has_urgency"]:
        score = max(
            score,
            5.0,
        )

    if context["current_has_escalation"]:
        score = max(
            score,
            6.0,
        )

    if context["current_has_hostility"]:
        score = max(
            score,
            7.0,
        )

    # ------------------------------------------------------------------
    # CUMULATIVE CONVERSATION SIGNALS
    # ------------------------------------------------------------------

    if context["has_repeated_unresolved_issue"]:
        score += 1.0

    if context["previous_poor_agent_response"]:
        score += 1.0

    if context["has_urgent_request"]:
        score += 0.5

    if context["has_escalation_request"]:
        score += 1.0

    if context["negative_count"] >= 2:
        score += 0.5

    if context["frustration_count"] >= 2:
        score += 0.5

    # ------------------------------------------------------------------
    # CONVERSATION TRAJECTORY
    #
    # More customer complaints over successive turns should not be
    # treated as isolated messages.
    # ------------------------------------------------------------------

    negative_customer_turns = sum(
        1
        for customer_message in _customer_messages_from_context(
            context
        )
        if _contains_any(
            customer_message,
            NEGATIVE_PHRASES
            + FRUSTRATION_PHRASES
            + HOSTILE_PHRASES
            + ESCALATION_PHRASES
            + URGENCY_PHRASES,
        )
    )

    if negative_customer_turns >= 2:
        score += 0.5

    if negative_customer_turns >= 3:
        score += 0.5

    return int(
        max(
            0,
            min(
                round(score),
                10,
            ),
        )
    )


def _customer_messages_from_context(
    context: dict[str, Any],
) -> list[str]:
    """
    Context stores the complete customer text for diagnostics.

    This helper intentionally returns message-level information only
    when it has been supplied by _detect_customer_context.
    """

    raw_messages = context.get(
        "customer_messages",
        [],
    )

    if isinstance(
        raw_messages,
        list,
    ):
        return [
            _normalize_text(message)
            for message in raw_messages
            if _normalize_text(message)
        ]

    return []


def _detect_trajectory(
    conversation: list[dict[str, str]],
) -> dict[str, Any]:
    """
    Calculate customer-message trajectory from the actual messages.

    This is separate from sentiment classification so the system can
    distinguish a single negative message from repeated deterioration.
    """

    customers = _customer_messages(
        conversation
    )

    signals: list[int] = []

    for message in customers:
        message_lower = message.lower()

        message_score = 0

        if _contains_any(
            message_lower,
            NEGATIVE_PHRASES,
        ):
            message_score += 1

        if _contains_any(
            message_lower,
            FRUSTRATION_PHRASES,
        ):
            message_score += 2

        if _contains_any(
            message_lower,
            URGENCY_PHRASES,
        ):
            message_score += 1

        if _contains_any(
            message_lower,
            ESCALATION_PHRASES,
        ):
            message_score += 2

        if _contains_any(
            message_lower,
            HOSTILE_PHRASES,
        ):
            message_score += 3

        signals.append(
            message_score
        )

    if len(signals) >= 2:
        previous = signals[-2]
        current = signals[-1]

        if current > previous:
            trajectory = "Worsening"

        elif current < previous:
            trajectory = "Improving"

        else:
            trajectory = "Stable"

    else:
        trajectory = "Stable"

    return {
        "scores": signals,
        "latest_signal": (
            signals[-1]
            if signals
            else 0
        ),
        "trajectory": trajectory,
    }


# ============================================================================
# CUMULATIVE ANALYSIS
# ============================================================================


def _apply_cumulative_analysis(
    analysis: dict[str, Any],
    context: dict[str, Any],
    conversation: list[dict[str, str]],
) -> dict[str, Any]:
    """
    Apply conversation-aware corrections to Task 4.

    The semantic model remains the base classifier.

    Deterministic corrections are only applied when observable
    conversation evidence supports them.
    """

    result = dict(
        analysis
    )

    current_sentiment = _normalize_text(
        result.get("sentiment")
    ).lower()

    current_emotion = _normalize_text(
        result.get("emotion")
    ).lower()

    # ------------------------------------------------------------------
    # FRUSTRATION
    # ------------------------------------------------------------------

    # Make the context available to the scoring helper.
    customer_messages = _customer_messages(
        conversation
    )

    context["customer_messages"] = (
        customer_messages
    )

    frustration = _calculate_conversation_frustration(
        analysis=result,
        context=context,
    )

    result["frustration_level"] = frustration

    # ------------------------------------------------------------------
    # SENTIMENT
    # ------------------------------------------------------------------

    if context.get("current_is_resolved"):
        result["sentiment"] = "Positive" if current_sentiment != "negative" else "Neutral"

    elif (
        context["current_has_hostility"]
        or context["current_has_frustration"]
        or context["current_is_negative"]
    ):
        result["sentiment"] = "Negative"

    elif (
        context["has_negative_context"]
        or context["has_repeated_unresolved_issue"]
        or context["has_urgent_request"]
        or context["has_escalation_request"]
    ):
        result["sentiment"] = "Negative"

    elif current_sentiment in {
        "negative",
        "very_negative",
    }:
        result["sentiment"] = "Negative"

    elif current_sentiment in {
        "positive",
        "very_positive",
    }:
        result["sentiment"] = "Positive"

    else:
        result["sentiment"] = "Neutral"

    # ------------------------------------------------------------------
    # EMOTION
    # ------------------------------------------------------------------

    if context.get("current_is_resolved"):
        result["emotion"] = "satisfied" if current_emotion in {"frustrated", "angry"} else (current_emotion or "neutral")

    elif context["current_has_hostility"]:
        result["emotion"] = "angry"

    elif (
        context["current_has_frustration"]
        or context["current_is_negative"]
        or context["has_repeated_unresolved_issue"]
        or context["has_escalation_request"]
        or context["has_urgent_request"]
    ):
        result["emotion"] = "frustrated"

    elif current_emotion:
        result["emotion"] = current_emotion

    else:
        result["emotion"] = "neutral"

    # ------------------------------------------------------------------
    # SATISFACTION TREND
    # ------------------------------------------------------------------

    trajectory = _detect_trajectory(
        conversation
    )

    if context.get("current_is_resolved") or trajectory["trajectory"] == "Improving":
        result["satisfaction_trend"] = (
            "Improving"
        )

    elif trajectory["trajectory"] == "Worsening":
        result["satisfaction_trend"] = (
            "Declining"
        )

    elif (
        context["has_repeated_unresolved_issue"]
        or context["previous_poor_agent_response"]
        or context["has_escalation_request"]
    ):
        result["satisfaction_trend"] = (
            "Declining"
        )

    elif trajectory["trajectory"] == "Improving":
        result["satisfaction_trend"] = (
            "Improving"
        )

    else:
        existing_trend = _normalize_text(
            result.get(
                "satisfaction_trend"
            )
        )

        if existing_trend in {
            "Improving",
            "Declining",
            "Stable",
        }:
            result["satisfaction_trend"] = (
                existing_trend
            )
        else:
            result["satisfaction_trend"] = (
                "Stable"
            )

    # ------------------------------------------------------------------
    # CONVERSATION CONTEXT
    # ------------------------------------------------------------------

    result["conversation_context"] = {
        "customer_turn_count": context[
            "customer_turn_count"
        ],
        "agent_turn_count": context[
            "agent_turn_count"
        ],
        "repeated_request": (
            context["repeated_request_count"] > 0
        ),
        "unresolved_issue": (
            context["unresolved_count"] > 0
        ),
        "previous_poor_agent_response": context[
            "previous_poor_agent_response"
        ],
        "urgent_request": (
            context["has_urgent_request"]
        ),
        "hostile_language": (
            context["has_hostile_language"]
        ),
        "escalation_requested": (
            context["has_escalation_request"]
        ),
        "frustration_signal_count": context[
            "frustration_count"
        ],
        "negative_signal_count": context[
            "negative_count"
        ],
    }

    # ------------------------------------------------------------------
    # CONFIDENCE
    # ------------------------------------------------------------------

    try:
        confidence = float(
            result.get(
                "confidence",
                0,
            )
            or 0
        )
    except (
        TypeError,
        ValueError,
    ):
        confidence = 0.0

    result["confidence"] = max(
        0.0,
        min(
            round(
                confidence,
                2,
            ),
            1.0,
        ),
    )

    return result


# ============================================================================
# ESCALATION CORRECTION
# ============================================================================


def _apply_cumulative_escalation(
    escalation: dict[str, Any],
    analysis: dict[str, Any],
    context: dict[str, Any],
) -> dict[str, Any]:
    """
    Apply conversation evidence to the escalation result.

    Escalation is based on explicit observable signals, not guesses.
    """

    result = dict(
        escalation
    )

    try:
        risk_score = int(
            result.get(
                "risk_score",
                0,
            )
            or 0
        )
    except (
        TypeError,
        ValueError,
    ):
        risk_score = 0

    frustration = int(
        analysis.get(
            "frustration_level",
            0,
        )
        or 0
    )

    # ------------------------------------------------------------------
    # EVIDENCE-BASED MINIMUMS
    # ------------------------------------------------------------------

    if context.get("current_is_resolved"):
        risk_score = min(risk_score, 2)
    else:
        if context["current_has_frustration"]:
            risk_score = max(
                risk_score,
                5,
            )

        if context["has_urgent_request"]:
            risk_score = max(
                risk_score,
                6,
            )

        if context["has_repeated_unresolved_issue"]:
            risk_score = max(
                risk_score,
                6,
            )

        if context["has_escalation_request"]:
            risk_score = max(
                risk_score,
                7,
            )

        if context["previous_poor_agent_response"]:
            risk_score = max(
                risk_score,
                7,
            )

        if context["has_hostile_language"]:
            risk_score = max(
                risk_score,
                8,
            )

        if frustration >= 8:
            risk_score = max(
                risk_score,
                8,
            )

    risk_score = max(
        0,
        min(
            risk_score,
            10,
        ),
    )

    # ------------------------------------------------------------------
    # RISK LEVEL
    # ------------------------------------------------------------------

    if risk_score >= 9:
        risk_level = "Critical"

    elif risk_score >= 7:
        risk_level = "High"

    elif risk_score >= 4:
        risk_level = "Medium"

    else:
        risk_level = "Low"

    # ------------------------------------------------------------------
    # REASONS
    # ------------------------------------------------------------------

    reasons = list(
        result.get(
            "reasons"
        )
        or []
    )

    if context.get("current_is_resolved"):
        reasons = ["Customer acknowledged resolution and de-escalated."]
    else:
        if (
            context["current_has_frustration"]
            and "Customer frustration is increasing." not in reasons
        ):
            reasons.append(
                "Customer frustration is increasing."
            )

        if (
            context["has_negative_context"]
            and "Customer sentiment is negative." not in reasons
        ):
            reasons.append(
                "Customer sentiment is negative."
            )

        if (
            context["has_urgent_request"]
            and "Customer is making an urgent resolution request."
            not in reasons
        ):
            reasons.append(
                "Customer is making an urgent resolution request."
            )

        if (
            context["has_escalation_request"]
            and "Customer explicitly requested escalation or human assistance."
            not in reasons
        ):
            reasons.append(
                "Customer explicitly requested escalation or human assistance."
            )

        if (
            context["has_repeated_unresolved_issue"]
            and "Previous customer messages indicate an unresolved issue."
            not in reasons
        ):
            reasons.append(
                "Previous customer messages indicate an unresolved issue."
            )

        if (
            context["previous_poor_agent_response"]
            and "Previous support response did not provide an effective resolution."
            not in reasons
        ):
            reasons.append(
                "Previous support response did not provide an effective resolution."
            )

        if (
            context["has_hostile_language"]
            and "Customer used hostile language during the conversation."
            not in reasons
        ):
            reasons.append(
                "Customer used hostile language during the conversation."
            )

    # ------------------------------------------------------------------
    # FINAL ESCALATION RESPONSE
    # ------------------------------------------------------------------

    result["risk_score"] = risk_score
    result["risk_level"] = risk_level
    result["reasons"] = reasons

    result["alert"] = (
        risk_score >= 7
    )

    result["critical_alert"] = (
        risk_score >= 9
    )

    if risk_level == "Critical":
        result["recommended_action"] = (
            "Acknowledge the customer's frustration, "
            "take ownership, provide the verified resolution path, "
            "and prepare for immediate human escalation."
        )

    elif risk_level == "High":
        result["recommended_action"] = (
            "Acknowledge the customer's frustration, "
            "take ownership of the unresolved issue, "
            "provide a verified resolution path, "
            "and prepare for human escalation if needed."
        )

    elif risk_level == "Medium":
        result["recommended_action"] = (
            "Use empathetic language, address the unresolved issue "
            "directly, provide a clear verified resolution path, "
            "and monitor the next customer response."
        )

    else:
        result["recommended_action"] = (
            "Continue the normal support flow and monitor the "
            "conversation for changes in sentiment, frustration, "
            "or escalation risk."
        )

    return result


# ============================================================================
# MANUAL MODE - MULTI-TURN ANALYSIS ENDPOINT
# ============================================================================


@router.post(
    "/analyze-turn",
    response_model=ManualAnalyzeResponse,
    summary="Analyze Manual Mode customer turn",
    description=(
        "Analyzes one customer turn using the complete completed "
        "conversation. Manual Mode follows the sequence "
        "Customer → Support Agent → Customer → Support Agent."
    ),
)
def analyze_manual_turn(
    request: ManualAnalyzeRequest,
):
    message = _normalize_text(
        request.customer_message
    )

    if not message:
        raise HTTPException(
            status_code=400,
            detail=(
                "Customer message cannot be empty."
            ),
        )

    # ------------------------------------------------------------------
    # BUILD COMPLETE CONVERSATION
    # ------------------------------------------------------------------

    full_conversation = _build_full_conversation(
        current_message=message,
        conversation_history=(
            request.conversation_history
            or []
        ),
        last_agent_message=(
            request.last_agent_message
        ),
    )

    # ------------------------------------------------------------------
    # CONVERSATION CONTEXT
    # ------------------------------------------------------------------

    conversation_context = _detect_customer_context(
        full_conversation
    )

    # ------------------------------------------------------------------
    # TASK 4 - BASE ANALYSIS
    # ------------------------------------------------------------------

    analysis = analyze_customer_message(
        message=message,
        conversation_history=full_conversation,
    )

    if not isinstance(
        analysis,
        dict,
    ):
        raise HTTPException(
            status_code=500,
            detail=(
                "Task 4 analysis service returned "
                "an invalid response."
            ),
        )

    # ------------------------------------------------------------------
    # TASK 4 - CUMULATIVE CORRECTION
    # ------------------------------------------------------------------

    analysis = _apply_cumulative_analysis(
        analysis=analysis,
        context=conversation_context,
        conversation=full_conversation,
    )

    # ------------------------------------------------------------------
    # TASK 5 - KNOWLEDGE RECOMMENDATIONS
    # ------------------------------------------------------------------

    knowledge_result = recommend_knowledge(
        message=message,
        conversation_history=full_conversation,
        number_of_recommendations=3,
    )

    if not isinstance(
        knowledge_result,
        dict,
    ):
        raise HTTPException(
            status_code=500,
            detail=(
                "Knowledge recommendation service "
                "returned an invalid response."
            ),
        )

    knowledge_recommendations = (
        knowledge_result.get(
            "recommendations",
            [],
        )
    )

    knowledge_message = (
        knowledge_result.get(
            "message",
            "",
        )
    )

    if not isinstance(
        knowledge_recommendations,
        list,
    ):
        knowledge_recommendations = []

    analysis["knowledge_recommendations"] = (
        knowledge_recommendations
    )

    analysis["knowledge_message"] = (
        knowledge_message
    )

    # ------------------------------------------------------------------
    # TASK 6 - ESCALATION
    # ------------------------------------------------------------------

    escalation_result = calculate_escalation_risk(
        message=message,
        frustration_level=analysis.get(
            "frustration_level",
            0,
        ),
        sentiment=analysis.get(
            "sentiment",
            "Neutral",
        ),
        conversation_history=full_conversation,
    )

    if not isinstance(
        escalation_result,
        dict,
    ):
        raise HTTPException(
            status_code=500,
            detail=(
                "Task 6 escalation service returned "
                "an invalid response."
            ),
        )

    escalation_result = _apply_cumulative_escalation(
        escalation=escalation_result,
        analysis=analysis,
        context=conversation_context,
    )

    # ------------------------------------------------------------------
    # KEEP ANALYSIS AND ESCALATION CONSISTENT
    # ------------------------------------------------------------------

    analysis["escalation_risk"] = (
        escalation_result.get(
            "risk_level",
            "Low",
        )
    )

    analysis["escalation_risk_score"] = (
        escalation_result.get(
            "risk_score",
            0,
        )
    )

    analysis["escalation_risk_threshold"] = (
        escalation_result.get(
            "risk_threshold",
            7,
        )
    )

    analysis["critical_threshold"] = (
        escalation_result.get(
            "critical_threshold",
            9,
        )
    )

    analysis["escalation_reasons"] = (
        escalation_result.get(
            "reasons",
            [],
        )
    )

    analysis["escalation_recommended_action"] = (
        escalation_result.get(
            "recommended_action",
            "",
        )
    )

    analysis["escalation_alert"] = (
        escalation_result.get(
            "alert",
            False,
        )
    )

    analysis["critical_alert"] = (
        escalation_result.get(
            "critical_alert",
            False,
        )
    )

    # ------------------------------------------------------------------
    # TASK 6 - COACHING
    # ------------------------------------------------------------------

    coaching_result = generate_coaching(
        message=message,
        intent=analysis.get(
            "intent",
            "general_inquiry",
        ),
        emotion=analysis.get(
            "emotion",
            "neutral",
        ),
        sentiment=analysis.get(
            "sentiment",
            "Neutral",
        ),
        frustration_level=int(
            analysis.get(
                "frustration_level",
                0,
            )
        ),
        escalation_risk=escalation_result.get(
            "risk_level",
            "Low",
        ),
        conversation_history=full_conversation,
        knowledge_recommendations=(
            knowledge_recommendations
        ),
    )

    if not isinstance(
        coaching_result,
        dict,
    ):
        raise HTTPException(
            status_code=500,
            detail=(
                "Task 6 coaching service returned "
                "an invalid response."
            ),
        )

    # ------------------------------------------------------------------
    # FINAL RESPONSE
    # ------------------------------------------------------------------

    return {
        "customer_message": message,
        "analysis": analysis,
        "escalation": escalation_result,
        "coaching": coaching_result,
        "knowledge_recommendations": (
            knowledge_recommendations
        ),
        "knowledge_message": knowledge_message,
    }