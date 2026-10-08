"""
Task 8 - Post-Interaction Performance Report API.

Generates the final performance report after a customer-support
interaction.

This module consumes the completed conversation supplied by the
frontend and uses the existing Task 4 analysis and Task 8 summary
services. It does not modify the Task 4-7 APIs or database models.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.analysis_service import analyze_customer_message
from app.services.post_interaction_summary_service import (
    build_post_interaction_summary,
    calculate_performance_score,
)


router = APIRouter(
    prefix="/api",
    tags=["Post-Interaction Report"],
)


# ============================================================
# REQUEST MODELS
# ============================================================


class ReportMessage(BaseModel):
    sender_type: str = ""
    message_text: str = ""
    timestamp: Any = None
    message_type: str = "Text"

    class Config:
        extra = "allow"


class ReportRequest(BaseModel):
    scenario: dict[str, Any] = Field(
        default_factory=dict
    )

    messages: list[ReportMessage] = Field(
        default_factory=list
    )

    durationSeconds: int = 0

    coachingLevel: str = "Standard"


# ============================================================
# NORMALIZATION HELPERS
# ============================================================


def _normalize(value: Any) -> str:
    return " ".join(
        str(value or "").strip().lower().split()
    )


def _message_history(
    messages: list[ReportMessage],
) -> list[dict[str, Any]]:
    return [
        {
            "sender_type": message.sender_type,
            "message_text": message.message_text,
            "timestamp": message.timestamp,
            "message_type": message.message_type,
        }
        for message in messages
        if str(message.message_text or "").strip()
    ]


def _customer_messages(
    messages: list[ReportMessage],
) -> list[ReportMessage]:
    customer_types = {
        "customer",
        "ai customer",
        "ai_customer",
        "user",
        "client",
        "customer_message",
    }

    return [
        message
        for message in messages
        if _normalize(message.sender_type)
        in customer_types
        and str(message.message_text or "").strip()
    ]


def _agent_messages(
    messages: list[ReportMessage],
) -> list[ReportMessage]:
    agent_types = {
        "support agent",
        "agent",
        "assistant",
        "you",
        "representative",
        "rep",
        "staff",
    }

    return [
        message
        for message in messages
        if _normalize(message.sender_type)
        in agent_types
        and str(message.message_text or "").strip()
    ]


def _safe_percentage(
    value: float,
) -> int:
    return max(
        0,
        min(
            100,
            int(round(value)),
        ),
    )


# ============================================================
# PERFORMANCE SCORING
# ============================================================


def _calculate_communication_score(
    agent_messages: list[ReportMessage],
) -> int:
    if not agent_messages:
        return 0

    total = 0.0

    for message in agent_messages:
        text = str(
            message.message_text or ""
        ).strip()

        words = text.split()

        score = 60.0

        if 5 <= len(words) <= 80:
            score += 15

        normalized = _normalize(text)

        if any(
            phrase in normalized
            for phrase in [
                "please",
                "thank you",
                "i understand",
                "i can help",
                "let me",
            ]
        ):
            score += 10

        if "?" in text:
            score += 5

        if len(words) > 120:
            score -= 15

        total += max(
            0.0,
            min(
                100.0,
                score,
            ),
        )

    return _safe_percentage(
        total / len(agent_messages)
    )


def _calculate_empathy_score(
    agent_messages: list[ReportMessage],
) -> int:
    if not agent_messages:
        return 0

    empathy_phrases = [
        "i understand",
        "i'm sorry",
        "sorry",
        "i can understand",
        "i understand your concern",
        "i understand why",
        "thank you for",
        "i appreciate",
        "i know this is frustrating",
        "i'll help",
        "let me help",
    ]

    total = 0.0

    for message in agent_messages:
        text = _normalize(
            message.message_text
        )

        matches = sum(
            1
            for phrase in empathy_phrases
            if phrase in text
        )

        score = min(
            100,
            55 + (matches * 15),
        )

        total += score

    return _safe_percentage(
        total / len(agent_messages)
    )


def _calculate_tone_score(
    agent_messages: list[ReportMessage],
) -> int:
    if not agent_messages:
        return 0

    positive_markers = [
        "please",
        "thank you",
        "certainly",
        "absolutely",
        "happy to help",
        "i can help",
        "let me",
        "we can",
    ]

    negative_markers = [
        "you should have",
        "you need to understand",
        "that's not my problem",
        "not my responsibility",
        "you failed",
        "you are wrong",
    ]

    total = 0.0

    for message in agent_messages:
        text = _normalize(
            message.message_text
        )

        score = 75.0

        score += sum(
            5
            for marker in positive_markers
            if marker in text
        )

        score -= sum(
            20
            for marker in negative_markers
            if marker in text
        )

        total += max(
            0.0,
            min(
                100.0,
                score,
            ),
        )

    return _safe_percentage(
        total / len(agent_messages)
    )


def _calculate_clarity_score(
    agent_messages: list[ReportMessage],
) -> int:
    if not agent_messages:
        return 0

    total = 0.0

    for message in agent_messages:
        text = str(
            message.message_text or ""
        ).strip()

        words = text.split()

        score = 75.0

        if 8 <= len(words) <= 80:
            score += 15

        if len(words) > 120:
            score -= 20

        normalized = _normalize(text)

        if any(
            phrase in normalized
            for phrase in [
                "next step",
                "please",
                "you can",
                "i will",
                "we will",
                "let me",
            ]
        ):
            score += 5

        total += max(
            0.0,
            min(
                100.0,
                score,
            ),
        )

    return _safe_percentage(
        total / len(agent_messages)
    )


def _calculate_knowledge_score(
    agent_messages: list[ReportMessage],
    scenario: dict[str, Any],
) -> int:
    if not agent_messages:
        return 0

    scenario_text = " ".join(
        [
            str(
                scenario.get(
                    "title",
                    "",
                )
            ),
            str(
                scenario.get(
                    "category",
                    "",
                )
            ),
            str(
                scenario.get(
                    "objective",
                    "",
                )
            ),
            str(
                scenario.get(
                    "description",
                    "",
                )
            ),
        ]
    )

    scenario_words = {
        word
        for word in _normalize(
            scenario_text
        ).split()
        if len(word) >= 5
    }

    if not scenario_words:
        return 70

    total = 0.0

    for message in agent_messages:
        message_words = set(
            _normalize(
                message.message_text
            ).split()
        )

        overlap = len(
            message_words.intersection(
                scenario_words
            )
        )

        score = 65 + min(
            30,
            overlap * 3,
        )

        total += min(
            100,
            score,
        )

    return _safe_percentage(
        total / len(agent_messages)
    )


def _calculate_resolution_score(
    outcome: str,
    agent_messages: list[ReportMessage],
) -> int:
    if outcome == "Resolved":
        return 95

    if outcome == "Escalated":
        return 75

    if not agent_messages:
        return 0

    return 55


# ============================================================
# OUTCOME DETECTION
# ============================================================


def _determine_outcome(
    messages: list[ReportMessage],
    scenario: dict[str, Any],
) -> tuple[str, bool, bool]:
    del scenario

    normalized_messages = [
        _normalize(
            message.message_text
        )
        for message in messages
        if str(message.message_text or "").strip()
    ]

    combined = " ".join(
        normalized_messages
    )

    resolution_markers = [
        "resolved",
        "issue is resolved",
        "problem is resolved",
        "successfully completed",
        "successfully processed",
        "refund has been processed",
        "refund was processed",
        "refund is processed",
        "account access restored",
        "cancellation is confirmed",
        "order has been replaced",
        "issue has been fixed",
        "problem has been fixed",
        "issue has been resolved",
        "problem has been resolved",
        "your issue is now resolved",
        "this has been resolved",
    ]

    escalation_markers = [
        "escalated to",
        "escalation has been raised",
        "transferred to",
        "transfer you to",
        "supervisor",
        "senior support",
        "escalate this",
        "escalate the issue",
    ]

    resolved = any(
        marker in combined
        for marker in resolution_markers
    )

    escalated = any(
        marker in combined
        for marker in escalation_markers
    )

    if resolved:
        return (
            "Resolved",
            True,
            False,
        )

    if escalated:
        return (
            "Escalated",
            False,
            True,
        )

    return (
        "Unresolved",
        False,
        False,
    )


# ============================================================
# SENTIMENT
# ============================================================


def _sentiment_snapshot(
    message: str,
    history: list[dict[str, Any]],
) -> dict[str, Any]:
    if not message:
        return {
            "sentiment": "Neutral",
            "emotion": "neutral",
            "frustration_level": 0,
            "satisfaction_trend": "Stable",
            "confidence": 0,
        }

    result = analyze_customer_message(
        message=message,
        conversation_history=history,
    )

    if not isinstance(
        result,
        dict,
    ):
        return {
            "sentiment": "Neutral",
            "emotion": "neutral",
            "frustration_level": 0,
            "satisfaction_trend": "Stable",
            "confidence": 0,
        }

    return {
        "sentiment": result.get(
            "sentiment",
            "Neutral",
        ),
        "emotion": result.get(
            "emotion",
            "neutral",
        ),
        "frustration_level": result.get(
            "frustration_level",
            0,
        ),
        "satisfaction_trend": result.get(
            "satisfaction_trend",
            "Stable",
        ),
        "confidence": result.get(
            "confidence",
            0,
        ),
    }


# ============================================================
# SENTIMENT TIMELINE
# ============================================================


def _build_timeline(
    messages: list[ReportMessage],
) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []

    customer_history: list[dict[str, Any]] = []

    for index, message in enumerate(
        messages,
        start=1,
    ):
        sender = _normalize(
            message.sender_type
        )

        if sender in {
            "customer",
            "ai customer",
            "ai_customer",
            "user",
            "client",
            "customer_message",
        }:
            event_type = "customer_message"
            title = "Customer Message"

            text = str(
                message.message_text or ""
            ).strip()

            analysis = _sentiment_snapshot(
                text,
                customer_history,
            )

            customer_history.append(
                {
                    "sender_type": "customer",
                    "message_text": text,
                }
            )

            events.append(
                {
                    "id": str(index),
                    "timestamp": (
                        str(message.timestamp)
                        if message.timestamp
                        else datetime.utcnow().isoformat()
                    ),
                    "type": event_type,
                    "title": title,
                    "description": text[:250],
                    "sentiment": analysis[
                        "sentiment"
                    ],
                    "emotion": analysis[
                        "emotion"
                    ],
                    "frustrationLevel": analysis[
                        "frustration_level"
                    ],
                    "satisfactionTrend": analysis[
                        "satisfaction_trend"
                    ],
                    "confidence": analysis[
                        "confidence"
                    ],
                }
            )

        elif sender in {
            "support agent",
            "agent",
            "assistant",
            "you",
            "representative",
            "rep",
            "staff",
        }:
            event_type = "agent_response"
            title = "Agent Response"

            text = str(
                message.message_text or ""
            ).strip()

            events.append(
                {
                    "id": str(index),
                    "timestamp": (
                        str(message.timestamp)
                        if message.timestamp
                        else datetime.utcnow().isoformat()
                    ),
                    "type": event_type,
                    "title": title,
                    "description": text[:250],
                }
            )

        else:
            text = str(
                message.message_text or ""
            ).strip()

            events.append(
                {
                    "id": str(index),
                    "timestamp": (
                        str(message.timestamp)
                        if message.timestamp
                        else datetime.utcnow().isoformat()
                    ),
                    "type": "conversation_event",
                    "title": "Conversation Event",
                    "description": text[:250],
                }
            )

    return events


# ============================================================
# STRENGTHS
# ============================================================


def _build_strengths(
    scores: dict[str, Any],
) -> list[str]:
    strengths: list[str] = []

    if scores["communication"] >= 80:
        strengths.append(
            "Clear and professional communication."
        )

    if scores["empathy"] >= 80:
        strengths.append(
            "Good acknowledgement of customer concerns."
        )

    if scores["knowledge"] >= 80:
        strengths.append(
            "Good use of scenario and support context."
        )

    if scores["resolution"] >= 80:
        strengths.append(
            "Strong focus on resolving the customer's issue."
        )

    if scores["tone"] >= 80:
        strengths.append(
            "Maintained a professional and respectful tone."
        )

    if scores["clarity"] >= 80:
        strengths.append(
            "Responses were generally clear and easy to follow."
        )

    if not strengths:
        strengths.append(
            "Maintained engagement with the customer throughout the interaction."
        )

    return strengths[:5]


# ============================================================
# WEAKNESSES
# ============================================================


def _build_weaknesses(
    scores: dict[str, Any],
) -> list[str]:
    weaknesses: list[str] = []

    if scores["communication"] < 75:
        weaknesses.append(
            "Make responses more concise and structured."
        )

    if scores["empathy"] < 75:
        weaknesses.append(
            "Acknowledge the customer's concern more explicitly."
        )

    if scores["knowledge"] < 75:
        weaknesses.append(
            "Use the available scenario or knowledge context more consistently."
        )

    if scores["resolution"] < 75:
        weaknesses.append(
            "Provide a clearer resolution path and next step."
        )

    if scores["tone"] < 75:
        weaknesses.append(
            "Use more consistently calm and customer-focused wording."
        )

    if scores["clarity"] < 75:
        weaknesses.append(
            "Make instructions and next steps easier to follow."
        )

    if not weaknesses:
        weaknesses.append(
            "Continue refining consistency across all response dimensions."
        )

    return weaknesses[:5]


# ============================================================
# TRAINING RECOMMENDATIONS
# ============================================================


def _build_training_recommendations(
    weaknesses: list[str],
) -> list[str]:
    recommendations: list[str] = []

    for weakness in weaknesses:
        normalized = _normalize(
            weakness
        )

        if "empathy" in normalized:
            recommendations.append(
                "Empathy and active listening"
            )

        elif "knowledge" in normalized:
            recommendations.append(
                "Knowledge-base and policy application"
            )

        elif "resolution" in normalized:
            recommendations.append(
                "Resolution-focused customer handling"
            )

        elif "tone" in normalized:
            recommendations.append(
                "Professional communication and tone"
            )

        elif "communication" in normalized:
            recommendations.append(
                "Clear and concise communication"
            )

        elif "instructions" in normalized:
            recommendations.append(
                "Clear instructions and next-step guidance"
            )

    if not recommendations:
        recommendations.append(
            "Advanced customer-support communication"
        )

    return list(
        dict.fromkeys(
            recommendations
        )
    )[:5]


# ============================================================
# RESPONSE COMPARISONS
# ============================================================


def _build_response_comparisons(
    messages: list[ReportMessage],
) -> list[dict[str, Any]]:
    comparisons: list[dict[str, Any]] = []

    agent_turn = 0

    for message in messages:
        sender = _normalize(
            message.sender_type
        )

        if sender not in {
            "support agent",
            "agent",
            "assistant",
            "you",
            "representative",
            "rep",
            "staff",
        }:
            continue

        agent_turn += 1

        original = str(
            message.message_text or ""
        ).strip()

        if not original:
            continue

        comparisons.append(
            {
                "turnNumber": agent_turn,
                "originalAgentText": original,
                "aiImprovedText": original,
                "improvementExplanation": (
                    "The original response is retained because the "
                    "post-interaction report does not rewrite the "
                    "agent's completed response."
                ),
            }
        )

    return comparisons[:10]


# ============================================================
# SAFE INTENT DETECTION
# ============================================================


def _detect_final_intent(
    ending_message: str,
    history: list[dict[str, Any]],
) -> str:
    if not ending_message:
        return "general_inquiry"

    try:
        result = analyze_customer_message(
            message=ending_message,
            conversation_history=history,
        )
    except Exception:
        return "general_inquiry"

    if not isinstance(
        result,
        dict,
    ):
        return "general_inquiry"

    intent = result.get(
        "intent",
        "general_inquiry",
    )

    if not intent:
        return "general_inquiry"

    return str(intent)


# ============================================================
# TASK 8 ENDPOINT
# ============================================================


@router.post("/generate-report")
def generate_post_interaction_report(
    request: ReportRequest,
):
    messages = request.messages

    history = _message_history(
        messages
    )

    customer_messages = _customer_messages(
        messages
    )

    agent_messages = _agent_messages(
        messages
    )

    scenario = request.scenario or {}

    # --------------------------------------------------------
    # Empty conversation protection
    # --------------------------------------------------------

    if not messages:
        return {
            "score": {
                "overall": 0,
                "intentHandling": 0,
                "knowledgeUsage": 0,
                "tone": 0,
                "clarity": 0,
                "resolution": 0,
                "communication": 0,
                "empathy": 0,
                "knowledge": 0,
            },
            "startingSentiment": {
                "sentiment": "Neutral",
                "emotion": "neutral",
                "frustrationLevel": 0,
                "confidence": 0,
            },
            "endingSentiment": {
                "sentiment": "Neutral",
                "emotion": "neutral",
                "frustrationLevel": 0,
                "satisfactionTrend": "Stable",
                "confidence": 0,
            },
            "sentimentImprovement": 0,
            "resolved": False,
            "escalated": False,
            "outcome": "Unresolved",
            "timelineEvents": [],
            "topStrengths": [],
            "topWeaknesses": [
                "No conversation data was available for evaluation."
            ],
            "recommendedTrainings": [
                "Customer-support communication"
            ],
            "xpEarned": 0,
            "responseComparisons": [],
            "interactionSummary": (
                "No completed conversation was available "
                "to generate a performance report."
            ),
            "conversationMetrics": {
                "messageCount": 0,
                "customerMessageCount": 0,
                "agentMessageCount": 0,
            },
            "durationSeconds": max(
                0,
                request.durationSeconds,
            ),
            "coachingLevel": request.coachingLevel,
            "generatedAt": datetime.utcnow().isoformat(),
        }

    # --------------------------------------------------------
    # Starting and ending customer analysis
    # --------------------------------------------------------

    starting_message = (
        customer_messages[0].message_text
        if customer_messages
        else ""
    )

    ending_message = (
        customer_messages[-1].message_text
        if customer_messages
        else ""
    )

    starting = _sentiment_snapshot(
        starting_message,
        history[:1],
    )

    ending = _sentiment_snapshot(
        ending_message,
        history,
    )

    # --------------------------------------------------------
    # Outcome
    # --------------------------------------------------------

    outcome, resolved, escalated = _determine_outcome(
        messages,
        scenario,
    )

    # --------------------------------------------------------
    # Escalation / frustration
    # --------------------------------------------------------

    frustration_level = int(
        ending.get(
            "frustration_level",
            0,
        )
    )

    escalation_risk = "Low"

    if escalated:
        escalation_risk = "High"
    elif frustration_level >= 9:
        escalation_risk = "Critical"
    elif frustration_level >= 7:
        escalation_risk = "High"
    elif frustration_level >= 4:
        escalation_risk = "Medium"

    # --------------------------------------------------------
    # Performance dimensions
    # --------------------------------------------------------

    communication_score = (
        _calculate_communication_score(
            agent_messages
        )
    )

    empathy_score = (
        _calculate_empathy_score(
            agent_messages
        )
    )

    tone_score = (
        _calculate_tone_score(
            agent_messages
        )
    )

    clarity_score = (
        _calculate_clarity_score(
            agent_messages
        )
    )

    knowledge_score = (
        _calculate_knowledge_score(
            agent_messages,
            scenario,
        )
    )

    resolution_score = (
        _calculate_resolution_score(
            outcome,
            agent_messages,
        )
    )

    intent_handling_score = _safe_percentage(
        (
            communication_score
            + knowledge_score
            + resolution_score
        )
        / 3
    )

    # --------------------------------------------------------
    # Existing Task 8 performance service
    # --------------------------------------------------------

    try:
        performance = calculate_performance_score(
            communication_score=communication_score,
            resolution_score=resolution_score,
            empathy_score=empathy_score,
            knowledge_score=knowledge_score,
        )
    except Exception:
        performance = {
            "communication": communication_score,
            "resolution": resolution_score,
            "empathy": empathy_score,
            "knowledge": knowledge_score,
        }

    if not isinstance(
        performance,
        dict,
    ):
        performance = {}

    performance.update(
        {
            "communication": communication_score,
            "empathy": empathy_score,
            "knowledge": knowledge_score,
            "intentHandling": intent_handling_score,
            "knowledgeUsage": knowledge_score,
            "tone": tone_score,
            "clarity": clarity_score,
            "resolution": resolution_score,
        }
    )

    performance["overall"] = _safe_percentage(
        (
            intent_handling_score
            + knowledge_score
            + empathy_score
            + tone_score
            + clarity_score
            + resolution_score
        )
        / 6
    )

    # --------------------------------------------------------
    # Final intent
    # --------------------------------------------------------

    final_intent = _detect_final_intent(
        ending_message,
        history,
    )

    # --------------------------------------------------------
    # Task 8 structured summary
    # --------------------------------------------------------

    try:
        summary = build_post_interaction_summary(
            conversation_history=history,
            intent=final_intent,
            sentiment=ending[
                "sentiment"
            ],
            emotion=ending[
                "emotion"
            ],
            frustration_level=frustration_level,
            satisfaction_trend=ending[
                "satisfaction_trend"
            ],
            escalation_risk=escalation_risk,
            resolution_status=outcome,
            session_status=(
                "Completed"
                if outcome in {
                    "Resolved",
                    "Escalated",
                    "Unresolved",
                }
                else "In Progress"
            ),
            is_resolved=resolved,
            is_escalated=escalated,
        )
    except Exception:
        summary = {
            "interaction_summary": (
                "The interaction was completed with "
                f"an outcome of {outcome.lower()}."
            ),
            "conversation_metrics": {
                "messageCount": len(messages),
                "customerMessageCount": len(
                    customer_messages
                ),
                "agentMessageCount": len(
                    agent_messages
                ),
            },
        }

    if not isinstance(
        summary,
        dict,
    ):
        summary = {}

    summary["performance_score"] = performance

    # --------------------------------------------------------
    # Strengths / weaknesses
    # --------------------------------------------------------

    score_context = {
        **performance,
        "communication": communication_score,
        "empathy": empathy_score,
        "knowledge": knowledge_score,
        "resolution": resolution_score,
        "tone": tone_score,
        "clarity": clarity_score,
    }

    strengths = _build_strengths(
        score_context
    )

    weaknesses = _build_weaknesses(
        score_context
    )

    trainings = _build_training_recommendations(
        weaknesses
    )

    # --------------------------------------------------------
    # Sentiment improvement
    # --------------------------------------------------------

    sentiment_improvement = 0

    starting_frustration = int(
        starting.get(
            "frustration_level",
            0,
        )
    )

    ending_frustration = int(
        ending.get(
            "frustration_level",
            0,
        )
    )

    if starting_frustration > 0:
        sentiment_improvement = max(
            -100,
            min(
                100,
                int(
                    (
                        (
                            starting_frustration
                            - ending_frustration
                        )
                        / starting_frustration
                    )
                    * 100
                ),
            ),
        )

    elif (
        starting.get("sentiment")
        != ending.get("sentiment")
    ):
        starting_sentiment = _normalize(
            starting.get(
                "sentiment",
                "",
            )
        )

        ending_sentiment = _normalize(
            ending.get(
                "sentiment",
                "",
            )
        )

        positive_sentiments = {
            "positive",
            "satisfied",
            "happy",
        }

        negative_sentiments = {
            "negative",
            "frustrated",
            "angry",
            "worried",
        }

        if (
            starting_sentiment
            in negative_sentiments
            and ending_sentiment
            in positive_sentiments
        ):
            sentiment_improvement = 100

    # --------------------------------------------------------
    # XP
    # --------------------------------------------------------

    xp_earned = max(
        0,
        int(
            performance["overall"] // 5
        ),
    )

    if resolved:
        xp_earned += 10

    if escalated:
        xp_earned += 5

    # --------------------------------------------------------
    # Timeline
    # --------------------------------------------------------

    timeline_events = _build_timeline(
        messages
    )

    # --------------------------------------------------------
    # Response comparisons
    # --------------------------------------------------------

    response_comparisons = (
        _build_response_comparisons(
            messages
        )
    )

    # --------------------------------------------------------
    # Conversation metrics
    # --------------------------------------------------------

    conversation_metrics = summary.get(
        "conversation_metrics",
        {},
    )

    if not isinstance(
        conversation_metrics,
        dict,
    ):
        conversation_metrics = {}

    conversation_metrics.setdefault(
        "messageCount",
        len(messages),
    )

    conversation_metrics.setdefault(
        "customerMessageCount",
        len(customer_messages),
    )

    conversation_metrics.setdefault(
        "agentMessageCount",
        len(agent_messages),
    )

    # --------------------------------------------------------
    # Final response
    # --------------------------------------------------------

    return {
        "score": performance,

        "startingSentiment": {
            "sentiment": starting[
                "sentiment"
            ],
            "emotion": starting[
                "emotion"
            ],
            "frustrationLevel": starting[
                "frustration_level"
            ],
            "confidence": starting[
                "confidence"
            ],
        },

        "endingSentiment": {
            "sentiment": ending[
                "sentiment"
            ],
            "emotion": ending[
                "emotion"
            ],
            "frustrationLevel": ending[
                "frustration_level"
            ],
            "satisfactionTrend": ending[
                "satisfaction_trend"
            ],
            "confidence": ending[
                "confidence"
            ],
        },

        "sentimentImprovement": (
            sentiment_improvement
        ),

        "resolved": resolved,

        "escalated": escalated,

        "outcome": outcome,

        "escalationRisk": escalation_risk,

        "timelineEvents": timeline_events,

        "topStrengths": strengths,

        "topWeaknesses": weaknesses,

        "recommendedTrainings": trainings,

        "xpEarned": xp_earned,

        "responseComparisons": (
            response_comparisons
        ),

        "interactionSummary": summary.get(
            "interaction_summary",
            (
                "The interaction was completed "
                f"with an outcome of "
                f"{outcome.lower()}."
            ),
        ),

        "conversationMetrics": (
            conversation_metrics
        ),

        "durationSeconds": max(
            0,
            request.durationSeconds,
        ),

        "coachingLevel": (
            request.coachingLevel
        ),

        "generatedAt": (
            datetime.utcnow().isoformat()
        ),
    }