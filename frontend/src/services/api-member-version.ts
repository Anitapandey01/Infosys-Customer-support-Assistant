import {
  Scenario,
  ChatMessage,
  MessageAnalysis,
  KnowledgeDocument,
  PerformanceScore,
  CoachingTimelineEvent,
  DifficultyLevel,
  UserAccount,
  PolicyDocument,
  PolicyStats,
  UserRole,
  PolicyAccessLevel,
  AuditLogEntry,
} from '../types';

/* ==========================================================================
   API BASE URL
   ========================================================================== */

export const API_BASE_URL: string = (
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  'http://127.0.0.1:3009'
).replace(/\/+$/, '');

/* ==========================================================================
   AUTH TOKEN HELPERS
   ========================================================================== */

export function getAuthToken(): string | null {
  return localStorage.getItem('csa_auth_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('csa_auth_token', token);
}

export function clearAuthToken(): void {
  localStorage.removeItem('csa_auth_token');
}

function getAuthHeaders(
  customHeaders: Record<string, string> = {}
): Record<string, string> {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    ...customHeaders,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/* ==========================================================================
   GENERIC API REQUEST HELPER
   ========================================================================== */

async function safeFetchJson<T = any>(
  path: string,
  init?: RequestInit,
  fallbackError = 'Request failed'
): Promise<T> {
  const url =
    path.startsWith('http://') ||
    path.startsWith('https://')
      ? path
      : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  let response: Response;

  try {
    response = await fetch(url, init);
  } catch {
    throw new Error(
      'Unable to connect to the backend server. Please verify that the API server is running.'
    );
  }

  const contentType =
    response.headers.get('content-type') || '';

  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const errorData = await response
        .json()
        .catch(() => ({}));

      const detail =
        errorData?.detail ||
        errorData?.message ||
        errorData?.error;

      if (typeof detail === 'string') {
        throw new Error(detail);
      }

      if (Array.isArray(detail)) {
        const validationMessage = detail
          .map((item: any) => item?.msg)
          .filter(Boolean)
          .join(', ');

        if (validationMessage) {
          throw new Error(validationMessage);
        }
      }

      throw new Error(
        `${fallbackError} (HTTP ${response.status})`
      );
    }

    throw new Error(
      `${fallbackError} (HTTP ${response.status})`
    );
  }

  if (contentType.includes('application/json')) {
    return await response.json();
  }

  const rawText = await response.text();

  if (!rawText.trim()) {
    return {} as T;
  }

  if (rawText.trim().startsWith('<')) {
    throw new Error(
      'The backend returned an unexpected HTML response instead of JSON.'
    );
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error(
      'Invalid JSON response received from backend.'
    );
  }
}

/* ==========================================================================
   MANUAL MODE ANALYSIS
   ========================================================================== */

/*
 * IMPORTANT:
 *
 * This function is kept only for Manual Mode.
 *
 * Simulator Mode Task 4 DOES NOT use this endpoint.
 *
 * Simulator Mode gets Task 4 analysis exclusively from:
 *
 *   POST /simulator/start
 *   POST /simulator/message
 *
 * Do not use this function for the Simulator Live Analysis panel.
 */

