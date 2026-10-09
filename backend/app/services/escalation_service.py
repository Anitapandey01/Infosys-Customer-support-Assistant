from typing import Any


# ============================================================
# TASK 6 - ESCALATION RISK CONFIGURATION
# ============================================================

DEFAULT_HIGH_RISK_THRESHOLD = 7
CRITICAL_RISK_THRESHOLD = 9

RISK_LEVEL_LOW = "Low"
RISK_LEVEL_MEDIUM = "Medium"
RISK_LEVEL_HIGH = "High"
RISK_LEVEL_CRITICAL = "Critical"


# ============================================================
# TEXT HELPERS
# ============================================================

def _normalize_text(message: str) -> str:
    return " ".join(
        str(message or "").lower().strip().split()
    )


def _customer_history(
    conversation_history: list[dict[str, Any]] | None,
) -> list[str]:
    if not conversation_history:
        return []

    customer_messages: list[str] = []

    for item in conversation_history:
        sender_type = str(
            item.get("sender_type", "")
        ).strip().lower()

        message_text = str(
            item.get("message_text", "")
        ).strip()

        if (
            sender_type in {
                "customer",
                "ai_customer",
                "user",
            }
            and message_text
        ):
            customer_messages.append(
                message_text
            )

    return customer_messages


def _contains_any(
    text: str,
    phrases: list[str],
) -> bool:
    return any(
        phrase in text
        for phrase in phrases
    )


def _count_matches(
    text: str,
    phrases: list[str],
) -> int:
    return sum(
        1
        for phrase in phrases
        if phrase in text
    )


# ============================================================
# TASK 6 - ESCALATION PHRASES
# ============================================================

EXPLICIT_ESCALATION_PHRASES = [
    "manager",
    "supervisor",
    "human agent",
    "human support",
    "escalate",
    "escalation",
    "speak to someone",
    "speak with someone",
    "someone in charge",
    "senior support",
    "support manager",
    "different representative",
    "transfer me",
    "transfer this",
    "connect me to",
    "connect me with",
]


SEVERE_ESCALATION_PHRASES = [
    "legal action",
    "lawyer",
    "attorney",
    "consumer court",
    "chargeback",
    "financial institution",
    "dispute this charge",
    "file a dispute",
    "formal dispute",
    "report you",
    "report this company",
    "report your company",
]


REPEATED_COMPLAINT_PHRASES = [
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
    "not resolved",
    "unresolved",
    "no resolution",
    "no one is helping",
    "nobody is helping",
    "unable to assist",
    "unable to help",
    "refusing to help",
    "refusing assistance",
]


HISTORICAL_FRUSTRATION_PHRASES = [
    "frustrated",
    "frustrating",
    "angry",
    "furious",
    "unacceptable",
    "unsatisfactory",
    "sick of",
    "runaround",
    "brush-off",
    "taking too long",
    "not resolved",
    "not an answer",
    "not helping",
    "unable to assist",
    "unable to help",
    "refusing to help",
]


# ============================================================
# RISK CLASSIFICATION
# ============================================================

def _classify_risk(
    score: int,
    escalation_threshold: int,
) -> str:

    if score >= CRITICAL_RISK_THRESHOLD:
        return RISK_LEVEL_CRITICAL

    if score >= escalation_threshold:
        return RISK_LEVEL_HIGH

    if score >= 4:
        return RISK_LEVEL_MEDIUM

    return RISK_LEVEL_LOW


# ============================================================
# RECOMMENDED ACTION
# ============================================================

def _recommended_action(
    risk_level: str,
) -> str:

    if risk_level == RISK_LEVEL_CRITICAL:
        return (
            "Escalate to a human support agent or supervisor immediately. "
            "Acknowledge the customer's concern and avoid further unnecessary back-and-forth."
        )

    if risk_level == RISK_LEVEL_HIGH:
        return (
            "Acknowledge the customer's frustration, provide a clear resolution path, "
            "and prepare for human escalation if the issue remains unresolved."
        )

    if risk_level == RISK_LEVEL_MEDIUM:
        return (
            "Use empathetic language, address the customer's concern directly, "
            "and monitor the next response for escalation signals."
        )

    return (
        "Continue with the normal support flow and monitor the conversation "
        "for changes in sentiment, frustration, or escalation risk."
    )


