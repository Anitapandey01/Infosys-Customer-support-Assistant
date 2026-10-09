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
  CoachingResponse,
} from '../types';

/* ==========================================================================
   API BASE URL
   ========================================================================== */

export const API_BASE_URL: string = (
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  'http://127.0.0.1:8000'
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
 * Manual Mode uses:
 *
 * POST /api/analyze-turn
 *
 * The backend is now the source of truth.
 *
 * IMPORTANT:
 * - No hardcoded analysis fallback.
 * - Existing UI remains compatible.
 * - Backend response fields are mapped into MessageAnalysis.
 * - The request sent to the backend uses the exact ManualTurnRequest
 *   field names expected by the manual endpoint.
 */

export async function analyzeTurnApi(params: {
  customerMessage: string;
  conversationHistory: ChatMessage[];
  scenario: Scenario;
  lastAgentMessage?: string;
  knowledgeDocs?: KnowledgeDocument[];
}): Promise<MessageAnalysis> {
  const conversationHistory = params.conversationHistory.map(
    (message) => ({
      sender_type:
        message.sender === 'customer'
          ? 'Customer'
          : message.sender === 'agent'
            ? 'Support Agent'
            : 'System',

      message_text:
        message.text,
    })
  );

  const backendResponse =
    await safeFetchJson<{
      message?: string;

      analysis?: {
        intent: string;
        emotion: string;
        sentiment: string;
        frustration_level: number;
        satisfaction_trend: string;
        escalation_risk: string;
        confidence: number;
      };

      coaching?: CoachingResponse;

      knowledge_recommendations?: Array<Record<string, unknown>>;

      knowledge_message?: string;

      escalation?: {
        risk_score?: number;
        risk_level?: string;
        risk_threshold?: number;
        critical_threshold?: number;
        reasons?: string[];
        recommended_action?: string;
        alert?: boolean;
        critical_alert?: boolean;
      };
    }>(
      '/api/analyze-turn',
      {
        method: 'POST',

        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),

        body: JSON.stringify({
          message:
            params.customerMessage,

          conversation_history:
            conversationHistory,

          /*
           * These values are kept in the request because
           * ManualTurnRequest can use scenario context.
           */
          scenario:
            params.scenario,

          last_agent_message:
            params.lastAgentMessage || '',

          knowledge_docs:
            params.knowledgeDocs || [],
        }),
      },

      'Failed to analyze manual support turn.'
    );

  /*
   * Backend response must contain the actual analysis.
   */
  if (!backendResponse.analysis) {
    throw new Error(
      'Manual analysis backend did not return an analysis object.'
    );
  }

  const analysis =
    backendResponse.analysis;

  /*
   * Convert backend Task 4 / Task 5 / Task 6 data
   * into the existing frontend MessageAnalysis shape.
   *
   * Nothing is generated or hardcoded here.
   */
  return {
    intent:
      analysis.intent,

    emotion:
      analysis.emotion,

    sentiment:
      analysis.sentiment as MessageAnalysis['sentiment'],

    frustration_level:
      Number(
        analysis.frustration_level
      ),

    satisfaction_trend:
      analysis.satisfaction_trend as MessageAnalysis['satisfaction_trend'],

    escalation_risk:
      analysis.escalation_risk as MessageAnalysis['escalation_risk'],

    confidence:
      Number(
        analysis.confidence
      ),

    /*
     * Backward-compatible frontend fields.
     */
    intentConfidence:
      Number(
        analysis.confidence
      ) * 100,

    sentimentConfidence:
      Number(
        analysis.confidence
      ) * 100,

    frustrationLevel:
      Number(
        analysis.frustration_level
      ) * 10,

    frustrationTrend:
      analysis.satisfaction_trend,

    emotions: [
      analysis.emotion,
    ],

    /*
     * Preserve backend knowledge recommendations.
     */
    knowledge_recommendations:
      backendResponse.knowledge_recommendations || [],

    knowledge_message:
      backendResponse.knowledge_message,

    /*
     * Preserve complete backend objects for existing
     * components that may read additional fields.
     */
    backendAnalysis:
      analysis,

    coaching:
      backendResponse.coaching,

    escalation:
      backendResponse.escalation,

    scenario:
      params.scenario,
  } as MessageAnalysis;
}

