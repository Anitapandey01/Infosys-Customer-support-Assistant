import json
import os
import re
from typing import Any


try:
    from google import genai
except ImportError:
    genai = None


# ============================================================
# TASK 4 - SUPPORTED VALUES
# ============================================================

SUPPORTED_INTENTS = {
    "refund_status",
    "cancellation",
    "delivery_issue",
    "payment_issue",
    "account_issue",
    "complaint",
    "return_exchange",
    "general_inquiry",
}

SUPPORTED_EMOTIONS = {
    "happy",
    "neutral",
    "confused",
    "worried",
    "frustrated",
    "angry",
    "satisfied",
}

SUPPORTED_SENTIMENTS = {
    "Positive",
    "Neutral",
    "Negative",
}

SUPPORTED_SATISFACTION_TRENDS = {
    "Improving",
    "Declining",
    "Stable",
}

SUPPORTED_ESCALATION_RISKS = {
    "Low",
    "Medium",
    "High",
}


# ============================================================
# TASK 4 - INTENT KEYWORDS
# ============================================================

INTENT_KEYWORDS = {
    "refund_status": [
        "refund",
        "money back",
        "moneyback",
        "reimbursement",
        "refunded",
        "refund status",
        "refund pending",
        "refund not received",
    ],

    "cancellation": [
        "cancel",
        "cancellation",
        "terminate subscription",
        "stop subscription",
        "cancel my order",
        "cancel order",
        "turn off auto-renewal",
        "turn off auto renewal",
        "stop auto-renewal",
        "stop auto renewal",
        "auto renewal",
        "auto-renew",
    ],

    "delivery_issue": [
        "delivery",
        "delivered",
        "delivery date",
        "late",
        "delay",
        "delayed",
        "shipment",
        "shipping",
        "tracking",
        "tracking status",
        "tracking hasn't updated",
        "tracking has not updated",
        "package",
        "parcel",
        "order hasn't arrived",
        "order has not arrived",
        "not arrived",
        "not delivered",
        "lost package",
        "where is my package",
        "where is my order",
        "guaranteed delivery",
    ],

    "payment_issue": [
        "payment",
        "paid",
        "pay",
        "payment failed",
        "payment failure",
        "charged twice",
        "double charged",
        "charged",
        "charge",
        "debit",
        "transaction",
        "card",
        "upi",
    ],

    "account_issue": [
        "login",
        "log in",
        "sign in",
        "password",
        "profile",
        "email address",
        "verification",
        "otp",
        "locked out",
        "cannot log in",
        "can't log in",
        "unable to log in",
        "reset my password",
        "forgot my password",
    ],

    "complaint": [
        "complaint",
        "file a complaint",
        "make a complaint",
        "complain",
        "terrible service",
        "worst service",
        "poor service",
        "poor support",
        "bad service",
        "unacceptable service",
        "service is unacceptable",
    ],

    "return_exchange": [
        "return",
        "return this",
        "return the item",
        "return the product",
        "exchange",
        "exchange this",
        "exchange the item",
        "exchange the product",
        "wrong item",
        "wrong product",
        "damaged item",
        "damaged product",
        "item is damaged",
        "product is damaged",
        "defective",
        "defective item",
        "defective product",
        "broken item",
        "broken product",
        "size exchange",
    ],

    "general_inquiry": [
        "how do i",
        "can i",
        "what is",
        "where can i",
        "when will",
        "is it possible",
        "tell me",
        "information",
        "question",
        "help",
    ],
}


# ============================================================
# TASK 4 - PRIMARY ISSUE SIGNALS
#
# These represent the customer's actual support problem.
# Remedy / escalation words are deliberately kept separate.
# ============================================================

