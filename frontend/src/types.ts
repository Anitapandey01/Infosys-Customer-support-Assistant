export type InteractionMode =
  | 'manual'
  | 'simulator'
  | 'replay';

export type UserRole =
  | 'admin'
  | 'employee'
  | 'user';

export type CoachingLevel =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert';

export type DifficultyLevel =
  | 'easy'
  | 'medium'
  | 'hard'
  | 'expert';

/* ==========================================================================
   ANALYSIS TYPES
   ========================================================================== */

export type SentimentType =
  | 'Positive'
  | 'Neutral'
  | 'Negative'
  | 'positive'
  | 'neutral'
  | 'negative';

export type SatisfactionTrend =
  | 'Improving'
  | 'Declining'
  | 'Stable'
  | 'improving'
  | 'declining'
  | 'stable';

export type EscalationRisk =
  | 'Low'
  | 'Medium'
  | 'High'
  | 'Critical'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

/* ==========================================================================
   MESSAGE ANALYSIS
   ========================================================================== */

export interface KnowledgeRecommendation {
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
  kb_id?: string;
  section?: string;
  [key: string]: unknown;
}

export interface CoachingResponse {
  suggested_response: string;
  tone: string;
  clarity: string;
  empathy: string;
  professionalism: string;
  communication_rating: string;
  coaching_tips: string[];
}

export interface MessageAnalysis {
  intent: string;

  emotion: string;

  sentiment: SentimentType;

  frustration_level: number;

  satisfaction_trend: SatisfactionTrend;

  escalation_risk: EscalationRisk;

  confidence: number;

  /* ------------------------------------------------------------------------
     Legacy / compatibility fields
     ------------------------------------------------------------------------ */

  intentConfidence?: number;

  sentimentConfidence?: number;

  frustrationLevel?: number;

  frustrationTrend?: string;

  emotions?: string[];

  /* ------------------------------------------------------------------------
     Knowledge Base information
     ------------------------------------------------------------------------ */

  relevantKnowledge?: {
    kbId?: string;

    title?: string;

    relevantSection?: string;

    policySnippet?: string;

    source?: string;

    [key: string]: unknown;
  };

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

  /* ------------------------------------------------------------------------
     Additional backend analysis fields
     ------------------------------------------------------------------------ */

  [key: string]: unknown;
}

/* ==========================================================================
   SIMULATOR ANALYSIS
   ==========================================================================

   Simulator Mode uses the exact same analysis contract as MessageAnalysis.

   IMPORTANT:
   Do NOT create a second independent SimulatorAnalysis interface.

   This prevents type conflicts between:
     - Manual Mode analysis
     - Simulator Mode analysis
     - Task 4 backend analysis

   The backend remains the source of truth for the actual values.
   ========================================================================== */

export type SimulatorAnalysis = MessageAnalysis;

/* ==========================================================================
   CHAT MESSAGE
   ========================================================================== */

export interface ChatMessage {
  id: string;

  sender:
    | 'customer'
    | 'agent'
    | 'system';

  text: string;

  timestamp: string;

  analysis?: MessageAnalysis;

  customerState?: {
    emotion?: string;

    frustration: number;

    patience: number;

    satisfaction: number;

    trust: number;

    escalationIntent: number;

    [key: string]: unknown;
  };

  [key: string]: unknown;
}

/* ==========================================================================
   CUSTOMER PERSONA
   ========================================================================== */

export interface CustomerPersona {
  id: string;

  name: string;

  type: string;

  avatar: string;

  behaviorDescription: string;

  baseFrustration: number;

  patience: number;

  [key: string]: unknown;
}

/* ==========================================================================
   SCENARIO
   ========================================================================== */

export interface Scenario {
  id: string;

  title: string;

  category: string;

  difficulty: DifficultyLevel;

  customerPersona: CustomerPersona;

  initialProblem: string;

  customerOpeningMessage: string;

  successCriteria: string[];

  escalationTrigger: string;

  [key: string]: unknown;
}

/* ==========================================================================
   KNOWLEDGE DOCUMENT
   ========================================================================== */

export interface KnowledgeDocument {
  id: string;

  title: string;

  category: string;

  updatedAt: string;

  chunkCount: number;

  embeddingCount: number;

  status: string;

  citationsCount: number;

  summary: string;

  content: string;

  [key: string]: unknown;
}

/* ==========================================================================
   AGENT PROFILE
   ========================================================================== */

export interface AgentProfile {
  id?: string;

  name?: string;

  email?: string;

  avatar?: string;

  role?: UserRole;

  [key: string]: unknown;
}

/* ==========================================================================
   USER ACCOUNT
   ========================================================================== */

export interface UserAccount {
  id?: string | number;

  email: string;

  name?: string;

  full_name?: string;

  username?: string;

  role: UserRole | string;

  is_active?: boolean;

  [key: string]: unknown;
}

/* ==========================================================================
   PERFORMANCE SCORE
   ========================================================================== */

export interface PerformanceScore {
  score?: number;

  overallScore?: number;

  rating?: number;

