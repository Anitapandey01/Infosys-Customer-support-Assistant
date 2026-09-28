import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Bot,
  BrainCircuit,
  Check,
  CheckCircle2,
  Copy,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';

import {
  Scenario,
  ChatMessage,
  MessageAnalysis,
  CoachingLevel,
  KnowledgeRecommendation,
} from '../../types';

type LiveAnalysis = MessageAnalysis & {
  knowledge_recommendations?: KnowledgeRecommendation[];
  knowledge_message?: string;
  recommended_response?: string | null;
  recommendedResponse?: string | null;
  coaching_response?: string | null;
  coachingResponse?: string | null;
  suggestedResponses?: Record<string, string>;
  escalationRisk?: number;
  escalationLevel?: string;
  escalation_probability?: number;
  escalationProbability?: number;
  riskReasons?: string[];
  recommendedIntervention?: string;
  coachWhisper?: string;
  alertType?: string;
};

interface LiveConsoleViewProps {
  scenario: Scenario;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isSimulatingCustomer: boolean;
  analysis?: LiveAnalysis;
  isAnalyzing: boolean;
  onFinishSession: () => void;
  onRestartSession: () => void;
  onSelectAnotherScenario: () => void;
  coachingLevel?: CoachingLevel;
  piiMaskingEnabled: boolean;
  onTriggerAiImprove: () => void;
  isImprovingInput: boolean;
  inputText: string;
  setInputText: (val: string) => void;
  onOpenFullKb?: (kbId: string) => void;
  knowledgeDocs: unknown[];
}

type RightPanelTab = 'coaching' | 'knowledge';

type CanonicalRisk = 'Low' | 'Medium' | 'High' | 'Critical';

const RISK_ORDER: CanonicalRisk[] = [
  'Low',
  'Medium',
  'High',
  'Critical',
];

function normalizeRisk(value: unknown): CanonicalRisk {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  if (normalized === 'critical' || normalized === 'critical risk') {
    return 'Critical';
  }

  if (normalized === 'high' || normalized === 'high risk') {
    return 'High';
  }

  if (normalized === 'medium' || normalized === 'medium risk') {
    return 'Medium';
  }

  return 'Low';
}

function clampNumber(value: unknown, min: number, max: number): number | null {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.max(min, Math.min(max, numeric));
}