PRIMARY_INTENT_SIGNALS = {
    "refund_status": [
        "refund",
        "money back",
        "moneyback",
        "reimbursement",
        "refund status",
        "refund pending",
        "refund not received",
        "refund hasn't arrived",
        "refund has not arrived",
    ],

    "cancellation": [
        "cancel my subscription",
        "cancel the subscription",
        "cancel subscription",
        "cancel my order",
        "cancel the order",
        "i want to cancel",
        "i need to cancel",
        "cancellation",
        "terminate subscription",
        "stop subscription",
        "turn off auto-renewal",
        "turn off auto renewal",
        "stop auto-renewal",
        "stop auto renewal",
        "auto renewal",
        "auto-renew",
    ],

    "delivery_issue": [
        "delivery",
        "delivery date",
        "late delivery",
        "delivery is late",
        "delivery was late",
        "delivery is delayed",
        "delivery was delayed",
        "delayed delivery",
        "shipment",
        "shipping",
        "tracking",
        "tracking status",
        "tracking hasn't updated",
        "tracking has not updated",
        "package",
        "parcel",
        "order hasn't arrived",
        "order has not arrived",
        "package hasn't arrived",
        "package has not arrived",
        "parcel hasn't arrived",
        "parcel has not arrived",
        "not arrived",
        "not delivered",
        "lost package",
        "lost parcel",
        "where is my package",
        "where is my order",
        "guaranteed delivery",
        "delivery is overdue",
        "order is overdue",
    ],

    "payment_issue": [
        "payment failed",
        "payment failure",
        "payment didn't go through",
        "payment did not go through",
        "payment was declined",
        "payment declined",
        "charged twice",
        "double charged",
        "charged me twice",
        "duplicate charge",
        "duplicate payment",
        "wrong charge",
        "incorrect charge",
        "unexpected charge",
        "payment issue",
        "payment problem",
        "transaction failed",
        "transaction declined",
    ],

    "account_issue": [
        "cannot log in",
        "can't log in",
        "unable to log in",
        "cannot login",
        "can't login",
        "unable to login",
        "log into my account",
        "login to my account",
        "sign into my account",
        "sign in to my account",
        "forgot my password",
        "reset my password",
        "password reset",
        "account is locked",
        "locked out of my account",
        "otp is not working",
        "verification code is not working",
        "cannot access my account",
        "can't access my account",
    ],

    "complaint": [
        "i want to file a complaint",
        "i want to make a complaint",
        "i need to file a complaint",
        "i need to make a complaint",
        "file a complaint",
        "make a complaint",
        "official complaint",
        "complain about",
        "terrible service",
        "worst service",
        "poor service",
        "poor support",
        "bad service",
        "service is unacceptable",
    ],

    "return_exchange": [
        "i want to return",
        "i need to return",
        "i want to exchange",
        "i need to exchange",
        "return this item",
        "return the item",
        "return this product",
        "return the product",
        "exchange this item",
        "exchange the item",
        "exchange this product",
        "exchange the product",
        "wrong item",
        "wrong product",
        "damaged item",
        "damaged product",
        "item is damaged",
        "product is damaged",
        "item arrived damaged",
        "product arrived damaged",
        "defective item",
        "defective product",
        "item is defective",
        "product is defective",
        "broken item",
        "broken product",
        "item is broken",
        "product is broken",
        "size exchange",
    ],
}


# ============================================================
# REMEDY / ACTION SIGNALS
# ============================================================

REMEDY_SIGNALS = [
    "replacement",
    "replace",
    "send me another",
    "send another one",
    "ship a replacement",
    "give me a credit",
    "credit",
    "compensation",
    "refund me",
    "manager",
    "supervisor",
    "escalate",
    "escalation",
]


# ============================================================
# TASK 4 - EMOTION KEYWORDS
# ============================================================

EMOTION_KEYWORDS = {
    "angry": [
        "angry",
        "furious",
        "ridiculous",
        "unacceptable",
        "outrageous",
        "worst",
        "hate",
        "fix this now",
        "right now",
        "manager",
        "sick of",
        "are you serious",
        "seriously",
    ],

    "frustrated": [
        "frustrated",
        "frustrating",
        "fed up",
        "tired of",
        "sick of",
        "again",
        "still",
        "already told",
        "already explained",
        "how many times",
        "waste of time",
        "taking too long",
        "taking way too long",
        "taking longer",
        "taking much longer",
        "brush-off",
        "brush off",
        "runaround",
        "platitudes",
        "vague answer",
        "vague answers",
        "not an answer",
        "not a real answer",
        "real solution",
        "right now",
    ],

    "worried": [
        "worried",
        "concerned",
        "concern",
        "afraid",
        "scared",
        "anxious",
        "hope",
        "what if",
        "i'm concerned",
        "i am concerned",
    ],

    "confused": [
        "confused",
        "don't understand",
        "do not understand",
        "not sure",
        "unclear",
        "what does that mean",
        "how is that possible",
        "which one",
        "i'm confused",
        "i am confused",
    ],

    "happy": [
        "happy",
        "great",
        "awesome",
        "excellent",
        "wonderful",
        "glad",
        "perfect",
        "amazing",
    ],

    "satisfied": [
        "satisfied",
        "resolved",
        "thank you",
        "thanks",
        "that helps",
        "problem solved",
        "all good",
    ],
}


# ============================================================
# TASK 4 - SENTIMENT WORDS
# ============================================================

POSITIVE_WORDS = {
    "good",
    "great",
    "excellent",
    "happy",
    "perfect",
    "thanks",
    "thank",
    "helpful",
    "resolved",
    "satisfied",
    "awesome",
    "wonderful",
    "amazing",
    "glad",
}


NEGATIVE_WORDS = {
    "bad",
    "poor",
    "angry",
    "frustrated",
    "frustrating",
    "worst",
    "terrible",
    "unacceptable",
    "disappointed",
    "disappointing",
    "annoyed",
    "annoying",
    "hate",
    "problem",
    "issue",
    "failed",
    "failure",
    "late",
    "delay",
    "delayed",
    "wrong",
    "broken",
    "ridiculous",
    "sick",
    "brush-off",
    "brush",
    "runaround",
    "vague",
    "overdue",
}


# ============================================================
# TASK 4 - ESCALATION PHRASES
# ============================================================

