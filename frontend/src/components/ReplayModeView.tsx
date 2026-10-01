import React, { useEffect, useMemo, useState } from "react";
import {
  RotateCcw,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  User,
  Clock3,
  BookOpen,
  Award,
  MessageSquareText,
  Target,
  Brain,
  ChevronRight,
  Play,
  Pause,
  Lightbulb,
  TrendingUp,
  Send,
  Upload,
  FileText,
  FileJson,
  FileSpreadsheet,
  Loader2,
  Download,
  Activity,
  ExternalLink,
} from "lucide-react";

import {
  INITIAL_REPLAY_SESSIONS,
  INITIAL_KNOWLEDGE_DOCS,
} from "../data/initialData";

import { analyzeTurnApi } from "../services/api";

type Sender = "customer" | "agent";

type ReplayMessage = {
  id: string;
  sender: Sender;
  text: string;
  timestamp?: string;
};

type ReplayTurn = {
  customerMessage: string;
  originalAgentResponse?: string;
  criticism?: string;
  improvedResponse?: string;
  timestamp?: string;
};

type ReplayCase = {
  id: string;
  title: string;
  category: string;
  customerName: string;
  difficulty: string;
  objective: string;
  turns: ReplayTurn[];
};

type AnalysisView = {
  intent: string;
  intentConfidence: number;
  sentiment: string;
  sentimentConfidence: number;
  frustrationLevel: number;
  frustrationTrend: string;
  emotions: string[];
  escalationRisk: number;
  escalationLevel: string;
  riskReasons: string[];
  coachWhisper: string;
  recommendedIntervention: string;
  suggestedResponse: string;
  knowledgeTitle: string;
  knowledgeSection: string;
  knowledgeSnippet: string;
  knowledgeSource: string;
  troubleshootingSteps: string[];
};

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cleanText = (value: unknown) => String(value ?? "").trim();

const getSender = (value: unknown): Sender | null => {
  const sender = cleanText(value).toLowerCase();

  if (
    ["customer", "client", "user", "caller", "cust"].includes(sender)
  ) {
    return "customer";
  }

  if (
    ["agent", "support", "employee", "representative", "assistant"].includes(
      sender
    )
  ) {
    return "agent";
  }

  return null;
};

const normalizeCases = (): ReplayCase[] =>
  (INITIAL_REPLAY_SESSIONS || [])
    .map((session: any, index: number) => ({
      id: session.id || `demo-${index}`,
      title: session.title || `Historical Case ${index + 1}`,
      category: session.category || "General Support",
      customerName: session.customerName || "Customer",
      difficulty: session.difficulty || "Medium",
      objective:
        session.objective || "Improve customer support communication quality",
      turns: (session.turns || []).map((turn: any) => ({
        customerMessage: cleanText(turn.customerMessage),
        originalAgentResponse: cleanText(turn.originalAgentResponse),
        criticism: cleanText(turn.criticism),
        improvedResponse: cleanText(turn.improvedResponse),
        timestamp: cleanText(turn.timestamp),
      })),
    }))
    .filter((session) => session.turns.length > 0);

const parseTxt = (raw: string): ReplayMessage[] => {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = lines.flatMap((line, index) => {
    const match = line.match(
      /^(customer|client|user|agent|support|employee|representative)\s*[:\-]\s*(.+)$/i
    );

    if (!match) {
      return [];
    }

    const sender = getSender(match[1]);

    if (!sender) {
      return [];
    }

    return [
      {
        id: makeId(`txt-${index}`),
        sender,
        text: match[2],
      },
    ];
  });

  if (parsed.length > 0) {
    return parsed;
  }

  return lines.map((line, index) => ({
    id: makeId(`line-${index}`),
    sender: index % 2 === 0 ? "customer" : "agent",
    text: line,
  }));
};

const parseCsvRow = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());

  return result;
};

const parseCsv = (raw: string): ReplayMessage[] => {
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvRow);

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((value) => value.toLowerCase());

  const senderIndex = headers.findIndex((value) =>
    ["sender", "role", "speaker", "type", "author"].includes(value)
  );

  const messageIndex = headers.findIndex((value) =>
    ["message", "text", "content", "body"].includes(value)
  );

  const timestampIndex = headers.findIndex((value) =>
    ["timestamp", "time", "date"].includes(value)
  );

  const hasHeader = senderIndex >= 0 && messageIndex >= 0;

  return rows
    .slice(hasHeader ? 1 : 0)
    .flatMap((row, index) => {
      const sender = getSender(
        hasHeader ? row[senderIndex] : row[0]
      );

      const message = cleanText(
        hasHeader ? row[messageIndex] : row[1] || row[0]
      );

      if (!sender || !message) {
        return [];
      }

      return [
        {
          id: makeId(`csv-${index}`),
          sender,
          text: message,
          timestamp: hasHeader
            ? cleanText(row[timestampIndex])
            : undefined,
        },
      ];
    });
};

