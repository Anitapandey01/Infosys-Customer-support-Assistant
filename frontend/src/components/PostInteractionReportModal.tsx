import React from 'react';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingDown,
  TrendingUp,
  Sparkles,
  BookOpen,
  MessageSquare,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  BarChart3,
  X,
} from 'lucide-react';
import { PostInteractionSummary } from '../types';

interface PostInteractionReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: PostInteractionSummary | null;
  onNavigateToAnalytics?: () => void;
  onStartNewSession?: () => void;
}

export const PostInteractionReportModal: React.FC<PostInteractionReportModalProps> = ({
  isOpen,
  onClose,
  summary,
  onNavigateToAnalytics,
  onStartNewSession,
}) => {
  if (!isOpen || !summary) {
    return null;
  }

  const isResolved = summary.final_resolution.toLowerCase() === 'resolved';
  const isEscalated = summary.final_resolution.toLowerCase() === 'escalated';

  const statusBadgeColor = isResolved
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    : isEscalated
    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
    : 'bg-amber-500/10 text-amber-400 border-amber-500/30';

  const StatusIcon = isResolved
    ? CheckCircle2
    : isEscalated
    ? AlertTriangle
    : XCircle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800/80 flex items-start justify-between bg-slate-950/40">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <Award className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-wider text-indigo-400 font-bold">
                  Task 8 • Post-Interaction Report
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${statusBadgeColor}`}
                >
                  <StatusIcon className="w-3.5 h-3.5" />
                  {summary.final_resolution.toUpperCase()}
                </span>
              </div>

              <h2 className="text-xl font-bold text-white mt-1">
                {summary.scenario_title}
              </h2>

              <p className="text-xs text-slate-400 mt-0.5">
                Primary Issue:{' '}
                <span className="text-slate-200 font-semibold">
                  {summary.primary_customer_issue}
                </span>{' '}
                • {summary.total_turns} Customer Turns Evaluated
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/50 hover:bg-slate-800 transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-200">
          {/* Key KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Resolution Quality
              </span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-white">
                  {summary.resolution_quality_score}
                </span>
                <span className="text-xs text-slate-500">/100</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    summary.resolution_quality_score >= 75
                      ? 'bg-emerald-500'
                      : summary.resolution_quality_score >= 50
                      ? 'bg-amber-400'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${summary.resolution_quality_score}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Communication
              </span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-white">
                  {summary.communication_score || 80}
                </span>
                <span className="text-xs text-slate-500">/100</span>
              </div>
              <span className="text-[11px] text-emerald-400 font-medium mt-1">
                {summary.communication_quality}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Empathy Score
              </span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-white">
                  {summary.empathy_score || 75}
                </span>
                <span className="text-xs text-slate-500">/100</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1">
                Validated customer distress
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Policy Adherence
              </span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-white">
                  {summary.policy_adherence_score || 85}
                </span>
                <span className="text-xs text-slate-500">/100</span>
              </div>
              <span className="text-[11px] text-indigo-400 truncate mt-1">
                Grounded in Task 5 KB
              </span>
            </div>
          </div>

          {/* Concise Conversation Summary */}
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              Conversation Overview
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              {summary.concise_summary}
            </p>
            {summary.policy_adherence_note && (
              <p className="text-xs text-slate-400 pt-1 border-t border-slate-800/60 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                {summary.policy_adherence_note}
              </p>
            )}
          </div>

          {/* Sentiment Journey Timeline */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Customer Sentiment Journey Timeline
            </h3>

            {summary.sentiment_journey && summary.sentiment_journey.length > 0 ? (
              <div className="space-y-2.5">
                {summary.sentiment_journey.map((turn) => {
                  const isNeg =
                    turn.sentiment.toLowerCase() === 'negative' ||
                    turn.frustration_level >= 6;
                  const isPos =
                    turn.sentiment.toLowerCase() === 'positive' ||
                    turn.frustration_level <= 2;

                  return (
                    <div
                      key={turn.turn}
                      className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-bold flex items-center justify-center text-xs shrink-0">
                          T{turn.turn}
                        </span>
                        <div>
                          <p className="text-slate-200 font-medium max-w-lg line-clamp-1">
                            "{turn.customer_message}"
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 flex-wrap">
                            <span>
                              Emotion:{' '}
                              <strong className="text-slate-300 capitalize">
                                {turn.emotion}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Intent:{' '}
                              <strong className="text-slate-300">
                                {turn.intent.replace('_', ' ')}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Trend:{' '}
                              <strong
                                className={
                                  turn.satisfaction_trend.toLowerCase() ===
                                  'improving'
                                    ? 'text-emerald-400'
                                    : 'text-amber-400'
                                }
                              >
                                {turn.satisfaction_trend}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                        <span
                          className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                            isPos
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : isNeg
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          Frustration: {turn.frustration_level}/10
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                            turn.escalation_risk === 'High' ||
                            turn.escalation_risk === 'Critical'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-slate-800/80 text-slate-400'
                          }`}
                        >
                          Risk: {turn.escalation_risk}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-950/40 rounded-xl">
                No customer turns recorded for timeline generation.
              </p>
            )}
          </div>

          {/* Strengths & Weaknesses Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strengths */}
            <div className="p-4 rounded-2xl bg-emerald-950/10 border border-emerald-500/20 space-y-2.5">
              <h4 className="text-xs uppercase font-bold text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Demonstrated Strengths
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {summary.agent_strengths && summary.agent_strengths.length > 0 ? (
                  summary.agent_strengths.map((str, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <span>{str}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500 italic">No specific strengths flagged.</li>
                )}
              </ul>
            </div>

            {/* Weaknesses / Opportunities */}
            <div className="p-4 rounded-2xl bg-amber-950/10 border border-amber-500/20 space-y-2.5">
              <h4 className="text-xs uppercase font-bold text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Areas for Growth
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {summary.agent_weaknesses && summary.agent_weaknesses.length > 0 ? (
                  summary.agent_weaknesses.map((weak, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-400 mt-0.5">•</span>
                      <span>{weak}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500 italic">No weaknesses detected.</li>
                )}
              </ul>
            </div>
          </div>

          {/* Personalized Coaching Recommendations */}
          <div className="p-5 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 space-y-3">
            <h4 className="text-xs uppercase tracking-wider font-bold text-indigo-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Personalized Coaching Recommendations
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-200">
              {summary.coaching_recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-900/90 border border-indigo-500/20 flex items-start gap-2.5"
                >
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400">
            Session data archived with underlying Task 4/5/6 metrics.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onNavigateToAnalytics && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToAnalytics();
                }}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                View Analytics
              </button>
            )}

            {onStartNewSession && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartNewSession();
                }}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/20"
              >
                <RotateCcw className="w-4 h-4" />
                Start New Session
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