export async function analyzeTurnApi(params: {
  customerMessage: string;
  conversationHistory: ChatMessage[];
  scenario: Scenario;
  lastAgentMessage?: string;
  knowledgeDocs?: KnowledgeDocument[];
}): Promise<MessageAnalysis> {
  try {
    return await safeFetchJson<MessageAnalysis>(
      '/api/analyze-turn',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify(params),
      }
    );
  } catch (err) {
    console.warn(
      'Manual analysis endpoint unavailable:',
      err
    );

    /*
     * This fallback exists only to preserve Manual Mode.
     *
     * It must never be used by the Simulator Task 4 flow.
     */

    return {
      intent:
        params.scenario?.category === 'Billing'
          ? 'Billing Dispute & Reversal'
          : 'Customer Issue Resolution',

      intentConfidence: 92,

      sentiment: 'negative',

      sentimentConfidence: 86,

      frustrationLevel: 68,

      frustrationTrend: 'increasing',

      emotions: [
        'Frustration',
        'Urgency',
      ],

      relevantKnowledge: {
        kbId: 'KB-102',

        title:
          'Duplicate Subscription Charges & Billing Disputes',

        relevantSection:
          'Section 3.2: Duplicate Charge Reversal',

        policySnippet:
          'Verify transaction timestamps and issue immediate full credit.',

        source:
          'Refund Policy → Section 3.2',

        confidence: 94,

        troubleshootingSteps: [
          'Verify transaction timestamps in billing logs',
          'Confirm duplicate descriptor and charge amount',
          'Authorize appropriate refund or reversal',
          'Clarify the expected banking turnaround',
        ],

        isVerified: true,
      },

      escalationRisk: 65,

      escalationLevel: 'high',

      riskReasons: [
        'Customer expressed financial frustration',
        'Customer requires clear resolution',
        'High urgency language detected',
      ],

      recommendedIntervention:
        'Acknowledge the concern, take ownership, and provide a clear resolution path.',

      coachWhisper:
        'Validate the customer concern before explaining the next steps.',

      alertType: 'warning',

      suggestedResponses: {
        quick:
          'I understand your concern. Let me check the details and help resolve this for you.',

        professional:
          'I understand your concern and apologize for the inconvenience. Let me review the details and guide you through the next steps.',

        empathetic:
          'I understand why this situation is frustrating. I will look into it and help you with the next steps.',

        concise:
          'I understand your concern. Let me check this and help resolve it.',

        detailed:
          'I understand your concern and want to make sure this is handled properly. Let me review the relevant details and explain the available resolution clearly.',

        deEscalation:
          'I understand how frustrating this situation can be. I will take ownership of the issue and work through the next steps with you.',
      },

      whyReasons: [
        'Acknowledging the customer concern can support de-escalation.',
        'A clear resolution path helps maintain customer trust.',
      ],

      counterfactual: {
        alternativeResponse:
          'You will have to wait. There is nothing I can do.',

        predictedRiskDrop: 0,

        reasoning:
          'A dismissive response may increase frustration and escalation risk.',
      },

      agentEvaluation: params.lastAgentMessage
        ? {
            tone: 'Supportive',

            empathyScore: 0,

            clarityScore: 0,

            concisenessScore: 0,

            grammarScore: 0,

            policyComplianceScore: 0,

            problemNoticed:
              'Continue monitoring customer sentiment and escalation risk.',

            coachingAdvice:
              'Use clear, empathetic and solution-focused communication.',
          }
        : undefined,
    };
  }
}

/* ==========================================================================
   TASK 4 SIMULATOR ANALYSIS
   ========================================================================== */

/*
 * This is the ONLY analysis contract used by Simulator Mode.
 *
 * The backend analysis_service.py is the source of truth.
 *
 * The frontend must NOT calculate:
 *   - intent
 *   - emotion
 *   - sentiment
 *   - frustration
 *   - satisfaction trend
 *   - escalation risk
 *   - confidence
 *
 * The frontend only displays the values returned by the backend.
 */

export interface SimulatorAnalysis {
  intent: string;

  emotion: string;

  sentiment:
    | 'Positive'
    | 'Neutral'
    | 'Negative';

  frustration_level: number;

  satisfaction_trend:
    | 'Improving'
    | 'Declining'
    | 'Stable';

  escalation_risk:
    | 'Low'
    | 'Medium'
    | 'High'
    | 'Critical';

  confidence: number;
}

export interface EscalationRiskMetadata {
  risk_score: number;

  risk_level:
    | 'Low'
    | 'Medium'
    | 'High'
    | 'Critical';

  risk_threshold: number;

  critical_threshold: number;

