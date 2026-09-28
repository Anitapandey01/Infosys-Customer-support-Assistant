import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle,
  Check,
  RefreshCw,
  Zap,
  Lightbulb,
  Lock,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
} from 'lucide-react';

import {
  MessageAnalysis,
  CoachingLevel,
} from '../../types';

interface CoachingPanelProps {
  analysis?: MessageAnalysis;
  onUseSuggestion: (text: string) => void;
  onGenerateAlternative: () => void;
  isAnalyzing: boolean;
  coachingLevel: CoachingLevel;
}

type ResponseMode =
  | 'empathetic'
  | 'professional'
  | 'quick'
  | 'concise'
  | 'detailed'
  | 'deEscalation';

interface SuggestionOption {
  id: ResponseMode;
  label: string;
}

const RESPONSE_MODES: SuggestionOption[] = [
  {
    id: 'empathetic',
    label: 'Empathetic',
  },
  {
    id: 'professional',
    label: 'Professional',
  },
  {
    id: 'deEscalation',
    label: 'De-escalation',
  },
  {
    id: 'quick',
    label: 'Quick',
  },
  {
    id: 'concise',
    label: 'Concise',
  },
  {
    id: 'detailed',
    label: 'Detailed',
  },
];

const normalizeIntent = (
  intent?: string
): string => {
  return String(intent || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .trim();
};

const getIntentCategory = (
  intent?: string
): string => {
  const normalized = normalizeIntent(intent);

  if (
    normalized.includes('refund') ||
    normalized.includes('return')
  ) {
    return 'refund';
  }

  if (
    normalized.includes('subscription') ||
    normalized.includes('billing') ||
    normalized.includes('charge') ||
    normalized.includes('payment') ||
    normalized.includes('invoice')
  ) {
    return 'billing';
  }

  if (
    normalized.includes('cancel')
  ) {
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

  if (
    normalized.includes('technical') ||
    normalized.includes('bug') ||
    normalized.includes('error') ||
    normalized.includes('issue')
  ) {
    return 'technical';
  }

  return 'general';
};

const getQueryAwareFallback = (
  analysis: MessageAnalysis | undefined,
  mode: ResponseMode
): string => {
  const category = getIntentCategory(
    analysis?.intent
  );

  const sentiment = String(
    analysis?.sentiment || ''
  ).toLowerCase();

  const isNegative =
    sentiment === 'negative' ||
    String(
      analysis?.emotion || ''
    ).toLowerCase() === 'frustrated' ||
    String(
      analysis?.emotion || ''
    ).toLowerCase() === 'angry';

  const empathyPrefix = isNegative
    ? 'I understand how frustrating this situation is. '
    : 'I understand your concern. ';

  if (category === 'refund') {
    switch (mode) {
      case 'professional':
        return 'I’ll review the refund eligibility and the applicable refund policy for this charge, then confirm the next steps with you.';

      case 'quick':
        return 'I’ll check the refund eligibility and applicable policy for this charge and update you on the next step.';

      case 'concise':
        return 'I’ll verify the refund policy and eligibility for this charge and help you with the next step.';

      case 'detailed':
        return `${empathyPrefix}I’ll verify the charge, check the applicable refund policy and eligibility, and explain the available resolution before proceeding.`;

      case 'deEscalation':
        return `${empathyPrefix}I’ll take ownership of this and review the charge against our refund policy so we can determine the appropriate resolution.`;

      case 'empathetic':
      default:
        return `${empathyPrefix}I’ll check the charge against our refund policy and verify your refund eligibility so we can get this resolved.`;
    }
  }

  if (category === 'billing') {
    switch (mode) {
      case 'professional':
        return 'I’ll review the billing details and the applicable billing policy, then confirm what caused the charge and the available resolution.';

      case 'quick':
        return 'I’ll review the billing details and check the applicable policy for this charge.';

      case 'concise':
        return 'I’ll verify the charge and applicable billing policy, then confirm the next step.';

      case 'detailed':
        return `${empathyPrefix}I’ll review the transaction details, identify the reason for the charge, check the applicable billing policy, and explain the resolution available to you.`;

      case 'deEscalation':
        return `${empathyPrefix}I’ll personally review the charge and the applicable billing policy so we can address the issue clearly and fairly.`;

      case 'empathetic':
      default:
        return `${empathyPrefix}I’ll review the charge and the applicable billing policy and help you understand exactly what happened.`;
    }
  }

  if (category === 'cancellation') {
    switch (mode) {
      case 'professional':
        return 'I’ll verify the cancellation status and review the applicable cancellation policy before confirming the next steps.';

      case 'quick':
        return 'I’ll check the cancellation status and applicable policy for you now.';

      case 'concise':
        return 'I’ll verify the cancellation status and policy, then confirm the next step.';

      case 'detailed':
        return `${empathyPrefix}I’ll verify when the cancellation was requested, check its current status against our cancellation policy, and explain what we can do next.`;

      case 'deEscalation':
        return `${empathyPrefix}I’ll take ownership of the cancellation issue and verify the request against the applicable policy before we decide the next step.`;

      case 'empathetic':
      default:
        return `${empathyPrefix}I’ll verify your cancellation request and check the applicable policy so I can help resolve this properly.`;
    }
  }

  if (category === 'shipping') {
    switch (mode) {
      case 'professional':
        return 'I’ll check the order and shipment status and review the applicable delivery policy before confirming the available options.';

      case 'quick':
        return 'I’ll check your order and shipment status and confirm the next step.';

      case 'concise':
        return 'I’ll verify the shipment status and applicable delivery policy for you.';

      case 'detailed':
        return `${empathyPrefix}I’ll review the order details, check the current shipment status and applicable delivery policy, and explain the available options.`;

      case 'deEscalation':
        return `${empathyPrefix}I’ll take ownership of this and check the shipment details and delivery policy so we can work out the appropriate next step.`;

      case 'empathetic':
      default:
        return `${empathyPrefix}I’ll check the order and shipment details and review the applicable delivery policy to help resolve this.`;
    }
  }

  if (category === 'account') {
    switch (mode) {
      case 'professional':
        return 'I’ll verify the account details and review the applicable account-access policy before confirming the next step.';

      case 'quick':
        return 'I’ll check the account details and help you with the next step.';

      case 'concise':
        return 'I’ll verify the account details and applicable policy for you.';

      case 'detailed':
        return `${empathyPrefix}I’ll verify the account details, identify the issue affecting access, check the applicable policy, and guide you through the available resolution.`;

      case 'deEscalation':
        return `${empathyPrefix}I’ll take ownership of the account issue and work through the applicable policy with you step by step.`;

      case 'empathetic':
      default:
        return `${empathyPrefix}I’ll check the account details and applicable policy and help you get this resolved.`;
    }
  }

  if (category === 'technical') {
    switch (mode) {
      case 'professional':
        return 'I’ll review the issue details and the applicable troubleshooting guidance, then confirm the next step.';

      case 'quick':
        return 'I’ll review the issue and check the relevant troubleshooting guidance now.';

      case 'concise':
        return 'I’ll check the issue against the relevant troubleshooting guidance and confirm the next step.';

      case 'detailed':
        return `${empathyPrefix}I’ll review the issue details, check the relevant troubleshooting guidance, and walk you through the appropriate resolution.`;

      case 'deEscalation':
        return `${empathyPrefix}I’ll take ownership of the issue and work through the relevant troubleshooting steps with you.`;

      case 'empathetic':
      default:
        return `${empathyPrefix}I’ll review the issue and the relevant troubleshooting guidance so we can work toward a resolution.`;
    }
  }

  switch (mode) {
    case 'professional':
      return 'I’ll review the details of your request and the applicable support guidance before confirming the next step.';

    case 'quick':
      return 'I’ll review your request and check the relevant support guidance now.';

    case 'concise':
      return 'I’ll review your request and confirm the appropriate next step.';

    case 'detailed':
      return `${empathyPrefix}I’ll review the details of your request, check the relevant support guidance, and explain the available resolution clearly.`;

    case 'deEscalation':
      return `${empathyPrefix}I’ll take ownership of this request and review the relevant support guidance so we can work toward the right resolution.`;

    case 'empathetic':
    default:
      return `${empathyPrefix}I’ll review your request and the relevant support guidance and help you with the next step.`;
  }
};

export const CoachingPanel: React.FC<
  CoachingPanelProps
> = ({
  analysis,
  onUseSuggestion,
  onGenerateAlternative,
  isAnalyzing,
  coachingLevel,
}) => {
  const [
    selectedMode,
    setSelectedMode,
  ] = useState<ResponseMode>(
    'empathetic'
  );

  const [
    showWhyDrawer,
    setShowWhyDrawer,
  ] = useState(false);

  const [
    showCounterfactual,
    setShowCounterfactual,
  ] = useState(false);

  const [
    copiedMode,
    setCopiedMode,
  ] = useState<string | null>(null);

  if (coachingLevel === 'assessment') {
    return (
      <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-center text-center shadow-lg">
        <div className="max-w-lg">
          <div className="w-12 h-12 rounded-2xl bg-amber-950/60 border border-amber-800/60 flex items-center justify-center text-amber-400 mx-auto mb-3">
            <Lock className="w-6 h-6" />
          </div>

          <h3 className="text-base font-bold text-white mb-2">
            Assessment Mode Active
          </h3>

          <p className="text-xs text-slate-400 leading-relaxed mb-3">
            Live AI response suggestions and real-time hints are hidden during blind assessment tests.
          </p>

          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
            A comprehensive AI Performance Report will be generated after the session is completed.
          </div>
        </div>
      </div>
    );
  }

  const backendSuggestion =
    analysis?.suggestedResponses?.[
      selectedMode
    ];

  const currentSuggestion =
    backendSuggestion &&
    backendSuggestion.trim()
      ? backendSuggestion
      : getQueryAwareFallback(
          analysis,
          selectedMode
        );

  const intentLabel =
    analysis?.intent ||
    'Customer Support Request';

  const sentimentLabel =
    analysis?.sentiment ||
    'Neutral';

  const frustrationLevel =
    analysis?.frustrationLevel ??
    analysis?.frustration_level ??
    0;

  const handleUseSuggestion = () => {
    onUseSuggestion(
      currentSuggestion
    );

    setCopiedMode(selectedMode);

    window.setTimeout(() => {
      setCopiedMode(null);
    }, 2000);
  };

  const getFrustrationColor = (
    level: number
  ) => {
    if (level < 35) {
      return 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60';
    }

    if (level < 65) {
      return 'text-amber-400 bg-amber-950/60 border-amber-800/60';
    }

    return 'text-rose-400 bg-rose-950/60 border-rose-800/60';
  };

  const getTrendIcon = (
    trend?: 'increasing' | 'decreasing' | 'stable'
  ) => {
    if (trend === 'increasing') {
      return (
        <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
      );
    }

    if (trend === 'decreasing') {
      return (
        <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
      );
    }

    return (
      <Minus className="w-3.5 h-3.5 text-slate-400" />
    );
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">

      {/* HEADER */}
      <div className="px-4 py-3 bg-slate-850 border-b border-slate-800 flex items-center justify-between">

        <div className="flex items-center gap-2">

          <BrainCircuit className="w-4 h-4 text-indigo-400" />

          <span className="font-semibold text-xs uppercase tracking-wider text-slate-200">
            Panel 2 — AI Real-Time Coaching
          </span>

        </div>

        {isAnalyzing && (
          <span className="flex items-center gap-1.5 text-[11px] text-indigo-400 font-medium">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Analyzing turn...
          </span>
        )}

      </div>

      {/* CONTENT — NO INTERNAL SCROLL */}
      <div className="p-4 space-y-3 bg-slate-900/60 text-xs">

        {/* INTELLIGENCE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">

            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">

              <span>
                Customer Intent
              </span>

              <span className="text-indigo-400 font-semibold">
                {analysis?.intentConfidence ??
                  0}
                % match
              </span>

            </div>

            <p className="font-bold text-white text-xs truncate">
              {intentLabel}
            </p>

          </div>

          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">

            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">

              <span>
                Frustration Level
              </span>

              <div className="flex items-center gap-1">

                {getTrendIcon(
                  analysis?.frustrationTrend
                )}

                <span className="capitalize font-medium text-slate-300">
                  {analysis?.frustrationTrend ||
                    'stable'}
                </span>

              </div>

            </div>

            <div className="flex items-center justify-between">

              <span
                className={`px-2 py-0.5 rounded text-xs font-bold border ${getFrustrationColor(
                  frustrationLevel
                )}`}
              >
                {frustrationLevel}%
              </span>

              <span className="text-[11px] text-slate-400 capitalize">
                Sentiment:{' '}
                <b className="text-slate-200">
                  {sentimentLabel}
                </b>
              </span>

            </div>

          </div>

        </div>

        {/* EMOTIONS */}
        {analysis?.emotions &&
          analysis.emotions.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">

              <span className="text-[11px] text-slate-400 font-medium">
                Emotions:
              </span>

              {analysis.emotions.map(
                (
                  emotion,
                  index
                ) => (
                  <span
                    key={`${emotion}-${index}`}
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950/40 text-rose-300 border border-rose-800/40"
                  >
                    {emotion}
                  </span>
                )
              )}

            </div>
          )}

        {/* COACH WHISPER */}
        {analysis?.coachWhisper && (
          <div className="p-3 rounded-xl bg-indigo-950/50 border border-indigo-700/60 text-xs text-indigo-100 flex items-start gap-2.5">

            <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />

            <div>

              <span className="font-semibold text-indigo-300 uppercase tracking-wider text-[10px] block mb-0.5">
                Coach Whisper
              </span>

              <p className="text-xs leading-relaxed">
                {analysis.coachWhisper}
              </p>

            </div>

          </div>
        )}

        {/* RESPONSE GENERATOR */}
        <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 space-y-3">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-1.5 text-xs font-bold text-white">

              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />

              <span>
                Recommended Responses
              </span>

            </div>

            <button
              id="coaching-refresh-suggestions"
              type="button"
              onClick={
                onGenerateAlternative
              }
              className="text-[11px] text-slate-400 hover:text-indigo-400 flex items-center gap-1 transition"
            >
              <RefreshCw className="w-3 h-3" />

              Regenerate
            </button>

          </div>

          <div className="flex items-center gap-1 flex-wrap text-[11px]">

            {RESPONSE_MODES.map(
              (tab) => (
                <button
                  key={tab.id}
                  id={`suggestion-tab-${tab.id}`}
                  type="button"
                  onClick={() =>
                    setSelectedMode(
                      tab.id
                    )
                  }
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
                    selectedMode ===
                    tab.id
                      ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                      : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              )
            )}

          </div>

          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-700/80 text-xs text-slate-200 leading-relaxed">

            <p className="italic">
              "{currentSuggestion}"
            </p>

          </div>

          <div className="flex items-center justify-between pt-1">

            <button
              id="btn-why-this-response"
              type="button"
              onClick={() =>
                setShowWhyDrawer(
                  !showWhyDrawer
                )
              }
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition"
            >

              <HelpCircle className="w-3.5 h-3.5" />

              <span>
                Why this response?
              </span>

              {showWhyDrawer ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}

            </button>

            <button
              id="btn-use-suggestion"
              type="button"
              onClick={
                handleUseSuggestion
              }
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            >

              {copiedMode ===
              selectedMode ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}

              <span>
                {copiedMode ===
                selectedMode
                  ? 'Applied to Input!'
                  : 'Use Suggestion'}
              </span>

            </button>

          </div>

          {showWhyDrawer &&
            analysis?.whyReasons &&
            analysis.whyReasons.length >
              0 && (
              <div className="p-3 rounded-lg bg-slate-950/80 border border-indigo-900/50 text-[11px] text-slate-300 space-y-1.5">

                <span className="font-semibold text-indigo-300 text-xs block mb-1">
                  AI Reasoning Breakdown:
                </span>

                {analysis.whyReasons.map(
                  (
                    reason,
                    index
                  ) => (
                    <div
                      key={`${reason}-${index}`}
                      className="flex items-start gap-1.5"
                    >
                      <span className="text-indigo-400 font-bold">
                        •
                      </span>

                      <span>
                        {reason}
                      </span>
                    </div>
                  )
                )}

              </div>
            )}

        </div>

        {/* COUNTERFACTUAL */}
        {analysis?.counterfactual && (
          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-1.5 font-bold text-xs text-amber-300">

                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />

                <span>
                  Counterfactual Coaching
                </span>

              </div>

              <button
                id="btn-toggle-counterfactual"
                type="button"
                onClick={() =>
                  setShowCounterfactual(
                    !showCounterfactual
                  )
                }
                className="text-[11px] text-slate-400 hover:text-slate-200"
              >
                {showCounterfactual
                  ? 'Hide'
                  : 'What if you said something else?'}
              </button>

            </div>

            {showCounterfactual && (
              <div className="p-2.5 rounded-lg bg-slate-900 border border-amber-900/40 text-[11px] text-slate-300 space-y-2">

                <div>
                  <span className="text-rose-400 font-semibold">
                    Poor Example:{' '}
                  </span>

                  <span className="italic">
                    "
                    {
                      analysis
                        .counterfactual
                        .alternativeResponse
                    }
                    "
                  </span>
                </div>

                <div className="p-2 rounded bg-rose-950/30 border border-rose-800/40 text-rose-200">
                  <b>
                    Predicted Risk Impact:
                  </b>{' '}
                  Frustration would rise by{' '}
                  {Math.abs(
                    analysis
                      .counterfactual
                      .predictedRiskDrop
                  )}
                  %.{' '}
                  {
                    analysis
                      .counterfactual
                      .reasoning
                  }
                </div>

              </div>
            )}

          </div>
        )}

        {/* AGENT EVALUATION */}
        {analysis?.agentEvaluation && (
          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2.5">

            <div className="flex items-center justify-between text-xs font-bold text-white">

              <span>
                Your Previous Turn Evaluation
              </span>

              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px]">
                Tone:{' '}
                {
                  analysis
                    .agentEvaluation
                    .tone
                }
              </span>

            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">

              <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/60">
                <span className="text-slate-400 block">
                  Empathy
                </span>

                <span className="font-bold text-white text-xs">
                  {
                    analysis
                      .agentEvaluation
                      .empathyScore
                  }
                  %
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/60">
                <span className="text-slate-400 block">
                  Clarity
                </span>

                <span className="font-bold text-white text-xs">
                  {
                    analysis
                      .agentEvaluation
                      .clarityScore
                  }
                  %
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/60">
                <span className="text-slate-400 block">
                  Policy
                </span>

                <span className="font-bold text-white text-xs">
                  {
                    analysis
                      .agentEvaluation
                      .policyComplianceScore
                  }
                  %
                </span>
              </div>

            </div>

            {analysis.agentEvaluation
              .problemNoticed && (
              <p className="text-[11px] text-amber-300 leading-tight">
                <b>
                  Feedback:
                </b>{' '}
                {
                  analysis
                    .agentEvaluation
                    .problemNoticed
                }
              </p>
            )}

          </div>
        )}

      </div>

    </div>
  );
};