const parseJson = (raw: string): ReplayMessage[] => {
  const data = JSON.parse(raw);

  const messages = Array.isArray(data)
    ? data
    : data?.messages || data?.conversation || data?.turns || [];

  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.flatMap((item: any, index: number) => {
    if (typeof item === "string") {
      return [
        {
          id: makeId(`json-${index}`),
          sender: index % 2 === 0 ? "customer" : "agent",
          text: item,
        },
      ];
    }

    const sender = getSender(
      item?.sender ??
        item?.role ??
        item?.speaker ??
        item?.type ??
        item?.author
    );

    const message = cleanText(
      item?.message ??
        item?.text ??
        item?.content ??
        item?.body
    );

    if (!sender || !message) {
      return [];
    }

    return [
      {
        id: makeId(`json-${index}`),
        sender,
        text: message,
        timestamp: cleanText(
          item?.timestamp ?? item?.time ?? item?.date
        ),
      },
    ];
  });
};

const messagesToTurns = (messages: ReplayMessage[]): ReplayTurn[] => {
  const turns: ReplayTurn[] = [];

  messages.forEach((message, index) => {
    if (message.sender !== "customer") {
      return;
    }

    const nextAgentMessage = messages
      .slice(index + 1)
      .find((item) => item.sender === "agent");

    turns.push({
      customerMessage: message.text,
      originalAgentResponse: nextAgentMessage?.text,
      timestamp: message.timestamp,
    });
  });

  return turns;
};

const normalizeAnalysis = (
  result: any,
  turn: ReplayTurn
): AnalysisView => {
  const knowledge = result?.relevantKnowledge || {};

  const escalationRisk = Number(
    result?.escalationRisk ?? 50
  );

  return {
    intent:
      result?.intent || "Customer Issue Resolution",

    intentConfidence: Number(
      result?.intentConfidence ?? 0
    ),

    sentiment:
      result?.sentiment || "neutral",

    sentimentConfidence: Number(
      result?.sentimentConfidence ?? 0
    ),

    frustrationLevel: Number(
      result?.frustrationLevel ?? 50
    ),

    frustrationTrend:
      result?.frustrationTrend || "stable",

    emotions: Array.isArray(result?.emotions)
      ? result.emotions
      : [],

    escalationRisk,

    escalationLevel:
      result?.escalationLevel ||
      (escalationRisk >= 75
        ? "high"
        : escalationRisk >= 45
        ? "medium"
        : "low"),

    riskReasons: Array.isArray(result?.riskReasons)
      ? result.riskReasons
      : [],

    coachWhisper:
      result?.coachWhisper ||
      "Validate the customer's concern and take clear ownership.",

    recommendedIntervention:
      result?.recommendedIntervention ||
      "Use empathy, ownership, and a clear next step.",

    suggestedResponse:
      result?.suggestedResponses?.empathetic ||
      result?.suggestedResponses?.professional ||
      result?.suggestedResponses?.quick ||
      turn.improvedResponse ||
      "I understand your concern. Let me review this and help resolve it.",

    knowledgeTitle:
      knowledge.title ||
      "Relevant Support Knowledge",

    knowledgeSection:
      knowledge.relevantSection ||
      "Recommended guidance",

    knowledgeSnippet:
      knowledge.policySnippet ||
      "Review the relevant support policy before responding.",

    knowledgeSource:
      knowledge.source ||
      "Support Knowledge Base",

    troubleshootingSteps:
      Array.isArray(knowledge.troubleshootingSteps)
        ? knowledge.troubleshootingSteps
        : [],
  };
};