function formatLabel(value: unknown): string {
  const text = String(value ?? '').trim();

  if (!text || text === '—') {
    return '—';
  }

  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatConfidence(value: unknown): string {
  const numeric = clampNumber(value, 0, 1);

  if (numeric === null) {
    return '—';
  }

  return `${Math.round(numeric * 100)}%`;
}

function formatFrustration(value: unknown): string {
  const numeric = clampNumber(value, 0, 10);

  if (numeric === null) {
    return '—';
  }

  return `${Math.round(numeric)}/10`;
}

function getRiskClasses(risk: CanonicalRisk) {
  switch (risk) {
    case 'Critical':
      return {
        text: 'text-rose-700',
        badge: 'bg-rose-100 text-rose-700 border-rose-200',
        border: 'border-rose-300',
        background: 'bg-rose-50',
        icon: 'text-rose-600',
      };

    case 'High':
      return {
        text: 'text-red-600',
        badge: 'bg-red-50 text-red-700 border-red-200',
        border: 'border-red-200',
        background: 'bg-red-50/60',
        icon: 'text-red-500',
      };

    case 'Medium':
      return {
        text: 'text-amber-600',
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        border: 'border-amber-200',
        background: 'bg-amber-50/60',
        icon: 'text-amber-500',
      };

    case 'Low':
    default:
      return {
        text: 'text-emerald-600',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        border: 'border-emerald-200',
        background: 'bg-emerald-50/60',
        icon: 'text-emerald-500',
      };
  }
}

function getSentimentClass(value: unknown): string {
  switch (String(value ?? '').toLowerCase()) {
    case 'positive':
      return 'text-emerald-600';

    case 'negative':
      return 'text-red-600';

    default:
      return 'text-slate-600';
  }
}

function getEmotionClass(value: unknown): string {
  switch (String(value ?? '').toLowerCase()) {
    case 'happy':
    case 'satisfied':
    case 'calm':
      return 'text-emerald-600';

    case 'worried':
    case 'confused':
      return 'text-amber-600';

    case 'frustrated':
    case 'angry':
      return 'text-red-600';

    default:
      return 'text-slate-700';
  }
}

function getFrustrationClass(value: unknown): string {
  const numeric = clampNumber(value, 0, 10);

  if (numeric === null) {
    return 'text-slate-500';
  }

  if (numeric >= 8) {
    return 'text-red-600';
  }

  if (numeric >= 5) {
    return 'text-amber-600';
  }

  return 'text-emerald-600';
}

function getSatisfactionClass(value: unknown): string {
  switch (String(value ?? '').toLowerCase()) {
    case 'improving':
      return 'text-emerald-600';

    case 'declining':
      return 'text-red-600';

    default:
      return 'text-slate-600';
  }
}

function getIntentCategory(intent: unknown): string {
  const normalized = String(intent ?? '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ');

  if (normalized.includes('refund') || normalized.includes('return')) {
    return 'refund';
  }

  if (
    normalized.includes('billing') ||
    normalized.includes('charge') ||
    normalized.includes('payment') ||
    normalized.includes('invoice') ||
    normalized.includes('subscription')
  ) {
    return 'billing';
  }

  if (normalized.includes('cancel')) {
    return 'cancellation';
  }

  if (
    normalized.includes('delivery') ||
    normalized.includes('shipping') ||
    normalized.includes('shipment') ||
    normalized.includes('order')
  ) {
    return 'shipping';
  }

  if (
    normalized.includes('account') ||
    normalized.includes('login') ||
    normalized.includes('password') ||
    normalized.includes('access')
  ) {
    return 'account';
  }

  return 'general';
}

function buildDynamicFallback(
  customerMessage: string,
  analysis?: LiveAnalysis
): string {
  const message = customerMessage.toLowerCase();
  const intent = String(analysis?.intent ?? '').toLowerCase();
  const emotion = String(analysis?.emotion ?? '').toLowerCase();
  const sentiment = String(analysis?.sentiment ?? '').toLowerCase();
  const frustration = clampNumber(analysis?.frustration_level, 0, 10);
  const category = getIntentCategory(intent);

  const isNegative =
    sentiment === 'negative' ||
    emotion === 'frustrated' ||
    emotion === 'angry' ||
    (frustration !== null && frustration >= 7);

  const empathy = isNegative
    ? 'I understand why this is frustrating. '
    : 'I understand your concern. ';

  const hasReference =
    /#?[a-z]{2,8}[-_]?\d{3,}/i.test(customerMessage) ||
    message.includes('invoice number') ||
    message.includes('invoice no') ||
    message.includes('order number') ||
    message.includes('reference number') ||
    message.includes('ticket number');

  if (hasReference) {
    return 'Thank you for providing the reference number. I’ll use it to verify the transaction details and confirm the current status for you.';
  }

  if (
    message.includes('what did you find') ||
    message.includes('what have you found') ||
    message.includes('any update') ||
    message.includes('what is the status') ||
    message.includes("what's the status") ||
    message.includes('please let me know what you find') ||
    message.includes('let me know what you found') ||
    message.includes('have you checked') ||
    message.includes('did you check')
  ) {
    return 'I’m checking the relevant account and transaction details now. I’ll confirm what I find and explain the next step clearly.';
  }

  if (
    (message.includes('refund') || category === 'refund') &&
    (
      message.includes('when will') ||
      message.includes('how long') ||
      message.includes('how soon') ||
      message.includes('when can i expect') ||
      message.includes('when should i receive') ||
      message.includes('reach my card') ||
      message.includes('arrive')
    )
  ) {
    return 'I’ll verify the refund status and applicable processing timeline so I can give you a clear expectation for when the amount should reach your card.';
  }

  if (
    message.includes('cancelled') ||
    message.includes('canceled') ||
    message.includes('requested to cancel') ||
    message.includes('asked to cancel') ||
    message.includes('already cancelled') ||
    message.includes('already canceled')
  ) {
    return 'I understand that you already requested the cancellation. I’ll verify the cancellation record against the charge and determine the appropriate next step.';
  }

  if (
    message.includes('charged') ||
    message.includes('charge') ||
    message.includes('payment was taken') ||
    message.includes('money was taken')
  ) {
    return `${empathy}I’ll verify the charge against the account and cancellation details, then confirm what action can be taken.`;
  }

  if (
    message.includes('refund') ||
    message.includes('money back') ||
    message.includes('return the money') ||
    message.includes('get my money back')
  ) {
    return `${empathy}I’ll verify the payment and applicable support policy, then confirm the next step for your refund.`;
  }

  if (category === 'cancellation') {
    return 'I’ll check the subscription cancellation status and confirm whether the renewal has been successfully stopped.';
  }

  if (category === 'shipping') {
    return 'I’ll check the latest order and shipment information and confirm the appropriate next step.';
  }

  if (
    message.includes('?') ||
    message.startsWith('can you') ||
    message.startsWith('could you') ||
    message.startsWith('why ') ||
    message.startsWith('how ') ||
    message.startsWith('what ') ||
    message.startsWith('when ') ||
    message.startsWith('where ')
  ) {
    return 'I’ll review the relevant support details and give you a clear answer based on the information available.';
  }

  return `${empathy}I’ll review the details of your request and confirm the appropriate next step.`;
}

export const LiveConsoleView: React.FC<LiveConsoleViewProps> = ({
  scenario,
  messages,
  onSendMessage,
  isSimulatingCustomer,
  analysis,
  isAnalyzing,
  onFinishSession,
  onSelectAnotherScenario,
  onOpenFullKb,
  inputText,
  setInputText,
}) => {
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const previousRiskRef = useRef<CanonicalRisk | null>(null);

  const [rightPanelTab, setRightPanelTab] =
    useState<RightPanelTab>('coaching');

  const [responseCopied, setResponseCopied] = useState(false);
  const [showCriticalAlert, setShowCriticalAlert] = useState(false);

  const intent = analysis?.intent ?? '—';
  const emotion = analysis?.emotion ?? '—';
  const sentiment = analysis?.sentiment ?? '—';
  const frustration = analysis?.frustration_level ?? null;
  const satisfactionTrend = analysis?.satisfaction_trend ?? '—';

  /*
   * Task 6 source-of-truth risk.
   *
   * Prefer the explicit backend escalation_risk value.
   * escalationLevel is only a compatibility alias.
   *
   * We do NOT calculate Low/Medium/High/Critical from a number.
   * The backend owns the risk classification.
   */
  const escalationRisk = normalizeRisk(
    analysis?.escalation_risk ??
      analysis?.escalationLevel
  );

  const confidence = analysis?.confidence ?? null;

  const escalationProbability = clampNumber(
    analysis?.escalationRisk ??
      analysis?.escalation_probability ??
      analysis?.escalationProbability,
    0,
    100
  );

  const riskReasons = Array.isArray(analysis?.riskReasons)
    ? analysis.riskReasons.filter(
        (reason): reason is string => typeof reason === 'string'
      )
    : [];

  const latestCustomerMessage = useMemo(() => {
    for (
      let messageIndex = messages.length - 1;
      messageIndex >= 0;
      messageIndex -= 1
    ) {
      const message = messages[messageIndex];

      if (message.sender === 'customer') {
        return message.text?.trim() ?? '';
      }
    }

    return '';
  }, [messages]);

  /*
   * Preserve backend-generated response first.
   * The local fallback is only used when the backend did not send
   * a response field. It is based on the latest customer message,
   * not only the scenario/intent.
   */
  const recommendedResponse = useMemo(() => {
    const backendResponse =
      analysis?.recommended_response?.trim() ||
      analysis?.recommendedResponse?.trim() ||
      analysis?.coaching_response?.trim() ||
      analysis?.coachingResponse?.trim();

    if (backendResponse) {
      return backendResponse;
    }

    const suggested =
      analysis?.suggestedResponses?.professional?.trim() ||
      analysis?.suggestedResponses?.empathetic?.trim() ||
      analysis?.suggestedResponses?.quick?.trim();

    if (suggested) {
      return suggested;
    }

    return buildDynamicFallback(
      latestCustomerMessage,
      analysis
    );
  }, [
    analysis,
    latestCustomerMessage,
  ]);

  /*
   * Task 6 Critical popup.
   *
   * It opens once when the current backend risk changes into Critical.
   * If the risk later drops and becomes Critical again, the popup opens
   * again because the transition is tracked.
   */
  useEffect(() => {
    const previousRisk = previousRiskRef.current;

    if (
      escalationRisk === 'Critical' &&
      previousRisk !== 'Critical'
    ) {
      setShowCriticalAlert(true);
    }

    previousRiskRef.current = escalationRisk;
  }, [escalationRisk]);

  useEffect(() => {
    const chatContainer = messagesScrollRef.current;

    if (!chatContainer) {
      return;
    }

    chatContainer.scrollTo({
      top: chatContainer.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isSimulatingCustomer]);

  const handleSend = () => {
    const trimmed = inputText.trim();

    if (!trimmed || isSimulatingCustomer) {
      return;
    }

    onSendMessage(trimmed);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const copyRecommendedResponse = async () => {
    try {
      await navigator.clipboard.writeText(
        recommendedResponse
      );
      setResponseCopied(true);
    } catch {
      setInputText(recommendedResponse);
      setResponseCopied(true);
    }

    window.setTimeout(() => {
      setResponseCopied(false);
    }, 1600);
  };

  const applyRecommendedResponse = () => {
    setInputText(recommendedResponse);
    setResponseCopied(true);

    window.setTimeout(() => {
      setResponseCopied(false);
    }, 1600);
  };

  const currentRiskClasses =
    getRiskClasses(escalationRisk);

  const knowledgeRecommendations =
    Array.isArray(
      analysis?.knowledge_recommendations
    )
      ? analysis.knowledge_recommendations
      : [];

  const relevantKnowledge =
    analysis?.relevantKnowledge;

  return (
    <div className="h-full min-h-0 w-full bg-slate-50 flex flex-col overflow-hidden">

      {/* =========================================================
          CRITICAL ESCALATION ALERT
          ========================================================= */}
      {showCriticalAlert && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-[2px]"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="critical-escalation-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-rose-300 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-rose-100 bg-rose-50 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <ShieldAlert className="h-5 w-5" />
                </div>

                <div>
                  <p
                    id="critical-escalation-title"
                    className="text-base font-bold text-rose-800"
                  >
                    Critical Escalation Risk
                  </p>

                  <p className="mt-0.5 text-xs text-rose-700">
                    Task 6 critical-risk alert detected by the backend.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCriticalAlert(false)}
                className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-100"
                aria-label="Close critical escalation alert"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                  Current customer risk
                </p>

                <p className="mt-1 text-sm font-bold text-rose-900">
                  Critical
                  {escalationProbability !== null
                    ? ` · ${Math.round(escalationProbability)}% probability`
                    : ''}
                </p>
              </div>

              {riskReasons.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Risk triggers
                  </p>

                  <div className="mt-2 space-y-1.5">
                    {riskReasons.map(
                      (reason, index) => (
                        <div
                          key={`${reason}-${index}`}
                          className="flex items-start gap-2 text-xs text-slate-600"
                        >
                          <span className="mt-1 text-rose-500">
                            •
                          </span>
                          <span>{reason}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {analysis?.recommendedIntervention && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-bold text-amber-800">
                    Recommended intervention
                  </p>

                  <p className="mt-1 text-xs leading-5 text-amber-900">
                    {analysis.recommendedIntervention}
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setShowCriticalAlert(false)
                  }
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Acknowledge Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          SESSION HEADER
          ========================================================= */}
      <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onSelectAnotherScenario}
            className="w-9 h-9 shrink-0 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition"
            title="Back to simulator setup"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm sm:text-base font-semibold text-slate-900 truncate">
                Customer Support Assistant
              </h1>

              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-100 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>

            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {scenario.title}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onFinishSession}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition shrink-0"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Finish Session</span>
        </button>
      </header>

      {/* =========================================================
          MAIN WORKSPACE
          ========================================================= */}
      <main className="flex-1 min-h-0 w-full overflow-hidden px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
        <div className="h-full min-h-0 w-full grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_390px] gap-4 xl:gap-5">

          {/* =====================================================
              LIVE CONVERSATION
              ===================================================== */}
          <section className="min-h-0 h-full bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
            <div className="h-12 shrink-0 px-4 sm:px-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-800">
                  Live Conversation
                </span>
              </div>

              <span className="text-[11px] text-slate-400">
                {messages.length} message
                {messages.length === 1 ? '' : 's'}
              </span>
            </div>

            <div
              ref={messagesScrollRef}
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 space-y-4 overscroll-contain"
            >
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-sm">
                    <div className="w-11 h-11 rounded-full bg-slate-100 mx-auto mb-3 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-slate-400" />
                    </div>

                    <p className="text-sm font-medium text-slate-700">
                      Waiting for the conversation to start
                    </p>

                    <p className="text-xs text-slate-400 mt-1">
                      The AI customer message will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message, index) => {
                  const isAgent =
                    message.sender === 'agent';

                  return (
                    <div
                      key={
                        message.id ||
                        `${message.sender}-${index}`
                      }
                      className={`flex ${
                        isAgent
                          ? 'justify-end'
                          : 'justify-start'
                      }`}
                    >
                      <div
                        className={`flex gap-2.5 max-w-[92%] sm:max-w-[82%] ${
                          isAgent
                            ? 'flex-row-reverse'
                            : 'flex-row'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
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
                          <span className="text-[10px] text-slate-400 mb-1 px-1">
                            {isAgent
                              ? 'You · Support Agent'
                              : 'AI Customer'}
                          </span>

                          <div
                            className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-5 whitespace-pre-wrap ${
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

              {isSimulatingCustomer && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Bot className="w-4 h-4" />
                    </div>

                    <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-md bg-slate-100">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                          style={{
                            animationDelay: '120ms',
                          }}
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                          style={{
                            animationDelay: '240ms',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-100 p-3 sm:p-4 bg-white">
              <div className="flex items-end gap-2.5">
                <textarea
                  value={inputText}
                  onChange={(event) =>
                    setInputText(event.target.value)
                  }
                  onKeyDown={handleKeyDown}
                  disabled={isSimulatingCustomer}
                  rows={2}
                  placeholder={
                    isSimulatingCustomer
                      ? 'AI customer is responding...'
                      : 'Type your response to the customer...'
                  }
                  className="flex-1 min-w-0 resize-none rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:bg-white transition disabled:opacity-60"
                />

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={
                    !inputText.trim() ||
                    isSimulatingCustomer
                  }
                  className="h-10 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold flex items-center gap-1.5 transition shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </button>
              </div>

              <p className="text-[10px] text-slate-400 mt-1.5 px-1">
                Press Enter to send · Shift + Enter for a new line
              </p>
            </div>
          </section>

          {/* =====================================================
              RIGHT AI WORKSPACE
              ===================================================== */}
          <aside className="min-h-0 h-full w-full flex flex-col gap-3 overflow-hidden">

            {/* ===================================================
                TASK 4 LIVE ANALYSIS
                =================================================== */}
            <section className="shrink-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="h-10 shrink-0 px-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-indigo-500" />

                  <span className="text-sm font-semibold text-slate-800">
                    Live Analysis
                  </span>

                  {isAnalyzing && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-indigo-500">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Updating
                    </span>
                  )}
                </div>

                <Sparkles className="w-4 h-4 text-slate-300" />
              </div>

              <div className="grid grid-cols-2 divide-x divide-y divide-slate-100">
                <div className="px-3 py-2 min-w-0">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                    Intent
                  </p>
                  <p className="text-xs font-semibold text-slate-800 mt-1 truncate">
                    {formatLabel(intent)}
                  </p>
                </div>

                <div className="px-3 py-2 min-w-0">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                    Emotion
                  </p>
                  <p
                    className={`text-xs font-semibold mt-1 truncate ${getEmotionClass(
                      emotion
                    )}`}
                  >
                    {formatLabel(emotion)}
                  </p>
                </div>

                <div className="px-3 py-2 min-w-0">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                    Sentiment
                  </p>
                  <p
                    className={`text-xs font-semibold mt-1 truncate ${getSentimentClass(
                      sentiment
                    )}`}
                  >
                    {formatLabel(sentiment)}
                  </p>
                </div>

                <div className="px-3 py-2 min-w-0">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                    Frustration
                  </p>
                  <p
                    className={`text-xs font-bold mt-1 ${getFrustrationClass(
                      frustration
                    )}`}
                  >
                    {formatFrustration(frustration)}
                  </p>
                </div>

                <div className="px-3 py-2 min-w-0">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                    Satisfaction
                  </p>
                  <p
                    className={`text-xs font-semibold mt-1 truncate ${getSatisfactionClass(
                      satisfactionTrend
                    )}`}
                  >
                    {formatLabel(satisfactionTrend)}
                  </p>
                </div>

                <div
                  className={`px-3 py-2 min-w-0 ${currentRiskClasses.background}`}
                >
                  <div className="flex items-center gap-1">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                      Escalation
                    </p>

                    {escalationRisk !== 'Low' && (
                      <AlertTriangle
                        className={`w-3 h-3 ${currentRiskClasses.icon}`}
                      />
                    )}
                  </div>

                  <p
                    className={`text-xs font-bold mt-1 ${currentRiskClasses.text}`}
                  >
                    {escalationRisk}
                  </p>
                </div>
              </div>

              <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                  Confidence
                </p>

                <p className="text-sm font-bold text-slate-900">
                  {formatConfidence(confidence)}
                </p>
              </div>

              {/* Task 6 — all four risk levels are always visible */}
              <div className="px-3 py-2 border-t border-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                    Escalation Risk Levels
                  </p>

                  {escalationProbability !== null && (
                    <span className="text-[10px] font-semibold text-slate-500">
                      {Math.round(escalationProbability)}% probability
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-1 mt-1.5">
                  {RISK_ORDER.map((risk) => {
                    const riskClasses =
                      getRiskClasses(risk);
                    const active =
                      risk === escalationRisk;

                    return (
                      <div
                        key={risk}
                        className={`rounded-md border px-1 py-1.5 text-center ${
                          active
                            ? `${riskClasses.badge} ring-1 ring-current`
                            : 'border-slate-200 bg-slate-50 text-slate-400'
                        }`}
                      >
                        <p className="text-[9px] font-bold">
                          {risk}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* ===================================================
                COACHING / KNOWLEDGE
                =================================================== */}
            <section className="min-h-0 flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="shrink-0 grid grid-cols-2 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() =>
                    setRightPanelTab('coaching')
                  }
                  className={`h-12 px-3 flex items-center justify-center gap-2 text-sm font-semibold transition ${
                    rightPanelTab === 'coaching'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  AI Real-Time Coaching
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setRightPanelTab('knowledge')
                  }
                  className={`h-12 px-3 flex items-center justify-center gap-2 text-sm font-semibold transition ${
                    rightPanelTab === 'knowledge'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Knowledge Base
                </button>
              </div>

              {rightPanelTab === 'coaching' ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-2.5 space-y-2 bg-slate-50/60">

                  {/* Customer state */}
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <BrainCircuit className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs font-bold text-slate-800">
                          AI Real-Time Coaching
                        </span>
                      </div>

                      <span className="text-[10px] text-slate-400">
                        Live
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                        <p className="text-[10px] text-slate-400">
                          Customer Intent
                        </p>

                        <p className="text-[11px] font-bold text-slate-800 mt-0.5 truncate">
                          {formatLabel(intent)}
                        </p>

                        <p className="text-[9px] text-indigo-500 mt-0.5">
                          {formatConfidence(confidence)} match
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                        <p className="text-[10px] text-slate-400">
                          Customer State
                        </p>

                        <p
                          className={`text-xs font-bold mt-1 ${getFrustrationClass(
                            frustration
                          )}`}
                        >
                          {formatFrustration(frustration)} frustration
                        </p>

                        <p
                          className={`text-[10px] mt-1 ${getSentimentClass(
                            sentiment
                          )}`}
                        >
                          Sentiment: {formatLabel(sentiment)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic recommended response */}
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-2.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-500" />

                      <span className="text-xs font-bold text-slate-800">
                        Recommended Response
                      </span>

                      {isAnalyzing && (
                        <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin ml-auto" />
                      )}
                    </div>

                    <p className="text-[11px] leading-4 text-slate-700 mt-1.5">
                      {recommendedResponse}
                    </p>

                    <div className="flex items-center justify-end gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={copyRecommendedResponse}
                        className="px-2 py-1 rounded-md border border-slate-200 bg-white text-[9px] font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1"
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
                        onClick={applyRecommendedResponse}
                        className="px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-semibold flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        Use Response
                      </button>
                    </div>
                  </div>

                  {/* Backend coaching / intervention */}
                  {(analysis?.coachWhisper ||
                    analysis?.recommendedIntervention) && (
                    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                      <p className="text-[9px] uppercase tracking-wide font-semibold text-slate-400">
                        Live Coaching Signal
                      </p>

                      {analysis?.coachWhisper && (
                        <p className="text-[10px] leading-4 text-slate-600 mt-1.5">
                          {analysis.coachWhisper}
                        </p>
                      )}

                      {analysis?.recommendedIntervention && (
                        <div className="mt-2 rounded-md bg-amber-50 border border-amber-100 p-2">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-amber-700">
                            Recommended intervention
                          </p>

                          <p className="text-[10px] leading-4 text-amber-900 mt-0.5">
                            {analysis.recommendedIntervention}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Response guidance */}
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <p className="text-[9px] uppercase tracking-wide font-semibold text-slate-400">
                      Response Guidance
                    </p>

                    <div className="mt-1.5 space-y-1.5">
                      <div className="flex gap-2">
                        <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-600 text-[9px] font-bold flex items-center justify-center shrink-0">
                          1
                        </span>

                        <p className="text-[10px] leading-3.5 text-slate-600">
                          Acknowledge the customer concern before giving process details.
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-600 text-[9px] font-bold flex items-center justify-center shrink-0">
                          2
                        </span>

                        <p className="text-[10px] leading-3.5 text-slate-600">
                          Address the detected intent directly and avoid unnecessary back-and-forth.
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-600 text-[9px] font-bold flex items-center justify-center shrink-0">
                          3
                        </span>

                        <p className="text-[10px] leading-3.5 text-slate-600">
                          Adjust the response when sentiment, frustration, satisfaction, or escalation changes.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Current signals */}
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] uppercase tracking-wide font-semibold text-slate-400">
                        Current Signals
                      </p>

                      <span
                        className={`text-[10px] font-bold ${currentRiskClasses.text}`}
                      >
                        {escalationRisk} escalation
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                      <div className="rounded-md bg-slate-50 p-1.5">
                        <p className="text-[9px] text-slate-400">
                          Emotion
                        </p>

                        <p
                          className={`text-[11px] font-semibold mt-0.5 ${getEmotionClass(
                            emotion
                          )}`}
                        >
                          {formatLabel(emotion)}
                        </p>
                      </div>

                      <div className="rounded-md bg-slate-50 p-1.5">
                        <p className="text-[9px] text-slate-400">
                          Satisfaction
                        </p>

                        <p
                          className={`text-[11px] font-semibold mt-0.5 ${getSatisfactionClass(
                            satisfactionTrend
                          )}`}
                        >
                          {formatLabel(satisfactionTrend)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Risk reasons */}
                  {riskReasons.length > 0 && (
                    <div className={`rounded-lg border p-2.5 ${currentRiskClasses.border} ${currentRiskClasses.background}`}>
                      <div className="flex items-center gap-1.5">
                        <ShieldAlert
                          className={`w-3.5 h-3.5 ${currentRiskClasses.icon}`}
                        />

                        <p className={`text-[9px] uppercase tracking-wide font-bold ${currentRiskClasses.text}`}>
                          Risk Triggers
                        </p>
                      </div>

                      <div className="mt-1.5 space-y-1">
                        {riskReasons.map(
                          (reason, index) => (
                            <p
                              key={`${reason}-${index}`}
                              className="text-[10px] leading-4 text-slate-600"
                            >
                              • {reason}
                            </p>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto p-2.5 space-y-2 bg-slate-50/60">

                  {/* Task 5 primary RAG recommendations */}
                  {knowledgeRecommendations.length > 0 ? (
                    knowledgeRecommendations.map(
                      (recommendation, index) => (
                        <article
                          key={`${recommendation.chunk_id ?? recommendation.rank ?? index}-${index}`}
                          className="rounded-lg border border-slate-200 bg-white p-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[9px] uppercase tracking-wide text-indigo-500 font-semibold">
                                #{recommendation.rank ?? index + 1}
                                {' · '}
                                {recommendation.document_type ||
                                  'Knowledge'}
                              </p>

                              <h3 className="text-[11px] font-bold text-slate-800 mt-0.5">
                                {recommendation.document_name ||
                                  recommendation.title ||
                                  recommendation.source ||
                                  'Support Knowledge'}
                              </h3>
                            </div>

                            {recommendation.relevance_score != null && (
                              <span className="shrink-0 text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-1 rounded">
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

                          <p className="text-[11px] leading-4 text-slate-600 mt-2 whitespace-pre-wrap">
                            {recommendation.content}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-slate-400">
                            {recommendation.version != null && (
                              <span>
                                Version: {recommendation.version}
                              </span>
                            )}

                            {recommendation.page_number != null && (
                              <span>
                                Page: {recommendation.page_number}
                              </span>
                            )}

                            {recommendation.chunk_id && (
                              <span>
                                Chunk: {recommendation.chunk_id}
                              </span>
                            )}

                            {recommendation.section && (
                              <span>
                                Section: {recommendation.section}
                              </span>
                            )}
                          </div>
                        </article>
                      )
                    )
                  ) : relevantKnowledge ? (
                    /* Compatibility with the backend's single relevantKnowledge object */
                    <article className="rounded-lg border border-slate-200 bg-white p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[9px] uppercase tracking-wide text-indigo-500 font-semibold">
                            Verified Knowledge
                          </p>

                          <h3 className="text-[11px] font-bold text-slate-800 mt-0.5">
                            {relevantKnowledge.title ||
                              'Support Knowledge'}
                          </h3>
                        </div>

                        {typeof relevantKnowledge.confidence === 'number' && (
                          <span className="shrink-0 text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-1 rounded">
                            {Math.round(
                              relevantKnowledge.confidence
                            )}
                            %
                          </span>
                        )}
                      </div>

                      {relevantKnowledge.source && (
                        <p className="text-[9px] text-emerald-600 font-semibold mt-2">
                          Source: {relevantKnowledge.source}
                        </p>
                      )}

                      {relevantKnowledge.relevantSection && (
                        <p className="text-[9px] text-slate-400 mt-1">
                          Section: {relevantKnowledge.relevantSection}
                        </p>
                      )}

                      {relevantKnowledge.policySnippet && (
                        <p className="text-[11px] leading-4 text-slate-600 mt-2 whitespace-pre-wrap">
                          {relevantKnowledge.policySnippet}
                        </p>
                      )}

                      {Array.isArray(
                        relevantKnowledge.troubleshootingSteps
                      ) && (
                        <div className="mt-2 space-y-1">
                          {relevantKnowledge.troubleshootingSteps.map(
                            (step, index) => (
                              <p
                                key={`${String(step)}-${index}`}
                                className="text-[10px] leading-4 text-slate-600"
                              >
                                {index + 1}. {String(step)}
                              </p>
                            )
                          )}
                        </div>
                      )}

                      {relevantKnowledge.kbId && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenFullKb?.(
                              String(
                                relevantKnowledge.kbId
                              )
                            )
                          }
                          className="w-full mt-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Read Full KB Document
                        </button>
                      )}
                    </article>
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
                      <BookOpen className="w-7 h-7 text-slate-300 mx-auto" />

                      <p className="text-xs font-semibold text-slate-700 mt-2">
                        No relevant knowledge found
                      </p>

                      <p className="text-[10px] leading-4 text-slate-400 mt-1">
                        {analysis?.knowledge_message ||
                          'Knowledge recommendations will appear here when the backend returns relevant support content.'}
                      </p>
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