ESCALATION_PHRASES = [
    "manager",
    "supervisor",
    "escalate",
    "escalation",
    "legal action",
    "lawyer",
    "consumer court",
    "chargeback",
    "report you",
    "report this",
    "negative review",
    "social media",
    "never use",
    "close my account",
]


# ============================================================
# BASIC HELPERS
# ============================================================

def _normalize_text(text: str) -> str:
    if not text:
        return ""

    text = str(text).lower().strip()
    text = re.sub(r"\s+", " ", text)

    return text


def _clamp(
    value: float,
    minimum: float,
    maximum: float,
) -> float:
    return max(
        minimum,
        min(maximum, value),
    )


def _keyword_matches(
    text: str,
    keywords: list[str],
) -> int:
    """
    Count keyword/phrase matches without substring
    false positives.
    """

    normalized = _normalize_text(text)

    if not normalized:
        return 0

    matches = 0

    for keyword in keywords:
        normalized_keyword = _normalize_text(keyword)

        if not normalized_keyword:
            continue

        pattern = rf"(?<!\w){re.escape(normalized_keyword)}(?!\w)"

        if re.search(pattern, normalized):
            matches += 1

    return matches


def _customer_history(
    conversation_history: list[dict[str, Any]] | None,
) -> list[str]:

    if not conversation_history:
        return []

    messages = []

    for item in conversation_history:

        if not isinstance(item, dict):
            continue

        sender = str(
            item.get("sender_type")
            or item.get("sender")
            or ""
        ).lower()

        if sender in {
            "customer",
            "user",
            "customer_message",
        }:

            message = (
                item.get("message_text")
                or item.get("text")
                or ""
            )

            if message:
                messages.append(
                    str(message)
                )

    return messages


def _intent_scores(
    text: str,
) -> dict[str, int]:

    normalized = _normalize_text(text)

    scores = {}

    for intent, keywords in INTENT_KEYWORDS.items():

        score = _keyword_matches(
            normalized,
            keywords,
        )

        if score > 0:
            scores[intent] = score

    return scores


def _primary_intent_scores(
    text: str,
) -> dict[str, int]:

    normalized = _normalize_text(text)

    if not normalized:
        return {}

    scores: dict[str, int] = {}

    for intent, signals in PRIMARY_INTENT_SIGNALS.items():

        score = _keyword_matches(
            normalized,
            signals,
        )

        if score > 0:
            scores[intent] = score

    explicit_intent_phrases = {
        "refund_status": [
            "where is my refund",
            "when will i get my refund",
            "my refund has not arrived",
            "my refund hasn't arrived",
            "i am waiting for my refund",
            "i'm waiting for my refund",
            "refund is still pending",
        ],

        "cancellation": [
            "i want to cancel",
            "i need to cancel",
            "please cancel my order",
            "please cancel my subscription",
        ],

        "delivery_issue": [
            "where is my package",
            "where is my order",
            "my package has not arrived",
            "my package hasn't arrived",
            "my order has not arrived",
            "my order hasn't arrived",
        ],

        "payment_issue": [
            "my payment failed",
            "my payment was declined",
            "my card was declined",
            "i was charged twice",
            "i was charged twice for",
        ],

        "account_issue": [
            "i cannot log in",
            "i can't log in",
            "i cannot login",
            "i can't login",
            "i cannot access my account",
            "i can't access my account",
        ],

        "complaint": [
            "i want to file a complaint",
            "i want to make a complaint",
            "i need to file a complaint",
            "i need to make a complaint",
        ],

        "return_exchange": [
            "i want to return",
            "i need to return",
            "i want to return it",
            "i need to return it",
            "i want to exchange",
            "i need to exchange",
            "i want to exchange it",
            "i need to exchange it",
            "please let me return",
            "please let me exchange",
        ],
    }

    for intent, phrases in explicit_intent_phrases.items():

        explicit_matches = _keyword_matches(
            normalized,
            phrases,
        )

        if explicit_matches:
            scores[intent] = scores.get(
                intent,
                0,
            ) + (2 * explicit_matches)

    return scores


def _has_any_signal(
    text: str,
    signals: list[str],
) -> bool:

    normalized = _normalize_text(text)

    if not normalized:
        return False

    for signal in signals:

        normalized_signal = _normalize_text(signal)

        if not normalized_signal:
            continue

        pattern = rf"(?<!\w){re.escape(normalized_signal)}(?!\w)"

        if re.search(pattern, normalized):
            return True

    return False


def _is_remedy_only_message(
    text: str,
) -> bool:

    normalized = _normalize_text(text)

    if not normalized:
        return False

    primary_scores = _primary_intent_scores(
        normalized
    )

    if primary_scores:
        return False

    return _has_any_signal(
        normalized,
        REMEDY_SIGNALS,
    )


# ============================================================
# ESTABLISHED INTENT FROM CONVERSATION HISTORY
# ============================================================