/* ==========================================================================
   TASK 6 - REAL-TIME COACHING
   ========================================================================== */

export async function generateCoachingApi(params: {
  message: string;
  intent: string;
  emotion: string;
  sentiment: string;
  frustration_level: number;
  escalation_risk: string;
  conversation_history: Array<{
    sender_type: string;
    message_text: string;
  }>;
  knowledge_recommendations: Array<Record<string, unknown>>;
}): Promise<CoachingResponse> {
  return await safeFetchJson<CoachingResponse>(
    '/coaching/suggest',
    {
      method: 'POST',

      headers: getAuthHeaders({
        'Content-Type': 'application/json',
      }),

      body:
        JSON.stringify(params),
    },

    'Failed to generate real-time coaching.'
  );
}

/* ==========================================================================
   TASK 4 SIMULATOR ANALYSIS
   ========================================================================== */

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

        body:
          JSON.stringify({
            session_id:
              Number(params.sessionId),

            agent_response:
              params.agentResponse,
          }),
      },

      'Failed to generate the next customer response.'
    );

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

        body:
          JSON.stringify(params),
      },

      'Failed to start simulator session.'
    );

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
            (message) =>
              message.sender === 'agent'
          )
          .slice(0, 2)
          .map(
            (message, index) => ({
              turnNumber:
                index + 1,

              originalAgentText:
                message.text,

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

export async function registerApi(name: string, email: string, password: string): Promise<any> {
  if (!name.trim()) throw new Error('Name is required.');
  if (!email.trim()) throw new Error('Email is required.');
  if (!password) throw new Error('Password is required.');

  return await safeFetchJson('/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, email, password }),
  }, 'Registration failed.');
}

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

export async function logoutApi(): Promise<void> {
  clearAuthToken();
}

/* ==========================================================================
   ADMIN USER MANAGEMENT
   ========================================================================== */

export async function fetchUsersApi(): Promise<UserAccount[]> {
  const data = await safeFetchJson<{
    total_users?: number;
    users?: UserAccount[];
  }>(
    '/users/',
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
    'Failed to fetch user directory.'
  );

  return Array.isArray(data.users) ? data.users : [];
}

export async function createUserApi(user: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<UserAccount> {
  return await safeFetchJson<UserAccount>(
    '/users/',
    {
      method: 'POST',
      headers: getAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(user),
    },
    'Failed to create user.'
  );
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
   DOCUMENT KNOWLEDGE BASE
   ========================================================================== */

export interface BackendDocument {
  document_id: number;
  document_name: string;
  document_type: string;
  version: number;
  status: string;
  filename: string;
  uploaded_by: string;
}

export interface DocumentListResponse {
  total_documents: number;
  documents: BackendDocument[];
}

export interface DocumentHistoryResponse {
  document_name: string;
  total_versions: number;
  versions: BackendDocument[];
}

export async function fetchDocumentsApi(): Promise<DocumentListResponse> {
  return await safeFetchJson<DocumentListResponse>(
    '/documents/',
    { method: 'GET', headers: getAuthHeaders() },
    'Failed to fetch knowledge base documents.'
  );
}

export async function uploadDocumentApi(
  file: File,
  documentName: string,
  documentType: string
): Promise<unknown> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('document_name', documentName);
  formData.append('document_type', documentType);

  return await safeFetchJson(
    '/documents/upload',
    { method: 'POST', headers: getAuthHeaders(), body: formData },
    'Failed to upload document.'
  );
}

export interface DocumentContentPage {
  page_number: number;
  text: string;
}

export interface DocumentContentResponse {
  document_id: number;
  document_name: string;
  filename: string;
  document_type: string;
  version: number;
  uploaded_by: string;
  pages: DocumentContentPage[];
}

export async function fetchDocumentContentApi(
  documentId: number
): Promise<DocumentContentResponse> {
  return await safeFetchJson<DocumentContentResponse>(
    `/documents/content/${documentId}`,
    { method: 'GET', headers: getAuthHeaders() },
    'Failed to read document content.'
  );
}

export async function fetchDocumentFileApi(documentId: number): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/documents/file/${documentId}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    let message = 'Failed to load the PDF document.';
    try {
      const payload = await response.json();
      if (payload?.detail) message = payload.detail;
    } catch {
      // Keep the default message when the server does not return JSON.
    }
    throw new Error(message);
  }

  return await response.blob();
}

export async function fetchDocumentHistoryApi(
  documentName: string
): Promise<DocumentHistoryResponse> {
  return await safeFetchJson<DocumentHistoryResponse>(
    `/documents/history/${encodeURIComponent(documentName)}`,
    { method: 'GET', headers: getAuthHeaders() },
    'Failed to fetch document history.'
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
    let fileIndex = 0;
    fileIndex < files.length;
    fileIndex++
  ) {
    formData.append(
      'files',
      files[fileIndex]
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

/* ==========================================================================
   MANUAL MODE HISTORY
   ========================================================================== */

export interface ManualConversationMessage {
  sender: 'customer' | 'agent';
  text: string;
  timestamp?: string;
}

export interface SaveManualInteractionResponse {
  success: boolean;
  message: string;
  session_id: number;
  conversation_id: number;
  status: string;
}

export async function saveManualInteractionApi(params: {
  conversation: ManualConversationMessage[];
  analysis?: Record<string, unknown> | null;
  status?: string;
  title?: string;
}): Promise<SaveManualInteractionResponse> {
  if (!params.conversation.length) {
    throw new Error(
      'Cannot save an empty Manual Mode interaction.'
    );
  }

  return await safeFetchJson<SaveManualInteractionResponse>(
    '/manual/save',
    {
      method: 'POST',

      headers: getAuthHeaders({
        'Content-Type': 'application/json',
      }),

      body: JSON.stringify({
        conversation: params.conversation,
        analysis: params.analysis || null,
        status: params.status || 'Completed',
        title:
          params.title ||
          'Manual Mode Interaction',
      }),
    },

    'Failed to save Manual Mode interaction.'
  );
}

/* ==========================================================================
   MANUAL MODE HISTORY
   ========================================================================== */

export interface ManualHistoryItem {
  session_id: number;
  conversation_id: number;
  title?: string;
  status: string;
  start_time?: string;
  end_time?: string;
  intent?: string;
  sentiment?: string;
  resolution_status?: string;
  escalation_risk?: string;
  customer_message_count?: number;
  agent_message_count?: number;
  analysis?: Record<string, unknown> | null;
  mode?: 'manual' | 'simulator';
  scenario_title?: string | null;
  scenario_category?: string | null;
}

export async function fetchManualHistoryApi(): Promise<
  ManualHistoryItem[]
> {
  const data = await safeFetchJson<{
    count?: number;
    interactions?: ManualHistoryItem[];
  }>(
    '/manual/history/all',
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
    'Failed to fetch Manual Mode history.'
  );

  return Array.isArray(data.interactions)
    ? data.interactions
    : [];
}

/* ==========================================================================
   GET ONE MANUAL INTERACTION
   ========================================================================== */

export interface ManualInteractionDetails {
  session_id: number;
  conversation_id: number;
  status: string;
  mode?: 'manual' | 'simulator';
  scenario_title?: string | null;
  scenario_category?: string | null;
  scenario_description?: string | null;

  conversation: Array<{
    id: number;
    sender: 'customer' | 'agent';
    text: string;
    timestamp?: string | null;
  }>;

  analysis: Record<string, unknown> | null;
}

export async function fetchManualInteractionApi(
  sessionId: number
): Promise<ManualInteractionDetails> {
  return await safeFetchJson<ManualInteractionDetails>(
    `/manual/${sessionId}`,
    {
      method: 'GET',

      headers: getAuthHeaders(),
    },

    'Failed to fetch Manual Mode interaction.'
  );
}