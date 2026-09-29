
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Bot,
  BrainCircuit,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  UserRound,
} from 'lucide-react';

import {
  Scenario,
  ChatMessage,
  MessageAnalysis,
  CoachingLevel,
} from '../../types';

interface Task5KnowledgeRecommendation {
  rank: number;
  chunk_id?: string;
  document_name?: string;
  document_type?: string;
  version?: number | string | null;
  page_number?: number | string | null;
  relevance_score?: number | null;
  content: string;
  title?: string;
  source?: string;
}

type LiveAnalysis = MessageAnalysis & {
  knowledge_recommendations?: Task5KnowledgeRecommendation[];
  knowledge_message?: string;

  // Task 6 - Escalation Risk metadata from the backend.
  escalation_risk_score?: number;
  escalation_risk_threshold?: number;
  critical_threshold?: number;
  escalation_reasons?: string[];
  escalation_recommended_action?: string;
  escalation_alert?: boolean;
  escalation_critical_alert?: boolean;
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

interface NormalizedKnowledgeDocument {
  id: string;
  name: string;
  type: string;
  version?: string | number | null;
  page?: string | number | null;
  content: string;
  score?: number | null;
  chunkId?: string;
  source?: string;
  title?: string;
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
  inputText,
  setInputText,
  knowledgeDocs,
}) => {
  /*
   * ================================================================
   * LIVE CONVERSATION SCROLL
   * ================================================================
   *
   * Only this container scrolls automatically when new messages arrive.
   * We intentionally do NOT use scrollIntoView().
   */
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);

  const [rightPanelTab, setRightPanelTab] =
    useState<RightPanelTab>('coaching');

  const [responseCopied, setResponseCopied] = useState(false);

  /*
   * Scroll only the Live Conversation container.
   */
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

  /*
   * ================================================================
   * SEND MESSAGE
   * ================================================================
   */
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

  /*
   * ================================================================
   * LIVE ANALYSIS VALUES
   * ================================================================
   */
  const intent = analysis?.intent ?? '—';
  const emotion = analysis?.emotion ?? '—';
  const sentiment = analysis?.sentiment ?? '—';
  const frustration = analysis?.frustration_level ?? null;
  const satisfactionTrend = analysis?.satisfaction_trend ?? '—';
  const escalationRisk = analysis?.escalation_risk ?? '—';
  const confidence = analysis?.confidence ?? null;

  // ============================================================
  // TASK 6 - ESCALATION RISK DATA
  // ============================================================
  // These values come directly from the backend Task 6 payload.
  // The frontend does not recalculate the risk score.
  const escalationRiskScore =
    typeof analysis?.escalation_risk_score === 'number' &&
    Number.isFinite(analysis.escalation_risk_score)
      ? Math.max(0, Math.min(10, Math.round(analysis.escalation_risk_score)))
      : null;

  const escalationRiskThreshold =
    analysis?.escalation_risk_threshold ?? 7;

  const criticalThreshold =
    analysis?.critical_threshold ?? 9;

  const escalationReasons =
    analysis?.escalation_reasons ?? [];

  const escalationRecommendedAction =
    analysis?.escalation_recommended_action ?? '';

  const escalationAlert =
    analysis?.escalation_alert ?? false;

  const escalationCriticalAlert =
    analysis?.escalation_critical_alert ?? false;

  /*
   * ================================================================
   * FORMATTERS
   * ================================================================
   */
  const formatLabel = (value: string): string => {
    if (!value || value === '—') {
      return '—';
    }

    return value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  };

  const formatFrustration = (value: number | null): string => {
    if (value === null || value === undefined) {
      return '—';
    }

    return `${Math.max(0, Math.min(10, Math.round(value)))}/10`;
  };

  const formatConfidence = (value: number | null): string => {
    if (value === null || value === undefined) {
      return '—';
    }

    return `${Math.round(value * 100)}%`;
  };

  const formatScore = (value: number | null | undefined): string => {
    if (value === null || value === undefined) {
      return '—';
    }

    /*
     * Backend may return either:
     * 0.87 OR 87
     */
    const normalized = value <= 1 ? value * 100 : value;

    return `${Math.round(normalized)}%`;
  };

  /*
   * ================================================================
   * STATUS CLASSES
   * ================================================================
   */
  const getSentimentClass = (value: string): string => {
    switch (value) {
      case 'Positive':
        return 'text-emerald-600';

      case 'Negative':
        return 'text-red-600';

      default:
        return 'text-slate-600';
    }
  };

  const getEmotionClass = (value: string): string => {
    switch (value.toLowerCase()) {
      case 'happy':
      case 'satisfied':
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
  };

  const getFrustrationClass = (value: number | null): string => {
    if (value === null) {
      return 'text-slate-500';
    }

    if (value >= 8) {
      return 'text-red-600';
    }

    if (value >= 5) {
      return 'text-amber-600';
    }

    return 'text-emerald-600';
  };

  const getEscalationClass = (value: string): string => {
    switch (value) {
      case 'Critical':
      case 'High':
        return 'text-red-600';

      case 'Medium':
        return 'text-amber-600';

      case 'Low':
        return 'text-emerald-600';

      default:
        return 'text-slate-500';
    }
  };

  const getSatisfactionClass = (value: string): string => {
    switch (value) {
      case 'Improving':
        return 'text-emerald-600';

      case 'Declining':
        return 'text-red-600';

      default:
        return 'text-slate-600';
    }
  };

  /*
   * ================================================================
   * RECOMMENDED RESPONSE
   * ================================================================
   */
  /*
   * ================================================================
   * TASK 6-AWARE RECOMMENDED RESPONSE
   * ================================================================
   *
   * Task 4/5 may identify the customer intent correctly, but the
   * coaching response must also respect the current escalation risk.
   *
   * IMPORTANT:
   * - Low risk: normal intent-based coaching.
   * - Medium risk: empathetic + direct resolution guidance.
   * - High risk: de-escalation + clear resolution path.
   * - Critical risk: stop repeating the generic script and coach the
   *   agent toward human/supervisor escalation.
   *
   * The backend remains the source of truth for escalationRisk.
   * React does NOT calculate a risk score here.
   */
  const recommendedResponse = useMemo(() => {
    const normalizedIntent = intent.toLowerCase();
    const normalizedRisk = escalationRisk.toLowerCase();

    const latestCustomerMessage = [...messages]
      .reverse()
      .find((message) => message.sender !== 'agent')?.text
      ?.trim()
      .toLowerCase() ?? '';

    /* ------------------------------------------------------------
       CRITICAL ESCALATION
       ------------------------------------------------------------ */
    if (normalizedRisk === 'critical') {
      const mentionsSupervisor =
        latestCustomerMessage.includes('supervisor') ||
        latestCustomerMessage.includes('manager') ||
        latestCustomerMessage.includes('human agent') ||
        latestCustomerMessage.includes('human support');

      const mentionsChargeback =
        latestCustomerMessage.includes('chargeback') ||
        latestCustomerMessage.includes('bank') ||
        latestCustomerMessage.includes('credit card') ||
        latestCustomerMessage.includes('dispute');

      const mentionsRefund =
        latestCustomerMessage.includes('refund') ||
        latestCustomerMessage.includes('refunded') ||
        normalizedIntent.includes('refund') ||
        normalizedIntent.includes('payment') ||
        normalizedIntent.includes('billing');

      /*
       * Critical coaching must react to the CURRENT customer turn.
       * Do not return one static sentence for every critical turn.
       */
      if (mentionsSupervisor) {
        return (
          'Absolutely. I understand that you want a supervisor involved. '
          + 'I’ll escalate this now and make sure they have the invoice, cancellation, '
          + 'and refund details so you do not have to repeat the situation again.'
        );
      }

      if (mentionsChargeback && mentionsRefund) {
        return (
          'I understand that you are considering a chargeback and want this refund resolved immediately. '
          + 'I’ll acknowledge the concern, avoid making you repeat the details, and escalate the case for immediate review.'
        );
      }

      if (mentionsRefund) {
        return (
          'I understand you need a clear answer about the refund. I’ll stop repeating the same script, '
          + 'review the cancellation and payment details, and escalate the case if I cannot resolve it directly.'
        );
      }

      if (latestCustomerMessage.includes('complaint') || latestCustomerMessage.includes('report')) {
        return (
          'I understand that you are unhappy with how this has been handled. I’ll take ownership of the concern, '
          + 'avoid further back-and-forth, and escalate it for appropriate review.'
        );
      }

      return (
        'I understand that this situation has become extremely frustrating. I’ll take ownership of the next step, '
        + 'avoid repeating the same response, and escalate the issue for immediate review.'
      );
    }

    /* ------------------------------------------------------------
       HIGH ESCALATION
       ------------------------------------------------------------ */
    if (normalizedRisk === 'high') {
      if (
        latestCustomerMessage.includes('refund') ||
        normalizedIntent.includes('refund') ||
        normalizedIntent.includes('payment') ||
        normalizedIntent.includes('billing')
      ) {
        return (
          'I understand this is frustrating. I’ll address the refund issue directly, '
          + 'verify the payment and cancellation details, and clearly explain the next step '
          + 'so we can move this toward resolution.'
        );
      }

      return (
        'I understand your frustration. I’ll address the issue directly, avoid unnecessary '
        + 'back-and-forth, and clearly explain the next step toward resolution.'
      );
    }

    /* ------------------------------------------------------------
       MEDIUM ESCALATION
       ------------------------------------------------------------ */
    if (normalizedRisk === 'medium') {
      if (
        normalizedIntent.includes('refund') ||
        normalizedIntent.includes('payment') ||
        normalizedIntent.includes('billing')
      ) {
        return (
          'I understand your concern. I’ll check the account and payment details and '
          + 'confirm the next step for resolving the refund issue.'
        );
      }

      if (normalizedIntent.includes('cancel')) {
        return (
          'I understand your concern. I’ll verify the cancellation status and explain '
          + 'clearly what needs to happen next.'
        );
      }

      return (
        'I understand your concern. I’ll address the issue directly and explain the '
        + 'next step clearly.'
      );
    }

    /* ------------------------------------------------------------
       LOW / NORMAL ESCALATION
       ------------------------------------------------------------ */
    if (
      normalizedIntent.includes('refund') ||
      normalizedIntent.includes('payment') ||
      normalizedIntent.includes('billing')
    ) {
      return 'I understand your concern. Let me check the account and payment details so I can confirm the next step for your refund.';
    }

    if (normalizedIntent.includes('cancel')) {
      return 'I understand your concern. Let me verify the cancellation status and make sure there are no further charges on the account.';
    }

    if (normalizedIntent.includes('delivery')) {
      return 'I understand the concern about your delivery. Let me check the latest order status and confirm what we can do next.';
    }

    return 'I understand your concern. Let me review the details and help you with the next step.';
  }, [
    intent,
    escalationRisk,
    messages,
  ]);

  const applyRecommendedResponse = () => {
    setInputText(recommendedResponse);
    setResponseCopied(true);

    window.setTimeout(() => {
      setResponseCopied(false);
    }, 1600);
  };

  const copyRecommendedResponse = async () => {
    try {
      await navigator.clipboard.writeText(recommendedResponse);

      setResponseCopied(true);

      window.setTimeout(() => {
        setResponseCopied(false);
      }, 1600);
    } catch {
      setInputText(recommendedResponse);
    }
  };

  /*
   * ================================================================
   * KNOWLEDGE BASE
   * ================================================================
   *
   * Priority:
   *
   * 1. Real Task 5 recommendations from backend
   * 2. knowledgeDocs prop as fallback
   *
   * This makes the UI document-aware instead of showing
   * generic knowledge content.
   */

  const task5Knowledge = useMemo<NormalizedKnowledgeDocument[]>(() => {
    const recommendations =
      analysis?.knowledge_recommendations ?? [];

    return recommendations.map((recommendation, index) => ({
      id:
        recommendation.chunk_id ||
        `${recommendation.document_name || 'document'}-${index}`,

      name:
        recommendation.document_name ||
        recommendation.title ||
        recommendation.source ||
        'Support Knowledge',

      type:
        recommendation.document_type ||
        'Knowledge Document',

      version: recommendation.version,

      page: recommendation.page_number,

      content:
        recommendation.content ||
        'No document content was returned.',

      score: recommendation.relevance_score,

      chunkId: recommendation.chunk_id,

      source: recommendation.source,

      title: recommendation.title,
    }));
  }, [analysis?.knowledge_recommendations]);

  /*
   * Convert unknown knowledgeDocs into a safe UI shape.
   *
   * Different backend versions may use slightly different field names,
   * so this intentionally supports common names without crashing.
   */
  const fallbackKnowledge = useMemo<NormalizedKnowledgeDocument[]>(() => {
    if (!Array.isArray(knowledgeDocs)) {
      return [];
    }

    return knowledgeDocs
      .map((rawDocument, index) => {
        if (
          !rawDocument ||
          typeof rawDocument !== 'object'
        ) {
          return null;
        }

        const document = rawDocument as Record<string, unknown>;

        const name =
          document.document_name ??
          document.name ??
          document.title ??
          document.filename ??
          document.file_name ??
          document.source;

        const content =
          document.content ??
          document.text ??
          document.chunk ??
          document.page_content ??
          document.description;

        if (
          typeof name !== 'string' &&
          typeof content !== 'string'
        ) {
          return null;
        }

        return {
          id: String(
            document.id ??
              document.document_id ??
              document.chunk_id ??
              `knowledge-document-${index}`
          ),

          name:
            typeof name === 'string'
              ? name
              : 'Support Knowledge',

          type:
            typeof document.document_type === 'string'
              ? document.document_type
              : typeof document.type === 'string'
              ? document.type
              : 'Knowledge Document',

          version:
            (document.version as
              | string
              | number
              | null
              | undefined) ?? null,

          page:
            (document.page_number as
              | string
              | number
              | null
              | undefined) ??
            (document.page as
              | string
              | number
              | null
              | undefined) ??
            null,

          content:
            typeof content === 'string'
              ? content
              : 'No document content available.',

          score:
            typeof document.relevance_score === 'number'
              ? document.relevance_score
              : null,

          chunkId:
            typeof document.chunk_id === 'string'
              ? document.chunk_id
              : undefined,

          source:
            typeof document.source === 'string'
              ? document.source
              : undefined,

          title:
            typeof document.title === 'string'
              ? document.title
              : undefined,
        };
      })
      .filter(
        (
          document
        ): document is NormalizedKnowledgeDocument =>
          document !== null
      );
  }, [knowledgeDocs]);

  /*
   * Backend recommendations are always preferred.
   * knowledgeDocs is only a fallback.
   */
  const displayedKnowledge =
    task5Knowledge.length > 0
      ? task5Knowledge
      : fallbackKnowledge;

  /*
   * Try to identify whether the current knowledge content is
   * actually related to the detected customer intent.
   *
   * This is only used for a small UI label.
   */
  const knowledgeContextLabel = useMemo(() => {
    if (task5Knowledge.length > 0) {
      if (intent !== '—') {
        return `Related to ${formatLabel(intent)}`;
      }

      return 'Retrieved from current conversation';
    }

    if (fallbackKnowledge.length > 0) {
      return 'Available support documents';
    }

    return 'Waiting for relevant document';
  }, [
    task5Knowledge.length,
    fallbackKnowledge.length,
    intent,
  ]);

  return (
    /*
     * ================================================================
     * ROOT
     *
     * No page-level scrolling.
     * Only dedicated internal areas can scroll.
     * ================================================================
     */
    <div className="h-full min-h-0 w-full bg-slate-50 flex flex-col overflow-hidden">

      {/* ============================================================
          LIVE SESSION HEADER
          ============================================================ */}

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

      {/* ============================================================
          MAIN WORKSPACE
          ============================================================ */}

      <main className="flex-1 min-h-0 w-full overflow-hidden px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5">

        <div
          className="
            h-full
            min-h-0
            w-full
            grid
            grid-cols-1
            xl:grid-cols-[minmax(0,1fr)_390px]
            gap-4
            xl:gap-5
          "
        >

          {/* ========================================================
              LEFT — LIVE CONVERSATION
              ======================================================== */}

          <section
            className="
              min-h-0
              h-full
              bg-white
              border
              border-slate-200
              rounded-xl
              shadow-sm
              flex
              flex-col
              overflow-hidden
            "
          >

            {/* Chat header */}

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

            {/* ======================================================
                ONLY LIVE CONVERSATION SCROLLS
                ====================================================== */}

            <div
              ref={messagesScrollRef}
              className="
                flex-1
                min-h-0
                overflow-y-auto
                overflow-x-hidden
                px-4
                sm:px-6
                py-4
                space-y-4
                overscroll-contain
              "
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
                      key={`${message.sender}-${index}`}
                      className={`flex ${
                        isAgent
                          ? 'justify-end'
                          : 'justify-start'
                      }`}
                    >

                      <div
                        className={`
                          flex
                          gap-2.5
                          max-w-[92%]
                          sm:max-w-[82%]
                          ${
                            isAgent
                              ? 'flex-row-reverse'
                              : 'flex-row'
                          }
                        `}
                      >

                        <div
                          className={`
                            w-8
                            h-8
                            shrink-0
                            rounded-full
                            flex
                            items-center
                            justify-center
                            ${
                              isAgent
                                ? 'bg-slate-900 text-white'
                                : 'bg-indigo-50 text-indigo-600'
                            }
                          `}
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
                            className={`
                              px-3.5
                              py-2.5
                              rounded-2xl
                              text-[13px]
                              leading-5
                              ${
                                isAgent
                                  ? 'bg-slate-900 text-white rounded-tr-md'
                                  : 'bg-slate-100 text-slate-800 rounded-tl-md'
                              }
                            `}
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

            {/* ======================================================
                CHAT INPUT — FIXED
                ====================================================== */}

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
                  className="
                    flex-1
                    min-w-0
                    resize-none
                    rounded-lg
                    border
                    border-slate-200
                    bg-slate-50
                    px-3.5
                    py-2.5
                    text-sm
                    text-slate-800
                    placeholder:text-slate-400
                    outline-none
                    focus:border-indigo-400
                    focus:bg-white
                    transition
                    disabled:opacity-60
                  "
                />

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={
                    !inputText.trim() ||
                    isSimulatingCustomer
                  }
                  className="
                    h-10
                    px-3.5
                    rounded-lg
                    bg-slate-900
                    hover:bg-slate-800
                    disabled:bg-slate-200
                    disabled:text-slate-400
                    text-white
                    text-sm
                    font-semibold
                    flex
                    items-center
                    gap-1.5
                    transition
                    shrink-0
                  "
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

          {/* ========================================================
              RIGHT PANEL
              ======================================================== */}

          <aside
            className="
              min-h-0
              h-full
              w-full
              flex
              flex-col
              gap-3
              overflow-hidden
            "
          >

            {/* ======================================================
                LIVE ANALYSIS
                ====================================================== */}

            <section
              className="
                shrink-0
                bg-white
                border
                border-slate-200
                rounded-xl
                shadow-sm
                overflow-hidden
              "
            >

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
                    {sentiment}
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

                <div className="px-3 py-2 min-w-0">

                  <div className="flex items-center gap-1">

                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                      Escalation
                    </p>

                    {escalationRisk === 'High' && (
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                    )}

                  </div>

                  <p
                    className={`text-xs font-bold mt-1 ${getEscalationClass(
                      escalationRisk
                    )}`}
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

            </section>

            {/* ======================================================
                RIGHT PANEL
                ====================================================== */}

            <section
              className="
                min-h-0
                flex-1
                bg-white
                border
                border-slate-200
                rounded-xl
                shadow-sm
                overflow-hidden
                flex
                flex-col
              "
            >

              {/* ====================================================
                  TABS
                  ==================================================== */}

              <div className="shrink-0 grid grid-cols-2 border-b border-slate-200">

                <button
                  type="button"
                  onClick={() => setRightPanelTab('coaching')}
                  className={`
                    h-12
                    px-3
                    flex
                    items-center
                    justify-center
                    gap-2
                    text-sm
                    font-semibold
                    transition
                    ${
                      rightPanelTab === 'coaching'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-500 hover:bg-slate-50'
                    }
                  `}
                >
                  <Sparkles className="w-4 h-4" />
                  AI Real-Time Coaching
                </button>

                <button
                  type="button"
                  onClick={() => setRightPanelTab('knowledge')}
                  className={`
                    h-12
                    px-3
                    flex
                    items-center
                    justify-center
                    gap-2
                    text-sm
                    font-semibold
                    transition
                    ${
                      rightPanelTab === 'knowledge'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-500 hover:bg-slate-50'
                    }
                  `}
                >
                  <BookOpen className="w-4 h-4" />
                  Knowledge Base
                </button>

              </div>

              {/* ====================================================
                  COACHING PANEL
                  ==================================================== */}

              {rightPanelTab === 'coaching' ? (

                <div
                  className="
                    min-h-0
                    flex-1
                    overflow-y-auto
                    overflow-x-hidden
                    p-2.5
                    space-y-2
                    bg-slate-50/60
                  "
                >

                  {/* Current AI analysis */}

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
                          Sentiment: {sentiment}
                        </p>

                      </div>

                    </div>

                  </div>

                  {/* Recommended response */}

                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-2.5">

                    <div className="flex items-center gap-2">

                      <Sparkles className="w-4 h-4 text-indigo-500" />

                      <span className="text-xs font-bold text-slate-800">
                        Recommended Response
                      </span>

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

                  {/* Guidance */}

                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">

                    <p className="text-[9px] uppercase tracking-wide font-semibold text-slate-400">
                      Response Guidance
                    </p>

                    <div className="mt-1.5 space-y-1.5">

                      <div className="flex gap-2">

                        <span className="w-4.5 h-4.5 rounded-full bg-indigo-50 text-indigo-600 text-[9px] font-bold flex items-center justify-center shrink-0">
                          1
                        </span>

                        <p className="text-[10px] leading-3.5 text-slate-600">
                          Acknowledge the customer concern before
                          giving process details.
                        </p>

                      </div>

                      <div className="flex gap-2">

                        <span className="w-4.5 h-4.5 rounded-full bg-indigo-50 text-indigo-600 text-[9px] font-bold flex items-center justify-center shrink-0">
                          2
                        </span>

                        <p className="text-[10px] leading-3.5 text-slate-600">
                          Address the detected intent directly and
                          avoid unnecessary back-and-forth.
                        </p>

                      </div>

                      <div className="flex gap-2">

                        <span className="w-4.5 h-4.5 rounded-full bg-indigo-50 text-indigo-600 text-[9px] font-bold flex items-center justify-center shrink-0">
                          3
                        </span>

                        <p className="text-[10px] leading-3.5 text-slate-600">
                          Keep the tone professional while live
                          sentiment and escalation signals are
                          monitored.
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
                        className={`text-[10px] font-bold ${getEscalationClass(
                          escalationRisk
                        )}`}
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

                  {/* ====================================================
                      TASK 6 — ESCALATION RISK MONITOR
                      ==================================================== */}

                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">

                    <div className="flex items-center justify-between gap-2">

                      <div className="flex items-center gap-2 min-w-0">

                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            escalationCriticalAlert
                              ? 'bg-red-100 text-red-600'
                              : escalationAlert
                                ? 'bg-amber-100 text-amber-600'
                                : 'bg-emerald-100 text-emerald-600'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800">
                            Escalation Risk Monitor
                          </p>

                          <p className="text-[9px] text-slate-400 mt-0.5">
                            Task 6 · Live monitoring
                          </p>
                        </div>

                      </div>

                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full border text-[10px] font-bold shrink-0 ${
                          escalationCriticalAlert
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : escalationAlert
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {escalationRisk}
                      </span>

                    </div>

                    <div className="grid grid-cols-3 gap-1.5 mt-2.5">

                      <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <p className="text-[9px] uppercase tracking-wide text-slate-400">
                          Risk Score
                        </p>
                        <p className="text-sm font-bold text-slate-900 mt-0.5">
                          {escalationRiskScore !== null
                            ? `${escalationRiskScore}/10`
                            : '—'}
                        </p>
                      </div>

                      <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <p className="text-[9px] uppercase tracking-wide text-slate-400">
                          Threshold
                        </p>
                        <p className="text-sm font-bold text-slate-900 mt-0.5">
                          {escalationRiskThreshold}/10
                        </p>
                      </div>

                      <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <p className="text-[9px] uppercase tracking-wide text-slate-400">
                          Critical
                        </p>
                        <p className="text-sm font-bold text-slate-900 mt-0.5">
                          {criticalThreshold}/10
                        </p>
                      </div>

                    </div>

                    <div
                      className={`mt-2 rounded-md px-2 py-1.5 flex items-center justify-between ${
                        escalationCriticalAlert
                          ? 'bg-red-50'
                          : escalationAlert
                            ? 'bg-amber-50'
                            : 'bg-emerald-50'
                      }`}
                    >
                      <span className="text-[10px] font-medium text-slate-600">
                        Monitoring Status
                      </span>

                      <span
                        className={`text-[10px] font-bold ${
                          escalationCriticalAlert
                            ? 'text-red-700'
                            : escalationAlert
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                        }`}
                      >
                        {escalationCriticalAlert
                          ? 'Critical Alert'
                          : escalationAlert
                            ? 'Attention Required'
                            : 'Normal Monitoring'}
                      </span>
                    </div>

                    {escalationReasons.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[9px] uppercase tracking-wide font-semibold text-slate-400">
                          Risk Indicators
                        </p>

                        <div className="mt-1.5 space-y-1">
                          {escalationReasons.slice(0, 2).map((reason, index) => (
                            <div
                              key={`${reason}-${index}`}
                              className="flex items-start gap-1.5"
                            >
                              <span className="w-1 h-1 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                              <p className="text-[10px] leading-4 text-slate-600">
                                {reason}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {escalationRecommendedAction && (
                      <div className="mt-2 rounded-md border border-indigo-100 bg-indigo-50/60 p-2">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                          <p className="text-[9px] uppercase tracking-wide font-semibold text-indigo-600">
                            Recommended Action
                          </p>
                        </div>

                        <p className="text-[10px] leading-4 text-slate-600 mt-1">
                          {escalationRecommendedAction}
                        </p>
                      </div>
                    )}

                  </div>

                </div>

              ) : (

                /* ==================================================
                   KNOWLEDGE BASE PANEL
                   ================================================== */

                <div
                  className="
                    min-h-0
                    flex-1
                    overflow-y-auto
                    overflow-x-hidden
                    p-2.5
                    space-y-2
                    bg-slate-50/60
                  "
                >

                  {/* Knowledge context header */}

                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-2.5">

                    <div className="flex items-start gap-2">

                      <div className="w-8 h-8 rounded-lg bg-white border border-indigo-100 flex items-center justify-center shrink-0">

                        <BookOpen className="w-4 h-4 text-indigo-600" />

                      </div>

                      <div className="min-w-0">

                        <div className="flex items-center gap-1.5">

                          <p className="text-xs font-bold text-slate-800">
                            Relevant Knowledge
                          </p>

                          {isAnalyzing && (
                            <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin" />
                          )}

                        </div>

                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {knowledgeContextLabel}
                        </p>

                      </div>

                    </div>

                  </div>

                  {/* ==================================================
                      DOCUMENT CARDS
                      ================================================== */}

                  {displayedKnowledge.length > 0 ? (

                    displayedKnowledge.map(
                      (document, index) => (

                        <article
                          key={`${document.id}-${index}`}
                          className="
                            rounded-lg
                            border
                            border-slate-200
                            bg-white
                            overflow-hidden
                            shadow-sm
                          "
                        >

                          {/* Document header */}

                          <div className="p-2.5 border-b border-slate-100">

                            <div className="flex items-start gap-2">

                              <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">

                                <FileText className="w-3.5 h-3.5 text-slate-500" />

                              </div>

                              <div className="min-w-0 flex-1">

                                <div className="flex items-center gap-1.5 flex-wrap">

                                  <span className="text-[9px] uppercase tracking-wide text-indigo-600 font-bold">
                                    {document.type}
                                  </span>

                                  {document.score != null && (
                                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                                      {formatScore(
                                        document.score
                                      )}{' '}
                                      match
                                    </span>
                                  )}

                                </div>

                                <h3 className="text-[11px] font-bold text-slate-800 mt-1 leading-4 break-words">
                                  {document.name}
                                </h3>

                              </div>

                            </div>

                          </div>

                          {/* Document metadata */}

                          {(document.version != null ||
                            document.page != null ||
                            document.chunkId) && (

                            <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-x-3 gap-y-1">

                              {document.version != null && (
                                <span className="text-[9px] text-slate-500">
                                  Version:{' '}
                                  <span className="font-semibold text-slate-700">
                                    {document.version}
                                  </span>
                                </span>
                              )}

                              {document.page != null && (
                                <span className="text-[9px] text-slate-500">
                                  Page:{' '}
                                  <span className="font-semibold text-slate-700">
                                    {document.page}
                                  </span>
                                </span>
                              )}

                              {document.chunkId && (
                                <span className="text-[9px] text-slate-500 truncate max-w-full">
                                  Chunk:{' '}
                                  <span className="font-semibold text-slate-700">
                                    {document.chunkId}
                                  </span>
                                </span>
                              )}

                            </div>
                          )}

                          {/* Actual relevant document content */}

                          <div className="p-2.5">

                            <p className="text-[9px] uppercase tracking-wide font-semibold text-slate-400 mb-1.5">
                              Relevant Content
                            </p>

                            <p className="text-[11px] leading-4.5 text-slate-700 whitespace-pre-wrap break-words">
                              {document.content}
                            </p>

                          </div>

                          {/* Source */}

                          {document.source && (
                            <div className="px-2.5 pb-2.5">

                              <div className="rounded-md bg-slate-50 border border-slate-100 px-2 py-1.5">

                                <p className="text-[9px] text-slate-400">
                                  Source
                                </p>

                                <p className="text-[9px] font-medium text-slate-600 mt-0.5 break-all">
                                  {document.source}
                                </p>

                              </div>

                            </div>
                          )}

                        </article>
                      )
                    )

                  ) : (

                    /* ==================================================
                       NO KNOWLEDGE
                       ================================================== */

                    <div className="rounded-lg border border-slate-200 bg-white p-5 text-center">

                      <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto">

                        <BookOpen className="w-5 h-5 text-slate-300" />

                      </div>

                      <p className="text-xs font-semibold text-slate-700 mt-2">

                        No related document found

                      </p>

                      <p className="text-[10px] leading-4 text-slate-400 mt-1">

                        {analysis?.knowledge_message ||
                          'Relevant knowledge will appear here when the backend returns document content for the current customer query.'}

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