def _established_intent_from_history(
    conversation_history: list[dict[str, Any]] | None,
) -> str | None:

    history = _customer_history(
        conversation_history
    )

    if not history:
        return None

    priority = [
        "refund_status",
        "cancellation",
        "delivery_issue",
        "payment_issue",
        "account_issue",
        "complaint",
        "return_exchange",
        "general_inquiry",
    ]

    for previous_message in reversed(
        history[-8:]
    ):

        primary_scores = _primary_intent_scores(
            previous_message
        )

        if not primary_scores:
            continue

        return max(
            primary_scores,
            key=lambda intent: (
                primary_scores[intent],
                -priority.index(intent),
            ),
        )

    return None


# ============================================================
# TASK 4 - INTENT
# ============================================================

def detect_intent(
    message: str,
    conversation_history: list[dict[str, Any]] | None = None,
) -> str:

    text = _normalize_text(message)

    if not text:
        return "general_inquiry"

    # --------------------------------------------------------
    # STEP 1:
    # Detect an explicit PRIMARY issue in the current message.
    # --------------------------------------------------------

    primary_scores = _primary_intent_scores(
        text
    )

    # --------------------------------------------------------
    # Replacement handling
    #
    # "My package is late. Send a replacement."
    # -> delivery_issue
    #
    # "My item is damaged. Send a replacement."
    # -> return_exchange
    # --------------------------------------------------------

    if (
        "return_exchange" not in primary_scores
        and _has_any_signal(
            text,
            [
                "replacement",
                "replace",
                "ship a replacement",
                "send me another",
            ],
        )
    ):

        condition_signals = [
            "damaged",
            "defective",
            "broken",
            "wrong item",
            "wrong product",
            "size",
            "doesn't fit",
            "does not fit",
            "incorrect item",
            "incorrect product",
        ]

        explicit_return_context = [
            "return",
            "exchange",
            "item",
            "product",
            "damaged",
            "defective",
            "broken",
            "wrong",
            "size",
        ]

        if (
            _has_any_signal(
                text,
                condition_signals,
            )
            and _has_any_signal(
                text,
                explicit_return_context,
            )
        ):
            primary_scores[
                "return_exchange"
            ] = 3

    # --------------------------------------------------------
    # Current explicit issue wins.
    # --------------------------------------------------------

    if primary_scores:

        priority = [
            "refund_status",
            "cancellation",
            "delivery_issue",
            "payment_issue",
            "account_issue",
            "complaint",
            "return_exchange",
            "general_inquiry",
        ]

        return max(
            primary_scores,
            key=lambda intent: (
                primary_scores[intent],
                -priority.index(intent),
            ),
        )

    # --------------------------------------------------------
    # STEP 2:
    # No explicit primary issue.
    # Use established context.
    # --------------------------------------------------------

    established_intent = (
        _established_intent_from_history(
            conversation_history
        )
    )

    # --------------------------------------------------------
    # Remedy-only messages preserve established issue.
    # --------------------------------------------------------

    if (
        established_intent
        and _is_remedy_only_message(text)
    ):
        return established_intent

    # --------------------------------------------------------
    # Generic continuation signals.
    # --------------------------------------------------------

    generic_continuation_signals = [
        "again",
        "still",
        "already explained",
        "already told",
        "previous agent",
        "previous agents",
        "taking too long",
        "taking way too long",
        "not an answer",
        "real solution",
        "what are you going to do",
        "what can you do",
        "i'm frustrated",
        "i am frustrated",
        "frustrated",
        "sick of this",
        "fed up",
        "this is ridiculous",
        "this is unacceptable",
        "where is the answer",
        "give me a straight answer",
    ]

    if (
        established_intent
        and _has_any_signal(
            text,
            generic_continuation_signals,
        )
    ):
        return established_intent

    # --------------------------------------------------------
    # STEP 3:
    # Normal keyword classification.
    # --------------------------------------------------------

    scores = _intent_scores(text)

    if scores:

        priority = [
            "refund_status",
            "cancellation",
            "delivery_issue",
            "payment_issue",
            "account_issue",
            "complaint",
            "return_exchange",
            "general_inquiry",
        ]

        # Generic account terms should not dominate a
        # meaningful support issue.
        if (
            "account_issue" in scores
            and scores["account_issue"] <= 1
        ):

            scores = {
                intent: score
                for intent, score in scores.items()
                if intent != "account_issue"
            }

            if not scores:
                return (
                    established_intent
                    or "general_inquiry"
                )

        return max(
            scores,
            key=lambda intent: (
                scores[intent],
                -priority.index(intent),
            ),
        )

    # --------------------------------------------------------
    # STEP 4:
    # Final context fallback.
    # --------------------------------------------------------

    if established_intent:
        return established_intent

    return "general_inquiry"


# ============================================================
# TASK 4 - EMOTION
# ============================================================

