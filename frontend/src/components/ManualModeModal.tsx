import React, {
  useState,
} from 'react';

import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  MessageSquare,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';

import {
  MessageAnalysis,
} from '../types';

interface ManualModeModalProps {
  isOpen: boolean;

  onClose: () => void;

  onAnalyzeMessage: (
    message: string
  ) => Promise<MessageAnalysis | null>;
}

interface ConversationItem {
  id: string;
  sender:
    | 'customer'
    | 'agent';
  text: string;
  timestamp: string;
  analysis?: MessageAnalysis;
}

export const ManualModeModal: React.FC<
  ManualModeModalProps
> = ({
  isOpen,
  onClose,
  onAnalyzeMessage,
}) => {
  const [
    customerMessage,
    setCustomerMessage,
  ] = useState('');

  const [
    agentResponse,
    setAgentResponse,
  ] = useState('');

  const [
    conversation,
    setConversation,
  ] = useState<
    ConversationItem[]
  >([]);

  const [
    analysisResult,
    setAnalysisResult,
  ] = useState<
    MessageAnalysis | null
  >(null);

  const [
    isAnalyzing,
    setIsAnalyzing,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const [
    copied,
    setCopied,
  ] = useState(false);

  if (!isOpen) {
    return null;
  }

  const coaching =
    analysisResult?.coaching as
      | {
          suggested_response?: string;
          tone?: string;
          clarity?: string;
          empathy?: string;
          professionalism?: string;
          communication_rating?: string;
          coaching_tips?: string[];
        }
      | undefined;

  const knowledgeRecommendations =
    Array.isArray(
      analysisResult?.knowledge_recommendations
    )
      ? analysisResult
          ?.knowledge_recommendations as any[]
      : [];

  const escalation =
    analysisResult?.escalation as
      | {
          risk_score?: number;
          risk_level?: string;
          risk_threshold?: number;
          critical_threshold?: number;
          reasons?: string[];
          recommended_action?: string;
          alert?: boolean;
          critical_alert?: boolean;
        }
      | undefined;

  const analyzeCustomerMessage =
    async () => {
      const trimmedMessage =
        customerMessage.trim();

      if (!trimmedMessage) {
        return;
      }

      setIsAnalyzing(true);
      setErrorMessage('');
      setCopied(false);

      try {
        const result =
          await onAnalyzeMessage(
            trimmedMessage
          );

        if (!result) {
          throw new Error(
            'No analysis was returned by the backend.'
          );
        }

        setAnalysisResult(
          result
        );

        setConversation(
          (previous) => [
            ...previous,
            {
              id:
                `${Date.now()}-customer`,
              sender:
                'customer',
              text:
                trimmedMessage,
              timestamp:
                new Date().toLocaleTimeString(
                  [],
                  {
                    hour:
                      '2-digit',
                    minute:
                      '2-digit',
                  }
                ),
              analysis:
                result,
            },
          ]
        );

        setCustomerMessage('');
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to analyze customer message.';

        setErrorMessage(
          message
        );
      } finally {
        setIsAnalyzing(
          false
        );
      }
    };

  const sendAgentResponse =
    () => {
      const trimmedResponse =
        agentResponse.trim();

      if (!trimmedResponse) {
        return;
      }

      setConversation(
        (previous) => [
          ...previous,
          {
            id:
              `${Date.now()}-agent`,
            sender:
              'agent',
            text:
              trimmedResponse,
            timestamp:
              new Date().toLocaleTimeString(
                [],
                {
                  hour:
                    '2-digit',
                  minute:
                    '2-digit',
                }
              ),
          },
        ]
      );

      setAgentResponse('');
    };

  const useSuggestedResponse =
    () => {
      const suggested =
        coaching?.suggested_response;

      if (!suggested) {
        return;
      }

      setAgentResponse(
        suggested
      );
    };

  const copySuggestedResponse =
    async () => {
      const suggested =
        coaching?.suggested_response;

      if (!suggested) {
        return;
      }

      try {
        await navigator.clipboard.writeText(
          suggested
        );

        setCopied(
          true
        );

        window.setTimeout(
          () =>
            setCopied(
              false
            ),
          1500
        );
      } catch {
        setCopied(
          false
        );
      }
    };

  const resetManualMode =
    () => {
      setCustomerMessage('');
      setAgentResponse('');
      setConversation([]);
      setAnalysisResult(null);
      setErrorMessage('');
      setCopied(false);
    };

  const renderValue = (
    value: unknown
  ) => {
    if (
      value ===
        undefined ||
      value ===
        null ||
      value === ''
    ) {
      return '—';
    }

    return String(
      value
    );
  };

  const getRiskClass =
    (
      risk?: string
    ) => {
      switch (
        String(
          risk
        ).toLowerCase()
      ) {
        case 'critical':
          return 'text-red-400';

        case 'high':
          return 'text-orange-400';

        case 'medium':
          return 'text-amber-400';

        case 'low':
          return 'text-emerald-400';

        default:
          return 'text-slate-300';
      }
    };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-7xl max-h-[95vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl flex flex-col">
        {/* HEADER */}

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-400" />

              <h2 className="text-lg font-bold text-white">
                Manual Mode
              </h2>
            </div>

            <p className="text-xs text-slate-400 mt-1">
              Live customer-message analysis,
              coaching and knowledge recommendations
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={
                resetManualMode
              }
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />

              Reset
            </button>

            <button
              type="button"
              onClick={
                onClose
              }
              className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs"
            >
              Close
            </button>
          </div>
        </div>

        {/* CONTENT */}

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
            {/* LEFT */}

            <section className="space-y-5">
              {/* CONVERSATION */}

              <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-white">
                    Live Conversation
                  </h3>

                  <p className="text-[11px] text-slate-500 mt-1">
                    Enter a customer message, analyze it,
                    then enter the agent response.
                  </p>
                </div>

                <div className="max-h-[340px] overflow-y-auto p-5 space-y-3">
                  {conversation.length ===
                  0 ? (
                    <div className="text-center py-12 text-xs text-slate-500">
                      No messages yet.
                    </div>
                  ) : (
                    conversation.map(
                      (
                        item
                      ) => (
                        <div
                          key={
                            item.id
                          }
                          className={`flex ${
                            item.sender ===
                            'customer'
                              ? 'justify-start'
                              : 'justify-end'
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-xl px-4 py-3 ${
                              item.sender ===
                              'customer'
                                ? 'bg-slate-800 border border-slate-700'
                                : 'bg-indigo-600/20 border border-indigo-500/30'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4 mb-1">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                {item.sender ===
                                'customer'
                                  ? 'Customer'
                                  : 'Support Agent'}
                              </span>

                              <span className="text-[9px] text-slate-500">
                                {
                                  item.timestamp
                                }
                              </span>
                            </div>

                            <p className="text-xs leading-5 text-slate-200">
                              {
                                item.text
                              }
                            </p>
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>

                <div className="border-t border-slate-800 p-4">
                  <textarea
                    value={
                      customerMessage
                    }
                    onChange={(
                      event
                    ) =>
                      setCustomerMessage(
                        event.target
                          .value
                      )
                    }
                    onKeyDown={(
                      event
                    ) => {
                      if (
                        event.key ===
                          'Enter' &&
                        !event.shiftKey
                      ) {
                        event.preventDefault();

                        void analyzeCustomerMessage();
                      }
                    }}
                    rows={
                      3
                    }
                    placeholder="Paste or type the customer's message..."
                    className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-500"
                  />

                  <div className="flex justify-end mt-3">
                    <button
                      type="button"
                      onClick={() =>
                        void analyzeCustomerMessage()
                      }
                      disabled={
                        isAnalyzing ||
                        !customerMessage.trim()
                      }
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />

                          Analyzing...
                        </>
                      ) : (
                        'Analyze Customer Message'
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* AGENT RESPONSE */}

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <h3 className="text-sm font-bold text-white mb-3">
                  Agent Response
                </h3>

                <textarea
                  value={
                    agentResponse
                  }
                  onChange={(
                    event
                  ) =>
                    setAgentResponse(
                      event.target
                        .value
                    )
                  }
                  rows={
                    4
                  }
                  placeholder="Enter the response you would send to the customer..."
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                />

                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    onClick={
                      sendAgentResponse
                    }
                    disabled={
                      !agentResponse.trim()
                    }
                    className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold"
                  >
                    Add Agent Response
                  </button>
                </div>
              </div>

              {/* ERROR */}

              {errorMessage && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />

                  <div>
                    <p className="text-xs font-semibold text-red-300">
                      Manual analysis failed
                    </p>

                    <p className="text-xs text-red-200/80 mt-1">
                      {
                        errorMessage
                      }
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* RIGHT */}

            <section className="space-y-5">
              {/* ANALYSIS */}

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <h3 className="text-sm font-bold text-white mb-4">
                  Live Analysis
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <AnalysisField
                    label="Intent"
                    value={
                      analysisResult?.intent
                    }
                  />

                  <AnalysisField
                    label="Emotion"
                    value={
                      analysisResult?.emotion
                    }
                  />

                  <AnalysisField
                    label="Sentiment"
                    value={
                      analysisResult?.sentiment
                    }
                  />

                  <AnalysisField
                    label="Frustration"
                    value={
                      analysisResult
                        ? `${analysisResult.frustration_level}/10`
                        : undefined
                    }
                  />

                  <AnalysisField
                    label="Satisfaction"
                    value={
                      analysisResult?.satisfaction_trend
                    }
                  />

                  <AnalysisField
                    label="Escalation"
                    value={
                      analysisResult?.escalation_risk
                    }
                    valueClassName={getRiskClass(
                      analysisResult?.escalation_risk
                    )}
                  />

                  <AnalysisField
                    label="Confidence"
                    value={
                      analysisResult
                        ? `${Math.round(
                            analysisResult.confidence *
                              100
                          )}%`
                        : undefined
                    }
                  />

                  <AnalysisField
                    label="Risk Score"
                    value={
                      escalation
                        ? `${renderValue(
                            escalation.risk_score
                          )}/10`
                        : undefined
                    }
                    valueClassName={getRiskClass(
                      escalation?.risk_level
                    )}
                  />
                </div>

                {escalation?.alert && (
                  <div className="mt-4 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-orange-400" />

                      <span className="text-xs font-bold text-orange-300">
                        Escalation Risk Alert
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 mt-2">
                      Risk:{' '}
                      {
                        escalation.risk_level
                      }
                      {' · '}
                      Score:{' '}
                      {
                        escalation.risk_score
                      }
                    </p>

                    {escalation.reasons?.map(
                      (
                        reason,
                        index
                      ) => (
                        <p
                          key={
                            `${reason}-${index}`
                          }
                          className="text-[11px] text-slate-400 mt-1"
                        >
                          • {reason}
                        </p>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* COACHING */}

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white">
                    AI Coaching
                  </h3>

                  {coaching?.communication_rating && (
                    <span className="text-[10px] font-semibold text-emerald-400">
                      {
                        coaching.communication_rating
                      }
                    </span>
                  )}
                </div>

                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
                      Suggested Response
                    </span>

                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={
                          copySuggestedResponse
                        }
                        disabled={
                          !coaching?.suggested_response
                        }
                        className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40"
                        title="Copy"
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs leading-5 text-slate-200">
                    {renderValue(
                      coaching?.suggested_response
                    )}
                  </p>

                  <button
                    type="button"
                    onClick={
                      useSuggestedResponse
                    }
                    disabled={
                      !coaching?.suggested_response
                    }
                    className="mt-3 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[11px] font-semibold"
                  >
                    Use Response
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <CoachingField
                    label="Tone"
                    value={
                      coaching?.tone
                    }
                  />

                  <CoachingField
                    label="Empathy"
                    value={
                      coaching?.empathy
                    }
                  />

                  <CoachingField
                    label="Clarity"
                    value={
                      coaching?.clarity
                    }
                  />

                  <CoachingField
                    label="Professionalism"
                    value={
                      coaching?.professionalism
                    }
                  />
                </div>

                {coaching?.coaching_tips?.length ? (
                  <div className="mt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                      Coaching Tips
                    </p>

                    <div className="space-y-2">
                      {coaching.coaching_tips.map(
                        (
                          tip,
                          index
                        ) => (
                          <div
                            key={
                              `${tip}-${index}`
                            }
                            className="rounded-lg bg-slate-950 border border-slate-800 p-3"
                          >
                            <p className="text-[11px] text-slate-300 leading-5">
                              <span className="text-indigo-400 font-bold mr-2">
                                {index +
                                  1}
                                .
                              </span>

                              {tip}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* KNOWLEDGE */}

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <h3 className="text-sm font-bold text-white mb-4">
                  Knowledge Recommendations
                </h3>

                {knowledgeRecommendations.length >
                0 ? (
                  <div className="space-y-3">
                    {knowledgeRecommendations.map(
                      (
                        recommendation
                      ) => (
                        <article
                          key={
                            recommendation.chunk_id
                          }
                          className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold text-white">
                                {
                                  recommendation.title ||
                                  recommendation.document_name
                                }
                              </p>

                              <p className="text-[10px] text-slate-500 mt-1">
                                {
                                  recommendation.document_type
                                }
                                {' · '}
                                v
                                {
                                  recommendation.version
                                }
                                {' · Page '}
                                {
                                  recommendation.page_number
                                }
                              </p>
                            </div>

                            <span className="text-[10px] text-indigo-300">
                              #
                              {
                                recommendation.rank
                              }
                            </span>
                          </div>

                          <p className="text-[11px] leading-5 text-slate-400 mt-3">
                            {
                              recommendation.content
                            }
                          </p>
                        </article>
                      )
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    {renderValue(
                      analysisResult?.knowledge_message
                    )}
                  </p>
                )}
              </div>

              {/* ESCALATION ACTION */}

              {escalation?.recommended_action && (
                <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-300 mb-2">
                    Recommended Action
                  </p>

                  <p className="text-xs leading-5 text-slate-300">
                    {
                      escalation.recommended_action
                    }
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AnalysisFieldProps {
  label: string;
  value?: unknown;
  valueClassName?: string;
}

const AnalysisField: React.FC<
  AnalysisFieldProps
> = ({
  label,
  value,
  valueClassName = 'text-white',
}) => (
  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
    <span className="text-[10px] text-slate-500 block">
      {label}
    </span>

    <span
      className={`text-xs font-bold mt-1 block ${valueClassName}`}
    >
      {value === undefined ||
      value === null ||
      value === ''
        ? '—'
        : String(value)}
    </span>
  </div>
);

interface CoachingFieldProps {
  label: string;
  value?: unknown;
}

const CoachingField: React.FC<
  CoachingFieldProps
> = ({
  label,
  value,
}) => (
  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
    <span className="text-[9px] uppercase tracking-wide text-slate-500 block">
      {label}
    </span>

    <span className="text-[11px] font-semibold text-slate-200 mt-1 block">
      {value === undefined ||
      value === null ||
      value === ''
        ? '—'
        : String(value)}
    </span>
  </div>
);