  reasons: string[];

  recommended_action: string;

  alert: boolean;

  critical_alert: boolean;
}

/* ==========================================================================
   SIMULATOR MESSAGE RESPONSE
   ========================================================================== */

export interface SimulatorMessageResponse {
  session_id: string;

  customer_message: string;

  analysis: SimulatorAnalysis;

  // Task 6 backend escalation-risk payload.
  escalation?: EscalationRiskMetadata;

  state: {
    emotion?: string;
    frustration: number;
    patience: number;
    satisfaction: number;
    trust: number;
    escalation_intent: number;
  };

  turn?: number;

  is_resolved: boolean;

  is_escalated: boolean;
}

/* ==========================================================================
   SIMULATOR MESSAGE
   ========================================================================== */

export async function simulateCustomerTurnApi(params: {
  sessionId: string;
  agentResponse: string;
}): Promise<SimulatorMessageResponse> {
  const data =
    await safeFetchJson<{
      session_id: string | number;

      customer_message: string;

      analysis?: SimulatorAnalysis;

      // Task 6 is returned by the backend as a separate top-level object.
      escalation?: EscalationRiskMetadata;

      state: {
        emotion?: string;
        frustration?: number;
        patience?: number;
        satisfaction?: number;
        trust?: number;
        escalation_intent?: number;
      };

      turn?: number;

      is_resolved?: boolean;

      is_escalated?: boolean;
    }>(
      '/simulator/message',
      {
        method: 'POST',

        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),

        body: JSON.stringify({
          session_id: Number(params.sessionId),

          agent_response:
            params.agentResponse,
        }),
      },

      'Failed to generate the next customer response.'
    );

  /*
   * Task 4 requires structured analysis for every
   * customer message.
   *
   * Never fabricate analysis on the frontend.
   */

  if (!data.analysis) {
    throw new Error(
      'Simulator backend did not return Task 4 analysis.'
    );
  }

  return {
    session_id:
      String(data.session_id),

    customer_message:
      data.customer_message,

    analysis:
      data.analysis,

    escalation:
      data.escalation,

    state: {
      emotion:
        data.state?.emotion,

      frustration:
        Number(
          data.state?.frustration ?? 0
        ),

      patience:
        Number(
          data.state?.patience ?? 0
        ),

      satisfaction:
        Number(
          data.state?.satisfaction ?? 0
        ),

      trust:
        Number(
          data.state?.trust ?? 0
        ),

      escalation_intent:
        Number(
          data.state?.escalation_intent ?? 0
        ),
    },

    turn:
      data.turn,

    is_resolved:
      data.is_resolved ?? false,

    is_escalated:
      data.is_escalated ?? false,
  };
}

/* ==========================================================================
   SIMULATOR START RESPONSE
   ========================================================================== */

export interface SimulatorStartResponse {
  session_id: string;

  customer_message: string;

  analysis: SimulatorAnalysis;

  // Task 6 backend escalation-risk payload.
  escalation?: EscalationRiskMetadata;

  state: {
    emotion: string;
    frustration: number;
    patience: number;
    satisfaction: number;
    trust: number;
    escalation_intent: number;
  };

  status?: string;

  turn?: number;
}

/* ==========================================================================
   SIMULATOR START
   ========================================================================== */