export const ReplayModeView: React.FC = () => {
  const [cases, setCases] = useState<ReplayCase[]>(
    normalizeCases()
  );

  const [caseIndex, setCaseIndex] = useState(0);
  const [turnIndex, setTurnIndex] = useState(0);

  const [draft, setDraft] = useState("");

  const [analysis, setAnalysis] =
    useState<AnalysisView | null>(null);

  const [riskHistory, setRiskHistory] = useState<
    { turn: number; risk: number }[]
  >([]);

  const [reviewedTurns, setReviewedTurns] = useState<number[]>(
    []
  );

  const [playing, setPlaying] = useState(false);
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [knowledgeOpen, setKnowledgeOpen] = useState(false);

  const currentCase = cases[caseIndex];

  const currentTurn =
    currentCase?.turns?.[turnIndex];

  const totalTurns =
    currentCase?.turns?.length || 0;

  const progress = totalTurns
    ? Math.round(
        (reviewedTurns.length / totalTurns) * 100
      )
    : 0;

  const currentRisk =
    analysis?.escalationRisk || 0;

  const peakRisk = riskHistory.length
    ? Math.max(
        ...riskHistory.map((item) => item.risk)
      )
    : 0;

  const averageRisk = riskHistory.length
    ? Math.round(
        riskHistory.reduce(
          (sum, item) => sum + item.risk,
          0
        ) / riskHistory.length
      )
    : 0;

  const finalRisk = riskHistory.length
    ? riskHistory[riskHistory.length - 1].risk
    : 0;

  const difficulty = useMemo(() => {
    const value = (
      currentCase?.difficulty || "medium"
    ).toLowerCase();

    if (
      value.includes("hard") ||
      value.includes("severe") ||
      value.includes("advanced")
    ) {
      return {
        label: "Advanced",
        className:
          "bg-rose-500/10 text-rose-300 border-rose-500/20",
      };
    }

    if (value.includes("easy")) {
      return {
        label: "Beginner",
        className:
          "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
      };
    }

    return {
      label: "Intermediate",
      className:
        "bg-amber-500/10 text-amber-300 border-amber-500/20",
    };
  }, [currentCase]);

  const customerInitials = useMemo(() => {
    const name = currentCase?.customerName || "Customer";

    return (
      name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "CU"
    );
  }, [currentCase]);

  const analyzeTurn = async (
    index = turnIndex,
    lastAgentMessage?: string
  ) => {
    if (!currentCase?.turns[index]) {
      return;
    }

    setBusy(true);
    setUploadError("");

    try {
      const history: any[] = [];

      currentCase.turns
        .slice(0, index + 1)
        .forEach((turn, historyIndex) => {
          history.push({
            id: `replay-customer-${historyIndex}`,
            sender: "customer",
            text: turn.customerMessage,
          });

          if (turn.originalAgentResponse) {
            history.push({
              id: `replay-agent-${historyIndex}`,
              sender: "agent",
              text: turn.originalAgentResponse,
            });
          }
        });

      const scenario = {
        id: currentCase.id,
        title: currentCase.title,
        category: currentCase.category,
        difficulty: currentCase.difficulty,
        customerOpeningMessage:
          currentCase.turns[0]?.customerMessage || "",
        customerPersona: {
          baseFrustration: 60,
          trust: 40,
          patience: 35,
          satisfaction: 35,
          escalationIntent: 45,
        },
      };

      const result = await analyzeTurnApi({
        customerMessage:
          currentCase.turns[index].customerMessage,

        conversationHistory: history,

        scenario,

        lastAgentMessage:
          lastAgentMessage ||
          currentCase.turns[index].originalAgentResponse,

        knowledgeDocs:
          INITIAL_KNOWLEDGE_DOCS as any,
      });

      const normalized = normalizeAnalysis(
        result,
        currentCase.turns[index]
      );

      setAnalysis(normalized);

      setRiskHistory((previous) => {
        const updated = [
          ...previous.filter(
            (item) => item.turn !== index + 1
          ),
          {
            turn: index + 1,
            risk: normalized.escalationRisk,
          },
        ];

        return updated.sort(
          (a, b) => a.turn - b.turn
        );
      });
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Replay analysis failed."
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (currentTurn && !complete) {
      void analyzeTurn(turnIndex);
    }

    // Intentionally triggered when replay turn changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseIndex, turnIndex]);

  useEffect(() => {
    if (
      !playing ||
      complete ||
      !currentCase ||
      totalTurns === 0
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setTurnIndex((previousIndex) => {
        if (previousIndex >= totalTurns - 1) {
          setPlaying(false);
          setComplete(true);

          setReviewedTurns((previous) =>
            previous.includes(previousIndex)
              ? previous
              : [...previous, previousIndex]
          );

          return previousIndex;
        }

        setReviewedTurns((previous) =>
          previous.includes(previousIndex)
            ? previous
            : [...previous, previousIndex]
        );

        setDraft("");

        return previousIndex + 1;
      });
    }, 7000);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    playing,
    complete,
    currentCase,
    totalTurns,
  ]);

  const resetReplay = () => {
    setTurnIndex(0);
    setDraft("");
    setAnalysis(null);
    setRiskHistory([]);
    setReviewedTurns([]);
    setComplete(false);
    setPlaying(false);
    setUploadError("");
    setKnowledgeOpen(false);
  };

  const selectCase = (index: number) => {
    setCaseIndex(index);
    setTurnIndex(0);
    setDraft("");
    setAnalysis(null);
    setRiskHistory([]);
    setReviewedTurns([]);
    setComplete(false);
    setPlaying(false);
    setUploadError("");
    setKnowledgeOpen(false);
  };

  const submitResponse = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!draft.trim() || !currentTurn) {
      return;
    }

    setReviewedTurns((previous) =>
      previous.includes(turnIndex)
        ? previous
        : [...previous, turnIndex]
    );

    await analyzeTurn(
      turnIndex,
      draft.trim()
    );
  };

  const nextTurn = () => {
    if (turnIndex < totalTurns - 1) {
      setReviewedTurns((previous) =>
        previous.includes(turnIndex)
          ? previous
          : [...previous, turnIndex]
      );

      setTurnIndex((previous) => previous + 1);
      setDraft("");
      setKnowledgeOpen(false);

      return;
    }

    setReviewedTurns((previous) =>
      previous.includes(turnIndex)
        ? previous
        : [...previous, turnIndex]
    );

    setComplete(true);
    setPlaying(false);
  };

  const previousTurn = () => {
    if (turnIndex > 0) {
      setTurnIndex((previous) => previous - 1);
      setDraft("");
      setComplete(false);
      setKnowledgeOpen(false);
    }
  };

  const importTranscript = async (
    file: File
  ) => {
    setUploadError("");

    try {
      const extension = file.name
        .split(".")
        .pop()
        ?.toLowerCase();

      const raw = await file.text();

      let messages: ReplayMessage[] = [];

      if (extension === "txt") {
        messages = parseTxt(raw);
      } else if (extension === "csv") {
        messages = parseCsv(raw);
      } else if (extension === "json") {
        messages = parseJson(raw);
      } else {
        throw new Error(
          "Unsupported file type. Use TXT, CSV, or JSON."
        );
      }

      if (!messages.length) {
        throw new Error(
          "No valid customer or agent messages were found."
        );
      }

      const turns = messagesToTurns(messages);

      if (!turns.length) {
        throw new Error(
          "The transcript must contain at least one customer message."
        );
      }

      const importedCase: ReplayCase = {
        id: makeId("uploaded"),
        title: file.name.replace(/\.[^/.]+$/, ""),
        category: "Uploaded Transcript",
        customerName: "Transcript Customer",
        difficulty: "Medium",
        objective:
          "Analyze the historical conversation and improve response quality.",
        turns,
      };

      setCases((previous) => [
        importedCase,
        ...previous,
      ]);

      setCaseIndex(0);
      setTurnIndex(0);
      setDraft("");
      setAnalysis(null);
      setRiskHistory([]);
      setReviewedTurns([]);
      setComplete(false);
      setPlaying(false);
      setShowUpload(false);
      setKnowledgeOpen(false);
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Unable to parse transcript."
      );
    }
  };

  const downloadTemplate = () => {
    const csv =
      'sender,message,timestamp\n' +
      '"customer","I was billed $89 for a cancelled service.","10:01"\n' +
      '"agent","I understand your concern. Let me check the billing details.","10:02"\n' +
      '"customer","I already contacted support twice.","10:03"\n';

    const url = URL.createObjectURL(
      new Blob([csv], {
        type: "text/csv",
      })
    );

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download = "replay-template.csv";
    anchor.click();

    URL.revokeObjectURL(url);
  };

  if (!currentCase || !currentTurn) {
    return (
      <div className="p-10 text-center text-white">
        No replay cases available.
      </div>
    );
  }

  const replayMessages = currentCase.turns.flatMap(
    (turn, index) => [
      {
        id: `customer-${index}`,
        sender: "customer" as Sender,
        text: turn.customerMessage,
      },
      ...(turn.originalAgentResponse
        ? [
            {
              id: `agent-${index}`,
              sender: "agent" as Sender,
              text: turn.originalAgentResponse,
            },
          ]
        : []),
    ]
  );

  return (
    <div className="w-full max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* HEADER */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/50 shadow-2xl">
        <div className="p-5 sm:p-6 lg:p-7">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-[10px] font-bold uppercase">
                  <RotateCcw className="w-3 h-3" />
                  Replay Training
                </span>

                <span
                  className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase ${difficulty.className}`}
                >
                  {difficulty.label}
                </span>

                <span className="px-2.5 py-1 rounded-full border border-slate-700 bg-slate-800/70 text-slate-400 text-[10px] font-semibold">
                  Historical Case Review
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                Replay Training Workspace
              </h1>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                Replay customer conversations message by
                message with AI coaching, knowledge
                recommendations, escalation-risk tracking,
                and an overall session summary.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setShowUpload((value) => !value)
                }
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-200 text-xs font-semibold"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Transcript
              </button>

              <button
                type="button"
                onClick={resetReplay}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 text-xs font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restart
              </button>

              <button
                type="button"
                disabled={complete}
                onClick={() =>
                  setPlaying((value) => !value)
                }
                className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-semibold ${
                  playing
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-900 border-slate-700 text-slate-300"
                }`}
              >
                {playing ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}

                {playing ? "Pause" : "Play"}
              </button>
            </div>
          </div>

          {/* UPLOAD */}
          {showUpload && (
            <div className="mt-6 p-5 rounded-2xl border border-indigo-500/20 bg-indigo-950/20">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-white">
                    Upload Conversation Transcript
                  </p>

                  <p className="text-[11px] text-slate-500 mt-1">
                    Supported formats: TXT, CSV, JSON
                  </p>

                  {uploadError && (
                    <p className="text-xs text-rose-300 mt-2">
                      {uploadError}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer">
                    <Upload className="w-4 h-4" />

                    Choose File

                    <input
                      type="file"
                      accept=".txt,.csv,.json"
                      className="hidden"
                      onChange={(event) => {
                        const file =
                          event.target.files?.[0];

                        if (file) {
                          void importTranscript(file);
                        }

                        event.currentTarget.value = "";
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 text-xs font-semibold"
                  >
                    <Download className="w-4 h-4" />
                    CSV Template
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <FileText className="w-4 h-4 text-indigo-400" />

                  <p className="text-xs font-semibold text-white mt-2">
                    TXT
                  </p>

                  <p className="text-[10px] text-slate-500">
                    Customer: ... / Agent: ...
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />

                  <p className="text-xs font-semibold text-white mt-2">
                    CSV
                  </p>

                  <p className="text-[10px] text-slate-500">
                    sender,message,timestamp
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <FileJson className="w-4 h-4 text-amber-400" />

                  <p className="text-xs font-semibold text-white mt-2">
                    JSON
                  </p>

                  <p className="text-[10px] text-slate-500">
                    messages[] / conversation[]
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PROGRESS */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <div className="flex justify-between mb-2 text-xs">
              <span className="text-slate-400 inline-flex gap-2">
                <Target className="w-3.5 h-3.5 text-indigo-400" />
                Replay Progress
              </span>

              <b className="text-white">
                Turn {turnIndex + 1} / {totalTurns}
              </b>
            </div>

            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400"
                style={{
                  width: `${Math.max(progress, 4)}%`,
                }}
              />
            </div>

            <div className="flex justify-between mt-2 text-[11px]">
              <span className="text-slate-500">
                {reviewedTurns.length} of {totalTurns} turns
                reviewed
              </span>

              <span className="text-indigo-300">
                {progress}% complete
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-[240px_minmax(0,1fr)] gap-5">
        {/* LIBRARY */}
        <aside className="rounded-3xl border border-slate-800 bg-slate-950/80 overflow-hidden h-fit xl:sticky xl:top-5">
          <div className="px-4 py-4 border-b border-slate-800">
            <div className="flex gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />

              <h2 className="text-sm font-bold text-white">
                Replay Library
              </h2>
            </div>

            <p className="text-[11px] text-slate-500 mt-1">
              Historical and uploaded conversations
            </p>
          </div>

          <div className="p-3 space-y-2">
            {cases.map((replayCase, index) => (
              <button
                key={replayCase.id}
                type="button"
                onClick={() => selectCase(index)}
                className={`w-full text-left rounded-2xl p-3.5 border ${
                  index === caseIndex
                    ? "bg-indigo-500/10 border-indigo-500/40"
                    : "bg-slate-900/60 border-slate-800"
                }`}
              >
                <div className="flex justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-300">
                      {String(index + 1).padStart(2, "0")} ·{" "}
                      {replayCase.category}
                    </span>

                    <p className="text-[10px] text-slate-400 mt-2">
                      {replayCase.title}
                    </p>
                  </div>

                  <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                </div>
              </button>
            ))}
          </div>

          <div className="px-4 py-4 border-t border-slate-800">
            <p className="text-[10px] text-slate-500">
              Training objective
            </p>

            <p className="text-[11px] text-white mt-1">
              {currentCase.objective}
            </p>
          </div>
        </aside>

        {/* CONTENT */}
        <main className="min-w-0 space-y-5">
          {/* CASE HEADER */}
          <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
            <div className="flex justify-between gap-4">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                  <MessageSquareText className="w-5 h-5 text-white" />
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                    Active Replay
                  </p>

                  <h2 className="text-lg sm:text-xl font-bold text-white">
                    {currentCase.title}
                  </h2>

                  <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-slate-500">
                    <span>
                      <User className="w-3 h-3 inline mr-1" />
                      {currentCase.customerName}
                    </span>

                    <span>
                      <Clock3 className="w-3 h-3 inline mr-1" />
                      Turn {turnIndex + 1}
                    </span>

                    <span>
                      <BookOpen className="w-3 h-3 inline mr-1" />
                      {currentCase.category}
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 h-fit">
                <p className="text-[10px] text-slate-500">
                  Difficulty
                </p>

                <p className="text-xs font-bold text-amber-300">
                  {currentCase.difficulty}
                </p>
              </div>
            </div>
          </section>

          {/* THREE PANELS */}
          <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_.9fr_.8fr] gap-5">
            {/* CONVERSATION */}
            <section className="rounded-3xl border border-slate-800 bg-slate-950/80 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex justify-between">
                <div>
                  <p className="text-xs font-bold text-white">
                    Conversation Replay
                  </p>

                  <p className="text-[10px] text-slate-500">
                    Chronological transcript
                  </p>
                </div>

                <span className="text-[10px] text-indigo-300">
                  {replayMessages.length} messages
                </span>
              </div>

              <div className="p-4 space-y-3 max-h-[560px] overflow-y-auto">
                {replayMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.sender === "agent"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl border p-3.5 ${
                        message.sender === "agent"
                          ? "border-emerald-500/20 bg-emerald-950/10"
                          : "border-slate-800 bg-slate-900/70"
                      }`}
                    >
                      <div className="flex gap-2 items-center mb-2">
                        <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-[9px] font-bold">
                          {message.sender === "agent"
                            ? "A"
                            : customerInitials}
                        </div>

                        <span className="text-[10px] font-bold text-white">
                          {message.sender === "agent"
                            ? "Agent"
                            : currentCase.customerName}
                        </span>
                      </div>

                      <p className="text-xs leading-6 text-slate-300">
                        {message.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CURRENT CUSTOMER */}
              <div className="border-t border-slate-800 p-4">
                <div className="flex justify-between mb-3">
                  <span className="text-xs font-bold text-white">
                    Current Customer Message
                  </span>

                  <span
                    className={`px-2 py-1 rounded-full text-[9px] font-bold ${
                      currentRisk >= 75
                        ? "bg-rose-500/10 text-rose-300"
                        : currentRisk >= 45
                        ? "bg-amber-500/10 text-amber-300"
                        : "bg-emerald-500/10 text-emerald-300"
                    }`}
                  >
                    Risk {currentRisk}%
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm leading-7 text-slate-200">
                  {currentTurn.customerMessage}
                </div>
              </div>

              {/* RESPONSE */}
              {!complete && (
                <form
                  onSubmit={submitResponse}
                  className="border-t border-slate-800 p-4"
                >
                  <div className="flex gap-2 mb-3">
                    <Brain className="w-4 h-4 text-indigo-400" />

                    <div>
                      <p className="text-xs font-bold text-white">
                        Your Response
                      </p>

                      <p className="text-[10px] text-slate-500">
                        Write a response and let AI evaluate it.
                      </p>
                    </div>
                  </div>

                  <textarea
                    rows={4}
                    value={draft}
                    onChange={(event) =>
                      setDraft(event.target.value)
                    }
                    placeholder="Write your response..."
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-xs text-slate-100 outline-none resize-none"
                  />

                  <button
                    type="submit"
                    disabled={!draft.trim() || busy}
                    className="mt-3 w-full inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 disabled:bg-slate-800 text-white text-xs font-bold"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}

                    Evaluate My Response
                  </button>
                </form>
              )}
            </section>

            {/* AI COACHING */}
            <section className="rounded-3xl border border-slate-800 bg-slate-950/80 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex justify-between">
                <div className="flex gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" />

                  <div>
                    <p className="text-xs font-bold text-white">
                      Real-Time Coaching
                    </p>

                    <p className="text-[10px] text-slate-500">
                      AI analysis after each customer turn
                    </p>
                  </div>
                </div>

                {busy && (
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                )}
              </div>

              {analysis ? (
                <div className="p-4 space-y-3">
                  {/* INTENT + SENTIMENT */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-indigo-500/20 p-3">
                      <p className="text-[9px] text-slate-500 uppercase">
                        Intent
                      </p>

                      <p className="text-xs font-bold text-indigo-200 mt-1">
                        {analysis.intent}
                      </p>

                      <p className="text-[9px] text-slate-600 mt-1">
                        Confidence:{" "}
                        {Math.round(
                          analysis.intentConfidence
                        )}
                        %
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-800 p-3">
                      <p className="text-[9px] text-slate-500 uppercase">
                        Sentiment
                      </p>

                      <p className="text-xs font-bold text-white mt-1 capitalize">
                        {analysis.sentiment}
                      </p>

                      <p className="text-[9px] text-slate-600 mt-1">
                        Confidence:{" "}
                        {Math.round(
                          analysis.sentimentConfidence
                        )}
                        %
                      </p>
                    </div>
                  </div>

                  {/* FRUSTRATION */}
                  <div className="rounded-2xl border border-rose-500/20 p-4">
                    <div className="flex justify-between">
                      <p className="text-[10px] text-slate-400 uppercase">
                        Frustration
                      </p>

                      <b className="text-xs text-rose-300">
                        {analysis.frustrationLevel}%
                      </b>
                    </div>

                    <div className="h-2 bg-slate-800 rounded-full mt-3">
                      <div
                        className="h-full bg-rose-500 rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              analysis.frustrationLevel
                            )
                          )}%`,
                        }}
                      />
                    </div>

                    <p className="text-[10px] text-slate-500 mt-2">
                      Trend: {analysis.frustrationTrend}
                    </p>
                  </div>

                  {/* ESCALATION */}
                  <div className="rounded-2xl border border-slate-800 p-4">
                    <div className="flex justify-between">
                      <span className="text-xs font-bold text-white">
                        Escalation Risk
                      </span>

                      <b className="text-white">
                        {currentRisk}%
                      </b>
                    </div>

                    <div className="h-2 bg-slate-800 rounded-full mt-3">
                      <div
                        className={`h-full rounded-full ${
                          currentRisk >= 75
                            ? "bg-rose-500"
                            : currentRisk >= 45
                            ? "bg-amber-400"
                            : "bg-emerald-400"
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, currentRisk)
                          )}%`,
                        }}
                      />
                    </div>

                    <p className="text-[10px] text-slate-500 mt-2">
                      Level:{" "}
                      {analysis.escalationLevel}
                    </p>

                    {analysis.riskReasons
                      .slice(0, 3)
                      .map((reason, index) => (
                        <p
                          key={index}
                          className="text-[10px] text-slate-500 mt-2"
                        >
                          • {reason}
                        </p>
                      ))}
                  </div>

                  {/* COACHING */}
                  <div className="rounded-2xl border border-violet-500/20 p-4">
                    <div className="flex gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-400" />

                      <p className="text-xs font-bold text-white">
                        Coaching Tips
                      </p>
                    </div>

                    <div className="space-y-2 mt-3">
                      {[
                        "Tone: Maintain calm language.",
                        "Empathy: Acknowledge customer frustration.",
                        "Clarity: State the next action clearly.",
                        "Professionalism: Take ownership.",
                      ].map((tip) => (
                        <div
                          key={tip}
                          className="text-[10px] text-slate-400 flex gap-2"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          {tip}
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-800">
                      <p className="text-[9px] uppercase text-violet-300">
                        AI Coach Whisper
                      </p>

                      <p className="text-[10px] leading-5 text-slate-400 mt-2">
                        {analysis.coachWhisper}
                      </p>
                    </div>

                    <div className="mt-4">
                      <p className="text-[9px] uppercase text-indigo-300">
                        Recommended Intervention
                      </p>

                      <p className="text-[10px] leading-5 text-slate-400 mt-2">
                        {analysis.recommendedIntervention}
                      </p>
                    </div>
                  </div>

                  {/* SUGGESTED RESPONSE */}
                  <div className="rounded-2xl border border-emerald-500/20 p-4">
                    <p className="text-[9px] uppercase text-emerald-300">
                      Suggested Response
                    </p>

                    <p className="text-xs leading-5 text-emerald-100 mt-2">
                      {analysis.suggestedResponse}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-500">
                  <Brain className="w-8 h-8 mx-auto text-slate-700 mb-3" />

                  {busy
                    ? "Analyzing customer turn..."
                    : "AI coaching will appear here."}
                </div>
              )}
            </section>

            {/* KNOWLEDGE */}
            <section className="rounded-3xl border border-slate-800 bg-slate-950/80 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex gap-2">
                <BookOpen className="w-4 h-4 text-cyan-400" />

                <div>
                  <p className="text-xs font-bold text-white">
                    Knowledge Recommendations
                  </p>

                  <p className="text-[10px] text-slate-500">
                    Relevant support content
                  </p>
                </div>
              </div>

              {analysis ? (
                <div className="p-4 space-y-3">
                  <div className="rounded-2xl border border-cyan-500/20 p-4">
                    <p className="text-[9px] uppercase text-cyan-300">
                      Recommended Knowledge
                    </p>

                    <h3 className="text-sm font-bold text-white mt-2">
                      {analysis.knowledgeTitle}
                    </h3>

                    <p className="text-[10px] text-slate-500 mt-1">
                      {analysis.knowledgeSection}
                    </p>

                    <p className="text-[11px] text-slate-400 leading-5 mt-3">
                      {analysis.knowledgeSnippet}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        setKnowledgeOpen(
                          (value) => !value
                        )
                      }
                      className="mt-3 text-[10px] font-bold text-cyan-300 inline-flex gap-2"
                    >
                      {knowledgeOpen
                        ? "Hide content"
                        : "View content"}

                      <ExternalLink className="w-3 h-3" />
                    </button>

                    {knowledgeOpen && (
                      <p className="text-[10px] text-slate-500 mt-3">
                        Source:{" "}
                        {analysis.knowledgeSource}
                      </p>
                    )}
                  </div>

                  {analysis.troubleshootingSteps
                    .length > 0 && (
                    <div className="rounded-2xl border border-slate-800 p-4">
                      <p className="text-xs font-bold text-white flex gap-2">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        Troubleshooting
                      </p>

                      <ol className="mt-3 space-y-2">
                        {analysis.troubleshootingSteps.map(
                          (step, index) => (
                            <li
                              key={index}
                              className="text-[10px] text-slate-400 flex gap-2"
                            >
                              <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                                {index + 1}
                              </span>

                              {step}
                            </li>
                          )
                        )}
                      </ol>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-500">
                  <BookOpen className="w-8 h-8 mx-auto text-slate-700 mb-3" />

                  Recommendations appear after analysis.
                </div>
              )}
            </section>
          </div>

          {/* RISK PROGRESSION */}
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <div className="flex gap-2 items-center">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />

                  <h3 className="text-sm font-bold text-white">
                    Escalation-Risk Progression
                  </h3>
                </div>

                <p className="text-[10px] text-slate-500 mt-1">
                  Risk across replayed customer turns
                </p>
              </div>

              <div className="flex gap-4 text-[10px] text-slate-500">
                <span>
                  Average{" "}
                  <b className="text-white">
                    {averageRisk}%
                  </b>
                </span>

                <span>
                  Peak{" "}
                  <b className="text-rose-300">
                    {peakRisk}%
                  </b>
                </span>

                <span>
                  Final{" "}
                  <b className="text-emerald-300">
                    {finalRisk}%
                  </b>
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-end gap-2 h-28">
              {Array.from({
                length: totalTurns,
              }).map((_, index) => {
                const item = riskHistory.find(
                  (riskItem) =>
                    riskItem.turn === index + 1
                );

                const value = item?.risk || 0;

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() =>
                      setTurnIndex(index)
                    }
                    className="flex-1 h-full flex flex-col justify-end gap-2"
                  >
                    <div
                      className={`w-full rounded-t-lg ${
                        value >= 75
                          ? "bg-rose-500"
                          : value >= 45
                          ? "bg-amber-400"
                          : "bg-emerald-400"
                      }`}
                      style={{
                        height: `${Math.max(
                          value,
                          4
                        )}%`,
                      }}
                    />

                    <span className="text-[9px] text-slate-600">
                      T{index + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* NAVIGATION */}
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={previousTurn}
                disabled={turnIndex === 0}
                className="inline-flex gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 text-xs disabled:opacity-30"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Previous
              </button>

              <div className="flex gap-1.5">
                {currentCase.turns.map(
                  (_, index) => (
                    <button
                      key={index}
                      type="button"
                      aria-label={`Go to turn ${
                        index + 1
                      }`}
                      onClick={() =>
                        setTurnIndex(index)
                      }
                      className={`h-1.5 rounded-full ${
                        index === turnIndex
                          ? "w-8 bg-indigo-500"
                          : reviewedTurns.includes(
                              index
                            )
                          ? "w-4 bg-emerald-500"
                          : "w-4 bg-slate-700"
                      }`}
                    />
                  )
                )}
              </div>

              <button
                type="button"
                onClick={nextTurn}
                className="inline-flex gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
              >
                {turnIndex === totalTurns - 1
                  ? "Complete Replay"
                  : "Next Turn"}

                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>

          {/* COMPLETION SUMMARY */}
          {complete && (
            <section className="rounded-3xl border border-emerald-500/25 bg-emerald-950/10 p-6">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <Award className="w-6 h-6 text-emerald-400" />
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white">
                    Replay Session Complete
                  </h3>

                  <p className="text-[11px] text-slate-500 mt-1">
                    Overall conversation replay summary
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                    {[
                      [
                        "Turns Reviewed",
                        reviewedTurns.length,
                      ],
                      [
                        "Average Risk",
                        `${averageRisk}%`,
                      ],
                      [
                        "Peak Risk",
                        `${peakRisk}%`,
                      ],
                      [
                        "Final Risk",
                        `${finalRisk}%`,
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                      >
                        <p className="text-[9px] uppercase text-slate-500">
                          {label}
                        </p>

                        <p className="text-xl font-bold text-white mt-1">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-5">
                    <button
                      type="button"
                      onClick={resetReplay}
                      className="inline-flex gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restart Replay
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setShowUpload(true)
                      }
                      className="inline-flex gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 text-xs font-semibold"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Another
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};