  [key: string]: unknown;
}

/* ==========================================================================
   COACHING TIMELINE EVENT
   ========================================================================== */

export interface CoachingTimelineEvent {
  id?: string;

  timestamp?: string;

  type?: string;

  title?: string;

  description?: string;

  [key: string]: unknown;
}

/* ==========================================================================
   LEADERBOARD ENTRY
   ========================================================================== */

export interface LeaderboardEntry {
  id?: string;

  name?: string;

  score?: number;

  rank?: number;

  [key: string]: unknown;
}

/* ==========================================================================
   AUDIT LOG ENTRY
   ========================================================================== */

export interface AuditLogEntry {
  id?: string;

  timestamp?: string;

  action?: string;

  user?: string;

  details?: string;

  [key: string]: unknown;
}

/* ==========================================================================
   SESSION RECORD
   ========================================================================== */

export interface SessionRecord {
  id?: string;

  sessionId?: string;

  scenarioId?: string;

  startedAt?: string;

  endedAt?: string;

  status?: string;

  [key: string]: unknown;
}

/* ==========================================================================
   TRAINING PLAN
   ========================================================================== */

export interface TrainingPlanWeek {
  week?: number;

  title?: string;

  description?: string;

  goals?: string[];

  [key: string]: unknown;
}

/* ==========================================================================
   POLICY ACCESS
   ========================================================================== */

export type PolicyAccessLevel =
  | 'ADMIN'
  | 'EMPLOYEE'
  | 'USER'
  | 'PUBLIC';

/* ==========================================================================
   POLICY DOCUMENT
   ========================================================================== */

export interface PolicyDocument {
  id: string;

  title?: string;

  name?: string;

  description?: string;

  category?: string;

  accessLevel?: PolicyAccessLevel | string;

  isActive?: boolean;

  status?: string;

  fileName?: string;

  filePath?: string;

  uploadedAt?: string;

  updatedAt?: string;

  createdAt?: string;

  fileSize?: number;

  chunkCount?: number;

  embeddingCount?: number;

  [key: string]: unknown;
}

/* ==========================================================================
   POLICY STATISTICS
   ========================================================================== */

export interface PolicyStats {
  total?: number;

  active?: number;

  inactive?: number;

  indexed?: number;

  processing?: number;

  failed?: number;

  [key: string]: unknown;
}

/* ==========================================================================
   TASK 8: SUMMARY & PERFORMANCE ANALYTICS
   ========================================================================== */

export interface SentimentJourneyPoint {
  turn: number;
  customer_message: string;
  sentiment: string;
  emotion: string;
  intent: string;
  frustration_level: number;
  satisfaction_trend: string;
  urgency: string;
  escalation_risk: string;
  escalation_risk_score: number;
}

export interface PostInteractionSummary {
  session_id?: string | number | null;
  scenario_title: string;
  concise_summary: string;
  primary_customer_issue: string;
  final_resolution: string;
  resolution_quality_score: number;
  communication_quality: string;
  communication_score: number;
  empathy_score: number;
  policy_adherence_score: number;
  policy_adherence_note?: string;
  sentiment_journey: SentimentJourneyPoint[];
  agent_strengths: string[];
  agent_weaknesses: string[];
  coaching_recommendations: string[];
  total_turns: number;
  total_messages?: number;
  underlying_metrics?: {
    initial_frustration: number;
    final_frustration: number;
    peak_frustration: number;
    average_frustration: number;
    max_risk_score: number;
    final_risk_level: string;
    escalated: boolean;
  };
  created_at?: string;
}

export interface IntentStat {
  intent: string;
  count: number;
  percentage: number;
}

export interface EscalationTriggerStat {
  trigger: string;
  count: number;
  percentage: number;
}

export interface KnowledgeGapStat {
  topic: string;
  frequency: number;
  avg_relevance: number;
  status: string;
}

export interface SessionTrendPoint {
  session_id: number;
  title: string;
  resolution_quality: number;
  resolution_status: string;
  timestamp?: string | null;
}

export interface RecentSessionItem {
  session_id: number;
  title: string;
  primary_issue: string;
  status: string;
  resolution_quality: number;
  turns: number;
  created_at?: string | null;
}

export interface PerformanceAnalyticsData {
  total_sessions: number;
  completed_sessions: number;
  total_interactions: number;
  customer_turns: number;
  resolution_rate: number;
  average_resolution_quality: number;
  average_frustration: number;
  average_response_quality: number;
  average_empathy: number;
  average_policy_adherence: number;
  escalation_frequency: number;
  common_escalation_triggers: EscalationTriggerStat[];
  common_customer_intents: IntentStat[];
  knowledge_gap_indicators: KnowledgeGapStat[];
  agent_improvement_trends: SessionTrendPoint[];
  recent_sessions: RecentSessionItem[];
  session_insights: {
    status_breakdown: {
      Resolved: number;
      Unresolved: number;
      Escalated: number;
    };
    best_resolution_quality: number;
    lowest_resolution_quality: number;
  };
  actionable_recommendations: string[];
}