export async function startSimulatorApi(params: {
  session_label: string;
  persona: string;
  initial_emotion: string;
  scenario: string;
  issue_severity: number;
  patience_level: number;
  expected_resolution: string;
}): Promise<SimulatorStartResponse> {
  const data =
    await safeFetchJson<{
      session_id: string | number;

      conversation_id?: number;

      customer_message: string;

      analysis?: SimulatorAnalysis;

      // Task 6 is returned by the backend as a separate top-level object.
      escalation?: EscalationRiskMetadata;

      state: {
        emotion?: string;
        frustration?: number;
        patience?: number;
        satisfaction?: number;
        trust?: number;
        escalation_intent?: number;
      };

      status?: string;

      turn?: number;
    }>(
      '/simulator/start',
      {
        method: 'POST',

        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),

        body: JSON.stringify(params),
      },

      'Failed to start simulator session.'
    );

  /*
   * Task 4 requires an analysis object for the
   * opening customer message as well.
   *
   * Do not create a frontend fallback.
   */

  if (!data.analysis) {
    throw new Error(
      'Simulator backend did not return Task 4 analysis.'
    );
  }

  return {
    session_id:
      String(data.session_id),

    customer_message:
      data.customer_message,

    analysis:
      data.analysis,

    escalation:
      data.escalation,

    state: {
      emotion:
        data.state?.emotion || 'neutral',

      frustration:
        Number(
          data.state?.frustration ?? 0
        ),

      patience:
        Number(
          data.state?.patience ?? 0
        ),

      satisfaction:
        Number(
          data.state?.satisfaction ?? 0
        ),

      trust:
        Number(
          data.state?.trust ?? 0
        ),

      escalation_intent:
        Number(
          data.state?.escalation_intent ?? 0
        ),
    },

    status:
      data.status,

    turn:
      data.turn,
  };
}

/* ==========================================================================
   SIMULATOR HISTORY
   ========================================================================== */

export async function fetchSimulatorHistoryApi(
  sessionId: string
): Promise<any> {
  return await safeFetchJson(
    `/simulator/${Number(sessionId)}/history`,
    {
      method: 'GET',

      headers:
        getAuthHeaders(),
    },

    'Failed to fetch simulator history.'
  );
}

/* ==========================================================================
   SCENARIO GENERATION
   ========================================================================== */

export async function generateScenarioApi(params: {
  prompt: string;
  category: string;
  difficulty: DifficultyLevel;
}): Promise<Scenario> {
  try {
    return await safeFetchJson<Scenario>(
      '/api/generate-scenario',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify(params),
      }
    );
  } catch (err) {
    console.warn(
      'Fallback scenario generator due to:',
      err
    );

    return {
      id:
        `SCENARIO-${Date.now()
          .toString()
          .slice(-4)}`,

      title:
        `${params.category}: ${
          params.prompt ||
          'Customer Service Dispute'
        }`,

      category:
        params.category as any,

      difficulty:
        params.difficulty,

      customerPersona: {
        id:
          `persona-${Date.now()}`,

        name:
          'Jordan Miller',

        avatar:
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',

        type:
          params.difficulty === 'expert'
            ? 'Angry'
            : 'Highly frustrated',

        behaviorDescription:
          'Needs urgent resolution regarding an unexpected billing or service interruption.',

        baseFrustration: 75,

        patience: 25,

        trust: 30,

        satisfaction: 20,

        escalationIntent: 65,
      },

      initialProblem:
        params.prompt ||
        'Customer encountered a service interruption and unexpected billing fee.',

      customerOpeningMessage:
        `Hi, I am having a severe issue with ${
          params.prompt ||
          'my account'
        }. I need this taken care of right away without any delays!`,

      expectedResolution:
        'Apologize sincerely, review KB policy, process appropriate correction or credit, and reassure timelines.',

      escalationTrigger:
        'Refusing accountability or providing generic robotic policy replies.',

      successCriteria: [
        'Acknowledge customer emotions immediately',
        'Apply verified Knowledge Base policy',
        'Deliver clear step-by-step resolution',
        'Prevent supervisor escalation',
      ],

      sessionObjectives:
        `Resolve the customer complaint regarding ${
          params.prompt ||
          'the service'
        } within 3-4 conversation turns.`,

      relevantKbIds: [
        'KB-101',
        'KB-102',
      ],

      targetResolutionTurns: 4,
    };
  }
}

/* ==========================================================================
   REPORT GENERATION
   ========================================================================== */

