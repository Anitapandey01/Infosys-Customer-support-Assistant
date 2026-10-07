"""
Task 8 - Post-Interaction Summary Service.

Generates a structured post-interaction report for completed customer support sessions,
computing sentiment journey timeline, resolution quality (0-100), communication quality,
empathy, policy adherence, agent strengths, weaknesses, and personalized coaching recommendations.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session as DBSession

from app.models.simulator import (
    Session,
    Conversation,
    Message,
    Scenario,
    SessionSummary,
)
from app.services.analysis_service import analyze_customer_message
from app.services.escalation_service import calculate_escalation_risk
from app.services.knowledge_recommendation_service import recommend_knowledge


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _normalize_text(val: Any) -> str:
    if val is None:
        return ""
    return str(val).strip()


def _is_customer(sender: str) -> bool:
    s = sender.lower()
    return "customer" in s or s in {"user", "client"}


def _is_agent(sender: str) -> bool:
    s = sender.lower()
    return "agent" in s or "support" in s or s in {"assistant", "rep", "representative"}


# ============================================================================
# METRICS COMPUTATION
# ============================================================================

def calculate_resolution_quality_score(
    resolution_status: str,
    initial_frustration: int,
    final_frustration: int,
    peak_frustration: int,
    escalation_risk: str,
    turn_count: int,
) -> float:
    """
    Computes a mathematically sound Resolution Quality Score from 0 to 100.

    Formula:
      - Base: 100
      - Frustration deduction: -(final_frustration * 4)  (up to -40)
      - Frustration trajectory bonus/penalty:
          if final < initial: + min((initial - final) * 3, 15)
          if final > initial: - min((final - initial) * 3, 15)
      - Peak frustration drag: -(peak_frustration * 1.5)  (up to -15)
      - Escalation deduction:
          "Critical": -25
          "High": -15
          "Medium": -5
          "Low": 0
      - Resolution Status adjustment:
          "Resolved": +10
          "Unresolved": -15
          "Escalated": -25
      - Clamped to [0.0, 100.0]
    """
    score = 100.0

    # Final frustration impact
    score -= max(0, min(10, final_frustration)) * 4.0

    # Frustration delta
    if final_frustration < initial_frustration:
        score += min((initial_frustration - final_frustration) * 3.0, 15.0)
    elif final_frustration > initial_frustration:
        score -= min((final_frustration - initial_frustration) * 3.0, 15.0)

    # Peak drag
    score -= max(0, min(10, peak_frustration)) * 1.5

    # Escalation impact
    risk_normalized = escalation_risk.strip().title()
    if risk_normalized == "Critical":
        score -= 25.0
    elif risk_normalized == "High":
        score -= 15.0
    elif risk_normalized == "Medium":
        score -= 5.0

    # Resolution status impact
    status_normalized = resolution_status.strip().title()
    if status_normalized == "Resolved":
        score += 10.0
    elif status_normalized == "Escalated":
        score -= 25.0
    else:  # Unresolved
        score -= 15.0

    return max(0.0, min(100.0, round(score, 1)))


def calculate_empathy_and_communication_scores(
    agent_messages: list[str],
    customer_turns: list[dict[str, Any]],
) -> tuple[float, float, str]:
    """
    Calculates empathy score (0-100) and communication score (0-100) plus rating
    based on agent messages and customer frustration context.
    """
    if not agent_messages:
        return 50.0, 50.0, "Needs Improvement"

    empathy_indicators = [
        "understand", "apologize", "sorry", "appreciate", "patience",
        "hear you", "frustrat", "inconvenience", "glad to", "happy to help",
        "care", "reassure", "priority"
    ]
    clarity_indicators = [
        "step", "process", "details", "policy", "confirm", "order",
        "timeline", "business days", "refund", "receipt", "account"
    ]

    empathy_hits = 0
    clarity_hits = 0

    for msg in agent_messages:
        text = msg.lower()
        if any(w in text for w in empathy_indicators):
            empathy_hits += 1
        if any(w in text for w in clarity_indicators):
            clarity_hits += 1

    total = len(agent_messages)
    empathy_ratio = empathy_hits / total
    clarity_ratio = clarity_hits / total

    # Scores from 50 to 98
    empathy_score = round(50.0 + (empathy_ratio * 45.0), 1)
    communication_score = round(50.0 + ((empathy_ratio * 0.4 + clarity_ratio * 0.6) * 45.0), 1)

    rating = "Good" if communication_score >= 70.0 else "Needs Improvement"
    return empathy_score, communication_score, rating


def calculate_policy_adherence_score(
    knowledge_recommendations: list[dict[str, Any]],
    agent_messages: list[str],
) -> tuple[float, str]:
    """
    Evaluates policy adherence score (0-100) and rationale.
    """
    if not knowledge_recommendations:
        return 80.0, "Standard support protocols followed."

    # Average relevance
    scores = [
        float(k.get("relevance_score") or k.get("score") or 0.8)
        for k in knowledge_recommendations
        if isinstance(k, dict)
    ]
    avg_relevance = sum(scores) / len(scores) if scores else 0.8

    # Keyword adherence checks in agent messages
    policy_keywords = ["policy", "calendar days", "business days", "eligible", "refund", "return", "15"]
    combined_agent_text = " ".join(agent_messages).lower()

    adherence_bonus = 10.0 if any(k in combined_agent_text for k in policy_keywords) else 0.0
    adherence_score = round(min(100.0, (avg_relevance * 85.0) + adherence_bonus), 1)

    top_doc = knowledge_recommendations[0].get("document_name", "Support Knowledge Base")
    explanation = f"Grounded in verified policy documentation ({top_doc})."

    return adherence_score, explanation


def derive_strengths_and_weaknesses(
    agent_messages: list[str],
    sentiment_journey: list[dict[str, Any]],
    resolution_status: str,
    resolution_quality_score: float,
    empathy_score: float,
) -> tuple[list[str], list[str], list[str]]:
    """
    Synthesizes agent strengths, weaknesses, and personalized recommendations
    based on the interaction turns and metrics.
    """
    strengths: list[str] = []
    weaknesses: list[str] = []
    recommendations: list[str] = []

    # Strengths
    if empathy_score >= 70.0:
        strengths.append("Maintained an empathetic and supportive tone throughout customer exchanges.")
    if resolution_status == "Resolved":
        strengths.append("Successfully resolved the customer's inquiry.")
    if resolution_quality_score >= 80.0:
        strengths.append("Delivered high-quality, clear explanations with minimal customer friction.")


    if len(sentiment_journey) >= 2:
        init_frust = sentiment_journey[0]["frustration_level"]
        final_frust = sentiment_journey[-1]["frustration_level"]
        if final_frust < init_frust:
            strengths.append(f"Effectively de-escalated customer frustration from {init_frust}/10 to {final_frust}/10.")

    if not strengths:
        strengths.append("Maintained responsive communication with the customer.")

    # Weaknesses
    if empathy_score < 70.0:
        weaknesses.append("Empathy acknowledgment could be reinforced during initial customer distress.")
    if resolution_status == "Escalated":
        weaknesses.append("Interaction reached critical escalation before a satisfactory solution was reached.")
    elif resolution_status == "Unresolved":
        weaknesses.append("Interaction ended without confirmed customer satisfaction or formal resolution.")

    if len(sentiment_journey) >= 2:
        final_frust = sentiment_journey[-1]["frustration_level"]
        if final_frust >= 6:
            weaknesses.append("Customer concluded the interaction with noticeable residual frustration.")

    if not weaknesses:
        weaknesses.append("Minor opportunities to proactively offer next-step self-service resources.")

    # Coaching Recommendations
    if empathy_score < 75.0:
        recommendations.append("Validate customer frustration explicitly using reassuring phrases before quoting policies.")
    if resolution_status != "Resolved":
        recommendations.append("Confirm complete resolution of primary issue before concluding the customer session.")
    if any(p.get("escalation_risk") in ["High", "Critical"] for p in sentiment_journey):
        recommendations.append("Recognize early warning triggers and take immediate ownership to prevent escalation risk.")
    
    recommendations.append("Continue grounding timelines and return terms in authoritative verified policy guidelines.")

    return strengths, weaknesses, recommendations


# ============================================================================
# SUMMARY GENERATION
# ============================================================================

def generate_conversation_summary(
    messages: list[dict[str, Any]],
    session_id: int | str | None = None,
    scenario_title: str | None = None,
    initial_status: str | None = None,
) -> dict[str, Any]:
    """
    Generates a structured post-interaction report from a list of messages.
    Supports Simulator, Manual Mode, and Replay Mode.
    """
    customer_messages: list[dict[str, Any]] = []
    agent_messages: list[str] = []

    for msg in messages:
        sender = msg.get("sender_type") or msg.get("sender") or msg.get("role") or ""
        text = msg.get("message_text") or msg.get("message") or msg.get("text") or ""
        if not text.strip() or msg.get("message_type") == "System":
            continue

        if _is_customer(sender):
            customer_messages.append({"text": text.strip(), "raw": msg})
        elif _is_agent(sender):
            agent_messages.append(text.strip())

    if not customer_messages:
        # Default empty response
        return {
            "session_id": session_id,
            "scenario_title": scenario_title or "Customer Support Session",
            "concise_summary": "No customer interaction turns recorded.",
            "primary_customer_issue": "General Inquiry",
            "final_resolution": initial_status or "Unresolved",
            "resolution_quality_score": 50.0,
            "communication_quality": "Needs Improvement",
            "communication_score": 50.0,
            "empathy_score": 50.0,
            "policy_adherence_score": 50.0,
            "sentiment_journey": [],
            "agent_strengths": ["Session initiated."],
            "agent_weaknesses": ["No conversation turns to evaluate."],
            "coaching_recommendations": ["Ensure conversation turns are conducted before evaluating summary."],
            "total_turns": 0,
            "underlying_metrics": {
                "initial_frustration": 0,
                "final_frustration": 0,
                "peak_frustration": 0,
                "average_frustration": 0.0,
                "escalated": False,
            },
        }

    # Build sentiment journey across turns
    sentiment_journey: list[dict[str, Any]] = []
    turn_intents: list[str] = []
    all_knowledge_recs: list[dict[str, Any]] = []

    running_history: list[dict[str, Any]] = []

    for idx, c_item in enumerate(customer_messages, start=1):
        c_text = c_item["text"]
        raw_analysis = c_item["raw"].get("analysis")

        # If analysis was already stored with turn, reuse it; else analyze
        if isinstance(raw_analysis, dict) and "frustration_level" in raw_analysis:
            turn_analysis = raw_analysis
        else:
            turn_analysis = analyze_customer_message(
                message=c_text,
                conversation_history=running_history,
            )

        # Task 5 knowledge recommendation check
        recs = turn_analysis.get("knowledge_recommendations") or []
        if not recs:
            k_res = recommend_knowledge(message=c_text, conversation_history=running_history, number_of_recommendations=2)
            recs = k_res.get("recommendations", [])
        all_knowledge_recs.extend(recs)

        # Task 6 escalation check
        risk_data = calculate_escalation_risk(
            message=c_text,
            frustration_level=turn_analysis.get("frustration_level", 0),
            sentiment=turn_analysis.get("sentiment", "Neutral"),
            conversation_history=running_history,
        )

        frustration_val = int(turn_analysis.get("frustration_level", 0))
        sentiment_val = str(turn_analysis.get("sentiment", "Neutral"))
        emotion_val = str(turn_analysis.get("emotion", "neutral"))
        intent_val = str(turn_analysis.get("intent", "general_inquiry"))
        trend_val = str(turn_analysis.get("satisfaction_trend", "Stable"))
        urgency_val = str(turn_analysis.get("urgency", "Medium"))
        risk_level_val = str(risk_data.get("risk_level", "Low"))
        risk_score_val = int(risk_data.get("risk_score", 0))

        turn_intents.append(intent_val)

        sentiment_journey.append({
            "turn": idx,
            "customer_message": c_text,
            "sentiment": sentiment_val,
            "emotion": emotion_val,
            "intent": intent_val,
            "frustration_level": frustration_val,
            "satisfaction_trend": trend_val,
            "urgency": urgency_val,
            "escalation_risk": risk_level_val,
            "escalation_risk_score": risk_score_val,
        })

        running_history.append({"sender_type": "Customer", "message_text": c_text})
        if idx - 1 < len(agent_messages):
            running_history.append({"sender_type": "Support Agent", "message_text": agent_messages[idx - 1]})

    # Derived summary values
    initial_frust = sentiment_journey[0]["frustration_level"]
    final_frust = sentiment_journey[-1]["frustration_level"]
    peak_frust = max(p["frustration_level"] for p in sentiment_journey)
    avg_frust = round(sum(p["frustration_level"] for p in sentiment_journey) / len(sentiment_journey), 1)

    max_risk_score = max(p["escalation_risk_score"] for p in sentiment_journey)
    final_risk_level = sentiment_journey[-1]["escalation_risk"]

    # Resolution status determination
    if initial_status and initial_status in {"Resolved", "Escalated", "Unresolved"}:
        final_resolution = initial_status
    elif max_risk_score >= 9 or final_risk_level == "Critical":
        final_resolution = "Escalated"
    elif final_frust <= 3 and sentiment_journey[-1]["sentiment"] in {"Positive", "positive"}:
        final_resolution = "Resolved"
    elif final_frust <= 3 and sentiment_journey[-1]["satisfaction_trend"] in {"Improving", "improving"}:
        final_resolution = "Resolved"
    else:
        final_resolution = "Unresolved"

    primary_issue = turn_intents[0] if turn_intents else "general_inquiry"
    primary_issue_formatted = primary_issue.replace("_", " ").title()

    # Scores
    res_quality = calculate_resolution_quality_score(
        resolution_status=final_resolution,
        initial_frustration=initial_frust,
        final_frustration=final_frust,
        peak_frustration=peak_frust,
        escalation_risk=final_risk_level,
        turn_count=len(sentiment_journey),
    )

    empathy_score, comm_score, comm_rating = calculate_empathy_and_communication_scores(
        agent_messages=agent_messages,
        customer_turns=sentiment_journey,
    )

    policy_score, policy_exp = calculate_policy_adherence_score(
        knowledge_recommendations=all_knowledge_recs,
        agent_messages=agent_messages,
    )

    strengths, weaknesses, recommendations = derive_strengths_and_weaknesses(
        agent_messages=agent_messages,
        sentiment_journey=sentiment_journey,
        resolution_status=final_resolution,
        resolution_quality_score=res_quality,
        empathy_score=empathy_score,
    )

    # Concise summary text
    if final_resolution == "Resolved":
        summary_text = (
            f"Customer contacted regarding {primary_issue_formatted}. "
            f"The support agent provided guidance and verified policy information, successfully resolving "
            f"the inquiry and de-escalating customer frustration to {final_frust}/10."
        )
    elif final_resolution == "Escalated":
        summary_text = (
            f"Customer engaged regarding {primary_issue_formatted}. "
            f"High dissatisfaction and churn signals were detected (peak frustration {peak_frust}/10), "
            f"resulting in case escalation for managerial review."
        )
    else:
        summary_text = (
            f"Customer reached out regarding {primary_issue_formatted}. "
            f"The session concluded without formal confirmation of complete resolution (final frustration {final_frust}/10)."
        )

    return {
        "session_id": session_id,
        "scenario_title": scenario_title or f"Support - {primary_issue_formatted}",
        "concise_summary": summary_text,
        "primary_customer_issue": primary_issue_formatted,
        "final_resolution": final_resolution,
        "resolution_quality_score": res_quality,
        "communication_quality": comm_rating,
        "communication_score": comm_score,
        "empathy_score": empathy_score,
        "policy_adherence_score": policy_score,
        "policy_adherence_note": policy_exp,
        "sentiment_journey": sentiment_journey,
        "agent_strengths": strengths,
        "agent_weaknesses": weaknesses,
        "coaching_recommendations": recommendations,
        "total_turns": len(sentiment_journey),
        "total_messages": len(messages),
        "underlying_metrics": {
            "initial_frustration": initial_frust,
            "final_frustration": final_frust,
            "peak_frustration": peak_frust,
            "average_frustration": avg_frust,
            "max_risk_score": max_risk_score,
            "final_risk_level": final_risk_level,
            "escalated": final_resolution == "Escalated",
        },
    }


def generate_session_summary(
    session_id: int,
    db: DBSession,
    override_status: str | None = None,
) -> dict[str, Any]:
    """
    Loads session, scenario, and messages from SQLite, produces structured post-interaction summary,
    and persists the record in SessionSummary table.
    """
    session_row = db.query(Session).filter(Session.session_id == session_id).first()
    if not session_row:
        raise ValueError(f"Session with ID {session_id} not found.")

    conversation_row = db.query(Conversation).filter(Conversation.session_id == session_id).first()
    scenario_row = None
    if session_row.scenario_id:
        scenario_row = db.query(Scenario).filter(Scenario.scenario_id == session_row.scenario_id).first()

    raw_messages: list[dict[str, Any]] = []
    if conversation_row:
        msgs = (
            db.query(Message)
            .filter(Message.conversation_id == conversation_row.conversation_id)
            .order_by(Message.message_id.asc())
            .all()
        )
        for m in msgs:
            raw_messages.append({
                "sender_type": m.sender_type,
                "message_text": m.message_text,
                "message_type": m.message_type,
                "timestamp": m.timestamp.isoformat() if m.timestamp else None,
            })

    # Determine status
    status_to_use = override_status or (conversation_row.resolution_status if conversation_row else None)
    if not status_to_use and session_row.status == "Completed":
        status_to_use = "Resolved"

    scenario_title = scenario_row.title if scenario_row else "Simulator Session"

    summary_result = generate_conversation_summary(
        messages=raw_messages,
        session_id=session_id,
        scenario_title=scenario_title,
        initial_status=status_to_use,
    )

    # Update session overall_score and status
    session_row.overall_score = summary_result["resolution_quality_score"]
    session_row.status = "Completed"
    if not session_row.end_time:
        session_row.end_time = datetime.utcnow()

    if conversation_row:
        conversation_row.resolution_status = summary_result["final_resolution"]

    # Persist or update SessionSummary row
    existing_summary = db.query(SessionSummary).filter(SessionSummary.session_id == session_id).first()
    if not existing_summary:
        existing_summary = SessionSummary(
            session_id=session_id,
            scenario_title=summary_result["scenario_title"],
            primary_issue=summary_result["primary_customer_issue"],
            resolution_status=summary_result["final_resolution"],
            resolution_quality_score=summary_result["resolution_quality_score"],
            communication_quality=summary_result["communication_quality"],
            communication_score=summary_result["communication_score"],
            empathy_score=summary_result["empathy_score"],
            policy_adherence_score=summary_result["policy_adherence_score"],
            summary_text=summary_result["concise_summary"],
            sentiment_journey=json.dumps(summary_result["sentiment_journey"]),
            agent_strengths=json.dumps(summary_result["agent_strengths"]),
            agent_weaknesses=json.dumps(summary_result["agent_weaknesses"]),
            coaching_recommendations=json.dumps(summary_result["coaching_recommendations"]),
            metrics_payload=json.dumps(summary_result["underlying_metrics"]),
            created_at=datetime.utcnow(),
        )
        db.add(existing_summary)
    else:
        existing_summary.resolution_status = summary_result["final_resolution"]
        existing_summary.resolution_quality_score = summary_result["resolution_quality_score"]
        existing_summary.communication_quality = summary_result["communication_quality"]
        existing_summary.communication_score = summary_result["communication_score"]
        existing_summary.empathy_score = summary_result["empathy_score"]
        existing_summary.policy_adherence_score = summary_result["policy_adherence_score"]
        existing_summary.summary_text = summary_result["concise_summary"]
        existing_summary.sentiment_journey = json.dumps(summary_result["sentiment_journey"])
        existing_summary.agent_strengths = json.dumps(summary_result["agent_strengths"])
        existing_summary.agent_weaknesses = json.dumps(summary_result["agent_weaknesses"])
        existing_summary.coaching_recommendations = json.dumps(summary_result["coaching_recommendations"])
        existing_summary.metrics_payload = json.dumps(summary_result["underlying_metrics"])

    db.commit()
    db.refresh(existing_summary)

    summary_result["summary_id"] = existing_summary.summary_id
    summary_result["created_at"] = existing_summary.created_at.isoformat()

    return summary_result
