import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Bot,
  BrainCircuit,
  Check,
  Copy,
  MessageSquare,
  Send,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';

import { MessageAnalysis } from '../types';

interface ManualModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyzeMessage: (
    message: string
  ) => Promise<MessageAnalysis | null>;
}

interface ManualMessage {
  id: string;
  sender: 'customer' | 'agent';
  text: string;
  timestamp: string;
}

interface KnowledgeRecommendation {
  title?: string;
  content?: string;
  source?: string;
  document_type?: string;
  relevance_score?: number;
  rank?: number;
  chunk_id?: string;
}

interface CoachingResult {
  suggested_response?: string;
  tone?: string;
  clarity?: string;
  empathy?: string;
  professionalism?: string;
  communication_rating?: string;
  coaching_tips?: string[];
}

type ExtendedAnalysis = MessageAnalysis & {
  knowledge_recommendations?: KnowledgeRecommendation[];
  knowledge_message?: string;
  recommended_response?: string;
  suggested_response?: string;
  coaching_response?: string;
  coaching?: CoachingResult;
};

type PanelTab = 'coaching' | 'knowledge';

const formatLabel = (value: string | undefined): string => {
  if (!value) {
    return '—';
  }

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const formatFrustration = (
  value: number | undefined
): string => {
  if (value === undefined || value === null) {
    return '—';
  }

  return `${Math.max(
    0,
    Math.min(10, Math.round(value))
  )}/10`;
};

const formatConfidence = (
  value: number | undefined
): string => {
  if (value === undefined || value === null) {
    return '—';
  }

  const normalized =
    value <= 1 ? value * 100 : value;

  return `${Math.round(normalized)}%`;
};

const getSentimentClass = (
  sentiment: string | undefined
): string => {
  switch (String(sentiment).toLowerCase()) {
    case 'positive':
      return 'text-emerald-600';

    case 'negative':
      return 'text-red-600';

    default:
      return 'text-slate-600';
  }
};

const getEmotionClass = (
  emotion: string | undefined
): string => {
  switch (String(emotion).toLowerCase()) {
    case 'happy':
    case 'satisfied':
      return 'text-emerald-600';

    case 'confused':
    case 'worried':
      return 'text-amber-600';

    case 'frustrated':
    case 'angry':
      return 'text-red-600';

    default:
      return 'text-slate-700';
  }
};

const getFrustrationClass = (
  frustration: number | undefined
): string => {
  if (frustration === undefined) {
    return 'text-slate-500';
  }

  if (frustration >= 8) {
    return 'text-red-600';
  }

  if (frustration >= 5) {
    return 'text-amber-600';
  }

  return 'text-emerald-600';
};

const getEscalationClass = (
  risk: string | undefined
): string => {
  switch (String(risk).toLowerCase()) {
    case 'high':
    case 'critical':
      return 'text-red-600';

    case 'medium':
      return 'text-amber-600';

    case 'low':
      return 'text-emerald-600';

    default:
      return 'text-slate-500';
  }
};

export const ManualModeModal: React.FC<
  ManualModeModalProps
> = ({
  isOpen,
  onClose,
  onAnalyzeMessage,
}) => {
  const [messages, setMessages] =
    useState<ManualMessage[]>([]);

  const [inputText, setInputText] =
    useState('');

  const [analysis, setAnalysis] =
    useState<ExtendedAnalysis | null>(null);

  const [isAnalyzing, setIsAnalyzing] =
    useState(false);

  const [panelTab, setPanelTab] =
    useState<PanelTab>('coaching');

  const [responseCopied, setResponseCopied] =
    useState(false);

  const messagesContainerRef =
    useRef<HTMLDivElement | null>(null);

  const latestCustomerMessage = useMemo(() => {
    for (
      let messageIndex = messages.length - 1;
      messageIndex >= 0;
      messageIndex -= 1
    ) {
      if (
        messages[messageIndex].sender ===
        'customer'
      ) {
        return messages[messageIndex].text;
      }
    }

    return '';
  }, [messages]);

  const sendCustomerMessage = async () => {
    const trimmedMessage =
      inputText.trim();

    if (
      !trimmedMessage ||
      isAnalyzing
    ) {
      return;
    }

    const customerMessage: ManualMessage = {
      id: `customer-${Date.now()}`,
      sender: 'customer',
      text: trimmedMessage,
      timestamp:
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
    };

    setMessages((previous) => [
      ...previous,
      customerMessage,
    ]);

    setInputText('');
    setIsAnalyzing(true);

    try {
      const result =
        await onAnalyzeMessage(
          trimmedMessage
        );

      if (result) {
        setAnalysis(
          result as ExtendedAnalysis
        );
      }
    } catch (error) {
      console.error(
        'Manual customer message analysis failed:',
        error
      );
    } finally {
      setIsAnalyzing(false);

      window.setTimeout(() => {
        const container =
          messagesContainerRef.current;

        if (container) {
          container.scrollTo({
            top:
              container.scrollHeight,
            behavior: 'smooth',
          });
        }
      }, 50);
    }
  };

  const sendAgentMessage = () => {
    const trimmedMessage =
      inputText.trim();

    if (
      !trimmedMessage ||
      isAnalyzing
    ) {
      return;
    }

    const agentMessage: ManualMessage = {
      id: `agent-${Date.now()}`,
      sender: 'agent',
      text: trimmedMessage,
      timestamp:
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
    };

    setMessages((previous) => [
      ...previous,
      agentMessage,
    ]);

    setInputText('');

    window.setTimeout(() => {
      const container =
        messagesContainerRef.current;

      if (container) {
        container.scrollTo({
          top:
            container.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 50);
  };

  const handleSend = () => {
    if (!inputText.trim()) {
      return;
    }

    /*
     * Manual Mode works in alternating turns:
     *
     * Customer message
     *       ↓
     * Task 4 analysis
     *       ↓
     * Agent response
     *       ↓
     * Next customer message
     *
     * If the last message was an agent message,
     * the next input is treated as a customer message.
     */
    const lastMessage =
      messages[messages.length - 1];

    if (
      !lastMessage ||
      lastMessage.sender === 'agent'
    ) {
      void sendCustomerMessage();
      return;
    }

    sendAgentMessage();
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault();
      handleSend();
    }
  };

  const resetConversation = () => {
    setMessages([]);
    setInputText('');
    setAnalysis(null);
    setIsAnalyzing(false);
    setPanelTab('coaching');
    setResponseCopied(false);
  };

  const recommendedResponse =
    analysis?.recommended_response ||
    analysis?.suggested_response ||
    analysis?.coaching_response ||
    analysis?.coaching
      ?.suggested_response ||
    '';

  const fallbackRecommendedResponse =
    analysis?.escalation_risk ===
      'High' ||
    analysis?.escalation_risk ===
      'Critical'
      ? 'I understand why this is frustrating. I’ll review the details carefully and explain the next step clearly.'
      : analysis?.emotion
          ?.toLowerCase()
          .includes('confused')
        ? 'I understand. Let me explain the next steps clearly and help you through the process.'
        : 'I understand your concern. Let me review the details and help you with the next step.';

  const finalRecommendedResponse =
    recommendedResponse ||
    fallbackRecommendedResponse;

  const knowledgeRecommendations =
    analysis
      ?.knowledge_recommendations ||
    [];

  const copyResponse = async () => {
    try {
      await navigator.clipboard.writeText(
        finalRecommendedResponse
      );

      setResponseCopied(true);

      window.setTimeout(() => {
        setResponseCopied(false);
      }, 1500);
    } catch {
      setInputText(
        finalRecommendedResponse
      );
    }
  };

  const useResponse = () => {
    setInputText(
      finalRecommendedResponse
    );

    setResponseCopied(true);

    window.setTimeout(() => {
      setResponseCopied(false);
    }, 1500);
  };

  if (!isOpen) {
    return null;
  }

  const intent =
    analysis?.intent || '—';

  const emotion =
    analysis?.emotion || '—';

  const sentiment =
    analysis?.sentiment || '—';

  const frustration =
    analysis?.frustration_level;

  const satisfaction =
    analysis?.satisfaction_trend ||
    '—';

  const escalation =
    analysis?.escalation_risk ||
    '—';

  const confidence =
    analysis?.confidence;

  const isWaitingForCustomer =
    messages.length === 0 ||
    messages[messages.length - 1]
      ?.sender === 'agent';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
      {/* ======================================================
          HEADER
          ====================================================== */}

      <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                Customer Support Assistant
              </h1>

              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-semibold">
                Manual
              </span>
            </div>

            <p className="text-[11px] text-slate-500">
              Live Support Console
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetConversation}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600"
            title="Close Manual Mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ======================================================
          THREE PANEL WORKSPACE
          ====================================================== */}

      <main className="flex-1 min-h-0 bg-slate-50 p-3 sm:p-4 overflow-hidden">
        <div className="h-full min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_390px] gap-4">

          {/* ==================================================
              PANEL 1 — CONVERSATION
              ================================================== */}

          <section className="min-h-0 h-full bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">

            <div className="h-12 shrink-0 px-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-slate-500" />

                <span className="text-sm font-semibold text-slate-800">
                  Live Conversation
                </span>
              </div>

              <span className="text-[11px] text-slate-400">
                {messages.length} message
                {messages.length === 1
                  ? ''
                  : 's'}
              </span>
            </div>

            {/* ONLY CHAT AREA SCROLLS */}

            <div
              ref={messagesContainerRef}
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 space-y-4"
            >
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-sm">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-500 mx-auto flex items-center justify-center">
                      <Bot className="w-5 h-5" />
                    </div>

                    <h2 className="text-sm font-semibold text-slate-700 mt-3">
                      Start Manual Mode
                    </h2>

                    <p className="text-xs text-slate-400 mt-1 leading-5">
                      Enter or paste the customer's
                      message below. The system will
                      analyze it and update the support
                      guidance panel.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message) => {
                  const isAgent =
                    message.sender ===
                    'agent';

                  return (
                    <div
                      key={message.id}
                      className={`flex ${
                        isAgent
                          ? 'justify-end'
                          : 'justify-start'
                      }`}
                    >
                      <div
                        className={`flex gap-2.5 max-w-[90%] ${
                          isAgent
                            ? 'flex-row-reverse'
                            : ''
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${
                            isAgent
                              ? 'bg-slate-900 text-white'
                              : 'bg-indigo-50 text-indigo-600'
                          }`}
                        >
                          {isAgent ? (
                            <UserRound className="w-4 h-4" />
                          ) : (
                            <Bot className="w-4 h-4" />
                          )}
                        </div>

                        <div
                          className={`flex flex-col ${
                            isAgent
                              ? 'items-end'
                              : 'items-start'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1 px-1">
                            <span className="text-[10px] font-semibold text-slate-500">
                              {isAgent
                                ? 'You · Support Agent'
                                : 'Customer'}
                            </span>

                            <span className="text-[9px] text-slate-400">
                              {message.timestamp}
                            </span>
                          </div>

                          <div
                            className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-5 ${
                              isAgent
                                ? 'bg-slate-900 text-white rounded-tr-md'
                                : 'bg-slate-100 text-slate-800 rounded-tl-md'
                            }`}
                          >
                            {message.text}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {isAnalyzing && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <BrainCircuit className="w-4 h-4" />
                    </div>

                    <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-md bg-slate-100">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                          style={{
                            animationDelay:
                              '120ms',
                          }}
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                          style={{
                            animationDelay:
                              '240ms',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* INPUT */}

            <div className="shrink-0 border-t border-slate-100 p-3 sm:p-4 bg-white">
              <div className="flex items-end gap-2">
                <textarea
                  value={inputText}
                  onChange={(event) =>
                    setInputText(
                      event.target.value
                    )
                  }
                  onKeyDown={handleKeyDown}
                  disabled={isAnalyzing}
                  rows={2}
                  placeholder={
                    isWaitingForCustomer
                      ? 'Enter or paste customer message...'
                      : 'Enter your support-agent response...'
                  }
                  className="flex-1 min-w-0 resize-none rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:bg-white transition disabled:opacity-60"
                />

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={
                    !inputText.trim() ||
                    isAnalyzing
                  }
                  className="h-10 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>

              <p className="text-[10px] text-slate-400 mt-1.5 px-1">
                Enter to send · Shift + Enter for a new line
              </p>
            </div>
          </section>

          {/* ==================================================
              PANEL 2 + PANEL 3
              ================================================== */}

          <aside className="min-h-0 h-full flex flex-col gap-3 overflow-hidden">

            {/* =================================================
                LIVE ANALYSIS
                ================================================= */}

            <section className="shrink-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="h-10 px-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-indigo-500" />

                  <span className="text-sm font-semibold text-slate-800">
                    Live Analysis
                  </span>

                  {isAnalyzing && (
                    <span className="text-[10px] text-indigo-500">
                      Updating...
                    </span>
                  )}
                </div>

                {escalation === 'High' ||
                escalation ===
                  'Critical' ? (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                ) : null}
              </div>

              <div className="grid grid-cols-2 divide-x divide-y divide-slate-100">

                <div className="p-3">
                  <p className="text-[10px] text-slate-400 uppercase">
                    Intent
                  </p>

                  <p className="text-xs font-bold text-slate-800 mt-1 truncate">
                    {formatLabel(intent)}
                  </p>
                </div>

                <div className="p-3">
                  <p className="text-[10px] text-slate-400 uppercase">
                    Emotion
                  </p>

                  <p
                    className={`text-xs font-bold mt-1 truncate ${getEmotionClass(
                      emotion
                    )}`}
                  >
                    {formatLabel(emotion)}
                  </p>
                </div>

                <div className="p-3">
                  <p className="text-[10px] text-slate-400 uppercase">
                    Sentiment
                  </p>

                  <p
                    className={`text-xs font-bold mt-1 ${getSentimentClass(
                      sentiment
                    )}`}
                  >
                    {formatLabel(sentiment)}
                  </p>
                </div>

                <div className="p-3">
                  <p className="text-[10px] text-slate-400 uppercase">
                    Frustration
                  </p>

                  <p
                    className={`text-xs font-bold mt-1 ${getFrustrationClass(
                      frustration
                    )}`}
                  >
                    {formatFrustration(
                      frustration
                    )}
                  </p>
                </div>

                <div className="p-3">
                  <p className="text-[10px] text-slate-400 uppercase">
                    Satisfaction
                  </p>

                  <p className="text-xs font-bold mt-1 text-slate-700">
                    {formatLabel(
                      satisfaction
                    )}
                  </p>
                </div>

                <div className="p-3">
                  <p className="text-[10px] text-slate-400 uppercase">
                    Escalation
                  </p>

                  <p
                    className={`text-xs font-bold mt-1 ${getEscalationClass(
                      escalation
                    )}`}
                  >
                    {formatLabel(
                      escalation
                    )}
                  </p>
                </div>
              </div>

              <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase">
                  Confidence
                </span>

                <span className="text-sm font-bold text-slate-900">
                  {formatConfidence(
                    confidence
                  )}
                </span>
              </div>
            </section>

            {/* =================================================
                COACHING / KNOWLEDGE
                ================================================= */}

            <section className="min-h-0 flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">

              <div className="shrink-0 grid grid-cols-2 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() =>
                    setPanelTab(
                      'coaching'
                    )
                  }
                  className={`h-11 flex items-center justify-center gap-1.5 text-xs font-semibold ${
                    panelTab ===
                    'coaching'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Coaching
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPanelTab(
                      'knowledge'
                    )
                  }
                  className={`h-11 flex items-center justify-center gap-1.5 text-xs font-semibold ${
                    panelTab ===
                    'knowledge'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Knowledge Base
                </button>
              </div>

              {panelTab === 'coaching' ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/60">

                  {/* CUSTOMER CONTEXT */}

                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <BrainCircuit className="w-4 h-4 text-indigo-500" />

                      <span className="text-xs font-bold text-slate-800">
                        Customer Context
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-4 mt-2">
                      {latestCustomerMessage ||
                        'Waiting for the customer message.'}
                    </p>
                  </div>

                  {/* RECOMMENDED RESPONSE */}

                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-500" />

                      <span className="text-xs font-bold text-slate-800">
                        Suggested Response
                      </span>
                    </div>

                    <p className="text-[11px] leading-4 text-slate-700 mt-2">
                      {finalRecommendedResponse}
                    </p>

                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        type="button"
                        onClick={copyResponse}
                        className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 flex items-center gap-1"
                      >
                        {responseCopied ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}

                        {responseCopied
                          ? 'Copied'
                          : 'Copy'}
                      </button>

                      <button
                        type="button"
                        onClick={useResponse}
                        className="px-2.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold"
                      >
                        Use Response
                      </button>
                    </div>
                  </div>

                  {/* COACHING FEEDBACK */}

                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wide font-bold text-slate-400">
                      Coaching Feedback
                    </p>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="bg-slate-50 rounded-md p-2">
                        <p className="text-[9px] text-slate-400">
                          Tone
                        </p>

                        <p className="text-[10px] font-semibold text-slate-700 mt-1">
                          {analysis?.coaching
                            ?.tone ||
                            'Professional and calm'}
                        </p>
                      </div>

                      <div className="bg-slate-50 rounded-md p-2">
                        <p className="text-[9px] text-slate-400">
                          Empathy
                        </p>

                        <p className="text-[10px] font-semibold text-slate-700 mt-1">
                          {analysis?.coaching
                            ?.empathy ||
                            'Acknowledge the customer concern.'}
                        </p>
                      </div>

                      <div className="bg-slate-50 rounded-md p-2">
                        <p className="text-[9px] text-slate-400">
                          Clarity
                        </p>

                        <p className="text-[10px] font-semibold text-slate-700 mt-1">
                          {analysis?.coaching
                            ?.clarity ||
                            'Keep the next step clear.'}
                        </p>
                      </div>

                      <div className="bg-slate-50 rounded-md p-2">
                        <p className="text-[9px] text-slate-400">
                          Professionalism
                        </p>

                        <p className="text-[10px] font-semibold text-slate-700 mt-1">
                          {analysis?.coaching
                            ?.professionalism ||
                            'Use respectful customer-focused language.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ESCALATION WARNING */}

                  {(escalation ===
                    'High' ||
                    escalation ===
                      'Critical') && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />

                        <span className="text-xs font-bold text-red-700">
                          Escalation Risk Warning
                        </span>
                      </div>

                      <p className="text-[11px] text-red-600 leading-4 mt-1.5">
                        Customer escalation risk is{' '}
                        {formatLabel(
                          escalation
                        )}
                        . Avoid unsupported promises and use a clear escalation or verification path.
                      </p>
                    </div>
                  )}

                  {/* COACHING TIPS */}

                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wide font-bold text-slate-400">
                      Coaching Tips
                    </p>

                    <ul className="mt-2 space-y-2">
                      {(
                        analysis?.coaching
                          ?.coaching_tips ||
                        [
                          'Acknowledge the customer concern before explaining the process.',
                          'Address the detected intent directly.',
                          'Keep the response concise and solution-focused.',
                        ]
                      ).map(
                        (
                          tip,
                          tipIndex
                        ) => (
                          <li
                            key={`${tipIndex}-${tip}`}
                            className="flex gap-2"
                          >
                            <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-600 text-[9px] font-bold flex items-center justify-center shrink-0">
                              {tipIndex +
                                1}
                            </span>

                            <span className="text-[10px] leading-4 text-slate-600">
                              {tip}
                            </span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/60">

                  {knowledgeRecommendations.length >
                  0 ? (
                    knowledgeRecommendations.map(
                      (
                        recommendation,
                        recommendationIndex
                      ) => (
                        <article
                          key={`${recommendation.rank || recommendationIndex}-${recommendation.title || 'knowledge'}`}
                          className="bg-white border border-slate-200 rounded-lg p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[9px] uppercase tracking-wide text-indigo-500 font-bold">
                                #
                                {recommendation.rank ||
                                  recommendationIndex +
                                    1}{' '}
                                ·{' '}
                                {recommendation.document_type ||
                                  'Knowledge'}
                              </p>

                              <h3 className="text-[11px] font-bold text-slate-800 mt-1">
                                {recommendation.title ||
                                  recommendation.source ||
                                  'Support Knowledge'}
                              </h3>
                            </div>

                            {recommendation.relevance_score !==
                              undefined && (
                              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-1 rounded shrink-0">
                                {Math.round(
                                  Number(
                                    recommendation.relevance_score
                                  ) *
                                    100
                                )}
                                %
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] leading-4 text-slate-600 mt-2">
                            {recommendation.content ||
                              'Knowledge content is not available.'}
                          </p>

                          {recommendation.source && (
                            <p className="text-[9px] text-slate-400 mt-2">
                              Source:{' '}
                              {recommendation.source}
                            </p>
                          )}
                        </article>
                      )
                    )
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <BookOpen className="w-7 h-7 text-slate-300 mx-auto" />

                        <p className="text-xs font-semibold text-slate-600 mt-2">
                          No recommendations yet
                        </p>

                        <p className="text-[10px] text-slate-400 mt-1 max-w-xs">
                          Knowledge recommendations will appear here after the customer message is analyzed.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default ManualModeModal;