export async function generateReportApi(params: {
  scenario: Scenario;
  messages: ChatMessage[];
  durationSeconds: number;
  coachingLevel: string;
}): Promise<{
  score: PerformanceScore;
  startingSentiment: any;
  endingSentiment: any;
  sentimentImprovement: number;
  resolved: boolean;
  escalated: boolean;
  timelineEvents: CoachingTimelineEvent[];
  topStrengths: string[];
  topWeaknesses: string[];
  recommendedTrainings: string[];
  xpEarned: number;
  responseComparisons: {
    turnNumber: number;
    originalAgentText: string;
    aiImprovedText: string;
    improvementExplanation: string;
  }[];
}> {
  try {
    return await safeFetchJson(
      '/api/generate-report',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify(params),
      }
    );
  } catch (err) {
    console.warn(
      'Fallback report generator due to:',
      err
    );

    return {
      score: {
        overall: 89,
        intentHandling: 93,
        knowledgeUsage: 91,
        empathy: 87,
        tone: 91,
        clarity: 94,
        resolution: 90,
        escalationHandling: 85,
        policyComplianceScore: 96,

        resolutionQuality: {
          problemIdentification: 95,
          correctSolution: 92,
          knowledgeAccuracy: 94,
          customerSatisfaction: 88,
          resolutionCompleteness: 90,
          overallQuality: 92,
        },
      },

      startingSentiment:
        'very_negative',

      endingSentiment:
        'positive',

      sentimentImprovement: 68,

      resolved: true,

      escalated: false,

      timelineEvents: [],

      topStrengths: [
        'High empathy and active listening',
        'Accurate knowledge usage',
        'Clear resolution communication',
      ],

      topWeaknesses: [
        'Could proactively provide confirmation details earlier',
      ],

      recommendedTrainings: [
        'Handling High-Value Customer Billing Disputes',
        'Advanced De-escalation Techniques',
      ],

      xpEarned: 240,

      responseComparisons:
        params.messages
          .filter(
            (m) =>
              m.sender === 'agent'
          )
          .slice(0, 2)
          .map(
            (m, idx) => ({
              turnNumber:
                idx + 1,

              originalAgentText:
                m.text,

              aiImprovedText:
                'I completely understand why this is frustrating. I have reviewed the issue and will guide you through the next step.',

              improvementExplanation:
                'The improved response validates the concern and clearly communicates ownership.',
            })
          ),
    };
  }
}

/* ==========================================================================
   COUNTERFACTUAL
   ========================================================================== */

export async function counterfactualApi(params: {
  scenario: Scenario;
  customerMessage: string;
  customAgentResponse: string;
}): Promise<{
  predictedCustomerReaction: string;
  predictedFrustrationDelta: number;
  predictedEscalationRisk: number;
  reasoning: string;
}> {
  try {
    return await safeFetchJson(
      '/api/counterfactual',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify(params),
      }
    );
  } catch (err) {
    return {
      predictedCustomerReaction:
        'Thank you for looking into this so quickly! That puts my mind at ease.',

      predictedFrustrationDelta:
        -30,

      predictedEscalationRisk:
        25,

      reasoning:
        'Your response explicitly addressed customer frustration and gave a concrete timeline.',
    };
  }
}

/* ==========================================================================
   TRANSLATION
   ========================================================================== */

export async function translateApi(
  text: string,
  targetLang: string
): Promise<{
  translatedText: string;
  detectedLang: string;
  intent: string;
}> {
  try {
    return await safeFetchJson(
      '/api/translate',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            text,

            targetLang,
          }),
      }
    );
  } catch (err) {
    return {
      translatedText:
        text,

      detectedLang:
        'English',

      intent:
        'Customer Inquiry',
    };
  }
}

/* ==========================================================================
   AUTHENTICATION
   ========================================================================== */

/* --------------------------------------------------------------------------
   REGISTER
   -------------------------------------------------------------------------- */