# ============================================================
# TASK 6 - MAIN ESCALATION RISK CALCULATOR
# ============================================================

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

    historical_text = _normalize_text(
        " ".join(history[-8:])
    )

    score = 0.0

    reasons: list[str] = []

    # --------------------------------------------------------
    # Normalize inputs
    # --------------------------------------------------------

    try:
        frustration_level = int(
            frustration_level
        )
    except (
        TypeError,
        ValueError,
    ):
        frustration_level = 0

    frustration_level = max(
        0,
        min(
            frustration_level,
            10,
        ),
    )

    normalized_sentiment = str(
        sentiment or "Neutral"
    ).strip().lower()

    try:
        escalation_threshold = int(
            escalation_threshold
        )
    except (
        TypeError,
        ValueError,
    ):
        escalation_threshold = (
            DEFAULT_HIGH_RISK_THRESHOLD
        )

    escalation_threshold = max(
        1,
        min(
            escalation_threshold,
            10,
        ),
    )

    # ========================================================
    # 1. CURRENT FRUSTRATION
    # ========================================================

    if frustration_level >= 9:

        score += 5.0

        reasons.append(
            "Customer frustration is extremely high."
        )

    elif frustration_level >= 8:

        score += 4.0

        reasons.append(
            "Customer frustration is very high."
        )

    elif frustration_level >= 6:

        score += 3.0

        reasons.append(
            "Customer frustration is elevated."
        )

    elif frustration_level >= 4:

        score += 2.0

        reasons.append(
            "Customer frustration is increasing."
        )

    elif frustration_level >= 3:

        score += 1.0

    # ========================================================
    # 2. NEGATIVE SENTIMENT
    # ========================================================

    if normalized_sentiment == "negative":

        score += 2.0

        reasons.append(
            "Customer sentiment is negative."
        )

    # ========================================================
    # 3. EXPLICIT ESCALATION REQUEST
    # ========================================================

    explicit_escalation_count = _count_matches(
        text,
        EXPLICIT_ESCALATION_PHRASES,
    )

    if explicit_escalation_count >= 2:

        score += 4.0

        reasons.append(
            "Customer repeatedly requested escalation or human assistance."
        )

    elif explicit_escalation_count == 1:

        score += 3.0

        reasons.append(
            "Customer explicitly requested escalation or human assistance."
        )

    # ========================================================
    # 4. SEVERE ESCALATION
    # ========================================================

    severe_escalation_count = _count_matches(
        text,
        SEVERE_ESCALATION_PHRASES,
    )

    if severe_escalation_count >= 2:

        score += 5.0

        reasons.append(
            "Customer used multiple severe escalation indicators such as dispute, chargeback, or legal-action language."
        )

    elif severe_escalation_count == 1:

        score += 4.0

        reasons.append(
            "Customer used a severe escalation indicator such as dispute, chargeback, or legal-action language."
        )

    # ========================================================
    # 5. REPEATED COMPLAINT
    # ========================================================

    repeated_count = _count_matches(
        text,
        REPEATED_COMPLAINT_PHRASES,
    )

    if repeated_count >= 3:

        score += 4.0

        reasons.append(
            "Customer repeatedly indicates that the issue remains unresolved."
        )

    elif repeated_count >= 2:

        score += 3.0

        reasons.append(
            "Customer indicates repeated unresolved assistance."
        )

    elif repeated_count == 1:

        score += 1.5

        reasons.append(
            "Customer indicates that the issue has already been raised or remains unresolved."
        )

    # ========================================================
    # 6. HISTORICAL ESCALATION
    # ========================================================

    historical_escalation_count = _count_matches(
        historical_text,
        EXPLICIT_ESCALATION_PHRASES,
    )

    if historical_escalation_count >= 3:

        score += 4.0

        reasons.append(
            "Previous customer messages contain repeated escalation requests."
        )

    elif historical_escalation_count >= 2:

        score += 3.0

        reasons.append(
            "Previous customer messages contain multiple escalation requests."
        )

    elif historical_escalation_count == 1:

        score += 1.5

        reasons.append(
            "Previous customer messages contain an escalation request."
        )

    # ========================================================
    # 7. HISTORICAL SEVERE ESCALATION
    # ========================================================

    historical_severe_count = _count_matches(
        historical_text,
        SEVERE_ESCALATION_PHRASES,
    )

    if historical_severe_count >= 2:

        score += 4.0

        reasons.append(
            "Previous customer messages contain repeated severe escalation signals."
        )

    elif historical_severe_count == 1:

        score += 3.0

        reasons.append(
            "Previous customer messages contain a severe escalation signal."
        )

    # ========================================================
    # 8. HISTORICAL FRUSTRATION
    # ========================================================

    historical_frustration_count = _count_matches(
        historical_text,
        HISTORICAL_FRUSTRATION_PHRASES,
    )

    if historical_frustration_count >= 3:

        score += 3.0

        reasons.append(
            "Previous customer messages contain repeated frustration or unresolved-issue signals."
        )

    elif historical_frustration_count >= 1:

        score += 1.5

        reasons.append(
            "Previous customer messages contain frustration or unresolved-issue signals."
        )

    # ========================================================
    # 9. PROLONGED CONVERSATION
    # ========================================================

    customer_turn_count = len(
        history
    )

    if customer_turn_count >= 8:

        score += 3.0

        reasons.append(
            "The conversation contains many customer turns without a clear resolution."
        )

    elif customer_turn_count >= 6:

        score += 2.0

        reasons.append(
            "The conversation is prolonged and the issue remains unresolved."
        )

    elif customer_turn_count >= 4:

        score += 1.0

        reasons.append(
            "The conversation contains multiple customer turns."
        )

    # ========================================================
    # 10. PERSISTENT DISPUTE / BANK LANGUAGE
    # ========================================================

    financial_dispute_phrases = [
        "my bank",
        "bank",
        "financial institution",
        "dispute through",
        "dispute this",
        "chargeback",
    ]

    financial_dispute_count = _count_matches(
        text,
        financial_dispute_phrases,
    )

    if financial_dispute_count >= 2:

        score += 4.0

        reasons.append(
            "Customer is preparing to dispute the charge through a financial institution."
        )

    elif financial_dispute_count == 1:

        score += 3.0

        reasons.append(
            "Customer mentioned disputing the charge through a financial institution."
        )

    # ========================================================
    # 11. FINAL NORMALIZATION
    # ========================================================

    score = min(
        int(round(score)),
        10,
    )

    risk_level = _classify_risk(
        score=score,
        escalation_threshold=escalation_threshold,
    )

    # ========================================================
    # 12. ACTION
    # ========================================================

    recommended_action = _recommended_action(
        risk_level
    )

    # ========================================================
    # 13. FALLBACK REASON
    # ========================================================

    if not reasons:

        reasons.append(
            "No significant escalation indicators detected."
        )

    # Remove duplicate reasons while preserving order.

    unique_reasons: list[str] = []

    for reason in reasons:

        if reason not in unique_reasons:

            unique_reasons.append(
                reason
            )

    # ========================================================
    # 14. ALERT
    # ========================================================

    alert = (
        score >= escalation_threshold
    )

    critical_alert = (
        risk_level == RISK_LEVEL_CRITICAL
    )

    # ========================================================
    # 15. RETURN TASK 6 PAYLOAD
    # ========================================================

    return {
        "risk_score": score,
        "risk_level": risk_level,
        "risk_threshold": escalation_threshold,
        "critical_threshold": CRITICAL_RISK_THRESHOLD,
        "reasons": unique_reasons,
        "recommended_action": recommended_action,
        "alert": alert,
        "critical_alert": critical_alert,
    }