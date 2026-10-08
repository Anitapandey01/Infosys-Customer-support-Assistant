"""
Task 6 - Coaching and Response Suggestion Agent.

Generates context-aware support-agent response suggestions,
evaluates communication quality, and provides actionable coaching tips.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

try:
    from google import genai
except ImportError:
    genai = None


SUPPORTED_TONES = {
    "Professional",
    "Empathetic",
    "Calm",
    "Clear",
    "Reassuring",
}


SUPPORTED_RATINGS = {
    "Good",
    "Needs Improvement",
}


# ============================================================
# TEXT HELPERS
# ============================================================

def _normalize_text(value: str | None) -> str:
    return " ".join(
        str(value or "").strip().lower().split()
    )


def _customer_history(
    conversation_history: list[dict[str, Any]] | None,
) -> list[str]:

    if not conversation_history:
        return []

    return [
        str(item.get("message_text", "")).strip()
        for item in conversation_history
        if str(item.get("message_text", "")).strip()
        and str(item.get("sender_type", "")).strip().lower()
        == "customer"
    ]


def _latest_customer_message(
    message: str,
    conversation_history: list[dict[str, Any]] | None,
) -> str:

    cleaned_message = str(message or "").strip()

    if cleaned_message:
        return cleaned_message

    history = _customer_history(conversation_history)

    return history[-1] if history else ""


# ============================================================
# GEMINI
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
        return genai.Client(api_key=api_key)
    except Exception:
        return None


def _get_coaching_model() -> str:

    return (
        os.getenv("GEMINI_COACHING_MODEL")
        or os.getenv("GEMINI_MODEL")
        or "gemini-3.5-flash-lite"
    )


def _build_coaching_prompt(
    message: str,
    intent: str,
    emotion: str,
    sentiment: str,
    frustration_level: int,
    escalation_risk: str,
    conversation_history: list[dict[str, Any]] | None,
    knowledge_recommendations: list[dict[str, Any]] | None,
) -> str:

    history = conversation_history or []

    history_text = "\n".join(
        (
            f"{index + 1}. "
            f"{item.get('sender_type', 'Unknown')}: "
            f"{item.get('message_text', '')}"
        )
        for index, item in enumerate(history[-8:])
    )

    if not history_text:
        history_text = "No previous conversation."

    knowledge_text = "\n".join(
        (
            f"{index + 1}. "
            f"{item.get('title', 'Knowledge item')}: "
            f"{item.get('content', '')}"
        )
        for index, item in enumerate(
            (knowledge_recommendations or [])[:5]
        )
    )

    if not knowledge_text:
        knowledge_text = "No knowledge-base recommendations available."

    return f"""
You are the Task 6 Coaching and Response Suggestion Agent
for a customer-support assistant.

Generate one response that a human support agent can send to
the customer.

CURRENT CUSTOMER MESSAGE:
{message}

CUSTOMER ANALYSIS:
Intent: {intent}
Emotion: {emotion}
Sentiment: {sentiment}
Frustration: {frustration_level}/10
Escalation Risk: {escalation_risk}

CONVERSATION HISTORY:
{history_text}

KNOWLEDGE-BASE RESULTS:
{knowledge_text}

Requirements:

1. The suggested response must directly address the customer's
   current issue.
2. Use the knowledge-base information when relevant.
3. Do not invent policies, refunds, timelines, actions,
   account changes, or guarantees that are not supported.
4. Acknowledge frustration when frustration is present.
5. Keep the response professional, clear, concise, and natural.
6. Do not blame the customer.
7. If the issue requires verification or approval, clearly say so.
8. If escalation risk is High or Critical, acknowledge the concern
   and recommend an appropriate escalation-aware response.
9. Do not claim that a refund or other action has already been
   completed unless the conversation explicitly confirms it.
10. The response should sound like a real support agent, not an AI.
11. Do not copy or repeat a previous support-agent response.
12. If a previous agent response appears in the conversation history,
    generate a meaningfully different response that addresses the
    customer's latest message.
13. The response must be based primarily on the CURRENT CUSTOMER
    MESSAGE and the provided customer analysis.
14. Do not respond to a previous customer message when a newer
    customer message is available.

Evaluate the response on:
- tone
- clarity
- empathy
- professionalism

Also provide actionable coaching tips.

Return ONLY valid JSON using exactly this structure:

{{
  "suggested_response": "...",
  "tone": "...",
  "clarity": "...",
  "empathy": "...",
  "professionalism": "...",
  "communication_rating": "Good",
  "coaching_tips": [
    "...",
    "..."
  ]
}}
""".strip()


# ============================================================
# VALIDATION
# ============================================================

def _validate_coaching_result(
    data: Any,
) -> dict[str, Any] | None:

    if not isinstance(data, dict):
        return None

    required_keys = {
        "suggested_response",
        "tone",
        "clarity",
        "empathy",
        "professionalism",
        "communication_rating",
        "coaching_tips",
    }

    if not required_keys.issubset(data.keys()):
        return None

    suggested_response = str(
        data.get("suggested_response", "")
    ).strip()

    if not suggested_response:
        return None

    communication_rating = str(
        data.get("communication_rating", "")
    ).strip()

    if communication_rating not in SUPPORTED_RATINGS:
        return None

    coaching_tips = data.get("coaching_tips")

    if not isinstance(coaching_tips, list):
        return None

    cleaned_tips = [
        str(tip).strip()
        for tip in coaching_tips
        if str(tip).strip()
    ]

    if not cleaned_tips:
        return None

    return {
        "suggested_response": suggested_response,
        "tone": str(data.get("tone", "")).strip(),
        "clarity": str(data.get("clarity", "")).strip(),
        "empathy": str(data.get("empathy", "")).strip(),
        "professionalism": str(
            data.get("professionalism", "")
        ).strip(),
        "communication_rating": communication_rating,
        "coaching_tips": cleaned_tips[:5],
    }


# ============================================================
# DETERMINISTIC RESPONSE SUGGESTION
# ============================================================

def _build_fallback_response(
    message: str,
    intent: str,
    emotion: str,
    frustration_level: int,
    escalation_risk: str,
    knowledge_recommendations: list[dict[str, Any]] | None,
) -> str:

    normalized_intent = _normalize_text(intent)

    acknowledgement = ""

    if frustration_level >= 7 or emotion.lower() in {
        "frustrated",
        "angry",
    }:
        acknowledgement = (
            "I understand why this is frustrating, and I’m sorry "
            "for the inconvenience. "
        )

    elif frustration_level >= 4 or emotion.lower() in {
        "worried",
        "confused",
    }:
        acknowledgement = (
            "I understand your concern. "
        )

    else:
        acknowledgement = (
            "Thank you for reaching out. "
        )

    knowledge_items = knowledge_recommendations or []

    knowledge_content = ""

    if knowledge_items:
        knowledge_content = str(
            knowledge_items[0].get("content", "")
        ).strip()

    if normalized_intent == "refund_status":
        response = (
            f"{acknowledgement}"
            "I’ll help clarify the refund status. "
        )

        if knowledge_content:
            response += (
                "The current support information indicates that "
                "refund processing follows the applicable eligibility "
                "and approval process. "
            )

        response += (
            "Please allow us to verify the order and refund status "
            "before confirming the next step."
        )

    elif normalized_intent == "cancellation":
        response = (
            f"{acknowledgement}"
            "I can help with the cancellation request. "
            "Cancellation and refund eligibility are handled "
            "separately, so the account and order details need to "
            "be verified before confirming the outcome."
        )

    elif normalized_intent == "delivery_issue":
        response = (
            f"{acknowledgement}"
            "I’ll check the delivery issue and the latest available "
            "order information so we can determine the appropriate "
            "next step."
        )

    elif normalized_intent == "payment_issue":
        response = (
            f"{acknowledgement}"
            "I’ll help review the payment issue and verify the "
            "transaction details before confirming the resolution."
        )

    elif normalized_intent == "account_issue":
        response = (
            f"{acknowledgement}"
            "I’ll help identify the account issue and guide you "
            "through the appropriate next step."
        )

    elif normalized_intent == "return_exchange":
        response = (
            f"{acknowledgement}"
            "I’ll help review the return or exchange request and "
            "confirm the applicable eligibility and next step."
        )

    elif normalized_intent == "complaint":
        response = (
            f"{acknowledgement}"
            "I’ll review the concern carefully and focus on the "
            "specific issue that still needs to be resolved."
        )

    else:
        response = (
            f"{acknowledgement}"
            "I’ll review the details you provided and help with "
            "the appropriate next step."
        )

    if escalation_risk in {"High", "Critical"}:
        response += (
            " Given the concern raised, this can be escalated to "
            "the appropriate support team if the issue cannot be "
            "resolved here."
        )

    return response


# ============================================================
# FALLBACK COACHING
# ============================================================

def _fallback_coaching(
    message: str,
    intent: str,
    emotion: str,
    sentiment: str,
    frustration_level: int,
    escalation_risk: str,
    conversation_history: list[dict[str, Any]] | None,
    knowledge_recommendations: list[dict[str, Any]] | None,
) -> dict[str, Any]:

    suggested_response = _build_fallback_response(
        message=message,
        intent=intent,
        emotion=emotion,
        frustration_level=frustration_level,
        escalation_risk=escalation_risk,
        knowledge_recommendations=knowledge_recommendations,
    )

    tips: list[str] = []

    if frustration_level >= 5:
        tips.append(
            "Acknowledge the customer's frustration before giving the next step."
        )

    if sentiment == "Negative":
        tips.append(
            "Use calm, solution-focused language instead of defensive wording."
        )

    if escalation_risk in {"High", "Critical"}:
        tips.append(
            "Avoid making promises and clearly explain the escalation or verification path."
        )

    if not conversation_history:
        tips.append(
            "Use the customer's current message as the primary context."
        )

    if not tips:
        tips.append(
            "Keep the response concise and focused on the customer's primary issue."
        )

    return {
        "suggested_response": suggested_response,
        "tone": (
            "Empathetic and calm"
            if frustration_level >= 4
            else "Professional and clear"
        ),
        "clarity": (
            "Clear next step provided."
        ),
        "empathy": (
            "Acknowledges the customer's concern."
            if frustration_level >= 4
            else "Uses respectful customer-focused language."
        ),
        "professionalism": (
            "Avoids unsupported promises and keeps the response professional."
        ),
        "communication_rating": "Good",
        "coaching_tips": tips[:5],
    }


# ============================================================
# GEMINI COACHING
# ============================================================

def _generate_with_gemini(
    message: str,
    intent: str,
    emotion: str,
    sentiment: str,
    frustration_level: int,
    escalation_risk: str,
    conversation_history: list[dict[str, Any]] | None,
    knowledge_recommendations: list[dict[str, Any]] | None,
) -> dict[str, Any] | None:

    client = _get_gemini_client()

    if client is None:
        return None

    prompt = _build_coaching_prompt(
        message=message,
        intent=intent,
        emotion=emotion,
        sentiment=sentiment,
        frustration_level=frustration_level,
        escalation_risk=escalation_risk,
        conversation_history=conversation_history,
        knowledge_recommendations=knowledge_recommendations,
    )

    try:
        response = client.models.generate_content(
            model=_get_coaching_model(),
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

        data = json.loads(response_text)

        return _validate_coaching_result(data)

    except Exception as exc:
        print(
            f"Gemini Task 6 coaching failed: {exc}"
        )
        return None


# ============================================================
# PUBLIC API
# ============================================================

def generate_coaching(
    message: str,
    intent: str = "general_inquiry",
    emotion: str = "neutral",
    sentiment: str = "Neutral",
    frustration_level: int = 0,
    escalation_risk: str = "Low",
    conversation_history: list[dict[str, Any]] | None = None,
    knowledge_recommendations: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:

    message = _latest_customer_message(
        message,
        conversation_history,
    )

    if not message:
        return {
            "suggested_response": (
                "Please provide the customer's message so a "
                "context-aware response can be suggested."
            ),
            "tone": "Professional and clear",
            "clarity": "No customer message was provided.",
            "empathy": "Unable to evaluate without customer context.",
            "professionalism": "Professional fallback response.",
            "communication_rating": "Needs Improvement",
            "coaching_tips": [
                "Provide the customer's latest message before generating a response."
            ],
        }

    ai_result = _generate_with_gemini(
        message=message,
        intent=intent,
        emotion=emotion,
        sentiment=sentiment,
        frustration_level=int(frustration_level),
        escalation_risk=escalation_risk,
        conversation_history=conversation_history,
        knowledge_recommendations=knowledge_recommendations,
    )

    if ai_result is not None:
        return ai_result

    return _fallback_coaching(
        message=message,
        intent=intent,
        emotion=emotion,
        sentiment=sentiment,
        frustration_level=int(frustration_level),
        escalation_risk=escalation_risk,
        conversation_history=conversation_history,
        knowledge_recommendations=knowledge_recommendations,
    )
