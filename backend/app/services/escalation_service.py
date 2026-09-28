from typing import Any


DEFAULT_HIGH_RISK_THRESHOLD = 7


def _normalize_text(message: str) -> str:
    return " ".join(
        str(message or "").lower().strip().split()
    )


def _customer_history(
    conversation_history: list[dict[str, Any]] | None,
) -> list[str]:
    if not conversation_history:
        return []

    return [
        str(item.get("message_text", "")).strip()
        for item in conversation_history
        if item.get("sender_type") == "Customer"
        and str(item.get("message_text", "")).strip()
    ]


def _contains_any(
    text: str,
    phrases: list[str],
) -> bool:
    return any(
        phrase in text
        for phrase in phrases
    )


def calculate_escalation_risk(
    message: str,
    frustration_level: int = 0,
    sentiment: str = "Neutral",
    conversation_history: list[dict[str, Any]] | None = None,
    escalation_threshold: int = DEFAULT_HIGH_RISK_THRESHOLD,
) -> dict[str, Any]:

    text = _normalize_text(message)

    history = _customer_history(
        conversation_history
    )

    score = 0.0
    reasons: list[str] = []

    # --------------------------------------------------
    # Frustration
    # --------------------------------------------------

    frustration_level = max(
        0,
        min(
            int(frustration_level),
            10,
        ),
    )

    if frustration_level >= 8:
        score += 4.0
        reasons.append(
            "Very high customer frustration."
        )

    elif frustration_level >= 5:
        score += 2.5
        reasons.append(
            "Elevated customer frustration."
        )

    elif frustration_level >= 3:
        score += 1.0

    # --------------------------------------------------
    # Negative sentiment
    # --------------------------------------------------

    if sentiment == "Negative":
        score += 2.0
        reasons.append(
            "Customer sentiment is negative."
        )

    # --------------------------------------------------
    # Repeated complaint signals
    # --------------------------------------------------

    repeated_phrases = [
        "again",
        "already explained",
        "already told",
        "twice",
        "three times",
        "still not",
        "still hasn't",
        "still have not",
        "still haven't",
        "previous agent",
        "previous agents",
        "same issue",
        "same problem",
    ]

    repeated_count = sum(
        1
        for phrase in repeated_phrases
        if phrase in text
    )

    if repeated_count:
        score += min(
            repeated_count * 1.25,
            3.0,
        )

        reasons.append(
            "Customer indicates that the issue has been repeated or remains unresolved."
        )

    # --------------------------------------------------
    # Explicit escalation requests
    # --------------------------------------------------

    escalation_phrases = [
        "manager",
        "supervisor",
        "human agent",
        "human support",
        "escalate",
        "escalation",
        "speak to someone",
        "speak with someone",
        "someone in charge",
    ]

    if _contains_any(
        text,
        escalation_phrases,
    ):
        score += 3.0

        reasons.append(
            "Customer is explicitly requesting escalation or human assistance."
        )

    # --------------------------------------------------
    # Severe escalation indicators
    # --------------------------------------------------

    severe_phrases = [
        "legal action",
        "lawyer",
        "consumer court",
        "chargeback",
        "report you",
        "report this company",
    ]

    if _contains_any(
        text,
        severe_phrases,
    ):
        score += 4.0

        reasons.append(
            "Customer used a severe escalation indicator such as legal action or chargeback language."
        )

    # --------------------------------------------------
    # Historical unresolved issue
    # --------------------------------------------------

    if len(history) >= 3:
        score += 1.0

        reasons.append(
            "Conversation contains multiple customer turns."
        )

    if len(history) >= 5:
        score += 1.0

        reasons.append(
            "Conversation is prolonged, increasing unresolved-issue risk."
        )

    # --------------------------------------------------
    # Historical frustration
    # --------------------------------------------------

    historical_text = " ".join(
        history[-6:]
    )

    historical_frustration_phrases = [
        "frustrated",
        "angry",
        "furious",
        "sick of",
        "runaround",
        "brush-off",
        "taking too long",
        "not resolved",
        "not an answer",
    ]

    historical_count = sum(
        1
        for phrase in historical_frustration_phrases
        if phrase in historical_text.lower()
    )

    if historical_count:
        score += min(
            historical_count * 0.75,
            2.0,
        )

        reasons.append(
            "Previous customer messages contain frustration or unresolved-issue signals."
        )

    # --------------------------------------------------
    # Normalize score
    # --------------------------------------------------

    score = min(
        round(score),
        10,
    )

    # --------------------------------------------------
    # Risk classification
    # --------------------------------------------------

    if score >= 9:
        risk_level = "Critical"

    elif score >= escalation_threshold:
        risk_level = "High"

    elif score >= 4:
        risk_level = "Medium"

    else:
        risk_level = "Low"

    # --------------------------------------------------
    # Recommended action
    # --------------------------------------------------

    if risk_level == "Critical":
        recommended_action = (
            "Acknowledge the customer's frustration and escalate to a human support agent immediately."
        )

    elif risk_level == "High":
        recommended_action = (
            "Acknowledge the frustration, provide a clear next step, and prepare for human escalation."
        )

    elif risk_level == "Medium":
        recommended_action = (
            "Use empathetic language, clarify the resolution path, and monitor the next customer response."
        )

    else:
        recommended_action = (
            "Continue with the normal support flow and monitor for changes in sentiment or frustration."
        )

    if not reasons:
        reasons.append(
            "No significant escalation indicators detected."
        )

    return {
        "risk_score": score,
        "risk_level": risk_level,
        "risk_threshold": escalation_threshold,
        "reasons": reasons,
        "recommended_action": recommended_action,
        "alert": score >= escalation_threshold,
    }