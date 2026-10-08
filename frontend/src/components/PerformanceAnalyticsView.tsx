import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Award,
  AlertTriangle,
  CheckCircle2,
  Users,
  MessageSquare,
  BookOpen,
  Sparkles,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Loader2,
  FileText,
} from 'lucide-react';
import { PerformanceAnalyticsData, PostInteractionSummary } from '../types';
import {
  fetchPerformanceAnalyticsApi,
  fetchSessionSummaryApi,
} from '../services/api';
import { PostInteractionReportModal } from './PostInteractionReportModal';

export const PerformanceAnalyticsView: React.FC = () => {
  const [analytics, setAnalytics] = useState<PerformanceAnalyticsData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected session for detailed post-interaction report modal
  const [selectedSummary, setSelectedSummary] =
    useState<PostInteractionSummary | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(false);

  const loadAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPerformanceAnalyticsApi();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load performance analytics:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load performance analytics.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const handleOpenSessionReport = async (sessionId: number) => {
    setIsLoadingSession(true);
    try {
      const summary = await fetchSessionSummaryApi(sessionId);
      setSelectedSummary(summary);
      setIsModalOpen(true);
    } catch (err) {
      console.error('Failed to load session summary:', err);
      window.alert(
        err instanceof Error
          ? err.message
          : 'Failed to load session summary report.'
      );
    } finally {
      setIsLoadingSession(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center p-8 text-center">
        <div className="space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
          <p className="text-xs text-slate-400">
            Calculating performance metrics from active sessions...
          </p>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4 my-12 bg-slate-900 border border-slate-800 rounded-3xl">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">
          Unable to Load Analytics
        </h3>
        <p className="text-xs text-slate-400">{error || 'Unknown error occurred.'}</p>
        <button
          type="button"
          onClick={loadAnalytics}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-indigo-400 font-bold">
              Task 8 • Reporting & Analytics
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Live Verified Data
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Performance Analytics
          </h1>

          <p className="text-xs text-slate-400 mt-1">
            Aggregated agent communication, customer sentiment trends, knowledge
            coverage, and resolution quality metrics.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAnalytics}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Metrics
        </button>
      </div>

      {/* Top Level KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Sessions */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Sessions
            </span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">
              {analytics.total_sessions}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {analytics.completed_sessions} completed
            </p>
          </div>
        </div>

        {/* Total Interactions */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Interactions
            </span>
            <MessageSquare className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">
              {analytics.total_interactions}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {analytics.customer_turns} customer turns
            </p>
          </div>
        </div>

        {/* Resolution Rate */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Resolution
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-400">
              {analytics.resolution_rate}%
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {analytics.session_insights.status_breakdown.Resolved} resolved
            </p>
          </div>
        </div>

        {/* Avg Resolution Quality */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Quality
            </span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">
              {analytics.average_resolution_quality}
              <span className="text-xs text-slate-500 font-normal">/100</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Avg resolution score
            </p>
          </div>
        </div>

        {/* Avg Customer Frustration */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Frustration
            </span>
            <TrendingUp className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">
              {analytics.average_frustration}
              <span className="text-xs text-slate-500 font-normal">/10</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Task 4 turn average
            </p>
          </div>
        </div>

        {/* Escalation Frequency */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Escalations
            </span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <div
              className={`text-2xl font-black ${
                analytics.escalation_frequency >= 20
                  ? 'text-rose-400'
                  : 'text-slate-200'
              }`}
            >
              {analytics.escalation_frequency}%
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {analytics.session_insights.status_breakdown.Escalated} escalated
            </p>
          </div>
        </div>
      </div>

      {/* Middle Grid: Intents Distribution & Escalation Triggers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Issues / Intents Distribution */}
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                Customer Issues & Intents
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Breakdown of primary inquiries categorized by Task 4 analysis.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {analytics.common_customer_intents.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">
                    {item.intent}
                  </span>
                  <span className="text-slate-400 font-mono">
                    {item.count} cases ({item.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${Math.max(item.percentage, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Escalation Triggers & Root Causes */}
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Escalation Triggers
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Primary factors driving High and Critical risk alerts in Task 6.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {analytics.common_escalation_triggers.length > 0 ? (
              analytics.common_escalation_triggers.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-medium truncate max-w-[280px]">
                      {item.trigger}
                    </span>
                    <span className="text-slate-400 font-mono">
                      {item.count} hits ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{ width: `${Math.max(item.percentage, 4)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic p-4 bg-slate-950/40 rounded-2xl">
                No active escalation triggers recorded in recent sessions.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Knowledge Gap Indicators */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-sky-400" />
            Knowledge-Gap Indicators (Task 5)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Customer inquiries requiring policy expansion or updated vector chunks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analytics.knowledge_gap_indicators.map((gap, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <span className="text-sm font-semibold text-white">
                  {gap.topic}
                </span>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span>Frequency: {gap.frequency}</span>
                  <span>•</span>
                  <span>
                    Avg Relevance:{' '}
                    <strong className="text-amber-400">
                      {Math.round(gap.avg_relevance * 100)}%
                    </strong>
                  </span>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
                {gap.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Actionable System Recommendations */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950/30 to-purple-950/20 border border-indigo-500/30 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          Actionable Coaching & Operational Recommendations
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
          {analytics.actionable_recommendations.map((rec, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-900/80 border border-indigo-500/20 flex items-start gap-2.5"
            >
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <span className="leading-relaxed text-slate-200">{rec}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Sessions Table */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              Recent Completed Sessions
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any session to view its full Post-Interaction Report.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Session ID</th>
                <th className="p-3">Scenario / Title</th>
                <th className="p-3">Primary Issue</th>
                <th className="p-3">Status</th>
                <th className="p-3">Quality Score</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {analytics.recent_sessions.map((sess) => {
                const isRes = sess.status.toLowerCase() === 'resolved';
                const isEsc = sess.status.toLowerCase() === 'escalated';

                return (
                  <tr
                    key={sess.session_id}
                    className="hover:bg-slate-800/40 transition cursor-pointer"
                    onClick={() => handleOpenSessionReport(sess.session_id)}
                  >
                    <td className="p-3 font-mono text-indigo-400 font-bold">
                      #{sess.session_id}
                    </td>
                    <td className="p-3 font-medium text-white max-w-[200px] truncate">
                      {sess.title}
                    </td>
                    <td className="p-3 text-slate-400">{sess.primary_issue}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isRes
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : isEsc
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {sess.status}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-white">
                      {sess.resolution_quality}/100
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSessionReport(sess.session_id);
                        }}
                        className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        View Report
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Post-Interaction Report Modal */}
      <PostInteractionReportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        summary={selectedSummary}
      />
    </div>
  );
};