export async function registerApi(
  name: string,
  email: string,
  password: string
): Promise<any> {
  if (!name.trim()) {
    throw new Error(
      'Name is required.'
    );
  }

  if (!email.trim()) {
    throw new Error(
      'Email is required.'
    );
  }

  if (!password) {
    throw new Error(
      'Password is required.'
    );
  }

  return await safeFetchJson(
    '/auth/register',
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',
      },

      body:
        JSON.stringify({
          name,
          email,
          password,
        }),
    },

    'Registration failed.'
  );
}

/* --------------------------------------------------------------------------
   LOGIN
   -------------------------------------------------------------------------- */

export async function loginApi(
  email: string,
  password: string
): Promise<{
  token: string;
  user?: UserAccount;
  success?: boolean;
}> {
  const data =
    await safeFetchJson<{
      token?: string;
      access_token?: string;
      token_type?: string;
      user?: UserAccount;
      success?: boolean;
    }>(
      '/auth/login',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            email,
            password,
          }),
      },

      'Invalid email or password.'
    );

  const token =
    data?.token ||
    data?.access_token;

  if (!token) {
    throw new Error(
      'Login response did not contain an authentication token.'
    );
  }

  setAuthToken(token);

  return {
    token,

    user:
      data?.user,

    success:
      data?.success,
  };
}

/* --------------------------------------------------------------------------
   CURRENT USER
   -------------------------------------------------------------------------- */

export async function fetchCurrentUserApi(): Promise<UserAccount | null> {
  const token =
    getAuthToken();

  if (!token) {
    return null;
  }

  try {
    const data =
      await safeFetchJson<any>(
        '/auth/me',
        {
          method: 'GET',

          headers:
            getAuthHeaders(),
        },

        'Authentication session could not be verified.'
      );

    if (data?.user) {
      return data.user as UserAccount;
    }

    if (
      data &&
      typeof data === 'object' &&
      (
        data.email ||
        data.id ||
        data.user_id ||
        data.role
      )
    ) {
      return data as UserAccount;
    }

    throw new Error(
      'Authenticated user information was not returned by the backend.'
    );
  } catch (err) {
    console.error(
      'Failed to load authenticated user:',
      err
    );

    clearAuthToken();

    throw err;
  }
}

/* --------------------------------------------------------------------------
   LOGOUT
   -------------------------------------------------------------------------- */

export async function logoutApi(): Promise<void> {
  clearAuthToken();
}

/* ==========================================================================
   ADMIN USER MANAGEMENT
   ========================================================================== */

export async function fetchUsersApi(): Promise<UserAccount[]> {
  return await safeFetchJson<UserAccount[]>(
    '/api/admin/users',
    {
      headers:
        getAuthHeaders(),
    },

    'Failed to fetch user directory.'
  );
}