def detect_emotion(
    message: str,
    conversation_history: list[dict[str, Any]] | None = None,
) -> str:

    text = _normalize_text(message)

    priority = [
        "angry",
        "frustrated",
        "worried",
        "confused",
        "happy",
        "satisfied",
    ]

    scores = {}

    for emotion in priority:

        score = _keyword_matches(
            text,
            EMOTION_KEYWORDS[emotion],
        )

        if score > 0:
            scores[emotion] = score

    if scores:

        return max(
            scores,
            key=lambda emotion: (
                scores[emotion],
                -priority.index(emotion),
            ),
        )

    # Use recent context only when the current message has
    # no explicit emotional signal.
    history = _customer_history(
        conversation_history
    )

    for previous_message in reversed(
        history[-3:]
    ):

        previous_scores = {}

        for emotion in priority:

            score = _keyword_matches(
                previous_message,
                EMOTION_KEYWORDS[emotion],
            )

            if score > 0:
                previous_scores[emotion] = score

        if previous_scores:

            return max(
                previous_scores,
                key=lambda emotion: (
                    previous_scores[emotion],
                    -priority.index(emotion),
                ),
            )

    return "neutral"


# ============================================================
# TASK 4 - SENTIMENT
# ============================================================

def detect_sentiment(
    message: str,
) -> str:

    text = _normalize_text(message)

    positive_count = sum(
        1
        for word in POSITIVE_WORDS
        if re.search(
            rf"(?<!\w){re.escape(word)}(?!\w)",
            text,
        )
    )

    negative_count = sum(
        1
        for word in NEGATIVE_WORDS
        if re.search(
            rf"(?<!\w){re.escape(word)}(?!\w)",
            text,
        )
    )

    clarification_signals = [
        "clarification",
        "clarify",
        "what do i need",
        "how do i",
        "where can i",
        "what happens",
        "not sure",
        "i need information",
        "can you explain",
    ]

    is_clarification = any(
        signal in text
        for signal in clarification_signals
    )

    if negative_count > positive_count:
        return "Negative"

    if positive_count > negative_count:

        if (
            is_clarification
            and negative_count == 0
        ):
            return "Neutral"

        return "Positive"

    if text.count("!") >= 2:
        return "Negative"

    if text.count("?") >= 3:
        return "Negative"

    return "Neutral"


# ============================================================
# TASK 4 - FRUSTRATION
# ============================================================

def calculate_frustration(
    message: str,
    conversation_history: list[dict[str, Any]] | None = None,
) -> int:

    text = _normalize_text(message)

    score = 0.0

    # --------------------------------------------------------
    # General negative language
    # --------------------------------------------------------

    negative_count = _keyword_matches(
        text,
        list(NEGATIVE_WORDS),
    )

    score += min(
        negative_count * 0.8,
        3.0,
    )

    # --------------------------------------------------------
    # Explicit frustration signals
    # --------------------------------------------------------

    frustration_words = [
        "frustrated",
        "frustrating",
        "fed up",
        "tired of",
        "sick of",
        "again",
        "still",
        "already told",
        "already explained",
        "how many times",
        "waste of time",
        "taking too long",
        "taking way too long",
        "taking longer",
        "taking much longer",
        "brush-off",
        "brush off",
        "runaround",
        "platitudes",
        "vague answer",
        "vague answers",
        "not an answer",
        "not a real answer",
        "real solution",
        "right now",
        "are you serious",
        "seriously",
    ]

    frustration_count = _keyword_matches(
        text,
        frustration_words,
    )

    score += min(
        frustration_count * 1.25,
        4.5,
    )

    # --------------------------------------------------------
    # Strong anger signals
    # --------------------------------------------------------

    angry_words = [
        "angry",
        "furious",
        "ridiculous",
        "unacceptable",
        "outrageous",
        "worst",
        "hate",
        "fix this now",
        "right now",
        "manager",
        "supervisor",
    ]

    angry_count = _keyword_matches(
        text,
        angry_words,
    )

    score += min(
        angry_count * 1.5,
        3.0,
    )

    # --------------------------------------------------------
    # Explicit escalation language
    # --------------------------------------------------------

    escalation_count = _keyword_matches(
        text,
        ESCALATION_PHRASES,
    )

    score += min(
        escalation_count * 1.0,
        2.0,
    )

    # --------------------------------------------------------
    # Repetition / unresolved issue signals
    # --------------------------------------------------------

    repeated_terms = [
        "still",
        "again",
        "already",
        "explained",
        "told",
        "same",
        "yet",
        "twice",
        "three times",
        "previous agents",
        "previous agent",
    ]

    repeated_count = _keyword_matches(
        text,
        repeated_terms,
    )

    score += min(
        repeated_count * 0.75,
        3.0,
    )

    # --------------------------------------------------------
    # Multi-turn context
    # --------------------------------------------------------

    history = _customer_history(
        conversation_history
    )

    if len(history) >= 2:
        score += 0.75

    if len(history) >= 4:
        score += 0.75

    if len(history) >= 6:
        score += 0.75

    historical_text = " ".join(
        history[-6:]
    )

    historical_frustration_count = _keyword_matches(
        historical_text,
        [
            "still",
            "again",
            "already explained",
            "already told",
            "frustrated",
            "taking too long",
            "taking way too long",
            "not resolved",
            "not an answer",
            "sick of",
            "brush-off",
            "runaround",
        ],
    )

    score += min(
        historical_frustration_count * 0.5,
        2.5,
    )

    # --------------------------------------------------------
    # Punctuation / intensity
    # --------------------------------------------------------

    if "!!" in text:
        score += 1.0

    if text.count("?") >= 3:
        score += 0.75

    if text.count("?") >= 5:
        score += 0.5

    # --------------------------------------------------------
    # Strong explicit phrases
    # --------------------------------------------------------

    strong_frustration_patterns = [
        "i am completely sick of",
        "i'm completely sick of",
        "taking way longer than it should",
        "i really don't have time for this",
        "i really do not have time for this",
        "i want a real solution right now",
        "this is taking way too long",
        "just another excuse",
        "keep getting the runaround",
    ]

    strong_pattern_count = _keyword_matches(
        text,
        strong_frustration_patterns,
    )

    score += min(
        strong_pattern_count * 2.0,
        4.0,
    )

    return int(
        _clamp(
            round(score),
            0,
            10,
        )
    )


