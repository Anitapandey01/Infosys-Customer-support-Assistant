import { useCallback, useEffect, useState } from 'react';

import {
  Headphones,
  Sparkles,
  BookOpen,
  BarChart3,
  LayoutDashboard,
  FileText,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  TrendingUp,
} from 'lucide-react';

import { Navbar } from './components/Navbar';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { LiveConsoleView } from './components/LiveConsole/LiveConsoleView';
import { ScenariosView } from './components/ScenariosView';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { ReplayModeView } from './components/ReplayModeView';
import { ManualModeModal } from './components/ManualModeModal';
import { LoginView } from './components/LoginView';
import { PolicyManagementView } from './components/PolicyManagementView';
import { SimulatorSetupView } from './components/SimulatorSetupView';

import {
  InteractionMode,
  UserRole,
  UserAccount,
  CoachingLevel,
  Scenario,
  ChatMessage,
  MessageAnalysis,
  KnowledgeDocument,
  AgentProfile,
  DifficultyLevel,
  SimulatorAnalysis,
} from './types';

import {
  INITIAL_SCENARIOS,
  INITIAL_KNOWLEDGE_DOCS,
  INITIAL_USER_PROFILE,
} from './data/initialData';

import {
  analyzeTurnApi,
  simulateCustomerTurnApi,
  startSimulatorApi,
  generateScenarioApi,
  fetchCurrentUserApi,
  logoutApi,
  generateReportApi,
} from './services/api';

type PostInteractionReport = Awaited<
  ReturnType<typeof generateReportApi>
> & {
  outcome?: string;
  interactionSummary?: {
    intent?: string;
    emotion?: string;
    sentiment?: string;
    frustration_level?: number;
    satisfaction_trend?: string;
    escalation_risk?: string;
    outcome?: string;
  };
  conversationMetrics?: {
    total_messages?: number;
    customer_messages?: number;
    agent_messages?: number;
  };
  durationSeconds?: number;
  generatedAt?: string;
};