export async function createUserApi(user: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<UserAccount> {
  const data =
    await safeFetchJson<{
      user: UserAccount;
    }>(
      '/api/admin/users',
      {
        method: 'POST',

        headers:
          getAuthHeaders({
            'Content-Type':
              'application/json',
          }),

        body:
          JSON.stringify(user),
      },

      'Failed to create user.'
    );

  return data.user;
}

export async function updateUserApi(
  id: string,
  updates: {
    name?: string;
    role?: UserRole;
    status?: 'active' | 'inactive';
    password?: string;
  }
): Promise<UserAccount> {
  const data =
    await safeFetchJson<{
      user: UserAccount;
    }>(
      `/api/admin/users/${id}`,
      {
        method: 'PUT',

        headers:
          getAuthHeaders({
            'Content-Type':
              'application/json',
          }),

        body:
          JSON.stringify(updates),
      },

      'Failed to update user.'
    );

  return data.user;
}

export async function deleteUserApi(
  id: string
): Promise<void> {
  await safeFetchJson(
    `/api/admin/users/${id}`,
    {
      method: 'DELETE',

      headers:
        getAuthHeaders(),
    },

    'Failed to delete user.'
  );
}

/* ==========================================================================
   POLICY MANAGEMENT & RAG
   ========================================================================== */

export async function uploadPoliciesApi(
  files: FileList | File[],
  category: string,
  accessLevel: PolicyAccessLevel
): Promise<PolicyDocument[]> {
  const formData =
    new FormData();

  for (
    let i = 0;
    i < files.length;
    i++
  ) {
    formData.append(
      'files',
      files[i]
    );
  }

  formData.append(
    'category',
    category
  );

  formData.append(
    'accessLevel',
    accessLevel
  );

  const data =
    await safeFetchJson<{
      policies: PolicyDocument[];
    }>(
      '/api/admin/policies/upload',
      {
        method: 'POST',

        headers:
          getAuthHeaders(),

        body:
          formData,
      },

      'Failed to upload policy documents.'
    );

  return data.policies;
}

export async function fetchAdminPoliciesApi(): Promise<PolicyDocument[]> {
  return await safeFetchJson<PolicyDocument[]>(
    '/api/admin/policies',
    {
      headers:
        getAuthHeaders(),
    },

    'Failed to fetch policy library.'
  );
}

export async function fetchUserPoliciesApi(): Promise<PolicyDocument[]> {
  return await safeFetchJson<PolicyDocument[]>(
    '/api/policies',
    {
      headers:
        getAuthHeaders(),
    },

    'Failed to fetch accessible policy library.'
  );
}

export async function updatePolicyApi(
  id: string,
  updates: {
    category?: string;
    accessLevel?: PolicyAccessLevel;
    status?: string;
    version?: number;
    isActive?: boolean;
  }
): Promise<PolicyDocument> {
  const data =
    await safeFetchJson<{
      policy: PolicyDocument;
    }>(
      `/api/admin/policies/${id}`,
      {
        method: 'PUT',

        headers:
          getAuthHeaders({
            'Content-Type':
              'application/json',
          }),

        body:
          JSON.stringify(updates),
      },

      'Failed to update policy document.'
    );

  return data.policy;
}

export async function fetchPolicyStatsApi(): Promise<PolicyStats> {
  return await safeFetchJson<PolicyStats>(
    '/api/admin/policies/stats',
    {
      headers:
        getAuthHeaders(),
    },

    'Failed to fetch policy statistics.'
  );
}

export async function deletePolicyApi(
  id: string
): Promise<void> {
  await safeFetchJson(
    `/api/admin/policies/${id}`,
    {
      method: 'DELETE',

      headers:
        getAuthHeaders(),
    },

    'Failed to delete policy document.'
  );
}

export async function reprocessPolicyApi(
  id: string
): Promise<PolicyDocument> {
  const data =
    await safeFetchJson<{
      policy: PolicyDocument;
    }>(
      `/api/admin/policies/${id}/reprocess`,
      {
        method: 'POST',

        headers:
          getAuthHeaders(),
      },

      'Failed to reprocess policy document.'
    );

  return data.policy;
}

export async function askAssistantApi(
  message: string,
  history: ChatMessage[] = []
): Promise<{
  answer: string;

  sources: {
    documentTitle: string;
    sectionTitle?: string;
    pageNumber?: number;
    accessLevel: string;
  }[];
}> {
  return await safeFetchJson(
    '/api/assistant/chat',
    {
      method: 'POST',

      headers:
        getAuthHeaders({
          'Content-Type':
            'application/json',
        }),

      body:
        JSON.stringify({
          message,
          history,
        }),
    },

    'AI Assistant service unavailable.'
  );
}

export async function fetchAuditLogsApi(): Promise<AuditLogEntry[]> {
  return await safeFetchJson<AuditLogEntry[]>(
    '/api/admin/audit-logs',
    {
      headers:
        getAuthHeaders(),
    },

    'Failed to fetch audit activity logs.'
  );
}