# ============================================================
# TASK 4 - SATISFACTION TREND
# ============================================================

def _sentiment_value(
    sentiment: str,
) -> int:

    if sentiment == "Positive":
        return 1

    if sentiment == "Negative":
        return -1

    return 0


def determine_satisfaction_trend(
    message: str,
    conversation_history: list[dict[str, Any]] | None = None,
) -> str:

    current_sentiment = detect_sentiment(
        message
    )

    history = _customer_history(
        conversation_history
    )

    if not history:

        if current_sentiment == "Positive":
            return "Improving"

        if current_sentiment == "Negative":
            return "Declining"

        return "Stable"

    recent_history = history[-4:]

    previous_sentiments = [
        detect_sentiment(previous)
        for previous in recent_history
    ]

    previous_values = [
        _sentiment_value(sentiment)
        for sentiment in previous_sentiments
    ]

    current_value = _sentiment_value(
        current_sentiment
    )

    average_previous = (
        sum(previous_values)
        / len(previous_values)
        if previous_values
        else 0
    )

    if current_value > average_previous:
        return "Improving"

    if current_value < average_previous:
        return "Declining"

    current_frustration = calculate_frustration(
        message,
        conversation_history,
    )

    previous_frustrations = [
        calculate_frustration(previous)
        for previous in recent_history
    ]

    if previous_frustrations:

        average_frustration = (
            sum(previous_frustrations)
            / len(previous_frustrations)
        )

        if (
            current_frustration
            > average_frustration + 1
        ):
            return "Declining"

        if (
            current_frustration
            < average_frustration - 1
        ):
            return "Improving"

    return "Stable"


# ============================================================
# TASK 4 - ESCALATION RISK
# ============================================================

def detect_escalation_risk(
    frustration_level: int,
    message: str,
    conversation_history: list[dict[str, Any]] | None = None,
) -> str:

    text = _normalize_text(message)

    escalation_count = _keyword_matches(
        text,
        ESCALATION_PHRASES,
    )

    high_risk_phrases = [
        "legal action",
        "lawyer",
        "consumer court",
        "chargeback",
        "report you",
    ]

    has_high_risk_phrase = any(
        phrase in text
        for phrase in high_risk_phrases
    )

    history = _customer_history(
        conversation_history
    )

    historical_escalation_count = _keyword_matches(
        " ".join(history[-6:]),
        ESCALATION_PHRASES,
    )

    if (
        frustration_level >= 8
        or has_high_risk_phrase
        or escalation_count >= 2
        or historical_escalation_count >= 2
    ):
        return "High"

    if (
        frustration_level >= 5
        or escalation_count >= 1
        or historical_escalation_count >= 1
        or len(history) >= 4
    ):
        return "Medium"

    return "Low"


# ============================================================
# GEMINI CONFIGURATION
# ============================================================

def _get_gemini_client():

    if genai is None:
        return None

    api_key = (
        os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
    )

    if not api_key:
        return None

    try:
        return genai.Client(
            api_key=api_key
        )

    except Exception:
        return None


def _get_analysis_model() -> str:

    return (
        os.getenv("GEMINI_ANALYSIS_MODEL")
        or os.getenv("GEMINI_MODEL")
        or "gemini-3.5-flash"
    )


# ============================================================
# GEMINI PROMPT
# ============================================================