export default function App() {
  // ============================================================
  // AUTHENTICATION
  // ============================================================

  const [currentUser, setCurrentUser] =
    useState<UserAccount | null>(null);

  const [isAuthLoading, setIsAuthLoading] =
    useState(true);

  const normalizeUserRole = (
    role: string
  ): UserRole => {
    const normalizedRole =
      role.trim().toLowerCase();

    if (normalizedRole === 'admin') {
      return 'admin' as UserRole;
    }

    if (normalizedRole === 'employee') {
      return 'employee' as UserRole;
    }

    return 'user' as UserRole;
  };

  const applyAuthenticatedUser = (
    user: UserAccount
  ) => {
    const normalizedRole =
      normalizeUserRole(
        String(user.role)
      );

    const normalizedUser = {
      ...user,
      role: normalizedRole,
    } as UserAccount;

    setCurrentUser(
      normalizedUser
    );

    setUserRole(
      normalizedRole
    );
  };

  // ============================================================
  // APPLICATION STATE
  // ============================================================

  const [activeTab, setActiveTab] =
    useState<ActiveTab>(
      'dashboard'
    );

  const [currentMode, setCurrentMode] =
    useState<InteractionMode>(
      'simulator'
    );

  const [userRole, setUserRole] =
    useState<UserRole>(
      'user' as UserRole
    );

  const [coachingLevel, setCoachingLevel] =
    useState<CoachingLevel>(
      'beginner'
    );

  const [piiMaskingEnabled, setPiiMaskingEnabled] =
    useState(true);

  const [activeLanguage, setActiveLanguage] =
    useState('English');

  const [isMobileMenuOpen, setIsMobileMenuOpen] =
    useState(false);

  // ============================================================
  // SIMULATOR CONFIGURATION
  // ============================================================

  const [simulatorConfig, setSimulatorConfig] =
    useState<{
      session_label: string;
      persona: string;
      initial_emotion: string;
      scenario: string;
      issue_severity: number;
      patience_level: number;
      expected_resolution: string;
    } | null>(null);

  // ============================================================
  // REAL BACKEND SIMULATOR SESSION
  // ============================================================

  const [simulatorSessionId, setSimulatorSessionId] =
    useState<string | null>(null);

  // ============================================================
  // AUTH SESSION RESTORE
  // ============================================================

  useEffect(() => {
    fetchCurrentUserApi()
      .then((user) => {
        if (user) {
          applyAuthenticatedUser(user);
        }

        setIsAuthLoading(false);
      })
      .catch(() => {
        setCurrentUser(null);
        setIsAuthLoading(false);
      });
  }, []);

  // ============================================================
  // LOGIN
  // ============================================================

  const handleLoginSuccess = (
    user: UserAccount
  ) => {
    applyAuthenticatedUser(user);

    setActiveTab('dashboard');

    setCurrentMode('simulator');

    setIsMobileMenuOpen(false);
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch (error) {
      console.error(
        'Logout failed:',
        error
      );
    }

    setCurrentUser(null);

    setActiveTab('dashboard');

    setCurrentMode('simulator');

    setIsMobileMenuOpen(false);

    setSimulatorConfig(null);

    setSimulatorSessionId(null);

    setMessages([]);

    setCurrentAnalysis(undefined);

    setHasActiveSession(false);
    setPostInteractionReport(null);
    setReportError(null);
  };

  // ============================================================
  // DATA
  // ============================================================

  const [scenarios, setScenarios] =
    useState<Scenario[]>(
      INITIAL_SCENARIOS
    );

  const [knowledgeDocs, setKnowledgeDocs] =
    useState<KnowledgeDocument[]>(
      INITIAL_KNOWLEDGE_DOCS
    );

  const [userProfile, setUserProfile] =
    useState<AgentProfile>(
      INITIAL_USER_PROFILE
    );

  // ============================================================
  // ACTIVE SESSION
  // ============================================================

  const [activeScenario, setActiveScenario] =
    useState<Scenario>(
      INITIAL_SCENARIOS[0]
    );

  const [messages, setMessages] =
    useState<ChatMessage[]>(
      []
    );

  const [currentAnalysis, setCurrentAnalysis] =
    useState<MessageAnalysis | undefined>(
      undefined
    );

  const [isAnalyzing, setIsAnalyzing] =
    useState(false);

  const [isSimulatingCustomer, setIsSimulatingCustomer] =
    useState(false);

  const [inputText, setInputText] =
    useState('');

  const [isImprovingInput, setIsImprovingInput] =
    useState(false);

  const [sessionStartTime, setSessionStartTime] =
    useState<number>(
      Date.now()
    );

  const [hasActiveSession, setHasActiveSession] =
    useState(false);

  const [isManualModalOpen, setIsManualModalOpen] =
    useState(false);

  const [postInteractionReport, setPostInteractionReport] =
    useState<PostInteractionReport | null>(null);

  const [isGeneratingReport, setIsGeneratingReport] =
    useState(false);

  const [reportError, setReportError] =
    useState<string | null>(null);

  // ============================================================
  // TYPE NORMALIZATION
  // ============================================================

  /*
   * SimulatorAnalysis and MessageAnalysis contain the same
   * Task 4 core analysis fields.
   *
   * MessageAnalysis also has an index signature because it
   * supports additional backend analysis fields.
   *
   * This adapter keeps the backend response unchanged while
   * making it compatible with the ChatMessage type.
   */
  const normalizeSimulatorAnalysis = (
    analysis: SimulatorAnalysis,
    escalation?: unknown
  ): MessageAnalysis => {
    /*
     * IMPORTANT:
     * The simulator backend is the source of truth for Tasks 4–6.
     *
     * Do not rebuild or selectively copy the analysis object here.
     * The old implementation copied only the seven Task-4 fields and
     * silently discarded Task-5 RAG recommendations and Task-6 risk
     * metadata (including Critical escalation).
     *
     * Keep every backend field while normalising only the legacy aliases
     * used by older UI components.
     */
    const backendAnalysis = analysis as MessageAnalysis;

    const analysisRecord =
      analysis && typeof analysis === 'object'
        ? (analysis as Record<string, unknown>)
        : {};

    // Task 6 may be returned either as the simulator response's
    // top-level `escalation` object or nested inside `analysis`.
    // Accept both shapes so the UI never silently converts a real
    // backend score into 0.
    const backendEscalationSource =
      escalation && typeof escalation === 'object'
        ? escalation
        : analysisRecord.escalation;

    const backendEscalation =
      backendEscalationSource &&
      typeof backendEscalationSource === 'object'
        ? (backendEscalationSource as Record<string, unknown>)
        : null;

    return {
      ...backendAnalysis,

      // ========================================================
      // TASK 6 - ESCALATION RISK METADATA
      // ========================================================
      // The simulator response keeps Task 6 in a separate
      // `escalation` object. Flatten only these display fields
      // into the analysis object so the existing LiveConsole UI
      // can consume them without changing the Task 4 structure.
      escalation_risk_score:
        backendEscalation &&
        backendEscalation.risk_score !== undefined &&
        backendEscalation.risk_score !== null
          ? Number(backendEscalation.risk_score)
          : undefined,

      escalation_risk_threshold:
        backendEscalation &&
        backendEscalation.risk_threshold !== undefined &&
        backendEscalation.risk_threshold !== null
          ? Number(backendEscalation.risk_threshold)
          : 7,

      critical_threshold:
        backendEscalation &&
        backendEscalation.critical_threshold !== undefined &&
        backendEscalation.critical_threshold !== null
          ? Number(backendEscalation.critical_threshold)
          : 9,

      escalation_reasons:
        backendEscalation && Array.isArray(backendEscalation.reasons)
          ? backendEscalation.reasons.filter(
              (reason): reason is string =>
                typeof reason === 'string'
            )
          : [],

      escalation_recommended_action:
        String(
          backendEscalation?.recommended_action ??
            ''
        ),

      escalation_alert:
        Boolean(backendEscalation?.alert),

      escalation_critical_alert:
        Boolean(backendEscalation?.critical_alert),

      intent:
        backendAnalysis.intent ?? 'Unknown',

      emotion:
        backendAnalysis.emotion ?? 'Unknown',

      sentiment:
        backendAnalysis.sentiment ?? 'Neutral',

      frustration_level:
        Number(
          backendAnalysis.frustration_level ??
          backendAnalysis.frustrationLevel ??
          0
        ),

      satisfaction_trend:
        backendAnalysis.satisfaction_trend ?? 'Stable',

      escalation_risk:
        (backendAnalysis.escalation_risk ??
          backendAnalysis.escalationLevel ??
          'Low') as MessageAnalysis['escalation_risk'],

      confidence:
        Number(
          backendAnalysis.confidence ??
          backendAnalysis.intentConfidence ??
          0
        ),

      intentConfidence:
        backendAnalysis.intentConfidence ??
        backendAnalysis.confidence,

      sentimentConfidence:
        backendAnalysis.sentimentConfidence ??
        backendAnalysis.confidence,

      frustrationLevel:
        backendAnalysis.frustrationLevel ??
        backendAnalysis.frustration_level,
    };
  };

  // Prevent unused-state compiler/linter problems
  void simulatorConfig;
  void sessionStartTime;

  // ============================================================
  // START EXISTING LOCAL SCENARIO SESSION
  // ============================================================

  const handleStartScenario = useCallback(
    (scenario: Scenario) => {
      setActiveScenario(scenario);

      const openingMsg: ChatMessage = {
        id: `msg-${Date.now()}-cust-0`,

        sender: 'customer',

        text: scenario.customerOpeningMessage,

        timestamp: new Date().toLocaleTimeString(
          [],
          {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }
        ),

        customerState: {
          frustration:
            Number(
              scenario.customerPersona
                .baseFrustration
            ),

          trust:
            Number(
              scenario.customerPersona
                .trust
            ),

          patience:
            Number(
              scenario.customerPersona
                .patience
            ),

          satisfaction:
            Number(
              scenario.customerPersona
                .satisfaction
            ),

          escalationIntent:
            Number(
              scenario.customerPersona
                .escalationIntent
            ),
        },
      };

      setMessages([
        openingMsg,
      ]);

      setInputText('');

      setSessionStartTime(
        Date.now()
      );

      setHasActiveSession(true);

      /*
       * This is the existing local scenario flow.
       *
       * It is separate from the configured backend
       * simulator session.
       */
      setSimulatorSessionId(null);

      setActiveTab(
        'live_console'
      );

      setCurrentMode(
        'simulator'
      );

      setIsAnalyzing(true);

      analyzeTurnApi({
        customerMessage:
          scenario.customerOpeningMessage,

        conversationHistory: [
          openingMsg,
        ],

        scenario,

        knowledgeDocs,
      })
        .then((analysis) => {
          setCurrentAnalysis(
            analysis
          );
        })
        .catch((error) => {
          console.error(
            'Initial turn analysis failed:',
            error
          );

          setCurrentAnalysis(
            undefined
          );
        })
        .finally(() => {
          setIsAnalyzing(false);
        });
    },
    [knowledgeDocs]
  );

  // ============================================================
  // START CONFIGURED REAL BACKEND SIMULATOR
  // ============================================================

  const handleStartConfiguredSimulation =
    async (
      config: {
        session_label?: string;
        persona: string;
        initial_emotion: string;
        scenario: string;
        issue_severity: number;
        patience_level: number;
        expected_resolution: string;
      }
    ) => {
      const backendConfig = {
        session_label:
          config.session_label ||
          `Simulator-${Date.now()}`,

        persona:
          config.persona,

        initial_emotion:
          config.initial_emotion,

        scenario:
          config.scenario,

        issue_severity:
          config.issue_severity,

        patience_level:
          config.patience_level,

        expected_resolution:
          config.expected_resolution,
      };

      setSimulatorConfig(
        backendConfig
      );

      setSimulatorSessionId(null);

      setMessages([]);

      setCurrentAnalysis(undefined);

      setIsSimulatingCustomer(true);

      setIsAnalyzing(false);

      try {
        /*
         * REAL BACKEND
         *
         * POST /simulator/start
         *
         * IMPORTANT:
         * The backend Task 4 analysis is returned
         * directly in result.analysis.
         */

        const result =
          await startSimulatorApi(
            backendConfig
          );

        console.log(
          'Simulator session started:',
          result
        );

        setSimulatorSessionId(
          result.session_id
        );

        // --------------------------------------------------------
        // CUSTOMER OPENING MESSAGE
        // --------------------------------------------------------

        const openingMsg: ChatMessage = {
          id: `msg-${Date.now()}-cust-0`,

          sender: 'customer',

          text:
            result.customer_message,

          timestamp:
            new Date().toLocaleTimeString(
              [],
              {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }
            ),

          /*
           * IMPORTANT:
           * Task 4 analysis comes directly from backend.
           */
          analysis:
            normalizeSimulatorAnalysis(
              result.analysis,
              (result as { escalation?: unknown })
                .escalation ??
                (result.analysis as unknown as { escalation?: unknown })
                  .escalation
            ),

          customerState: {
            frustration:
              Number(
                result.state.frustration
              ),

            trust:
              Number(
                result.state.trust
              ),

            patience:
              Number(
                result.state.patience
              ),

            satisfaction:
              Number(
                result.state.satisfaction
              ),

            escalationIntent:
              Number(
                result.state
                  .escalation_intent
              ),
          },
        };

        setMessages([
          openingMsg,
        ]);

        setInputText('');

        setSessionStartTime(
          Date.now()
        );

        setHasActiveSession(true);

        // --------------------------------------------------------
        // MATCH FRONTEND SCENARIO IF AVAILABLE
        // --------------------------------------------------------

        const matchedScenario =
          scenarios.find(
            (item) =>
              item.id
                .toLowerCase()
                .includes(
                  config.scenario
                    .toLowerCase()
                ) ||
              item.title
                .toLowerCase()
                .includes(
                  config.scenario
                    .toLowerCase()
                )
          );

        if (matchedScenario) {
          setActiveScenario(
            matchedScenario
          );
        }

        /*
         * ========================================================
         * TASK 4 ANALYSIS
         * ========================================================
         *
         * DO NOT build analysis from simulator state.
         *
         * The backend already calculates:
         *
         * - intent
         * - emotion
         * - sentiment
         * - frustration_level
         * - satisfaction_trend
         * - escalation_risk
         * - confidence
         *
         * Therefore the backend response is the
         * single source of truth.
         */

        setCurrentAnalysis(
          normalizeSimulatorAnalysis(
            result.analysis,
            (result as { escalation?: unknown })
              .escalation
          )
        );

        setCurrentMode(
          'simulator'
        );

        setActiveTab(
          'live_console'
        );
      } catch (error) {
        console.error(
          'Failed to start simulator session:',
          error
        );

        const message =
          error instanceof Error
            ? error.message
            : 'Failed to start simulator session.';

        window.alert(message);

        setSimulatorSessionId(null);

        setHasActiveSession(false);

        setMessages([]);

        setCurrentAnalysis(
          undefined
        );
      } finally {
        setIsSimulatingCustomer(
          false
        );

        setIsAnalyzing(false);
      }
    };

  // ============================================================
  // LIVE CONVERSATION
  // ============================================================

  const handleSendMessage = async (
    text: string
  ) => {
    if (
      !text.trim() ||
      isSimulatingCustomer
    ) {
      return;
    }

    if (!simulatorSessionId) {
      console.error(
        'Cannot send simulator response: no active backend simulator session.'
      );

      window.alert(
        'The simulator session is not active. Please start a new simulation.'
      );

      return;
    }

    const trimmedText =
      text.trim();

    // ----------------------------------------------------------
    // AGENT MESSAGE
    // ----------------------------------------------------------

    const agentMsg: ChatMessage = {
      id: `msg-${Date.now()}-agent`,

      sender: 'agent',

      text:
        trimmedText,

      timestamp:
        new Date().toLocaleTimeString(
          [],
          {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }
        ),
    };

    const updatedHistory = [
      ...messages,
      agentMsg,
    ];

    setMessages(
      updatedHistory
    );

    setInputText('');

    setIsSimulatingCustomer(true);

    try {
      /*
       * REAL BACKEND
       *
       * POST /simulator/message
       *
       * The backend:
       *
       * 1. receives agent response
       * 2. generates next customer message
       * 3. analyzes customer message using Task 4
       * 4. returns analysis
       */

      const simResult =
        await simulateCustomerTurnApi({
          sessionId:
            simulatorSessionId,

          agentResponse:
            trimmedText,
        });

      // ----------------------------------------------------------
      // NEXT CUSTOMER MESSAGE
      // ----------------------------------------------------------

      const nextCustMsg: ChatMessage = {
        id: `msg-${Date.now()}-cust`,

        sender: 'customer',

        text:
          simResult.customer_message,

        timestamp:
          new Date().toLocaleTimeString(
            [],
            {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }
          ),

        /*
         * Backend Task 4 analysis is attached
         * directly to this customer message.
         */
        analysis:
          normalizeSimulatorAnalysis(
            simResult.analysis,
            (simResult as { escalation?: unknown })
              .escalation
          ),

        customerState: {
          frustration:
            Number(
              simResult.state.frustration
            ),

          trust:
            Number(
              simResult.state.trust
            ),

          patience:
            Number(
              simResult.state.patience
            ),

          satisfaction:
            Number(
              simResult.state.satisfaction
            ),

          escalationIntent:
            Number(
              simResult.state
                .escalation_intent
            ),
        },
      };

      const fullHistory = [
        ...updatedHistory,
        nextCustMsg,
      ];

      setMessages(
        fullHistory
      );

      /*
       * ========================================================
       * TASK 4 ANALYSIS
       * ========================================================
       *
       * IMPORTANT:
       *
       * Do NOT call buildSimulatorAnalysis().
       *
       * Do NOT derive intent from scenario category.
       *
       * Do NOT convert simulator frustration into
       * percentages.
       *
       * Do NOT derive escalation risk from
       * escalation_intent percentage.
       *
       * The backend has already performed Task 4 analysis.
       */

      setCurrentAnalysis(
        normalizeSimulatorAnalysis(
          simResult.analysis,
          (simResult as { escalation?: unknown })
            .escalation ??
            (simResult.analysis as unknown as { escalation?: unknown })
              .escalation
        )
      );

      // ----------------------------------------------------------
      // BACKEND SESSION STATUS
      // ----------------------------------------------------------

      if (
        simResult.is_resolved ||
        simResult.is_escalated
      ) {
        console.log(
          'Simulator session state:',
          {
            resolved:
              simResult.is_resolved,

            escalated:
              simResult.is_escalated,

            turn:
              simResult.turn,
          }
        );
      }
    } catch (error) {
      console.error(
        'Error during customer simulation turn:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Failed to generate the next customer response.';

      window.alert(message);
    } finally {
      setIsSimulatingCustomer(
        false
      );

      setIsAnalyzing(false);
    }
  };

  // ============================================================
  // AI RESPONSE IMPROVEMENT
  // ============================================================

  const handleTriggerAiImprove =
    async () => {
      if (!inputText.trim()) {
        return;
      }

      setIsImprovingInput(true);

      try {
        /*
         * Task 4 analysis does not contain
         * suggestedResponses.
         *
         * Therefore we do not read:
         *
         * currentAnalysis.suggestedResponses
         *
         * Instead, provide a simple response
         * improvement based on the actual Task 4
         * analysis fields.
         */

        if (
          currentAnalysis?.escalation_risk ===
          'High'
        ) {
          setInputText(
            'I understand this is frustrating. I will take care of this and clearly explain the next steps for you.'
          );
        } else if (
          currentAnalysis?.emotion ===
          'confused'
        ) {
          setInputText(
            'I understand. Let me explain the next steps clearly and help you through the process.'
          );
        } else if (
          currentAnalysis?.sentiment ===
          'Negative'
        ) {
          setInputText(
            'I understand your concern, and I apologize for the inconvenience. Let me check the details and help resolve this for you.'
          );
        } else {
          setInputText(
            'I understand your concern. Let me check the details and help you with the next steps.'
          );
        }
      } finally {
        setIsImprovingInput(false);
      }
    };

  // ============================================================
  // FINISH SESSION - TASK 8
  // ============================================================

  const handleFinishSession = async () => {
    if (isGeneratingReport) {
      return;
    }

    const completedMessages = [...messages];
    const durationSeconds = Math.max(
      0,
      Math.round((Date.now() - sessionStartTime) / 1000)
    );

    if (completedMessages.length === 0) {
      setHasActiveSession(false);
      setSimulatorSessionId(null);
      setSimulatorConfig(null);
      setCurrentAnalysis(undefined);
      setInputText('');
      setReportError('There are no conversation messages to generate a report.');
      setActiveTab('dashboard');
      return;
    }

    setIsGeneratingReport(true);
    setReportError(null);

    try {
      const reportMessages = completedMessages.map((message) => ({
        id: message.id,
        sender_type: message.sender === 'customer' ? 'customer' : message.sender === 'agent' ? 'agent' : 'system',
        message_text: message.text,
        timestamp: message.timestamp,
        message_type: 'Text',
      }));

      const report = await generateReportApi({
        scenario: activeScenario,
        messages: reportMessages as unknown as ChatMessage[],
        durationSeconds,
        coachingLevel,
      });

      setPostInteractionReport(report);
      setHasActiveSession(false);
      setSimulatorSessionId(null);
      setSimulatorConfig(null);
      setMessages(completedMessages);
      setCurrentAnalysis(undefined);
      setInputText('');
      setActiveTab('reports');
    } catch (error) {
      console.error('Failed to generate Task 8 report:', error);
      setReportError('Unable to generate the post-interaction report. Please try finishing the session again.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // ============================================================
  // AI SCENARIO GENERATION
  // ============================================================

  const handleGenerateAiScenario =
    async (
      prompt: string,
      category: string,
      difficulty: DifficultyLevel
    ): Promise<Scenario | null> => {
      return await generateScenarioApi({
        prompt,
        category,
        difficulty,
      });
    };

  // ============================================================
  // MANUAL MODE
  // ============================================================

  const handleAnalyzeManualMessage =
    async (
      msg: string
    ): Promise<MessageAnalysis | null> => {
      return await analyzeTurnApi({
        customerMessage:
          msg,

        conversationHistory:
          [],

        scenario:
          activeScenario,

        knowledgeDocs,
      });
    };

  // ============================================================
  // ROLE AUTHORIZATION
  // ============================================================

  const isTabAuthorized = (
    role: UserRole,
    tab: ActiveTab
  ): boolean => {
    const normalizedRole =
      String(role).toLowerCase();

    if (
      normalizedRole ===
      'admin'
    ) {
      return true;
    }

    if (
      normalizedRole ===
      'employee'
    ) {
      return [
        'dashboard',
        'simulator_setup',
        'live_console',
        'replay',
        'knowledge_base',
        'reports',
      ].includes(tab);
    }

    if (
      normalizedRole ===
      'user'
    ) {
      return [
        'dashboard',
        'simulator_setup',
        'live_console',
        'replay',
      ].includes(tab);
    }

    return false;
  };

  // ============================================================
  // MODE CARDS
  // ============================================================
    // ============================================================
  // MODE CARDS
  // ============================================================

  const renderModeCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

      {/* ======================================================
          SIMULATOR
          ====================================================== */}

      <button
        type="button"
        onClick={() => {
          setCurrentMode(
            'simulator'
          );

          setActiveTab(
            'simulator_setup'
          );

          setSimulatorConfig(
            null
          );

          setSimulatorSessionId(
            null
          );

          setCurrentAnalysis(
            undefined
          );

          setMessages([]);

          setHasActiveSession(
            false
          );
        }}
        className="text-left p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition"
      >
        <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-5">
          <Headphones className="w-5 h-5" />
        </div>

        <h2 className="text-lg font-bold text-white">
          Simulator
        </h2>

        <p className="text-sm text-slate-400 mt-2">
          Practice with an AI-generated customer
          conversation.
        </p>

        <span className="inline-block mt-5 text-xs font-semibold text-indigo-400">
          Start Simulator →
        </span>
      </button>

      {/* ======================================================
          MANUAL MODE
          ====================================================== */}

      <button
        type="button"
        onClick={() => {
          setCurrentMode(
            'manual'
          );

          setIsManualModalOpen(
            true
          );
        }}
        className="text-left p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition"
      >
        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5">
          <Sparkles className="w-5 h-5" />
        </div>

        <h2 className="text-lg font-bold text-white">
          Manual Mode
        </h2>

        <p className="text-sm text-slate-400 mt-2">
          Enter a customer message and receive
          AI guidance.
        </p>

        <span className="inline-block mt-5 text-xs font-semibold text-emerald-400">
          Open Manual Mode →
        </span>
      </button>

      {/* ======================================================
          REPLAY
          ====================================================== */}

      <button
        type="button"
        onClick={() => {
          setCurrentMode(
            'replay'
          );

          setActiveTab(
            'replay'
          );
        }}
        className="text-left p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition"
      >
        <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-5">
          <BarChart3 className="w-5 h-5" />
        </div>

        <h2 className="text-lg font-bold text-white">
          Replay
        </h2>

        <p className="text-sm text-slate-400 mt-2">
          Review support conversations and coaching
          results.
        </p>

        <span className="inline-block mt-5 text-xs font-semibold text-amber-400">
          Open Replay →
        </span>
      </button>

      {/* ======================================================
          POST-INTERACTION ANALYSIS
          ====================================================== */}

      <button
        type="button"
        onClick={() => {
          setCurrentMode(
            'replay'
          );

          setActiveTab(
            'reports'
          );
        }}
        className="text-left p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 transition"
      >
        <div className="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-5">
          <BarChart3 className="w-5 h-5" />
        </div>

        <h2 className="text-lg font-bold text-white">
          Post-Interaction Analysis
        </h2>

        <p className="text-sm text-slate-400 mt-2">
          Analyze completed conversations, review
          performance, and track conversation history.
        </p>

        <span className="inline-block mt-5 text-xs font-semibold text-cyan-400">
          View Analysis →
        </span>
      </button>

    </div>
  );
  
          
  // ============================================================
  // LOADING
  // ============================================================

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 animate-pulse mx-auto flex items-center justify-center font-bold text-lg">
            CSA
          </div>

          <p className="text-xs text-slate-400">
            Loading system session...
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // LOGIN
  // ============================================================

  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={
          handleLoginSuccess
        }
      />
    );
  }

  const currentRole =
    String(
      currentUser.role
    ).toLowerCase();

  // ============================================================
  // MAIN APPLICATION
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      <Navbar
        currentMode={
          currentMode
        }

        onSelectMode={
          setCurrentMode
        }

        userRole={
          currentUser.role
        }

        onChangeRole={
          setUserRole
        }

        coachingLevel={
          coachingLevel
        }

        onChangeCoachingLevel={
          setCoachingLevel
        }

        userProfile={
          userProfile
        }

        piiMaskingEnabled={
          piiMaskingEnabled
        }

        onTogglePiiMasking={() =>
          setPiiMaskingEnabled(
            (previous) =>
              !previous
          )
        }

        activeLanguage={
          activeLanguage
        }

        onChangeLanguage={
          setActiveLanguage
        }

        onOpenQuickManual={() =>
          setIsManualModalOpen(
            true
          )
        }

        isMobileMenuOpen={
          isMobileMenuOpen
        }

        onToggleMobileMenu={() =>
          setIsMobileMenuOpen(
            (previous) =>
              !previous
          )
        }

        currentUser={
          currentUser
        }

        onLogout={
          handleLogout
        }
      />

      <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto px-0 sm:px-4 lg:px-8 py-0 sm:py-4 gap-4">
        {currentRole !== 'user' && (
          <Sidebar
            activeTab={
              activeTab
            }

            onSelectTab={(tab) => {
              if (
                tab ===
                'manual_mode'
              ) {
                setCurrentMode(
                  'manual'
                );

                setIsManualModalOpen(
                  true
                );
              } else {
                setActiveTab(
                  tab
                );

                if (
                  tab ===
                  'simulator_setup'
                ) {
                  setCurrentMode(
                    'simulator'
                  );
                }

                if (
                  tab ===
                  'replay'
                ) {
                  setCurrentMode(
                    'replay'
                  );
                }
              }

              setIsMobileMenuOpen(
                false
              );
            }}

            userRole={
              currentUser.role
            }

            activeScenarioTitle={
              activeScenario?.title
            }

            hasActiveSession={
              hasActiveSession
            }

            isMobileOpen={
              isMobileMenuOpen
            }

            onCloseMobile={() =>
              setIsMobileMenuOpen(
                false
              )
            }
          />
        )}

        <main className="flex-1 overflow-y-auto bg-slate-950/90 rounded-2xl">
          {!isTabAuthorized(
            currentUser.role,
            activeTab
          ) ? (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl max-w-md mx-auto my-12 space-y-4 shadow-2xl">
              <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/20 font-bold text-xl">
                403
              </div>

              <h2 className="text-xl font-bold text-white">
                Access Forbidden
              </h2>

              <p className="text-xs text-slate-400">
                Your account does not have
                permission to view this section.
              </p>

              <button
                type="button"
                onClick={() =>
                  setActiveTab(
                    'dashboard'
                  )
                }
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-500 transition"
              >
                Return to Dashboard
              </button>
            </div>
          ) : (
            <>
              {/* ==================================================
                  DASHBOARD
                  ================================================== */}

              {activeTab ===
                'dashboard' && (
                <div className="p-6 sm:p-8 space-y-8">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-indigo-400 font-semibold">
                      Customer Support Assistant
                    </p>

                    <h1 className="text-3xl font-bold text-white mt-2">
                      Welcome,{' '}
                      {currentUser.name ||
                        currentUser.email}
                    </h1>

                    <p className="text-sm text-slate-400 mt-2">
                      Choose a support mode to
                      continue.
                    </p>
                  </div>

                  {renderModeCards()}

                  {currentRole ===
                    'employee' && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
                          <BookOpen className="w-5 h-5" />
                        </div>

                        <div>
                          <h3 className="font-semibold text-white">
                            Knowledge Base
                            Access
                          </h3>

                          <p className="text-sm text-slate-400 mt-1">
                            You can read support
                            knowledge and policies.
                            Document management is
                            restricted to administrators.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentRole ===
                    'admin' && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                          <BookOpen className="w-5 h-5" />
                        </div>

                        <div>
                          <h3 className="font-semibold text-white">
                            Knowledge Base
                            Management
                          </h3>

                          <p className="text-sm text-slate-400 mt-1">
                            You have full access to
                            knowledge documents,
                            uploads, management and
                            document history.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ==================================================
                  SIMULATOR SETUP
                  ================================================== */}

              {activeTab ===
                'simulator_setup' && (
                <SimulatorSetupView
                  onBack={() =>
                    setActiveTab(
                      'dashboard'
                    )
                  }

                  onStartSimulation={
                    handleStartConfiguredSimulation
                  }
                />
              )}

              {/* ==================================================
                  LIVE CONSOLE
                  ================================================== */}

              {activeTab ===
                'live_console' && (
                <LiveConsoleView
                  scenario={
                    activeScenario
                  }

                  messages={
                    messages
                  }

                  onSendMessage={
                    handleSendMessage
                  }

                  isSimulatingCustomer={
                    isSimulatingCustomer
                  }

                  analysis={
                    currentAnalysis
                  }

                  isAnalyzing={
                    isAnalyzing
                  }

                  coachingLevel={
                    coachingLevel
                  }

                  onFinishSession={
                    handleFinishSession
                  }

                  onRestartSession={() =>
                    handleStartScenario(
                      activeScenario
                    )
                  }

                  onSelectAnotherScenario={() => {
                    setSimulatorSessionId(
                      null
                    );

                    setHasActiveSession(
                      false
                    );

                    setMessages([]);

                    setCurrentAnalysis(
                      undefined
                    );

                    setActiveTab(
                      'simulator_setup'
                    );
                  }}

                  piiMaskingEnabled={
                    piiMaskingEnabled
                  }

                  onTriggerAiImprove={
                    handleTriggerAiImprove
                  }

                  isImprovingInput={
                    isImprovingInput
                  }

                  inputText={
                    inputText
                  }

                  setInputText={
                    setInputText
                  }

                  onOpenFullKb={() =>
                    setActiveTab(
                      'knowledge_base'
                    )
                  }

                  knowledgeDocs={
                    knowledgeDocs
                  }
                />
              )}

              {/* ==================================================
                  SCENARIOS
                  ================================================== */}

              {activeTab ===
                'scenarios' && (
                <ScenariosView
                  scenarios={
                    scenarios
                  }

                  onStartScenario={
                    handleStartScenario
                  }

                  onAddNewScenario={(
                    newScenario
                  ) => {
                    setScenarios(
                      (previous) => [
                        newScenario,
                        ...previous,
                      ]
                    );

                    handleStartScenario(
                      newScenario
                    );
                  }}

                  userRole={
                    currentUser.role
                  }

                  onGenerateAiScenario={
                    handleGenerateAiScenario
                  }
                />
              )}

              {/* ==================================================
                  KNOWLEDGE BASE
                  ================================================== */}

              {activeTab ===
                'knowledge_base' &&
                currentRole ===
                  'admin' && (
                  <PolicyManagementView />
                )}

              {activeTab ===
                'knowledge_base' &&
                currentRole ===
                  'employee' && (
                  <KnowledgeBaseView
                    documents={
                      knowledgeDocs
                    }
                  />
                )}

              {/* ==================================================
                  TASK 8 - POST-INTERACTION REPORT
                  ================================================== */}

              {activeTab === 'reports' && (
                <div className="p-6 sm:p-8 space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-indigo-400 font-semibold">
                        Task 8
                      </p>
                      <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2">
                        Post-Interaction Summary
                      </h1>
                      <p className="text-sm text-slate-400 mt-2">
                        Review the completed conversation, performance, sentiment journey, strengths, weaknesses, and coaching recommendations.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('dashboard')}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-200 text-xs font-semibold hover:bg-slate-800"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Dashboard
                    </button>
                  </div>

                  {isGeneratingReport && (
                    <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-5 text-sm text-indigo-200">
                      Generating your post-interaction report...
                    </div>
                  )}

                  {reportError && (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200">
                      {reportError}
                    </div>
                  )}

                  {!postInteractionReport && !isGeneratingReport && !reportError && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
                      <FileText className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                      <h2 className="text-lg font-semibold text-white">No completed interaction report yet</h2>
                      <p className="text-sm text-slate-400 mt-2">Finish a simulator conversation to generate the Task 8 report.</p>
                    </div>
                  )}

                  {postInteractionReport && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                          <p className="text-xs text-slate-400">Overall Score</p>
                          <p className="text-3xl font-bold text-white mt-2">{postInteractionReport.score?.overall ?? postInteractionReport.score?.overallScore ?? postInteractionReport.score?.score ?? 0}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                          <p className="text-xs text-slate-400">Outcome</p>
                          <p className="text-lg font-bold text-white mt-2 flex items-center gap-2">
                            {postInteractionReport.resolved ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : postInteractionReport.escalated ? <AlertTriangle className="w-5 h-5 text-amber-400" /> : <Clock3 className="w-5 h-5 text-slate-400" />}
                            {postInteractionReport.outcome || (postInteractionReport.resolved ? 'Resolved' : postInteractionReport.escalated ? 'Escalated' : 'Unresolved')}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                          <p className="text-xs text-slate-400">Sentiment Improvement</p>
                          <p className="text-3xl font-bold text-white mt-2 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-emerald-400" />
                            {postInteractionReport.sentimentImprovement ?? 0}%
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                          <p className="text-xs text-slate-400">XP Earned</p>
                          <p className="text-3xl font-bold text-white mt-2">+{postInteractionReport.xpEarned ?? 0}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                          <h2 className="text-lg font-semibold text-white">Interaction Summary</h2>
                          <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                            <div><p className="text-slate-500">Intent</p><p className="text-slate-200 mt-1">{postInteractionReport.interactionSummary?.intent || 'General inquiry'}</p></div>
                            <div><p className="text-slate-500">Emotion</p><p className="text-slate-200 mt-1">{postInteractionReport.interactionSummary?.emotion || 'Unknown'}</p></div>
                            <div><p className="text-slate-500">Sentiment</p><p className="text-slate-200 mt-1">{postInteractionReport.interactionSummary?.sentiment || 'Neutral'}</p></div>
                            <div><p className="text-slate-500">Frustration</p><p className="text-slate-200 mt-1">{postInteractionReport.interactionSummary?.frustration_level ?? 0}/10</p></div>
                            <div><p className="text-slate-500">Satisfaction Trend</p><p className="text-slate-200 mt-1">{postInteractionReport.interactionSummary?.satisfaction_trend || 'Stable'}</p></div>
                            <div><p className="text-slate-500">Escalation Risk</p><p className="text-slate-200 mt-1">{postInteractionReport.interactionSummary?.escalation_risk || 'Low'}</p></div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                          <h2 className="text-lg font-semibold text-white">Performance Breakdown</h2>
                          <div className="mt-5 space-y-4">
                            {[
                              ['Communication', postInteractionReport.score?.communication],
                              ['Resolution', postInteractionReport.score?.resolution],
                              ['Empathy', postInteractionReport.score?.empathy],
                              ['Knowledge Usage', postInteractionReport.score?.knowledgeUsage],
                              ['Tone', postInteractionReport.score?.tone],
                              ['Clarity', postInteractionReport.score?.clarity],
                            ].map(([label, value]) => (
                              <div key={String(label)}>
                                <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">{label}</span><span className="text-white font-semibold">{Number(value ?? 0)}</span></div>
                                <div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.max(0, Math.min(100, Number(value ?? 0)))}%` }} /></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                          <h2 className="text-lg font-semibold text-white">Strengths</h2>
                          <ul className="mt-4 space-y-3">
                            {(postInteractionReport.topStrengths || []).map((item) => <li key={item} className="text-sm text-slate-300 flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />{item}</li>)}
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                          <h2 className="text-lg font-semibold text-white">Areas to Improve</h2>
                          <ul className="mt-4 space-y-3">
                            {(postInteractionReport.topWeaknesses || []).map((item) => <li key={item} className="text-sm text-slate-300 flex gap-2"><AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />{item}</li>)}
                          </ul>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                        <h2 className="text-lg font-semibold text-white">Personalized Coaching Recommendations</h2>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {(postInteractionReport.recommendedTrainings || []).map((item) => <div key={item} className="rounded-xl bg-slate-800/70 border border-slate-700 px-4 py-3 text-sm text-slate-200">{item}</div>)}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                        <h2 className="text-lg font-semibold text-white">Sentiment Journey</h2>
                        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="rounded-xl bg-slate-800/60 p-4"><p className="text-xs text-slate-500">Starting</p><p className="text-sm text-white mt-1">{postInteractionReport.startingSentiment?.sentiment || String(postInteractionReport.startingSentiment || 'Neutral')} · {postInteractionReport.startingSentiment?.emotion || ''}</p></div>
                          <div className="rounded-xl bg-slate-800/60 p-4"><p className="text-xs text-slate-500">Ending</p><p className="text-sm text-white mt-1">{postInteractionReport.endingSentiment?.sentiment || String(postInteractionReport.endingSentiment || 'Neutral')} · {postInteractionReport.endingSentiment?.emotion || ''}</p></div>
                        </div>
                        <div className="mt-5 space-y-3">
                          {(postInteractionReport.timelineEvents || []).map((event) => <div key={event.id ?? `${event.timestamp}-${event.title}`} className="flex gap-3 border-l border-slate-700 pl-4"><div><p className="text-xs text-indigo-400">{event.title || 'Conversation Event'}</p><p className="text-sm text-slate-300 mt-1">{event.description || ''}</p></div></div>)}
                        </div>
                      </div>

                      {(postInteractionReport.responseComparisons || []).length > 0 && (
                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                          <h2 className="text-lg font-semibold text-white">Response Review</h2>
                          <div className="mt-5 space-y-4">
                            {postInteractionReport.responseComparisons.map((comparison) => (
                              <div key={comparison.turnNumber} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                                <p className="text-xs font-semibold text-indigo-400">Agent Response {comparison.turnNumber}</p>
                                <p className="text-xs text-slate-500 mt-3">Original</p>
                                <p className="text-sm text-slate-300 mt-1">{comparison.originalAgentText}</p>
                                <p className="text-xs text-slate-500 mt-3">Review</p>
                                <p className="text-sm text-slate-300 mt-1">{comparison.improvementExplanation}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ==================================================
                  REPLAY
                  ================================================== */}

              {activeTab ===
                'replay' && (
                <ReplayModeView />
              )}
            </>
          )}
        </main>
      </div>

      {/* ==========================================================
          MANUAL MODE
          ========================================================== */}

      <ManualModeModal
        isOpen={
          isManualModalOpen
        }

        onClose={() =>
          setIsManualModalOpen(
            false
          )
        }

        onAnalyzeMessage={
          handleAnalyzeManualMessage
        }
      />

      {/* ==========================================================
          MOBILE NAVIGATION
          ========================================================== */}

      {currentRole !==
        'user' && (
        <nav
          aria-label="Mobile Navigation"
          className="sm:hidden bg-slate-900 border-t border-slate-800 px-2 py-1.5 flex items-center justify-around z-30 shrink-0 shadow-xl"
        >
          <button
            type="button"
            id="mob-nav-dashboard"
            onClick={() => {
              setActiveTab(
                'dashboard'
              );

              setIsMobileMenuOpen(
                false
              );
            }}
            className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] ${
              activeTab ===
              'dashboard'
                ? 'text-indigo-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 mb-0.5" />

            <span>
              Home
            </span>
          </button>

          <button
            type="button"
            id="mob-nav-simulator"
            onClick={() => {
              setActiveTab(
                'simulator_setup'
              );

              setCurrentMode(
                'simulator'
              );

              setIsMobileMenuOpen(
                false
              );
            }}
            className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] ${
              activeTab ===
              'simulator_setup'
                ? 'text-indigo-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Headphones className="w-4 h-4 mb-0.5" />

            <span>
              Simulator
            </span>
          </button>

          <button
            type="button"
            id="mob-nav-live-console"
            onClick={() => {
              setActiveTab(
                'live_console'
              );

              setIsMobileMenuOpen(
                false
              );
            }}
            className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] relative ${
              activeTab ===
              'live_console'
                ? 'text-indigo-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {hasActiveSession && (
              <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}

            <Headphones className="w-4 h-4 mb-0.5" />

            <span>
              Practice
            </span>
          </button>

          <button
            type="button"
            id="mob-nav-kb"
            onClick={() => {
              setActiveTab(
                'knowledge_base'
              );

              setIsMobileMenuOpen(
                false
              );
            }}
            className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] ${
              activeTab ===
              'knowledge_base'
                ? 'text-indigo-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4 mb-0.5" />

            <span>
              RAG KB
            </span>
          </button>
        </nav>
      )}
    </div>
  );
}