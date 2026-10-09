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
  RefreshCw,
  X,
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
import { UserManagementView } from './components/UserManagementView';
import { AdminAuditView } from './components/AdminAuditView';

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
  fetchManualHistoryApi,
  fetchManualInteractionApi,
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

  timelineEvents?: Array<{
    type?: string;
    frustrationLevel?: number;
    sentiment?: string;
    emotion?: string;
  }>;

  startingSentiment?: {
    sentiment?: string;
    emotion?: string;
    frustrationLevel?: number;
  };

  endingSentiment?: {
    sentiment?: string;
    emotion?: string;
    frustrationLevel?: number;
  };

  escalationRisk?: string;

  generatedAt?: string;
};

type SavedManualInteraction = {
  session_id: number;
  conversation_id: number;
  status?: string;
  start_time?: string | null;
  end_time?: string | null;
  intent?: string | null;
  sentiment?: string | null;
  resolution_status?: string | null;
  escalation_risk?: string | null;
  customer_message_count?: number;
  agent_message_count?: number;
  analysis?: Record<string, unknown> | null;
  mode?: 'manual' | 'simulator';
  scenario_title?: string | null;
  scenario_category?: string | null;
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

    setSavedManualInteractions([]);

    setReportError(null);

    setSavedReportsError(null);
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

  // ============================================================
  // TASK 8 - CURRENT REPORT
  // ============================================================

  const [postInteractionReport, setPostInteractionReport] =
    useState<PostInteractionReport | null>(null);

  const [isGeneratingReport, setIsGeneratingReport] =
    useState(false);

  const [openingReportSessionId, setOpeningReportSessionId] =
    useState<number | null>(null);

  const [reportError, setReportError] =
    useState<string | null>(null);

  const [showReportAnalytics, setShowReportAnalytics] =
    useState(false);

  // ============================================================
  // TASK 8 - SAVED MANUAL INTERACTIONS
  // ============================================================

  const [savedManualInteractions, setSavedManualInteractions] =
    useState<SavedManualInteraction[]>([]);

  const [isLoadingSavedReports, setIsLoadingSavedReports] =
    useState(false);

  const [savedReportsError, setSavedReportsError] =
    useState<string | null>(null);

  // ============================================================
  // LOAD SAVED MANUAL INTERACTIONS
  // ============================================================

  const loadSavedManualInteractions =
    useCallback(async () => {
      if (!currentUser) {
        return;
      }

      setIsLoadingSavedReports(true);
      setSavedReportsError(null);

      try {
        const interactions =
          await fetchManualHistoryApi();

        setSavedManualInteractions(
          interactions as SavedManualInteraction[]
        );
      } catch (error) {
        console.error(
          'Failed to load saved manual interactions:',
          error
        );

        setSavedReportsError(
          error instanceof Error
            ? error.message
            : 'Unable to load saved interactions.'
        );
      } finally {
        setIsLoadingSavedReports(false);
      }
    }, [currentUser]);

  const handleViewSavedReport = useCallback(
    async (sessionId: number) => {
      setOpeningReportSessionId(sessionId);
      setIsGeneratingReport(true);
      setReportError(null);
      try {
        const saved = await fetchManualInteractionApi(sessionId);
        const reportMessages = saved.conversation.map((message) => ({
          id: message.id,
          sender: message.sender,
          text: message.text,
          sender_type: message.sender === 'customer' ? 'Customer' : 'Support Agent',
          message_text: message.text,
          timestamp: message.timestamp || undefined,
          message_type: 'Text',
        }));
        if (!reportMessages.length) {
          throw new Error('This saved interaction has no conversation messages.');
        }
        const startTime = saved.conversation[0]?.timestamp
          ? new Date(saved.conversation[0].timestamp).getTime()
          : 0;
        const endTime = saved.conversation[saved.conversation.length - 1]?.timestamp
          ? new Date(saved.conversation[saved.conversation.length - 1].timestamp as string).getTime()
          : startTime;

        const savedScenario: Scenario = {
          ...activeScenario,
          title: saved.scenario_title || activeScenario.title,
          category: saved.scenario_category || activeScenario.category,
          initialProblem: saved.scenario_description || activeScenario.initialProblem,
        };

        const report = await generateReportApi({
          scenario: savedScenario,
          messages: reportMessages,
          durationSeconds: Math.max(0, Math.round((endTime - startTime) / 1000)),
          coachingLevel,
        });
        setPostInteractionReport(report);
        setMessages(reportMessages);
        setActiveTab('reports');
      } catch (error) {
        setReportError(error instanceof Error ? error.message : 'Unable to open the saved report.');
      } finally {
        setIsGeneratingReport(false);
        setOpeningReportSessionId(null);
      }
    },
    [activeScenario, coachingLevel]
  );

  // ============================================================
  // LOAD SAVED REPORTS WHEN REPORT PAGE OPENS
  // ============================================================

  useEffect(() => {
    if (
      activeTab !== 'reports' ||
      !currentUser
    ) {
      return;
    }

    loadSavedManualInteractions();
  }, [
    activeTab,
    currentUser,
    loadSavedManualInteractions,
  ]);

  // ============================================================
  // TYPE NORMALIZATION
  // ============================================================

  const normalizeSimulatorAnalysis = (
    analysis: SimulatorAnalysis,
    escalation?: unknown
  ): MessageAnalysis => {
    const backendAnalysis =
      analysis as MessageAnalysis;

    const analysisRecord =
      analysis &&
      typeof analysis === 'object'
        ? (analysis as Record<string, unknown>)
        : {};

    const backendEscalationSource =
      escalation &&
      typeof escalation === 'object'
        ? escalation
        : analysisRecord.escalation;

    const backendEscalation =
      backendEscalationSource &&
      typeof backendEscalationSource === 'object'
        ? (backendEscalationSource as Record<string, unknown>)
        : null;

    return {
      ...backendAnalysis,

      escalation_risk_score:
        backendEscalation &&
        backendEscalation.risk_score !== undefined &&
        backendEscalation.risk_score !== null
          ? Number(
              backendEscalation.risk_score
            )
          : undefined,

      escalation_risk_threshold:
        backendEscalation &&
        backendEscalation.risk_threshold !== undefined &&
        backendEscalation.risk_threshold !== null
          ? Number(
              backendEscalation.risk_threshold
            )
          : 7,

      critical_threshold:
        backendEscalation &&
        backendEscalation.critical_threshold !== undefined &&
        backendEscalation.critical_threshold !== null
          ? Number(
              backendEscalation.critical_threshold
            )
          : 9,

      escalation_reasons:
        backendEscalation &&
        Array.isArray(
          backendEscalation.reasons
        )
          ? backendEscalation.reasons.filter(
              (
                reason
              ): reason is string =>
                typeof reason ===
                'string'
            )
          : [],

      escalation_recommended_action:
        String(
          backendEscalation?.recommended_action ??
            ''
        ),

      escalation_alert:
        Boolean(
          backendEscalation?.alert
        ),

      escalation_critical_alert:
        Boolean(
          backendEscalation?.critical_alert
        ),

      intent:
        backendAnalysis.intent ??
        'Unknown',

      emotion:
        backendAnalysis.emotion ??
        'Unknown',

      sentiment:
        backendAnalysis.sentiment ??
        'Neutral',

      frustration_level:
        Number(
          backendAnalysis.frustration_level ??
            backendAnalysis.frustrationLevel ??
            0
        ),

      satisfaction_trend:
        backendAnalysis.satisfaction_trend ??
        'Stable',

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

  void simulatorConfig;

  // ============================================================
  // START EXISTING LOCAL SCENARIO SESSION
  // ============================================================

  const handleStartScenario = useCallback(
    (scenario: Scenario) => {
      setActiveScenario(
        scenario
      );

      const openingMsg: ChatMessage = {
        id: `msg-${Date.now()}-cust-0`,

        sender: 'customer',

        text:
          scenario.customerOpeningMessage,

        timestamp:
          new Date().toLocaleTimeString(
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

      setHasActiveSession(
        true
      );

      setSimulatorSessionId(
        null
      );

      setActiveTab(
        'live_console'
      );

      setCurrentMode(
        'simulator'
      );

      setIsAnalyzing(
        true
      );

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
          setIsAnalyzing(
            false
          );
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

      setSimulatorSessionId(
        null
      );

      setMessages([]);

      setCurrentAnalysis(
        undefined
      );

      setIsSimulatingCustomer(
        true
      );

      setIsAnalyzing(
        false
      );

      try {
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

          analysis:
            normalizeSimulatorAnalysis(
              result.analysis,
              (result as {
                escalation?: unknown;
              }).escalation ??
                (
                  result.analysis as unknown as {
                    escalation?: unknown;
                  }
                ).escalation
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

        setHasActiveSession(
          true
        );

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

        setCurrentAnalysis(
          normalizeSimulatorAnalysis(
            result.analysis,
            (result as {
              escalation?: unknown;
            }).escalation
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

        window.alert(
          message
        );

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
      } finally {
        setIsSimulatingCustomer(
          false
        );

        setIsAnalyzing(
          false
        );
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

    setIsSimulatingCustomer(
      true
    );

    try {
      const simResult =
        await simulateCustomerTurnApi({
          sessionId:
            simulatorSessionId,

          agentResponse:
            trimmedText,
        });

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

        analysis:
          normalizeSimulatorAnalysis(
            simResult.analysis,
            (simResult as {
              escalation?: unknown;
            }).escalation
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

      setCurrentAnalysis(
        normalizeSimulatorAnalysis(
          simResult.analysis,
          (simResult as {
            escalation?: unknown;
          }).escalation ??
            (
              simResult.analysis as unknown as {
                escalation?: unknown;
              }
            ).escalation
        )
      );

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

      window.alert(
        message
      );
    } finally {
      setIsSimulatingCustomer(
        false
      );

      setIsAnalyzing(
        false
      );
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

      setIsImprovingInput(
        true
      );

      try {
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
        setIsImprovingInput(
          false
        );
      }
    };

  // ============================================================
  // FINISH SESSION - TASK 8
  // ============================================================

  const handleFinishSession = async () => {
    if (
      isGeneratingReport
    ) {
      return;
    }

    const completedMessages =
      [...messages];

    const durationSeconds =
      Math.max(
        0,
        Math.round(
          (Date.now() -
            sessionStartTime) /
            1000
        )
      );

    if (
      completedMessages.length ===
      0
    ) {
      setHasActiveSession(
        false
      );

      setSimulatorSessionId(
        null
      );

      setSimulatorConfig(
        null
      );

      setCurrentAnalysis(
        undefined
      );

      setInputText('');

      setReportError(
        'There are no conversation messages to generate a report.'
      );

      setActiveTab(
        'dashboard'
      );

      return;
    }

    setIsGeneratingReport(
      true
    );

    setReportError(null);

    try {
      const reportMessages =
        completedMessages.map(
          (message) => ({
            id: message.id,

            sender_type:
              message.sender ===
              'customer'
                ? 'customer'
                : message.sender ===
                    'agent'
                  ? 'agent'
                  : 'system',

            message_text:
              message.text,

            timestamp:
              message.timestamp,

            message_type:
              'Text',
          })
        );

      const report =
        await generateReportApi({
          scenario:
            activeScenario,

          messages:
            reportMessages as unknown as ChatMessage[],

          durationSeconds,

          coachingLevel,
        });

      setPostInteractionReport(
        report
      );

      setHasActiveSession(
        false
      );

      setSimulatorSessionId(
        null
      );

      setSimulatorConfig(
        null
      );

      setMessages(
        completedMessages
      );

      setCurrentAnalysis(
        undefined
      );

      setInputText('');

      /*
       * Refresh saved Manual history too.
       *
       * This does not replace the Task 8 generated report.
       * It makes sure the Reports page always reflects the
       * database state after finishing an interaction.
       */
      await loadSavedManualInteractions();

      setActiveTab(
        'reports'
      );
    } catch (error) {
      console.error(
        'Failed to generate Task 8 report:',
        error
      );

      setReportError(
        'Unable to generate the post-interaction report. Please try finishing the session again.'
      );
    } finally {
      setIsGeneratingReport(
        false
      );
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
                  ADMIN USER MANAGEMENT
                  ================================================== */}

              {activeTab ===
                'user_management' &&
                currentRole ===
                  'admin' && (
                  <UserManagementView />
                )}

              {/* ==================================================
                  ADMIN AUDIT - DOCUMENT UPLOAD HISTORY
                  ================================================== */}

              {activeTab ===
                'admin_audit' &&
                currentRole ===
                  'admin' && (
                  <AdminAuditView />
                )}

              {/* ==================================================
                  KNOWLEDGE BASE
                  ================================================== */}

              {activeTab ===
                'knowledge_base' &&
                (currentRole === 'admin' || currentRole === 'employee') && (
                  <PolicyManagementView />
                )}

              {/* ==================================================
                  TASK 8 - POST-INTERACTION REPORT
                  ================================================== */}

              {activeTab ===
                'reports' && (
                <div className="p-6 sm:p-8 space-y-6">

                  {/* ==================================================
                      HEADER
                      ================================================== */}

                  <div className="flex items-start justify-between gap-4">

                    <div>

                      <p className="text-xs uppercase tracking-widest text-indigo-400 font-semibold">
                        Task 8
                      </p>

                      <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2">
                        Post-Interaction Analysis
                      </h1>

                      <p className="text-sm text-slate-400 mt-2">
                        Review completed interactions,
                        saved conversation history,
                        performance, sentiment journey,
                        strengths, weaknesses, and
                        coaching recommendations.
                      </p>

                    </div>

                    <div className="flex items-center gap-2 shrink-0">

                      <button
                        type="button"
                        onClick={
                          loadSavedManualInteractions
                        }
                        disabled={
                          isLoadingSavedReports
                        }
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-200 text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${
                            isLoadingSavedReports
                              ? 'animate-spin'
                              : ''
                          }`}
                        />

                        Refresh
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setActiveTab(
                            'dashboard'
                          )
                        }
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-200 text-xs font-semibold hover:bg-slate-800"
                      >
                        <ArrowLeft className="w-4 h-4" />

                        Dashboard
                      </button>

                    </div>

                  </div>

                  {/* ==================================================
                      CURRENT GENERATED REPORT
                      ================================================== */}

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

                  {!postInteractionReport &&
                    !isGeneratingReport &&
                    !reportError && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">

                        <FileText className="w-10 h-10 text-slate-500 mx-auto mb-3" />

                        <h2 className="text-lg font-semibold text-white">
                          No new report generated in this session
                        </h2>

                        <p className="text-sm text-slate-400 mt-2">
                          Your saved completed interactions
                          are shown below.
                        </p>

                      </div>
                    )}

                  {postInteractionReport && (
                    <div
                      className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-sm p-3 sm:p-6"
                      role="dialog"
                      aria-modal="true"
                      aria-label="Post-Interaction Report"
                    >
                      <div className="h-full w-full max-w-7xl mx-auto rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden flex flex-col">
                        <div className="shrink-0 flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800 bg-slate-900">
                          <div>
                            <p className="text-xs uppercase tracking-widest text-indigo-400 font-semibold">
                              Task 8
                            </p>
                            <h2 className="text-lg font-bold text-white mt-1">
                              Post-Interaction Report
                            </h2>
                            <p className="text-xs text-slate-400 mt-1">
                              Report for the selected saved interaction.
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setShowReportAnalytics(true)}
                              className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/20"
                            >
                              <BarChart3 className="w-4 h-4" />
                              View Analytics
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPostInteractionReport(null);
                                setMessages([]);
                                setReportError(null);
                                setShowReportAnalytics(false);
                              }}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                            aria-label="Close report"
                          >
                              <X className="w-4 h-4" />
                              Close Report
                            </button>
                          </div>
                        </div>

                        {showReportAnalytics && (
                          <div
                            className="absolute inset-0 z-[110] bg-slate-950/95 backdrop-blur-sm p-4 sm:p-8 overflow-y-auto"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Post-Interaction Analytics"
                          >
                            <div className="max-w-6xl mx-auto space-y-6">
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <p className="text-xs uppercase tracking-widest text-indigo-400 font-semibold">Task 8</p>
                                  <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">Post-Interaction Analytics</h2>
                                  <p className="text-sm text-slate-400 mt-1">Visual analysis for this selected interaction only.</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setShowReportAnalytics(false)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                                >
                                  <X className="w-4 h-4" />
                                  Back to Report
                                </button>
                              </div>

                              {(() => {
                                const timeline = Array.isArray(postInteractionReport.timelineEvents)
                                  ? postInteractionReport.timelineEvents.filter((event: any) => event?.type === 'customer_message')
                                  : [];
                                const points = timeline.length
                                  ? timeline.map((event: any, index: number) => ({
                                      label: `Turn ${index + 1}`,
                                      value: Math.max(0, Math.min(10, Number(event.frustrationLevel ?? 0))),
                                    }))
                                  : [
                                      { label: 'Start', value: Number(postInteractionReport.startingSentiment?.frustrationLevel ?? 0) },
                                      { label: 'End', value: Number(postInteractionReport.endingSentiment?.frustrationLevel ?? 0) },
                                    ];
                                const maxValue = 10;
                                const width = 720;
                                const height = 260;
                                const padding = 42;
                                const chartWidth = width - padding * 2;
                                const chartHeight = height - padding * 2;
                                const linePoints = points.map((point, index) => {
                                  const x = points.length === 1 ? width / 2 : padding + (index / (points.length - 1)) * chartWidth;
                                  const y = padding + chartHeight - (point.value / maxValue) * chartHeight;
                                  return `${x},${y}`;
                                }).join(' ');

                                const escalation = String(
                                  postInteractionReport.interactionSummary?.escalation_risk ??
                                  postInteractionReport.escalationRisk ??
                                  'Low'
                                ).toLowerCase();
                                const riskLabel = escalation === 'critical' ? 'Critical' : escalation === 'high' ? 'High' : escalation === 'medium' ? 'Medium' : 'Low';
                                const riskClass = riskLabel === 'Critical' ? 'text-violet-300' : riskLabel === 'High' ? 'text-red-300' : riskLabel === 'Medium' ? 'text-yellow-300' : 'text-emerald-300';
                                const riskDegrees = riskLabel === 'Critical' ? 360 : riskLabel === 'High' ? 270 : riskLabel === 'Medium' ? 180 : 90;
                                const riskColor = riskLabel === 'Critical' ? '#a855f7' : riskLabel === 'High' ? '#ef4444' : riskLabel === 'Medium' ? '#eab308' : '#22c55e';
                                const riskStyle = `conic-gradient(${riskColor} 0deg ${riskDegrees}deg, #334155 ${riskDegrees}deg 360deg)`;

                                const performance = [
                                  ['Communication', Number(postInteractionReport.score?.communication ?? 0)],
                                  ['Resolution', Number(postInteractionReport.score?.resolution ?? 0)],
                                  ['Empathy', Number(postInteractionReport.score?.empathy ?? 0)],
                                  ['Knowledge', Number(postInteractionReport.score?.knowledge ?? postInteractionReport.score?.knowledgeUsage ?? 0)],
                                  ['Tone', Number(postInteractionReport.score?.tone ?? 0)],
                                  ['Clarity', Number(postInteractionReport.score?.clarity ?? 0)],
                                ];

                                return (
                                  <>
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                      <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-5">
                                        <div className="flex items-center justify-between mb-4">
                                          <div>
                                            <h3 className="text-base font-semibold text-white">Frustration Journey</h3>
                                            <p className="text-xs text-slate-500 mt-1">Customer frustration across the interaction · 0–10</p>
                                          </div>
                                          <span className="text-sm font-semibold text-white">{points.at(-1)?.value ?? 0}/10</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                          <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[620px] h-64" role="img" aria-label="Frustration line graph">
                                            {[0, 2, 4, 6, 8, 10].map((value) => {
                                              const y = padding + chartHeight - (value / maxValue) * chartHeight;
                                              return <g key={value}><line x1={padding} x2={width - padding} y1={y} y2={y} stroke="currentColor" className="text-slate-800" /><text x={8} y={y + 4} className="fill-slate-500 text-[12px]">{value}</text></g>;
                                            })}
                                            <polyline fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400" points={linePoints} />
                                            {points.map((point, index) => {
                                              const x = points.length === 1 ? width / 2 : padding + (index / (points.length - 1)) * chartWidth;
                                              const y = padding + chartHeight - (point.value / maxValue) * chartHeight;
                                              return <g key={`${point.label}-${index}`}><circle cx={x} cy={y} r="6" fill="currentColor" className="text-indigo-300" /><text x={x} y={height - 10} textAnchor="middle" className="fill-slate-500 text-[11px]">{point.label}</text></g>;
                                            })}
                                          </svg>
                                        </div>
                                      </div>

                                      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                                        <h3 className="text-base font-semibold text-white">Escalation Risk</h3>
                                        <p className="text-xs text-slate-500 mt-1">Risk level for this interaction</p>
                                        <div className="flex justify-center py-6">
                                          <div className="relative w-36 h-36 rounded-full" style={{ background: riskStyle }}>
                                            <div className="absolute inset-5 rounded-full bg-slate-900 flex flex-col items-center justify-center">
                                              <span className={`text-lg font-bold ${riskClass}`}>{riskLabel}</span>
                                              <span className="text-[11px] text-slate-500">Risk</span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                          <span className="text-emerald-300">● Low</span>
                                          <span className="text-yellow-300">● Medium</span>
                                          <span className="text-red-300">● High</span>
                                          <span className="text-violet-300">● Critical</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                                        <h3 className="text-base font-semibold text-white">Sentiment</h3>
                                        <p className="text-xs text-slate-500 mt-1">Starting vs ending customer sentiment</p>
                                        <div className="flex items-center justify-center gap-10 py-7">
                                          {[
                                            ['Starting', postInteractionReport.startingSentiment?.sentiment ?? 'Neutral'],
                                            ['Ending', postInteractionReport.endingSentiment?.sentiment ?? 'Neutral'],
                                          ].map(([label, value]) => (
                                            <div key={label} className="text-center">
                                              <div className="w-28 h-28 rounded-full flex items-center justify-center" style={{ background: value.toLowerCase().includes('negative') ? 'conic-gradient(#ef4444 0deg 270deg, #334155 270deg 360deg)' : value.toLowerCase().includes('positive') ? 'conic-gradient(#22c55e 0deg 270deg, #334155 270deg 360deg)' : 'conic-gradient(#eab308 0deg 120deg, #334155 120deg 360deg)' }}>
                                                <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center text-xs font-semibold text-white">{value}</div>
                                              </div>
                                              <p className="text-xs text-slate-500 mt-3">{label}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                                        <h3 className="text-base font-semibold text-white">Performance Breakdown</h3>
                                        <p className="text-xs text-slate-500 mt-1">Scores calculated for the selected interaction</p>
                                        <div className="mt-5 space-y-3">
                                          {performance.map(([label, value]) => (
                                            <div key={label}>
                                              <div className="flex justify-between text-xs mb-1"><span className="text-slate-300">{label}</span><span className="text-white font-semibold">{value}</span></div>
                                              <div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full rounded-full bg-indigo-400" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                          <>

                      {/* ==================================================
                          CURRENT REPORT SUMMARY CARDS
                          ================================================== */}

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

                          <p className="text-xs text-slate-400">
                            Overall Score
                          </p>

                          <p className="text-3xl font-bold text-white mt-2">
                            {postInteractionReport.score?.overall ??
                              postInteractionReport.score?.overallScore ??
                              postInteractionReport.score?.score ??
                              0}
                          </p>

                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

                          <p className="text-xs text-slate-400">
                            Outcome
                          </p>

                          <p className="text-lg font-bold text-white mt-2 flex items-center gap-2">

                            {postInteractionReport.resolved ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : postInteractionReport.escalated ? (
                              <AlertTriangle className="w-5 h-5 text-amber-400" />
                            ) : (
                              <Clock3 className="w-5 h-5 text-slate-400" />
                            )}

                            {postInteractionReport.outcome ||
                              (postInteractionReport.resolved
                                ? 'Resolved'
                                : postInteractionReport.escalated
                                  ? 'Escalated'
                                  : 'Unresolved')}
                          </p>

                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

                          <p className="text-xs text-slate-400">
                            Sentiment Improvement
                          </p>

                          <p className="text-3xl font-bold text-white mt-2 flex items-center gap-2">

                            <TrendingUp className="w-5 h-5 text-emerald-400" />

                            {postInteractionReport.sentimentImprovement ??
                              0}
                            %

                          </p>

                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

                          <p className="text-xs text-slate-400">
                            XP Earned
                          </p>

                          <p className="text-3xl font-bold text-white mt-2">
                            +
                            {postInteractionReport.xpEarned ??
                              0}
                          </p>

                        </div>

                      </div>

                      {/* ==================================================
                          INTERACTION SUMMARY + PERFORMANCE
                          ================================================== */}

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

                          <h2 className="text-lg font-semibold text-white">
                            Interaction Summary
                          </h2>

                          <div className="mt-5 grid grid-cols-2 gap-4 text-sm">

                            <div>
                              <p className="text-slate-500">
                                Intent
                              </p>

                              <p className="text-slate-200 mt-1">
                                {postInteractionReport.interactionSummary?.intent ||
                                  'General inquiry'}
                              </p>
                            </div>

                            <div>
                              <p className="text-slate-500">
                                Emotion
                              </p>

                              <p className="text-slate-200 mt-1">
                                {postInteractionReport.interactionSummary?.emotion ||
                                  'Unknown'}
                              </p>
                            </div>

                            <div>
                              <p className="text-slate-500">
                                Sentiment
                              </p>

                              <p className="text-slate-200 mt-1">
                                {postInteractionReport.interactionSummary?.sentiment ||
                                  'Neutral'}
                              </p>
                            </div>

                            <div>
                              <p className="text-slate-500">
                                Frustration
                              </p>

                              <p className="text-slate-200 mt-1">
                                {postInteractionReport.interactionSummary?.frustration_level ??
                                  0}
                                /10
                              </p>
                            </div>

                            <div>
                              <p className="text-slate-500">
                                Satisfaction Trend
                              </p>

                              <p className="text-slate-200 mt-1">
                                {postInteractionReport.interactionSummary?.satisfaction_trend ||
                                  'Stable'}
                              </p>
                            </div>

                            <div>
                              <p className="text-slate-500">
                                Escalation Risk
                              </p>

                              <p className="text-slate-200 mt-1">
                                {postInteractionReport.interactionSummary?.escalation_risk ||
                                  'Low'}
                              </p>
                            </div>

                          </div>

                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

                          <h2 className="text-lg font-semibold text-white">
                            Performance Breakdown
                          </h2>

                          <div className="mt-5 space-y-4">

                            {[
                              [
                                'Communication',
                                postInteractionReport.score?.communication,
                              ],

                              [
                                'Resolution',
                                postInteractionReport.score?.resolution,
                              ],

                              [
                                'Empathy',
                                postInteractionReport.score?.empathy,
                              ],

                              [
                                'Knowledge Usage',
                                postInteractionReport.score?.knowledgeUsage,
                              ],

                              [
                                'Tone',
                                postInteractionReport.score?.tone,
                              ],

                              [
                                'Clarity',
                                postInteractionReport.score?.clarity,
                              ],
                            ].map(
                              ([
                                label,
                                value,
                              ]) => (
                                <div
                                  key={String(
                                    label
                                  )}
                                >

                                  <div className="flex justify-between text-xs mb-1">

                                    <span className="text-slate-400">
                                      {label}
                                    </span>

                                    <span className="text-white font-semibold">
                                      {Number(
                                        value ??
                                          0
                                      )}
                                    </span>

                                  </div>

                                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">

                                    <div
                                      className="h-full bg-indigo-500 rounded-full"
                                      style={{
                                        width: `${Math.max(
                                          0,
                                          Math.min(
                                            100,
                                            Number(
                                              value ??
                                                0
                                            )
                                          )
                                        )}%`,
                                      }}
                                    />

                                  </div>

                                </div>
                              )
                            )}

                          </div>

                        </div>

                      </div>

                      {/* ==================================================
                          STRENGTHS + WEAKNESSES
                          ================================================== */}

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

                          <h2 className="text-lg font-semibold text-white">
                            Strengths
                          </h2>

                          <ul className="mt-4 space-y-3">

                            {(
                              postInteractionReport.topStrengths ||
                              []
                            ).map(
                              (item) => (
                                <li
                                  key={item}
                                  className="text-sm text-slate-300 flex gap-2"
                                >

                                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />

                                  {item}

                                </li>
                              )
                            )}

                          </ul>

                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

                          <h2 className="text-lg font-semibold text-white">
                            Areas to Improve
                          </h2>

                          <ul className="mt-4 space-y-3">

                            {(
                              postInteractionReport.topWeaknesses ||
                              []
                            ).map(
                              (item) => (
                                <li
                                  key={item}
                                  className="text-sm text-slate-300 flex gap-2"
                                >

                                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />

                                  {item}

                                </li>
                              )
                            )}

                          </ul>

                        </div>

                      </div>

                      {/* ==================================================
                          COACHING
                          ================================================== */}

                      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

                        <h2 className="text-lg font-semibold text-white">
                          Personalized Coaching Recommendations
                        </h2>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">

                          {(
                            postInteractionReport.recommendedTrainings ||
                            []
                          ).map(
                            (item) => (
                              <div
                                key={item}
                                className="rounded-xl bg-slate-800/70 border border-slate-700 px-4 py-3 text-sm text-slate-200"
                              >
                                {item}
                              </div>
                            )
                          )}

                        </div>

                      </div>

                      {/* ==================================================
                          SENTIMENT JOURNEY
                          ================================================== */}

                      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

                        <h2 className="text-lg font-semibold text-white">
                          Sentiment Journey
                        </h2>

                        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">

                          <div className="rounded-xl bg-slate-800/60 p-4">

                            <p className="text-xs text-slate-500">
                              Starting
                            </p>

                            <p className="text-sm text-white mt-1">
                              {postInteractionReport.startingSentiment?.sentiment ||
                                String(
                                  postInteractionReport.startingSentiment ||
                                    'Neutral'
                                )}{' '}
                              ·{' '}
                              {postInteractionReport.startingSentiment?.emotion ||
                                ''}
                            </p>

                          </div>

                          <div className="rounded-xl bg-slate-800/60 p-4">

                            <p className="text-xs text-slate-500">
                              Ending
                            </p>

                            <p className="text-sm text-white mt-1">
                              {postInteractionReport.endingSentiment?.sentiment ||
                                String(
                                  postInteractionReport.endingSentiment ||
                                    'Neutral'
                                )}{' '}
                              ·{' '}
                              {postInteractionReport.endingSentiment?.emotion ||
                                ''}
                            </p>

                          </div>

                        </div>

                        <div className="mt-5 space-y-3">

                          {(
                            postInteractionReport.timelineEvents ||
                            []
                          ).map(
                            (event) => (
                              <div
                                key={
                                  event.id ??
                                  `${event.timestamp}-${event.title}`
                                }
                                className="flex gap-3 border-l border-slate-700 pl-4"
                              >

                                <div>

                                  <p className="text-xs text-indigo-400">
                                    {event.title ||
                                      'Conversation Event'}
                                  </p>

                                  <p className="text-sm text-slate-300 mt-1">
                                    {event.description ||
                                      ''}
                                  </p>

                                </div>

                              </div>
                            )
                          )}

                        </div>

                      </div>

                      {/* ==================================================
                          RESPONSE REVIEW
                          ================================================== */}

                      {(
                        postInteractionReport.responseComparisons ||
                        []
                      ).length >
                        0 && (
                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

                          <h2 className="text-lg font-semibold text-white">
                            Response Review
                          </h2>

                          <div className="mt-5 space-y-4">

                            {postInteractionReport.responseComparisons.map(
                              (
                                comparison
                              ) => (
                                <div
                                  key={
                                    comparison.turnNumber
                                  }
                                  className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
                                >

                                  <p className="text-xs font-semibold text-indigo-400">
                                    Agent Response{' '}
                                    {
                                      comparison.turnNumber
                                    }
                                  </p>

                                  <p className="text-xs text-slate-500 mt-3">
                                    Original
                                  </p>

                                  <p className="text-sm text-slate-300 mt-1">
                                    {
                                      comparison.originalAgentText
                                    }
                                  </p>

                                  <p className="text-xs text-slate-500 mt-3">
                                    Review
                                  </p>

                                  <p className="text-sm text-slate-300 mt-1">
                                    {
                                      comparison.improvementExplanation
                                    }
                                  </p>

                                </div>
                              )
                            )}

                          </div>

                        </div>
                      )}

                          </>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ==================================================
                      ACTUAL SAVED CONVERSATION
                      ================================================== */}

                  {messages.length > 0 && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-widest text-cyan-400 font-semibold">
                            Saved Conversation
                          </p>
                          <h2 className="text-xl font-bold text-white mt-2">
                            Actual Conversation
                          </h2>
                          <p className="text-sm text-slate-400 mt-1">
                            Messages from the selected saved interaction.
                          </p>
                        </div>
                        <span className="text-xs text-slate-500">
                          {messages.length} messages
                        </span>
                      </div>

                      <div className="mt-6 space-y-3 max-h-[520px] overflow-y-auto pr-2">
                        {messages.map((message, index) => (
                          <div
                            key={message.id ?? index}
                            className={`rounded-xl border p-4 ${
                              message.sender === 'customer'
                                ? 'border-slate-700 bg-slate-950/70'
                                : 'border-indigo-500/20 bg-indigo-500/5'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <span className="text-xs font-semibold text-slate-300">
                                {message.sender === 'customer' ? 'Customer' : 'Support Agent'}
                              </span>
                              {message.timestamp && (
                                <span className="text-[11px] text-slate-500">
                                  {new Date(message.timestamp).toLocaleString()}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-200 whitespace-pre-wrap">
                              {message.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ==================================================
                      SAVED INTERACTIONS FROM DATABASE
                      ================================================== */}

                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

                    <div className="flex items-start justify-between gap-4">

                      <div>

                        <p className="text-xs uppercase tracking-widest text-cyan-400 font-semibold">
                          Saved History
                        </p>

                        <h2 className="text-xl font-bold text-white mt-2">
                          Saved Interactions
                        </h2>

                        <p className="text-sm text-slate-400 mt-1">
                          Completed interactions from Manual Mode and Simulator Mode
                          saved in the database.
                        </p>

                      </div>

                      <div className="text-xs text-slate-500">
                        {savedManualInteractions.length}{' '}
                        saved
                      </div>

                    </div>

                    {savedReportsError && (
                      <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                        {savedReportsError}
                      </div>
                    )}

                    {isLoadingSavedReports ? (
                      <div className="mt-6 flex items-center justify-center py-10">

                        <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />

                        <span className="ml-3 text-sm text-slate-400">
                          Loading saved interactions...
                        </span>

                      </div>
                    ) : savedManualInteractions.length ===
                      0 ? (
                      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center">

                        <FileText className="w-8 h-8 text-slate-600 mx-auto mb-3" />

                        <h3 className="text-sm font-semibold text-white">
                          No saved interactions found
                        </h3>

                        <p className="text-xs text-slate-500 mt-2">
                          Save a completed Manual Mode
                          interaction and it will appear here.
                        </p>

                      </div>
                    ) : (
                      <div className="mt-6 space-y-4">

                        {savedManualInteractions.map(
                          (
                            interaction
                          ) => (
                            <div
                              key={
                                interaction.session_id
                              }
                              className="rounded-xl border border-slate-800 bg-slate-950/60 p-5"
                            >

                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                                <div>

                                  <div className="flex items-center gap-2">

                                    <FileText className="w-4 h-4 text-cyan-400" />

                                    <h3 className="text-sm font-semibold text-white">
                                      {interaction.mode === 'simulator'
                                        ? 'Simulator Interaction'
                                        : 'Manual Mode Interaction'}
                                    </h3>

                                  </div>

                                  <p className="text-xs text-slate-500 mt-2">
                                    Session #
                                    {
                                      interaction.session_id
                                    }

                                    {' · '}

                                    Conversation #
                                    {
                                      interaction.conversation_id
                                    }
                                  </p>

                                  {interaction.scenario_title && (
                                    <p className="text-xs text-slate-400 mt-1">
                                      Scenario: {interaction.scenario_title}
                                    </p>
                                  )}

                                </div>

                                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                                  <CheckCircle2 className="w-3.5 h-3.5" />

                                  {interaction.status ||
                                    'Completed'}
                                </span>

                              </div>

                              <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-4">

                                <div>
                                  <p className="text-[11px] text-slate-500">
                                    Intent
                                  </p>

                                  <p className="text-sm text-slate-200 mt-1">
                                    {interaction.intent ||
                                      'Unknown'}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-[11px] text-slate-500">
                                    Sentiment
                                  </p>

                                  <p className="text-sm text-slate-200 mt-1">
                                    {interaction.sentiment ||
                                      'Unknown'}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-[11px] text-slate-500">
                                    Resolution
                                  </p>

                                  <p className="text-sm text-slate-200 mt-1">
                                    {interaction.resolution_status ||
                                      'Unknown'}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-[11px] text-slate-500">
                                    Escalation
                                  </p>

                                  <p className="text-sm text-slate-200 mt-1">
                                    {interaction.escalation_risk ||
                                      'Low'}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-[11px] text-slate-500">
                                    Messages
                                  </p>

                                  <p className="text-sm text-slate-200 mt-1">
                                    {(interaction.customer_message_count ??
                                      0) +
                                      (interaction.agent_message_count ??
                                        0)}
                                  </p>

                                </div>

                              </div>

                              <div className="mt-5 flex flex-wrap gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleViewSavedReport(interaction.session_id)}
                                  disabled={isGeneratingReport}
                                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
                                >
                                  <FileText className="w-4 h-4" />
                                  {openingReportSessionId === interaction.session_id
                                    ? 'Opening Report...'
                                    : 'View Report'}
                                </button>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-500">

                                {interaction.start_time && (
                                  <span>
                                    Started:{' '}
                                    {new Date(
                                      interaction.start_time
                                    ).toLocaleString()}
                                  </span>
                                )}

                                {interaction.end_time && (
                                  <span>
                                    · Finished:{' '}
                                    {new Date(
                                      interaction.end_time
                                    ).toLocaleString()}
                                  </span>
                                )}

                              </div>

                              {interaction.analysis && (
                                <div className="mt-4 rounded-xl bg-slate-900 border border-slate-800 p-4">

                                  <p className="text-xs font-semibold text-indigo-400">
                                    Saved Analysis
                                  </p>

                                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">

                                    <div>
                                      <p className="text-[11px] text-slate-500">
                                        Emotion
                                      </p>

                                      <p className="text-xs text-slate-200 mt-1">
                                        {String(
                                          interaction.analysis
                                            .emotion ??
                                            'Unknown'
                                        )}
                                      </p>
                                    </div>

                                    <div>
                                      <p className="text-[11px] text-slate-500">
                                        Frustration
                                      </p>

                                      <p className="text-xs text-slate-200 mt-1">
                                        {String(
                                          interaction.analysis
                                            .frustration_level ??
                                            '0'
                                        )}
                                        /10
                                      </p>
                                    </div>

                                    <div>
                                      <p className="text-[11px] text-slate-500">
                                        Satisfaction
                                      </p>

                                      <p className="text-xs text-slate-200 mt-1">
                                        {String(
                                          interaction.analysis
                                            .satisfaction_trend ??
                                            'Stable'
                                        )}
                                      </p>
                                    </div>

                                    <div>
                                      <p className="text-[11px] text-slate-500">
                                        Confidence
                                      </p>

                                      <p className="text-xs text-slate-200 mt-1">
                                        {String(
                                          interaction.analysis
                                            .confidence ??
                                            '0'
                                        )}
                                      </p>
                                    </div>

                                  </div>

                                </div>
                              )}

                            </div>
                          )
                        )}

                      </div>
                    )}

                  </div>

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