def _build_analysis_prompt(
    message: str,
    conversation_history: list[dict[str, Any]] | None,
) -> str:

    history = _customer_history(
        conversation_history
    )

    if history:

        history_text = "\n".join(
            f"{index + 1}. {item}"
            for index, item in enumerate(
                history[-8:]
            )
        )

    else:

        history_text = (
            "No previous customer messages."
        )

    return f"""
You are the Task 4 AI Intent and Sentiment Analysis Agent
for a real-world Customer Support Assistant.

Analyze the CURRENT CUSTOMER MESSAGE together with the
previous customer messages.

CURRENT CUSTOMER MESSAGE:
{message}

PREVIOUS CUSTOMER MESSAGES:
{history_text}

Return exactly these fields:

1. intent
Allowed values:
refund_status
cancellation
delivery_issue
payment_issue
account_issue
complaint
return_exchange
general_inquiry

2. emotion
Allowed values:
happy
neutral
confused
worried
frustrated
angry
satisfied

3. sentiment
Allowed values:
Positive
Neutral
Negative

4. frustration_level
Integer from 0 to 10.

5. satisfaction_trend
Allowed values:
Improving
Declining
Stable

6. escalation_risk
Allowed values:
Low
Medium
High

7. confidence
Number from 0 to 1.

IMPORTANT INTENT RULES:

- Identify the customer's PRIMARY SUPPORT ISSUE.
- Use conversation context, but do not permanently lock the
  customer to a previous intent.
- If the customer clearly introduces a NEW primary issue,
  change the intent.
- If the customer is continuing the same issue, preserve the
  established intent.
- Generic words such as "account" do not automatically mean
  account_issue.
- Manager, supervisor, escalation, or legal language is an
  escalation signal, not automatically the primary intent.
- "replacement", "replace", "credit", or "compensation" are
  remedies and should NOT automatically create return_exchange
  or payment_issue.

Examples:

"My package is late. Please send a replacement."
-> delivery_issue

"My item arrived damaged. I want a replacement."
-> return_exchange

"I was charged twice. Give me a credit."
-> payment_issue

"My package was late, but it arrived damaged. I want to
return it."
-> return_exchange because the primary issue changed.

"My order is late. I've already contacted support twice."
-> delivery_issue.

- Repeated unresolved complaints should increase frustration.
- "sick of this", "brush-off", "runaround", "taking way too
  long", "not an answer", "real solution", and similar language
  indicate significant frustration.
- Manager/supervisor/legal/chargeback/escalation requests
  increase escalation risk.
- Satisfaction trend must consider the conversation history.
- Polite clarification should not automatically mean positive
  sentiment or satisfaction.

Return ONLY valid JSON.

Example:
{{
  "intent": "delivery_issue",
  "emotion": "frustrated",
  "sentiment": "Negative",
  "frustration_level": 8,
  "satisfaction_trend": "Declining",
  "escalation_risk": "High",
  "confidence": 0.94
}}
""".strip()


# ============================================================
# VALIDATE GEMINI RESULT
# ============================================================

def _validate_ai_analysis(
    data: Any,
) -> dict[str, Any] | None:

    if not isinstance(data, dict):
        return None

    required_keys = {
        "intent",
        "emotion",
        "sentiment",
        "frustration_level",
        "satisfaction_trend",
        "escalation_risk",
        "confidence",
    }

    if not required_keys.issubset(
        data.keys()
    ):
        return None

    intent = str(
        data["intent"]
    ).strip()

    emotion = str(
        data["emotion"]
    ).strip().lower()

    sentiment = str(
        data["sentiment"]
    ).strip()

    satisfaction_trend = str(
        data["satisfaction_trend"]
    ).strip()

    escalation_risk = str(
        data["escalation_risk"]
    ).strip()

    if intent not in SUPPORTED_INTENTS:
        return None

    if emotion not in SUPPORTED_EMOTIONS:
        return None

    if sentiment not in SUPPORTED_SENTIMENTS:
        return None

    if (
        satisfaction_trend
        not in SUPPORTED_SATISFACTION_TRENDS
    ):
        return None

    if (
        escalation_risk
        not in SUPPORTED_ESCALATION_RISKS
    ):
        return None

    try:

        frustration_level = int(
            round(
                float(
                    data["frustration_level"]
                )
            )
        )

        confidence = float(
            data["confidence"]
        )

    except (
        TypeError,
        ValueError,
    ):

        return None

    frustration_level = int(
        _clamp(
            frustration_level,
            0,
            10,
        )
    )

    confidence = _clamp(
        confidence,
        0.0,
        1.0,
    )

    return {
        "intent": intent,
        "emotion": emotion,
        "sentiment": sentiment,
        "frustration_level": frustration_level,
        "satisfaction_trend": satisfaction_trend,
        "escalation_risk": escalation_risk,
        "confidence": round(
            confidence,
            2,
        ),
    }


# ============================================================
# RECONCILE AI RESULT WITH TASK 4 RULES
# ============================================================

def _reconcile_analysis(
    ai_result: dict[str, Any],
    message: str,
    conversation_history: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:

    result = dict(ai_result)

    # --------------------------------------------------------
    # INTENT
    # Deterministic primary-issue classification is the
    # safety layer for Gemini semantic mistakes.
    # --------------------------------------------------------

    deterministic_intent = detect_intent(
        message,
        conversation_history,
    )

    result["intent"] = deterministic_intent

    # --------------------------------------------------------
    # FRUSTRATION
    # Deterministic score acts as a minimum safety level.
    # --------------------------------------------------------

    deterministic_frustration = calculate_frustration(
        message,
        conversation_history,
    )

    try:

        ai_frustration = int(
            float(
                result.get(
                    "frustration_level",
                    0,
                )
            )
        )

    except (
        TypeError,
        ValueError,
    ):

        ai_frustration = 0

    ai_frustration = int(
        _clamp(
            ai_frustration,
            0,
            10,
        )
    )

    result["frustration_level"] = max(
        ai_frustration,
        deterministic_frustration,
    )

    # --------------------------------------------------------
    # EMOTION
    # --------------------------------------------------------

    deterministic_emotion = detect_emotion(
        message,
        conversation_history,
    )

    if deterministic_emotion in {
        "angry",
        "frustrated",
    }:

        if result.get("emotion") in {
            "neutral",
            "confused",
            "worried",
        }:

            result["emotion"] = (
                deterministic_emotion
            )

    # --------------------------------------------------------
    # SENTIMENT
    # --------------------------------------------------------

    deterministic_sentiment = detect_sentiment(
        message
    )

    if (
        deterministic_sentiment == "Negative"
        and result.get("sentiment") == "Positive"
    ):

        result["sentiment"] = "Negative"

    if (
        deterministic_sentiment == "Positive"
        and result.get("sentiment") == "Negative"
    ):

        result["sentiment"] = "Positive"

    # --------------------------------------------------------
    # SATISFACTION TREND
    # --------------------------------------------------------

    result["satisfaction_trend"] = (
        determine_satisfaction_trend(
            message,
            conversation_history,
        )
    )

    # --------------------------------------------------------
    # ESCALATION RISK
    # --------------------------------------------------------

    result["escalation_risk"] = (
        detect_escalation_risk(
            frustration_level=result[
                "frustration_level"
            ],
            message=message,
            conversation_history=conversation_history,
        )
    )

    return result


# ============================================================
# GEMINI ANALYSIS
# ============================================================

def _analyze_with_gemini(
    message: str,
    conversation_history: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:

    client = _get_gemini_client()

    if client is None:
        return None

    model = _get_analysis_model()

    prompt = _build_analysis_prompt(
        message=message,
        conversation_history=conversation_history,
    )

    try:

        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
            },
        )

        response_text = getattr(
            response,
            "text",
            None,
        )

        if not response_text:
            return None

        response_text = response_text.strip()

        # Handle accidental Markdown JSON fences.
        if response_text.startswith("```"):

            response_text = re.sub(
                r"^```(?:json)?\s*",
                "",
                response_text,
                flags=re.IGNORECASE,
            )

            response_text = re.sub(
                r"\s*```$",
                "",
                response_text,
            )

        data = json.loads(
            response_text
        )

        return _validate_ai_analysis(
            data
        )

    except Exception as exc:

        print(
            f"Gemini Task 4 analysis failed: {exc}"
        )

        return None


# ============================================================
# DETERMINISTIC FALLBACK
# ============================================================

def _fallback_analysis(
    message: str,
    conversation_history: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:

    intent = detect_intent(
        message,
        conversation_history,
    )

    emotion = detect_emotion(
        message,
        conversation_history,
    )

    sentiment = detect_sentiment(
        message
    )

    frustration_level = calculate_frustration(
        message,
        conversation_history,
    )

    satisfaction_trend = determine_satisfaction_trend(
        message,
        conversation_history,
    )

    escalation_risk = detect_escalation_risk(
        frustration_level=frustration_level,
        message=message,
        conversation_history=conversation_history,
    )

    confidence = 0.60

    text = _normalize_text(message)

    intent_matches = _keyword_matches(
        text,
        INTENT_KEYWORDS.get(
            intent,
            [],
        ),
    )

    emotion_matches = _keyword_matches(
        text,
        EMOTION_KEYWORDS.get(
            emotion,
            [],
        ),
    )

    if intent_matches:

        confidence += min(
            intent_matches * 0.05,
            0.20,
        )

    if emotion_matches:

        confidence += min(
            emotion_matches * 0.04,
            0.12,
        )

    if sentiment != "Neutral":
        confidence += 0.04

    if len(text.split()) >= 20:
        confidence += 0.03

    if conversation_history:
        confidence += 0.03

    confidence = _clamp(
        confidence,
        0.0,
        0.99,
    )

    return {
        "intent": intent,
        "emotion": emotion,
        "sentiment": sentiment,
        "frustration_level": frustration_level,
        "satisfaction_trend": satisfaction_trend,
        "escalation_risk": escalation_risk,
        "confidence": round(
            confidence,
            2,
        ),
    }


# ============================================================
# MAIN TASK 4 ANALYSIS
# ============================================================

def analyze_customer_message(
    message: str,
    conversation_history: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:

    message = str(
        message or ""
    ).strip()

    if not message:

        return {
            "intent": "general_inquiry",
            "emotion": "neutral",
            "sentiment": "Neutral",
            "frustration_level": 0,
            "satisfaction_trend": "Stable",
            "escalation_risk": "Low",
            "confidence": 0.60,
        }

    # --------------------------------------------------------
    # Gemini semantic analysis
    # --------------------------------------------------------

    ai_result = _analyze_with_gemini(
        message=message,
        conversation_history=conversation_history,
    )

    if ai_result is not None:

        return _reconcile_analysis(
            ai_result=ai_result,
            message=message,
            conversation_history=conversation_history,
        )

    # --------------------------------------------------------
    # Deterministic fallback
    # --------------------------------------------------------

    return _fallback_analysis(
        message=message,
        conversation_history=conversation_history,
    )