import { useState, useRef, useEffect, useCallback } from "react";
import { useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/use-auth";
import { captureEvent } from "@/lib/analytics";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MessageCircle,
  StickyNote,
  Send,
  Plus,
  Trash2,
  Check,
  X,
  List,
  ListOrdered,
  ListTodo,
  AlignLeft,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  ChevronLeft,
  RotateCcw,
  Share2,
  Lock,
  Users,
  ChevronRight,
  Pencil,
  BookMarked,
  Loader2,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";

type TabType = "messages" | "notes";
type MessagesView = "list" | "sage" | "group-chat";

// ─── Sage types ───────────────────────────────────────────────────────────────

interface SageConversation {
  id: number;
  userId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface SageMessage {
  id: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface MessageItem {
  id: number;
  familyId: number;
  userId: number;
  content: string;
  createdAt: string;
  senderName: string;
}

interface PersonalNoteItem {
  id: number;
  userId: number;
  title: string;
  content: string | null;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SharedNoteItem {
  id: number;
  familyId: number;
  userId: number;
  title: string;
  content: string | null;
  isCompleted: boolean;
  createdAt: string;
  creatorName: string;
}

interface FamilyInfo {
  id: number;
  name: string;
  groupType: string;
  code: string;
}

interface MessagesPreview {
  lastMessage: MessageItem | null;
  unreadCount: number;
}

const SUGGESTED_QUESTIONS = [
  "How am I doing with my budget this month?",
  "What are my biggest spending categories?",
  "Am I on track for my savings goals?",
  "How does this month compare to last month?",
  "What recurring expenses do I have?",
  "What can I cut back on to save more?",
];

// ─── Sage message renderer ────────────────────────────────────────────────────

function SageText({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return <p key={i} className="font-semibold text-base mt-2">{line.slice(3)}</p>;
        if (line.startsWith("# ")) return <p key={i} className="font-bold text-base mt-2">{line.slice(2)}</p>;
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>;
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-primary mt-0.5 shrink-0">•</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        const boldParts = line.split(/(\*\*[^*]+\*\*)/g);
        if (boldParts.length > 1) {
          return (
            <p key={i}>
              {boldParts.map((part, j) =>
                part.startsWith("**") && part.endsWith("**")
                  ? <strong key={j}>{part.slice(2, -2)}</strong>
                  : part
              )}
            </p>
          );
        }
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

// ─── Sage Tab ─────────────────────────────────────────────────────────────────

const FEEDBACK_NUDGE_AFTER = 4;

const PAGE_CONTEXT_GREETINGS: Record<string, { message: string; quickReplies: string[] }> = {
  budget: {
    message: "I can see you're looking at your budgets. I can give you a full breakdown of how you're tracking, flag any categories that are trending over, or help you think through whether your limits make sense. What would you prefer?",
    quickReplies: [
      "How am I tracking across all my budgets?",
      "Which budget am I closest to exceeding?",
      "Help me decide if my budget limits make sense",
    ],
  },
  goals: {
    message: "You're on your savings goals page. I can check how each goal is tracking, tell you if you're on pace to hit your targets, or help you prioritise which to focus on. What would you like to dig into?",
    quickReplies: [
      "Am I on track to reach my goals?",
      "Which goal should I prioritise?",
      "How much do I need to save each month to hit my goals?",
    ],
  },
  expenses: {
    message: "You're on the Money page. I can review your recent spending, flag anything unusual, or help you understand where your money is going this month. What's on your mind?",
    quickReplies: [
      "What did I spend the most on recently?",
      "Flag anything unusual in my recent spending",
      "How does this month compare to last month?",
    ],
  },
  reports: {
    message: "You're on your Reports page — a good moment to reflect. I can analyse your spending trends, compare months, or highlight patterns worth knowing about. What caught your eye?",
    quickReplies: [
      "What are my biggest spending patterns?",
      "Compare this month to last month for me",
      "What should I be paying more attention to?",
    ],
  },
};

function SageTab({
  onBack,
  initialPrompt,
  onInitialPromptHandled,
  pageContext,
  pageContextTopic,
}: {
  onBack: () => void;
  initialPrompt?: string | null;
  onInitialPromptHandled?: () => void;
  pageContext?: string | null;
  pageContextTopic?: string | null;
}) {
  const { user } = useAuth();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [inputText, setInputText] = useState("");
  const [localMessages, setLocalMessages] = useState<SageMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<number, number>>({});
  const [rememberMap, setRememberMap] = useState<Record<number, "pending" | "saved" | "skipped">>({});
  const [chatLifeStageDraft, setChatLifeStageDraft] = useState<string[]>([]);
  const [chatLifeStageSaved, setChatLifeStageSaved] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    try { return sessionStorage.getItem("sage_nudge_dismissed") === "true"; } catch { return false; }
  });
  const [nudgeSent, setNudgeSent] = useState(false);
  const [nudgeText, setNudgeText] = useState("");
  const [shareMessageId, setShareMessageId] = useState<number | null>(null);
  const [shareText, setShareText] = useState("");
  const [shareSentId, setShareSentId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: convsLoading } = useQuery<SageConversation[]>({
    queryKey: ["/api/sage/conversations"],
  });

  const { data: messages, isLoading: msgsLoading } = useQuery<SageMessage[]>({
    queryKey: ["/api/sage/conversations", activeConvId, "messages"],
    enabled: activeConvId !== null,
  });

  useEffect(() => {
    if (messages) setLocalMessages(messages);
  }, [messages]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [localMessages.length, isGenerating]);

  const resetNudge = () => {
    setNudgeSent(false);
    setNudgeText("");
  };

  const dismissNudge = () => {
    setNudgeDismissed(true);
    try { sessionStorage.setItem("sage_nudge_dismissed", "true"); } catch {}
  };

  const createConvMutation = useMutation({
    mutationFn: async (title?: string) => {
      const res = await apiRequest("POST", "/api/sage/conversations", { title });
      return res.json() as Promise<SageConversation>;
    },
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sage/conversations"] });
      setActiveConvId(conv.id);
      setLocalMessages([]);
      resetNudge();
      captureEvent("sage_conversation_created");
    },
  });

  const deleteConvMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sage/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sage/conversations"] });
      setActiveConvId(null);
      setLocalMessages([]);
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({ id, feedback }: { id: number; feedback: number }) => {
      await apiRequest("PATCH", `/api/sage/messages/${id}/feedback`, { feedback });
    },
  });

  const rememberMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      setRememberMap(prev => ({ ...prev, [id]: "pending" }));
      const res = await apiRequest("POST", "/api/sage/remember", { content });
      return res.json() as Promise<{ remembered: boolean; extracted?: string }>;
    },
    onSuccess: (data, { id }) => {
      setRememberMap(prev => ({ ...prev, [id]: data.remembered ? "saved" : "skipped" }));
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (_err, { id }) => {
      setRememberMap(prev => ({ ...prev, [id]: "skipped" }));
    },
  });

  const saveLifeStageMutation = useMutation({
    mutationFn: async (stages: string[]) => {
      const res = await apiRequest("PATCH", "/api/user/profile", { lifeStage: stages });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setChatLifeStageSaved(true);
      captureEvent("sage_life_stage_set", { stages: chatLifeStageDraft });
    },
  });

  const CHAT_LIFE_STAGE_OPTIONS = ["Student", "Employed", "Part-time worker", "Freelancer", "Parent", "Single parent", "Retired", "Between jobs"];

  const nudgeFeedbackMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/feedback", {
        group: "Sage AI – Chat Feedback",
        message,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to send");
      }
    },
    onSuccess: () => {
      setNudgeSent(true);
      captureEvent("sage_nudge_feedback_submitted");
    },
  });

  const shareToGroupMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/messages", { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/preview"] });
      setShareSentId(shareMessageId);
      setTimeout(() => {
        setShareMessageId(null);
        setShareText("");
        setShareSentId(null);
      }, 2000);
    },
  });

  const openShare = (msg: SageMessage) => {
    const plain = msg.content.replace(/[#*`_]/g, "").replace(/\n+/g, " ").trim();
    const preview = plain.length > 200 ? plain.slice(0, 200) + "…" : plain;
    setShareText(`💡 Sage says: ${preview}`);
    setShareMessageId(msg.id);
  };

  const handleSend = async (text?: string, convIdOverride?: number, isSuggested = false) => {
    const convId = convIdOverride ?? activeConvId;
    const msg = (text ?? inputText).trim();
    if (!msg || isGenerating || !convId) return;
    setInputText("");

    captureEvent("sage_message_sent", {
      is_suggested_question: isSuggested,
      message_length: msg.length,
    });

    const tempUser: SageMessage = {
      id: Date.now(),
      conversationId: convId,
      role: "user",
      content: msg,
      createdAt: new Date().toISOString(),
    };
    setLocalMessages(prev => [...prev, tempUser]);
    setIsGenerating(true);

    try {
      const res = await apiRequest("POST", `/api/sage/conversations/${convId}/messages`, { message: msg });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 || (data.message && data.message.toLowerCase().includes("daily"))) {
          captureEvent("sage_daily_limit_reached");
        }
        throw new Error(data.message || "Failed");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/sage/conversations", convId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sage/conversations"] });
      setLocalMessages(prev => {
        const withoutTemp = prev.filter(m => m.id !== tempUser.id);
        return [...withoutTemp, tempUser, data.reply];
      });
    } catch (e: any) {
      setLocalMessages(prev => prev.filter(m => m.id !== tempUser.id));
      setLocalMessages(prev => [...prev, {
        id: Date.now(),
        conversationId: convId,
        role: "assistant",
        content: e.message || "Something went wrong. Please try again.",
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFeedback = (msgId: number, feedback: number) => {
    setFeedbackMap(prev => ({ ...prev, [msgId]: feedback }));
    feedbackMutation.mutate({ id: msgId, feedback });
    captureEvent("sage_message_feedback", { feedback });
  };


  // Handle initialPrompt: create a new conversation and pre-fill the input
  useEffect(() => {
    if (!initialPrompt) return;
    let cancelled = false;
    async function setup() {
      try {
        const res = await apiRequest("POST", "/api/sage/conversations", { title: "Note question" });
        const conv: SageConversation = await res.json();
        if (cancelled) return;
        queryClient.invalidateQueries({ queryKey: ["/api/sage/conversations"] });
        setActiveConvId(conv.id);
        setLocalMessages([]);
        resetNudge();
        setInputText(initialPrompt!);
        onInitialPromptHandled?.();
      } catch {}
    }
    setup();
    return () => { cancelled = true; };
  }, [initialPrompt]);

  // Handle pageContext: auto-create a conversation and pre-fill with topic if given
  useEffect(() => {
    if (!pageContext || initialPrompt) return;
    let cancelled = false;
    async function setup() {
      try {
        const greeting = PAGE_CONTEXT_GREETINGS[pageContext!];
        const title = pageContextTopic
          ? `${pageContextTopic} (${pageContext})`
          : `From ${pageContext} page`;
        const res = await apiRequest("POST", "/api/sage/conversations", { title });
        const conv: SageConversation = await res.json();
        if (cancelled) return;
        queryClient.invalidateQueries({ queryKey: ["/api/sage/conversations"] });
        setActiveConvId(conv.id);
        resetNudge();
        if (pageContextTopic) {
          setInputText(`Tell me about my ${pageContextTopic} budget — how am I tracking?`);
        } else if (greeting) {
          setInputText("");
        }
        setLocalMessages([]);
      } catch {}
    }
    setup();
    return () => { cancelled = true; };
  }, [pageContext]);

  // ── Conversation list view ──────────────────────────────────────────────────
  if (activeConvId === null) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-background/80">
          <Button size="icon" variant="ghost" onClick={onBack} data-testid="button-back-from-sage">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">Sage</p>
              <p className="text-xs text-muted-foreground">AI Financial Advisor</p>
            </div>
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium ml-1">Beta</span>
          </div>
          <Button
            size="sm"
            onClick={() => createConvMutation.mutate(undefined)}
            disabled={createConvMutation.isPending}
            data-testid="button-new-sage-conversation"
          >
            <Plus className="w-4 h-4 mr-1" />
            New chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {convsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : (
            <>
              {/* Past conversations */}
              {conversations && conversations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide px-1">Recent chats</p>
                  {conversations.map(conv => (
                    <Card
                      key={conv.id}
                      className="p-3 cursor-pointer hover:bg-secondary/40 transition-colors flex items-center justify-between"
                      onClick={() => setActiveConvId(conv.id)}
                      data-testid={`card-sage-conversation-${conv.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Sparkles className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{conv.title}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(conv.updatedAt), "MMM d, h:mm a")}</p>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); deleteConvMutation.mutate(conv.id); }}
                        data-testid={`button-delete-sage-conv-${conv.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </Card>
                  ))}
                </div>
              )}

              {/* Life stage prompt — first time only, no life stage set */}
              {!chatLifeStageSaved && !(user as any)?.lifeStage?.length && !conversations?.length && (
                <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium">Help Sage understand your situation</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Pick what applies to you — Sage will tailor its advice accordingly. You can always update this in Settings.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CHAT_LIFE_STAGE_OPTIONS.map((option) => {
                      const selected = chatLifeStageDraft.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setChatLifeStageDraft(prev => selected ? prev.filter(s => s !== option) : [...prev, option])}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-background text-secondary-foreground border-border/50 hover:border-primary/40"}`}
                          data-testid={`button-chat-life-stage-${option.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setChatLifeStageSaved(true)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
                      data-testid="button-skip-life-stage"
                    >
                      Skip
                    </button>
                    <Button
                      size="sm"
                      onClick={() => saveLifeStageMutation.mutate(chatLifeStageDraft)}
                      disabled={chatLifeStageDraft.length === 0 || saveLifeStageMutation.isPending}
                      data-testid="button-save-chat-life-stage"
                    >
                      {saveLifeStageMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Done"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Suggested questions — always shown */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide px-1">
                  {conversations && conversations.length > 0 ? "Start something new" : "Ask Sage something"}
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={async () => {
                        captureEvent("sage_suggested_question_tapped", { question_index: i });
                        const conv = await createConvMutation.mutateAsync(q.slice(0, 60));
                        if (conv) {
                          setActiveConvId(conv.id);
                          handleSend(q, conv.id, true);
                        }
                      }}
                      className="text-left text-sm px-3 py-2.5 rounded-xl border border-border/60 hover:bg-secondary/40 hover:border-primary/30 transition-colors text-muted-foreground"
                      data-testid={`button-suggested-question-${i}`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Active conversation view ──────────────────────────────────────────────
  const currentConv = conversations?.find(c => c.id === activeConvId);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-background/80">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => { setActiveConvId(null); setLocalMessages([]); resetNudge(); onBack(); }}
          data-testid="button-back-conversations"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium truncate flex-1">{currentConv?.title || "Sage"}</span>
        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium shrink-0">Beta</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {msgsLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <Skeleton key={i} className="h-16 w-3/4 rounded-2xl" />)}
          </div>
        ) : localMessages.length === 0 ? (
          pageContext && PAGE_CONTEXT_GREETINGS[pageContext] ? (
            <div className="flex flex-col h-full py-8 px-2 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]">
                  <p className="text-sm text-secondary-foreground leading-relaxed">
                    {pageContextTopic
                      ? `You're looking at your ${pageContextTopic} budget. I can break down how you're tracking, flag trends, or help you decide if the limit makes sense. What would you like to know?`
                      : PAGE_CONTEXT_GREETINGS[pageContext].message}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 pl-11">
                {(pageContextTopic
                  ? [
                      `How am I tracking on ${pageContextTopic} this month?`,
                      `Is my ${pageContextTopic} budget realistic?`,
                      `How does my ${pageContextTopic} spending compare to last month?`,
                    ]
                  : PAGE_CONTEXT_GREETINGS[pageContext].quickReplies
                ).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => { captureEvent("sage_context_quick_reply", { pageContext, index: i }); handleSend(q, undefined, true); }}
                    className="text-left text-xs px-3 py-2.5 rounded-xl border border-border/60 hover:bg-secondary/40 hover:border-primary/30 transition-colors"
                    data-testid={`button-context-reply-${i}`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16 space-y-4">
            <Sparkles className="w-12 h-12 opacity-20" />
            <p className="font-medium">Ask Sage anything</p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
              {SUGGESTED_QUESTIONS.slice(0, 3).map((q, i) => (
                <button
                  key={i}
                  onClick={() => { captureEvent("sage_suggested_question_tapped", { question_index: i }); handleSend(q, undefined, true); }}
                  className="text-left text-xs px-3 py-2 rounded-lg border border-border/60 hover:bg-secondary/40 transition-colors"
                  data-testid={`button-quick-question-${i}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          )
        ) : (
          <>
            {localMessages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={cn("flex flex-col", isUser ? "items-end" : "items-start")}
                  data-testid={`sage-message-${msg.id}`}
                >
                  {!isUser && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium">Sage</span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] px-3.5 py-2.5 rounded-2xl break-words",
                      isUser
                        ? "bg-primary text-primary-foreground rounded-br-md text-sm"
                        : "bg-secondary text-secondary-foreground rounded-bl-md"
                    )}
                  >
                    {isUser ? msg.content : <SageText content={msg.content} />}
                  </div>
                  {!isUser && (
                    <>
                      <div className="flex items-center gap-1 mt-1 ml-1">
                        <button
                          onClick={() => handleFeedback(msg.id, 1)}
                          className={cn("p-1 rounded hover:bg-secondary transition-colors", feedbackMap[msg.id] === 1 ? "text-primary" : "text-muted-foreground")}
                          data-testid={`button-thumbs-up-${msg.id}`}
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleFeedback(msg.id, -1)}
                          className={cn("p-1 rounded hover:bg-secondary transition-colors", feedbackMap[msg.id] === -1 ? "text-destructive" : "text-muted-foreground")}
                          data-testid={`button-thumbs-down-${msg.id}`}
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </button>
                        <span className="text-[10px] text-muted-foreground ml-1">
                          {format(new Date(msg.createdAt), "h:mm a")}
                        </span>
                        {user?.familyId && (
                          <button
                            onClick={() => shareMessageId === msg.id ? setShareMessageId(null) : openShare(msg)}
                            className={cn("p-1 rounded hover:bg-secondary transition-colors ml-1", shareMessageId === msg.id ? "text-primary" : "text-muted-foreground")}
                            data-testid={`button-share-sage-${msg.id}`}
                            title="Share with group"
                          >
                            <Share2 className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (!rememberMap[msg.id]) {
                              rememberMutation.mutate({ id: msg.id, content: msg.content });
                              captureEvent("sage_remember_tapped", { msg_id: msg.id });
                            }
                          }}
                          disabled={!!rememberMap[msg.id]}
                          className={cn(
                            "p-1 rounded transition-colors ml-1",
                            rememberMap[msg.id] === "saved" ? "text-primary" : rememberMap[msg.id] === "skipped" ? "text-muted-foreground/40" : "hover:bg-secondary text-muted-foreground"
                          )}
                          data-testid={`button-remember-sage-${msg.id}`}
                          title={rememberMap[msg.id] === "saved" ? "Sage remembered this" : rememberMap[msg.id] === "skipped" ? "Not relevant for Sage context" : "Ask Sage to remember this"}
                        >
                          <BookMarked className="w-3 h-3" />
                        </button>
                      </div>
                      {shareMessageId === msg.id && (
                        <div className="mt-2 ml-1 w-[85%] rounded-xl border border-border/50 bg-background/80 p-3 space-y-2">
                          {shareSentId === msg.id ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-0.5">
                              <Check className="w-4 h-4 text-primary shrink-0" />
                              <span>Sent to group!</span>
                            </div>
                          ) : (
                            <>
                              <Textarea
                                value={shareText}
                                onChange={(e) => setShareText(e.target.value)}
                                maxHeight={120}
                                className="text-sm bg-background border-border/40 focus-visible:ring-1 rounded-lg"
                                data-testid={`textarea-share-sage-${msg.id}`}
                              />
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs text-muted-foreground h-7 px-2.5"
                                  onClick={() => { setShareMessageId(null); setShareText(""); }}
                                  data-testid={`button-cancel-share-${msg.id}`}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  className="text-xs h-7 px-3"
                                  disabled={!shareText.trim() || shareToGroupMutation.isPending}
                                  onClick={() => shareToGroupMutation.mutate(shareText.trim())}
                                  data-testid={`button-send-share-${msg.id}`}
                                >
                                  Send to group
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            {isGenerating && (
              <div className="flex items-start gap-2" data-testid="sage-generating">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                </div>
                <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            {localMessages.length >= FEEDBACK_NUDGE_AFTER && !isGenerating && !nudgeDismissed && (
              <div className="mx-1 mt-2 rounded-2xl border border-border/50 bg-secondary/30 p-3.5 space-y-2.5" data-testid="sage-feedback-nudge">
                {nudgeSent ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>Thanks — we read every message.</span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground leading-snug">
                      Got a thought while chatting with Sage? A suggestion, something off, or just a note — we're listening.
                    </p>
                    <Textarea
                      value={nudgeText}
                      onChange={(e) => setNudgeText(e.target.value)}
                      placeholder="Share a suggestion or something that could be better…"
                      maxHeight={120}
                      className="text-sm bg-background/70 border-border/40 focus-visible:ring-1 rounded-xl"
                      data-testid="textarea-sage-feedback"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-muted-foreground h-8 px-3"
                        onClick={dismissNudge}
                        data-testid="button-dismiss-sage-feedback"
                      >
                        Not now
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs h-8 px-3"
                        disabled={nudgeText.trim().length < 10 || nudgeFeedbackMutation.isPending}
                        onClick={() => nudgeFeedbackMutation.mutate(nudgeText.trim())}
                        data-testid="button-send-sage-feedback"
                      >
                        {nudgeFeedbackMutation.isPending ? <RotateCcw className="w-3 h-3 mr-1 animate-spin" /> : null}
                        Send feedback
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="border-t border-border/40 p-3 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ask Sage anything…"
            disabled={isGenerating}
            className="flex-1 rounded-full bg-secondary/50 border-0 focus-visible:ring-1"
            data-testid="input-sage-message"
          />
          <Button
            size="icon"
            onClick={() => handleSend()}
            disabled={!inputText.trim() || isGenerating}
            className="rounded-full shrink-0"
            data-testid="button-send-sage"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Group Chat Panel ─────────────────────────────────────────────────────────

function formatMessageTime(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return "Yesterday " + format(date, "h:mm a");
  return format(date, "MMM d, h:mm a");
}

function GroupChatPanel({ onBack, groupName }: { onBack: () => void; groupName: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery<MessageItem[]>({
    queryKey: ["/api/messages"],
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/messages", { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/preview"] });
      setNewMessage("");
    },
  });

  useEffect(() => {
    if (messages && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages?.length]);

  const handleSend = () => {
    if (newMessage.trim() && !sendMutation.isPending) {
      sendMutation.mutate(newMessage.trim());
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-background/80">
        <Button size="icon" variant="ghost" onClick={onBack} data-testid="button-back-from-group-chat">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">{groupName}</p>
          <p className="text-xs text-muted-foreground">Group chat</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 p-4 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={cn("flex gap-2", i % 2 === 0 ? "justify-end" : "")}>
              <Skeleton className="h-12 w-48 rounded-2xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {!messages || messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16">
              <MessageCircle className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-medium">{t("noMessages")}</p>
              <p className="text-sm mt-1">{t("startConversation")}</p>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => {
                const isOwn = msg.userId === user?.id;
                const showSender = !isOwn && (index === 0 || messages[index - 1].userId !== msg.userId);
                const showTime =
                  index === messages.length - 1 ||
                  messages[index + 1].userId !== msg.userId ||
                  new Date(messages[index + 1].createdAt).getTime() - new Date(msg.createdAt).getTime() > 300000;

                return (
                  <div
                    key={msg.id}
                    className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}
                    data-testid={`message-item-${msg.id}`}
                  >
                    {showSender && (
                      <span className="text-[11px] text-muted-foreground ml-3 mb-0.5 font-medium">
                        {msg.senderName}
                      </span>
                    )}
                    <div
                      className={cn(
                        "max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words",
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-secondary text-secondary-foreground rounded-bl-md"
                      )}
                    >
                      {msg.content}
                    </div>
                    {showTime && (
                      <span className="text-[10px] text-muted-foreground mt-0.5 mx-3 mb-2">
                        {formatMessageTime(msg.createdAt)}
                      </span>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      )}

      <div className="border-t border-border/40 p-3 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={t("typeMessage")}
            className="flex-1 rounded-full bg-secondary/50 border-0 focus-visible:ring-1"
            data-testid="input-message"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!newMessage.trim() || sendMutation.isPending}
            className="rounded-full shrink-0"
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Content parsing ──────────────────────────────────────────────────────────

type ParsedBlock =
  | { kind: "text"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "ordered"; text: string; num: number }
  | { kind: "todo"; text: string; checked: boolean; lineIdx: number };

function parseContent(raw: string | null): ParsedBlock[] {
  if (!raw) return [];
  const lines = raw.split("\n");
  let orderedCounter = 0;

  return lines.map((line, i) => {
    if (line.startsWith("- ")) {
      orderedCounter = 0;
      return { kind: "bullet", text: line.slice(2) };
    }
    if (line.startsWith("[ ] ")) {
      orderedCounter = 0;
      return { kind: "todo", text: line.slice(4), checked: false, lineIdx: i };
    }
    if (line.startsWith("[x] ")) {
      orderedCounter = 0;
      return { kind: "todo", text: line.slice(4), checked: true, lineIdx: i };
    }
    const orderedMatch = line.match(/^(\d+)\. (.*)/);
    if (orderedMatch) {
      orderedCounter++;
      return { kind: "ordered", text: orderedMatch[2], num: parseInt(orderedMatch[1]) };
    }
    orderedCounter = 0;
    return { kind: "text", text: line };
  });
}

function toggleTodoInContent(raw: string, lineIdx: number): string {
  const lines = raw.split("\n");
  const line = lines[lineIdx];
  if (line.startsWith("[ ] ")) {
    lines[lineIdx] = "[x] " + line.slice(4);
  } else if (line.startsWith("[x] ")) {
    lines[lineIdx] = "[ ] " + line.slice(4);
  }
  return lines.join("\n");
}

function detectLinePrefix(line: string): string {
  if (line.startsWith("- ") || line.startsWith("* ")) return "- ";
  if (line.startsWith("[ ] ") || line.startsWith("[x] ")) return "[ ] ";
  const m = line.match(/^(\d+)\. /);
  if (m) return `${parseInt(m[1]) + 1}. `;
  return "";
}

function stripLinePrefix(line: string): string {
  if (line.startsWith("- ") || line.startsWith("* ")) return line.slice(2);
  if (line.startsWith("[ ] ") || line.startsWith("[x] ")) return line.slice(4);
  const m = line.match(/^\d+\. (.*)/);
  if (m) return m[1];
  return line;
}

// ─── Format toolbar ───────────────────────────────────────────────────────────

type FormatType = "text" | "bullet" | "ordered" | "todo";

function applyFormatToLine(line: string, fmt: FormatType, lineNum: number): string {
  const text = stripLinePrefix(line);
  switch (fmt) {
    case "bullet": return "- " + text;
    case "ordered": return `${lineNum}. ` + text;
    case "todo": return "[ ] " + text;
    default: return text;
  }
}

function getLineRange(value: string, cursorPos: number): [number, number] {
  const lineStart = value.lastIndexOf("\n", cursorPos - 1) + 1;
  let lineEnd = value.indexOf("\n", cursorPos);
  if (lineEnd === -1) lineEnd = value.length;
  return [lineStart, lineEnd];
}

interface FormatToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
}

function FormatToolbar({ textareaRef, value, onChange }: FormatToolbarProps) {
  const applyFormat = (fmt: FormatType) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart ?? 0;
    const [lineStart, lineEnd] = getLineRange(value, cursor);
    const currentLine = value.slice(lineStart, lineEnd);

    const linesBefore = value.slice(0, lineStart).split("\n");
    const lineNum = linesBefore.length;
    const newLine = applyFormatToLine(currentLine, fmt, lineNum);
    const newValue = value.slice(0, lineStart) + newLine + value.slice(lineEnd);
    onChange(newValue);

    const newCursor = lineStart + newLine.length;
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  const tools: { fmt: FormatType; icon: React.ReactNode; label: string }[] = [
    { fmt: "text", icon: <AlignLeft className="w-4 h-4" />, label: "Plain text" },
    { fmt: "bullet", icon: <List className="w-4 h-4" />, label: "Bullet list" },
    { fmt: "ordered", icon: <ListOrdered className="w-4 h-4" />, label: "Numbered list" },
    { fmt: "todo", icon: <ListTodo className="w-4 h-4" />, label: "To-do item" },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-lg">
      {tools.map(({ fmt, icon, label }) => (
        <button
          key={fmt}
          type="button"
          title={label}
          onClick={() => applyFormat(fmt)}
          data-testid={`button-note-format-${fmt}`}
          className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

// ─── Note content renderer ────────────────────────────────────────────────────

function NoteContentRenderer({
  blocks,
  noteId,
  rawContent,
  onToggleTodo,
}: {
  blocks: ParsedBlock[];
  noteId: number;
  rawContent: string;
  onToggleTodo: (noteId: number, newContent: string) => void;
}) {
  if (blocks.length === 0) return null;
  const allEmpty = blocks.every((b) => b.text === "");
  if (allEmpty) return null;

  return (
    <div className="mt-1.5 space-y-0.5">
      {blocks.map((block, i) => {
        if (block.kind === "text") {
          if (!block.text) return <div key={i} className="h-1" />;
          return <p key={i} className="text-xs text-muted-foreground leading-relaxed">{block.text}</p>;
        }
        if (block.kind === "bullet") {
          return (
            <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <span className="text-primary mt-0.5 shrink-0 font-bold">•</span>
              <span>{block.text}</span>
            </div>
          );
        }
        if (block.kind === "ordered") {
          return (
            <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <span className="text-primary shrink-0 font-semibold tabular-nums min-w-[1.25rem]">{block.num}.</span>
              <span>{block.text}</span>
            </div>
          );
        }
        if (block.kind === "todo") {
          const handleToggle = () => {
            const newContent = toggleTodoInContent(rawContent, block.lineIdx);
            onToggleTodo(noteId, newContent);
          };
          return (
            <button
              key={i}
              type="button"
              onClick={handleToggle}
              data-testid={`button-todo-item-${noteId}-${i}`}
              className="flex items-start gap-2 text-xs text-left w-full group py-0.5"
            >
              <span className={cn(
                "mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                block.checked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40 group-hover:border-primary/60"
              )}>
                {block.checked && <Check className="w-2.5 h-2.5" />}
              </span>
              <span className={cn("text-muted-foreground transition-colors", block.checked && "line-through opacity-50")}>
                {block.text}
              </span>
            </button>
          );
        }
        return null;
      })}
    </div>
  );
}

// ─── Smart textarea ───────────────────────────────────────────────────────────

type DetectedFormat = "bullet" | "ordered" | "todo" | "text";

function detectLineFormat(line: string): DetectedFormat {
  if (line.startsWith("- ") || line.startsWith("* ")) return "bullet";
  if (line.startsWith("[ ] ") || line.startsWith("[x] ")) return "todo";
  if (/^\d+\. /.test(line)) return "ordered";
  return "text";
}

function useSmartTextarea(
  value: string,
  onChange: (v: string) => void,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
) {
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat>("text");

  const handleCursorChange = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart;
    const [lineStart, lineEnd] = getLineRange(value, cursor);
    const line = value.slice(lineStart, lineEnd);
    setDetectedFormat(detectLineFormat(line));
  }, [value, textareaRef]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = textareaRef.current;
      if (!ta) return;

      if (e.key === " ") {
        const cursor = ta.selectionStart;
        const [lineStart] = getLineRange(value, cursor);
        const beforeCursor = value.slice(lineStart, cursor);
        if (beforeCursor === "*") {
          e.preventDefault();
          const newValue = value.slice(0, lineStart) + "- " + value.slice(cursor);
          onChange(newValue);
          setTimeout(() => {
            ta.setSelectionRange(lineStart + 2, lineStart + 2);
            setDetectedFormat("bullet");
          }, 0);
          return;
        }
      }

      if (e.key !== "Enter") return;

      const cursor = ta.selectionStart;
      const [lineStart, lineEnd] = getLineRange(value, cursor);
      const currentLine = value.slice(lineStart, lineEnd);
      const prefix = detectLinePrefix(currentLine);
      const text = stripLinePrefix(currentLine);

      if (!prefix) return;

      if (!text.trim()) {
        e.preventDefault();
        const newValue = value.slice(0, lineStart) + value.slice(lineEnd);
        onChange(newValue);
        setTimeout(() => { ta.setSelectionRange(lineStart, lineStart); }, 0);
        return;
      }

      e.preventDefault();
      const insertion = "\n" + prefix;
      const newValue = value.slice(0, cursor) + insertion + value.slice(cursor);
      onChange(newValue);
      const newCursor = cursor + insertion.length;
      setTimeout(() => { ta.setSelectionRange(newCursor, newCursor); }, 0);
    },
    [value, onChange, textareaRef]
  );

  return { handleKeyDown, detectedFormat, handleCursorChange };
}

// ─── Note format badge ────────────────────────────────────────────────────────

function NoteFormatBadge({ format }: { format: DetectedFormat }) {
  if (format === "text") return null;
  const labels: Record<Exclude<DetectedFormat, "text">, string> = {
    bullet: "Bullet list",
    ordered: "Numbered list",
    todo: "To-do item",
  };
  return (
    <span
      className="inline-flex items-center text-[10px] font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5 transition-opacity"
      data-testid="badge-note-format"
    >
      {labels[format]}
    </span>
  );
}

// ─── Note preview strip ───────────────────────────────────────────────────────

function NotePreviewStrip({ value }: { value: string }) {
  const blocks = parseContent(value);
  const hasListBlock = blocks.some(b => b.kind !== "text");
  if (!hasListBlock) return null;

  return (
    <div className="bg-muted/40 rounded-lg px-3 pt-3 pb-1" data-testid="note-preview-strip">
      <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide mb-0.5">Preview</p>
      <NoteContentRenderer
        blocks={blocks}
        noteId={0}
        rawContent={value}
        onToggleTodo={() => {}}
      />
    </div>
  );
}

// ─── Note editor with live preview ───────────────────────────────────────────

function NoteEditorWithPreview({
  textareaRef,
  value,
  onChange,
  onKeyDown,
  placeholder,
  testId,
  hint,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  testId?: string;
  hint?: string;
}) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"write" | "preview">(() => {
    try {
      const stored = localStorage.getItem("note-editor-mode");
      return stored === "preview" ? "preview" : "write";
    } catch {
      return "write";
    }
  });

  const handleSetMode = (newMode: "write" | "preview") => {
    setMode(newMode);
    try { localStorage.setItem("note-editor-mode", newMode); } catch {}
  };

  const previewBlocks = parseContent(value);
  const hasContent = value.trim().length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <FormatToolbar textareaRef={textareaRef} value={value} onChange={onChange} />
        </div>
        <div className="flex rounded-md border border-border overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => handleSetMode("write")}
            data-testid={testId ? `${testId}-tab-write` : "tab-write"}
            className={cn(
              "px-2.5 py-1 text-xs transition-colors font-medium",
              mode === "write" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
            )}
          >
            {t("noteEditorWrite")}
          </button>
          <button
            type="button"
            onClick={() => handleSetMode("preview")}
            data-testid={testId ? `${testId}-tab-preview` : "tab-preview"}
            className={cn(
              "px-2.5 py-1 text-xs transition-colors font-medium",
              mode === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
            )}
          >
            {t("noteEditorPreview")}
          </button>
        </div>
      </div>

      {mode === "write" ? (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="font-mono text-sm"
          data-testid={testId}
        />
      ) : (
        <div
          className="min-h-[80px] rounded-md border border-border p-3 bg-muted/30"
          data-testid={testId ? `${testId}-preview` : "note-preview"}
        >
          {!hasContent ? (
            <p className="text-sm text-muted-foreground/50 italic">{t("noteEditorEmptyPreview")}</p>
          ) : (
            <NoteContentRenderer
              blocks={previewBlocks}
              noteId={-1}
              rawContent={value}
              onToggleTodo={(_, newContent) => onChange(newContent)}
            />
          )}
        </div>
      )}

      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Personal Note Card ───────────────────────────────────────────────────────

function PersonalNoteCard({
  note,
  onToggleNote,
  onDelete,
  onUpdate,
  onToggleTodo,
  onAskSage,
  onShareToGroup,
  hasGroup,
}: {
  note: PersonalNoteItem;
  onToggleNote: () => void;
  onDelete: () => void;
  onUpdate: (id: number, title: string, content: string) => void;
  onToggleTodo: (noteId: number, newContent: string) => void;
  onAskSage: (note: PersonalNoteItem) => void;
  onShareToGroup: (note: PersonalNoteItem) => Promise<void>;
  hasGroup: boolean;
}) {
  const [localContent, setLocalContent] = useState(note.content);
  const [shareSent, setShareSent] = useState(false);
  const [shareError, setShareError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title);
  const [editContent, setEditContent] = useState(note.content ?? "");
  const editContentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setLocalContent(note.content); }, [note.content]);

  const { handleKeyDown: handleEditSmartKeyDown, detectedFormat: editDetectedFormat, handleCursorChange: handleEditCursorChange } = useSmartTextarea(editContent, setEditContent, editContentRef);

  const blocks = parseContent(localContent);

  const handleShareToGroup = async () => {
    setShareError(false);
    try {
      await onShareToGroup(note);
      setShareSent(true);
      setTimeout(() => setShareSent(false), 3000);
    } catch {
      setShareError(true);
      setTimeout(() => setShareError(false), 3000);
    }
  };

  const handleSaveEdit = () => {
    if (!editTitle.trim()) return;
    onUpdate(note.id, editTitle.trim(), editContent);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(note.title);
    setEditContent(note.content ?? "");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Card className="p-4" data-testid={`personal-note-card-${note.id}`}>
        <div className="space-y-2">
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Note title"
            className="text-sm font-medium"
            data-testid={`input-edit-personal-note-title-${note.id}`}
          />
          <NoteEditorWithPreview
            textareaRef={editContentRef}
            value={editContent}
            onChange={setEditContent}
            onKeyDown={handleEditSmartKeyDown}
            placeholder="Note content (optional)"
            testId={`textarea-edit-personal-note-content-${note.id}`}
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={handleCancelEdit} data-testid={`button-cancel-edit-personal-note-${note.id}`}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={!editTitle.trim()} data-testid={`button-save-edit-personal-note-${note.id}`}>
              Save
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn("p-4 transition-all", note.isCompleted && "opacity-60")}
      data-testid={`personal-note-card-${note.id}`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onToggleNote}
          className={cn(
            "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
            note.isCompleted
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground/30 hover:border-primary/50"
          )}
          title={note.isCompleted ? "Mark as active" : "Mark note as done"}
          data-testid={`button-toggle-personal-note-${note.id}`}
        >
          {note.isCompleted && <Check className="w-3 h-3" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1.5">
            <Lock className="w-3 h-3 text-muted-foreground/50 mt-0.5 shrink-0" />
            <p className={cn("font-medium text-sm", note.isCompleted && "line-through text-muted-foreground")}>
              {note.title}
            </p>
          </div>

          {blocks.length > 0 && (
            <NoteContentRenderer
              blocks={blocks}
              noteId={note.id}
              rawContent={localContent ?? ""}
              onToggleTodo={(noteId, newContent) => {
                setLocalContent(newContent);
                onToggleTodo(noteId, newContent);
              }}
            />
          )}

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(note.createdAt), "MMM d")}
            </span>
            <button
              onClick={() => onAskSage(note)}
              className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
              data-testid={`button-ask-sage-note-${note.id}`}
            >
              <Sparkles className="w-3 h-3" />
              Ask Sage
            </button>
            {hasGroup && (
              shareSent ? (
                <span className="flex items-center gap-1 text-[10px] text-primary">
                  <Check className="w-3 h-3" />
                  Shared!
                </span>
              ) : shareError ? (
                <span className="text-[10px] text-destructive">Failed to share</span>
              ) : (
                <button
                  onClick={handleShareToGroup}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  data-testid={`button-share-personal-note-${note.id}`}
                >
                  <Share2 className="w-3 h-3" />
                  Share to group
                </button>
              )
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => { setEditTitle(note.title); setEditContent(note.content ?? ""); setIsEditing(true); }}
            className="text-muted-foreground hover:text-foreground w-7 h-7"
            data-testid={`button-edit-personal-note-${note.id}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive w-7 h-7"
            data-testid={`button-delete-personal-note-${note.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── Shared Note Card ─────────────────────────────────────────────────────────

function SharedNoteCard({
  note,
  currentUserId,
  onToggleNote,
  onDelete,
  onUpdate,
  onToggleTodo,
  t,
}: {
  note: SharedNoteItem;
  currentUserId?: number;
  onToggleNote: () => void;
  onDelete: () => void;
  onUpdate: (noteId: number, title: string, content: string) => void;
  onToggleTodo: (noteId: number, newContent: string) => void;
  t: (key: any) => string;
}) {
  const [localContent, setLocalContent] = useState(note.content);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title);
  const [editContent, setEditContent] = useState(note.content ?? "");
  const editContentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setLocalContent(note.content); }, [note.content]);

  const { handleKeyDown: handleEditSmartKeyDown, detectedFormat: editDetectedFormat, handleCursorChange: handleEditCursorChange } =
    useSmartTextarea(editContent, setEditContent, editContentRef);

  const blocks = parseContent(localContent);

  const isCreator = currentUserId === note.userId;

  const handleSaveEdit = () => {
    if (!editTitle.trim()) return;
    onUpdate(note.id, editTitle.trim(), editContent);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(note.title);
    setEditContent(note.content ?? "");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Card className="p-4" data-testid={`shared-note-card-${note.id}`}>
        <div className="space-y-2">
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Note title"
            className="text-sm font-medium"
            data-testid={`input-edit-shared-note-title-${note.id}`}
          />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <FormatToolbar textareaRef={editContentRef} value={editContent} onChange={setEditContent} />
              <NoteFormatBadge format={editDetectedFormat} />
            </div>
            <Textarea
              ref={editContentRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleEditSmartKeyDown}
              onKeyUp={handleEditCursorChange}
              onSelect={handleEditCursorChange}
              placeholder="Note content (optional)"
              className="text-sm font-mono min-h-[80px]"
              data-testid={`textarea-edit-shared-note-content-${note.id}`}
            />
            <NotePreviewStrip value={editContent} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={handleCancelEdit} data-testid={`button-cancel-edit-shared-note-${note.id}`}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={!editTitle.trim()} data-testid={`button-save-edit-shared-note-${note.id}`}>
              Save
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn("p-4 transition-all", note.isCompleted && "opacity-60")}
      data-testid={`note-card-${note.id}`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onToggleNote}
          className={cn(
            "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
            note.isCompleted
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground/30 hover:border-primary/50"
          )}
          title={note.isCompleted ? "Mark as active" : "Mark note as done"}
          data-testid={`button-toggle-note-${note.id}`}
        >
          {note.isCompleted && <Check className="w-3 h-3" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={cn("font-medium text-sm", note.isCompleted && "line-through text-muted-foreground")}>
            {note.title}
          </p>

          {blocks.length > 0 && (
            <NoteContentRenderer
              blocks={blocks}
              noteId={note.id}
              rawContent={localContent ?? ""}
              onToggleTodo={(noteId, newContent) => {
                setLocalContent(newContent);
                onToggleTodo(noteId, newContent);
              }}
            />
          )}

          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-muted-foreground">{t("by")} {note.creatorName}</span>
            <span className="text-[10px] text-muted-foreground">{format(new Date(note.createdAt), "MMM d")}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          {isCreator && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => { setEditTitle(note.title); setEditContent(note.content ?? ""); setIsEditing(true); }}
              className="text-muted-foreground hover:text-foreground w-7 h-7"
              data-testid={`button-edit-shared-note-${note.id}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            className="shrink-0 text-muted-foreground hover:text-destructive w-7 h-7"
            data-testid={`button-delete-note-${note.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────

type NotesView = "list" | "personal" | "personal-detail" | "shared" | "shared-detail";

function NotesTab({
  onAskSage,
}: {
  onAskSage: (prompt: string) => void;
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const hasGroup = !!user?.familyId;

  const [notesView, setNotesView] = useState<NotesView>("list");
  const [selectedPersonalId, setSelectedPersonalId] = useState<number | null>(null);
  const [selectedSharedId, setSelectedSharedId] = useState<number | null>(null);

  const [showAddPersonalForm, setShowAddPersonalForm] = useState(false);
  const [showGuidedQuestions, setShowGuidedQuestions] = useState(false);
  const [newPersonalTitle, setNewPersonalTitle] = useState("");
  const [newPersonalContent, setNewPersonalContent] = useState("");
  const personalContentRef = useRef<HTMLTextAreaElement>(null);

  const [showAddSharedForm, setShowAddSharedForm] = useState(false);
  const [newSharedTitle, setNewSharedTitle] = useState("");
  const [newSharedContent, setNewSharedContent] = useState("");
  const sharedContentRef = useRef<HTMLTextAreaElement>(null);

  const { data: personalNotesList, isLoading: personalLoading } = useQuery<PersonalNoteItem[]>({
    queryKey: ["/api/personal-notes"],
  });

  const { data: sharedNotesList, isLoading: sharedLoading } = useQuery<SharedNoteItem[]>({
    queryKey: ["/api/notes"],
    enabled: hasGroup,
  });

  const { data: intentionPrompt } = useQuery<any>({
    queryKey: ["/api/intention-prompt"],
    enabled: !!user,
  });
  const [intentionNoteDraft, setIntentionNoteDraft] = useState("");
  const [showIntentionCapture, setShowIntentionCapture] = useState(false);
  const userHasIntention = !!(user as any)?.onboardingIntention;
  const showIntentionBanner = !userHasIntention && intentionPrompt?.status !== "completed";

  const saveIntentionMutation = useMutation({
    mutationFn: async (intention: string) => {
      await apiRequest("PATCH", "/api/user/profile", { onboardingIntention: intention });
      await apiRequest("POST", "/api/intention-prompt", { status: "completed" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/intention-prompt"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setShowIntentionCapture(false);
      setIntentionNoteDraft("");
    },
  });

  const createPersonalMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      const res = await apiRequest("POST", "/api/personal-notes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personal-notes"] });
      setNewPersonalTitle("");
      setNewPersonalContent("");
      setShowAddPersonalForm(false);
    },
  });

  const togglePersonalMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: number; isCompleted: boolean }) => {
      const res = await apiRequest("PATCH", `/api/personal-notes/${id}`, { isCompleted });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/personal-notes"] }),
  });

  const updatePersonalContentMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const res = await apiRequest("PATCH", `/api/personal-notes/${id}`, { content });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/personal-notes"] }),
  });

  const updatePersonalNoteMutation = useMutation({
    mutationFn: async ({ id, title, content }: { id: number; title: string; content: string }) => {
      const res = await apiRequest("PATCH", `/api/personal-notes/${id}`, { title, content });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/personal-notes"] }),
  });

  const deletePersonalMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/personal-notes/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/personal-notes"] }),
  });

  const shareToGroupMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/messages", { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/preview"] });
    },
  });

  const createSharedMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      const res = await apiRequest("POST", "/api/notes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setNewSharedTitle("");
      setNewSharedContent("");
      setShowAddSharedForm(false);
    },
  });

  const toggleSharedMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: number; isCompleted: boolean }) => {
      const res = await apiRequest("PATCH", `/api/notes/${id}`, { isCompleted });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notes"] }),
  });

  const updateSharedContentMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const res = await apiRequest("PATCH", `/api/notes/${id}`, { content });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notes"] }),
  });

  const updateSharedNoteMutation = useMutation({
    mutationFn: async ({ id, title, content }: { id: number; title: string; content: string }) => {
      const res = await apiRequest("PATCH", `/api/notes/${id}`, { title, content });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notes"] }),
  });

  const deleteSharedMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/notes/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notes"] }),
  });

  const { handleKeyDown: handlePersonalSmartKeyDown, detectedFormat: personalDetectedFormat, handleCursorChange: handlePersonalCursorChange } = useSmartTextarea(newPersonalContent, setNewPersonalContent, personalContentRef);
  const { handleKeyDown: handleSharedSmartKeyDown, detectedFormat: sharedDetectedFormat, handleCursorChange: handleSharedCursorChange } = useSmartTextarea(newSharedContent, setNewSharedContent, sharedContentRef);

  const handleAskSage = (note: PersonalNoteItem) => {
    const prompt = note.content
      ? `About my note "${note.title}": ${note.content}`
      : `Help me think about: "${note.title}"`;
    onAskSage(prompt);
  };

  const handleShareToGroup = async (note: PersonalNoteItem): Promise<void> => {
    const content = note.content
      ? `📝 ${note.title}\n${note.content}`
      : `📝 ${note.title}`;
    await shareToGroupMutation.mutateAsync(content);
  };

  const activePersonal = personalNotesList?.filter(n => !n.isCompleted) || [];
  const completedPersonal = personalNotesList?.filter(n => n.isCompleted) || [];
  const activeShared = sharedNotesList?.filter(n => !n.isCompleted) || [];
  const completedShared = sharedNotesList?.filter(n => n.isCompleted) || [];

  const selectedPersonalNote = personalNotesList?.find(n => n.id === selectedPersonalId) ?? null;
  const selectedSharedNote = sharedNotesList?.find(n => n.id === selectedSharedId) ?? null;

  // ─── NOTES FOLDER LIST ─────────────────────────────────────────────────────
  if (notesView === "list") {
    return (
      <div className="flex-1 overflow-y-auto">
        <button
          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/40 transition-colors border-b border-border/30"
          onClick={() => setNotesView("personal")}
          data-testid="button-open-personal-notes"
        >
          <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Personal Notes</span>
              <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">Private</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {personalLoading ? "Loading…" : activePersonal.length > 0
                ? `${activePersonal.length} active note${activePersonal.length !== 1 ? "s" : ""}`
                : "Your private planning notes"}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>

        {hasGroup ? (
          <button
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/40 transition-colors border-b border-border/30"
            onClick={() => setNotesView("shared")}
            data-testid="button-open-shared-notes"
          >
            <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">Shared Notes</span>
                <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">Group</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {sharedLoading ? "Loading…" : activeShared.length > 0
                  ? `${activeShared.length} active note${activeShared.length !== 1 ? "s" : ""}`
                  : "Shopping lists, to-dos and shared plans"}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ) : (
          <div className="p-6 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No group yet</p>
            <p className="text-xs mt-1">Create or join a group to access shared notes</p>
          </div>
        )}
      </div>
    );
  }

  // ─── PERSONAL NOTES LIST ───────────────────────────────────────────────────
  if (notesView === "personal") {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-background/80">
          <Button
            size="icon" variant="ghost"
            onClick={() => { setNotesView("list"); setShowAddPersonalForm(false); }}
            data-testid="button-back-from-personal-notes"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Lock className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm flex-1">Personal Notes</span>
          <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">Private</span>
          <Button
            size="sm" variant="ghost" className="h-8 text-xs ml-1"
            onClick={() => setShowAddPersonalForm(!showAddPersonalForm)}
            data-testid="button-add-personal-note"
          >
            {showAddPersonalForm ? <X className="w-3.5 h-3.5 mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
            {showAddPersonalForm ? "Cancel" : "Add"}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {showIntentionBanner && !showIntentionCapture && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-primary mb-0.5">Set your intention</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">In 3 months, what would have to be true about your finances for you to feel like this was worth it? Sage will track your progress against this.</p>
                </div>
                <button onClick={() => apiRequest("POST", "/api/intention-prompt", { status: "snoozed" }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/intention-prompt"] }))} className="text-muted-foreground hover:text-foreground shrink-0" data-testid="button-dismiss-intention-banner">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <Button size="sm" className="w-full h-8 text-xs" onClick={() => setShowIntentionCapture(true)} data-testid="button-open-intention-capture">
                Write my intention
              </Button>
            </div>
          )}
          {showIntentionCapture && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-primary">Your financial intention</p>
              <Textarea
                value={intentionNoteDraft}
                onChange={(e) => setIntentionNoteDraft(e.target.value)}
                placeholder="e.g. I want to stop feeling like money just disappears every month…"
                maxLength={500}
                maxHeight={200}
                className="px-3 py-2 rounded-lg border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/60 min-h-[60px]"
                data-testid="input-notes-intention-draft"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => setShowIntentionCapture(false)}>Cancel</Button>
                <Button size="sm" className="flex-1 h-8 text-xs" disabled={!intentionNoteDraft.trim() || saveIntentionMutation.isPending} onClick={() => saveIntentionMutation.mutate(intentionNoteDraft.trim())} data-testid="button-save-intention-note">Save</Button>
              </div>
            </div>
          )}
          {showAddPersonalForm && (
            <Card className="p-4 space-y-3">
              <div>
                <button
                  type="button"
                  onClick={() => setShowGuidedQuestions(v => !v)}
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium uppercase tracking-wide hover:text-primary transition-colors"
                  data-testid="button-toggle-guided-questions"
                >
                  <ChevronRight className={cn("w-3 h-3 transition-transform", showGuidedQuestions && "rotate-90")} />
                  Questions to inspire your note
                </button>
                {showGuidedQuestions && (
                  <div className="mt-2 space-y-1">
                    {[
                      "What am I saving up for right now?",
                      "What was my biggest unnecessary expense lately?",
                      "What financial habit am I working on this month?",
                      "What recurring costs should I review or cut?",
                      "What's coming up financially that I need to plan for?",
                      "What was an unexpected expense I want to remember?",
                      "What do I want to change about my spending?",
                      "What am I proud of financially this month?",
                      "When does my income usually arrive, and what do I do first?",
                      "What's my financial goal for next month?",
                      "Has what I want from my finances changed since I started using this app?",
                    ].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => { setNewPersonalTitle(q); setShowGuidedQuestions(false); }}
                        className="w-full text-left text-xs bg-secondary/60 hover:bg-primary/10 hover:text-primary px-3 py-2 rounded-lg transition-colors"
                        data-testid={`button-guided-question-${q.slice(0, 20).replace(/\s/g, "-")}`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Input
                value={newPersonalTitle}
                onChange={(e) => setNewPersonalTitle(e.target.value)}
                placeholder="Note title…"
                data-testid="input-personal-note-title"
              />
              <NoteEditorWithPreview
                textareaRef={personalContentRef}
                value={newPersonalContent}
                onChange={setNewPersonalContent}
                onKeyDown={handlePersonalSmartKeyDown}
                placeholder="Note content (optional)…"
                testId="input-personal-note-content"
              />
              <Button
                onClick={() => { if (newPersonalTitle.trim()) createPersonalMutation.mutate({ title: newPersonalTitle.trim(), content: newPersonalContent.trim() }); }}
                disabled={!newPersonalTitle.trim() || createPersonalMutation.isPending}
                className="w-full rounded-xl"
                data-testid="button-save-personal-note"
              >
                {t("save")}
              </Button>
            </Card>
          )}

          {personalLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : activePersonal.length === 0 && completedPersonal.length === 0 && !showAddPersonalForm ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed border-border/50 rounded-xl">
              <Lock className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm font-medium">No personal notes yet</p>
              <p className="text-xs mt-1">Tap Add to write your first note</p>
            </div>
          ) : (
            <>
              {activePersonal.map(note => (
                <button
                  key={note.id}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-secondary/30 transition-colors text-left"
                  onClick={() => { setSelectedPersonalId(note.id); setNotesView("personal-detail"); }}
                  data-testid={`button-personal-note-${note.id}`}
                >
                  <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{note.title}</p>
                    {note.content && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{note.content.replace(/[#*`_\[\]]/g, "").slice(0, 60)}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">{format(new Date(note.createdAt), "MMM d")}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </button>
              ))}
              {completedPersonal.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide px-1">Done ({completedPersonal.length})</p>
                  {completedPersonal.map(note => (
                    <button
                      key={note.id}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/50 hover:bg-secondary/30 transition-colors text-left opacity-60"
                      onClick={() => { setSelectedPersonalId(note.id); setNotesView("personal-detail"); }}
                      data-testid={`button-personal-note-done-${note.id}`}
                    >
                      <div className="w-4 h-4 rounded-full bg-primary border-primary border-2 flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-primary-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground line-through truncate flex-1">{note.title}</p>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── PERSONAL NOTE DETAIL ──────────────────────────────────────────────────
  if (notesView === "personal-detail" && selectedPersonalNote) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-background/80">
          <Button
            size="icon" variant="ghost"
            onClick={() => { setNotesView("personal"); setSelectedPersonalId(null); }}
            data-testid="button-back-from-personal-note-detail"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold flex-1 truncate">Personal Note</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <PersonalNoteCard
            note={selectedPersonalNote}
            onToggleNote={() => togglePersonalMutation.mutate({ id: selectedPersonalNote.id, isCompleted: !selectedPersonalNote.isCompleted })}
            onDelete={() => { deletePersonalMutation.mutate(selectedPersonalNote.id); setNotesView("personal"); setSelectedPersonalId(null); }}
            onUpdate={(id, title, content) => updatePersonalNoteMutation.mutate({ id, title, content })}
            onToggleTodo={(id, content) => updatePersonalContentMutation.mutate({ id, content })}
            onAskSage={handleAskSage}
            onShareToGroup={handleShareToGroup}
            hasGroup={hasGroup}
          />
        </div>
      </div>
    );
  }

  // ─── SHARED NOTES LIST ─────────────────────────────────────────────────────
  if (notesView === "shared") {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-background/80">
          <Button
            size="icon" variant="ghost"
            onClick={() => { setNotesView("list"); setShowAddSharedForm(false); }}
            data-testid="button-back-from-shared-notes"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm flex-1">Shared Notes</span>
          <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">Group</span>
          <Button
            size="sm" variant="ghost" className="h-8 text-xs ml-1"
            onClick={() => setShowAddSharedForm(!showAddSharedForm)}
            data-testid="button-add-note"
          >
            {showAddSharedForm ? <X className="w-3.5 h-3.5 mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
            {showAddSharedForm ? "Cancel" : "Add"}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {showIntentionBanner && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-primary mb-0.5">Add your voice</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">What's your reason for tracking finances together? Sage uses everyone's answers to give the whole group more balanced guidance.</p>
                </div>
              </div>
              <Button size="sm" className="w-full h-8 text-xs" onClick={() => { setNotesView("personal"); setShowIntentionCapture(true); }} data-testid="button-shared-intention-cta">
                Share my intention
              </Button>
            </div>
          )}
          {showAddSharedForm && (
            <Card className="p-4 space-y-3">
              <Input
                value={newSharedTitle}
                onChange={(e) => setNewSharedTitle(e.target.value)}
                placeholder={t("noteTitlePlaceholder")}
                data-testid="input-note-title"
              />
              <NoteEditorWithPreview
                textareaRef={sharedContentRef}
                value={newSharedContent}
                onChange={setNewSharedContent}
                onKeyDown={handleSharedSmartKeyDown}
                placeholder={t("noteContentPlaceholder")}
                testId="input-note-content"
                hint="Use the toolbar above to add bullets, numbered lists, or to-do items."
              />
              <Button
                onClick={() => { if (newSharedTitle.trim()) createSharedMutation.mutate({ title: newSharedTitle.trim(), content: newSharedContent.trim() }); }}
                disabled={!newSharedTitle.trim() || createSharedMutation.isPending}
                className="w-full rounded-xl"
                data-testid="button-save-note"
              >
                {t("save")}
              </Button>
            </Card>
          )}

          {sharedLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : activeShared.length === 0 && completedShared.length === 0 && !showAddSharedForm ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed border-border/50 rounded-xl">
              <Users className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm font-medium">{t("noNotes")}</p>
              <p className="text-xs mt-1">{t("addFirstNote")}</p>
            </div>
          ) : (
            <>
              {activeShared.map(note => (
                <button
                  key={note.id}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-secondary/30 transition-colors text-left"
                  onClick={() => { setSelectedSharedId(note.id); setNotesView("shared-detail"); }}
                  data-testid={`button-shared-note-${note.id}`}
                >
                  <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{note.title}</p>
                    {note.content && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{note.content.replace(/[#*`_\[\]]/g, "").slice(0, 60)}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">{format(new Date(note.createdAt), "MMM d")}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </button>
              ))}
              {completedShared.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide px-1">{t("statusCompleted")} ({completedShared.length})</p>
                  {completedShared.map(note => (
                    <button
                      key={note.id}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/50 hover:bg-secondary/30 transition-colors text-left opacity-60"
                      onClick={() => { setSelectedSharedId(note.id); setNotesView("shared-detail"); }}
                      data-testid={`button-shared-note-done-${note.id}`}
                    >
                      <div className="w-4 h-4 rounded-full bg-primary border-primary border-2 flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-primary-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground line-through truncate flex-1">{note.title}</p>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── SHARED NOTE DETAIL ────────────────────────────────────────────────────
  if (notesView === "shared-detail" && selectedSharedNote) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-background/80">
          <Button
            size="icon" variant="ghost"
            onClick={() => { setNotesView("shared"); setSelectedSharedId(null); }}
            data-testid="button-back-from-shared-note-detail"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold flex-1 truncate">Shared Note</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <SharedNoteCard
            note={selectedSharedNote}
            currentUserId={user?.id}
            onToggleNote={() => toggleSharedMutation.mutate({ id: selectedSharedNote.id, isCompleted: !selectedSharedNote.isCompleted })}
            onDelete={() => { deleteSharedMutation.mutate(selectedSharedNote.id); setNotesView("shared"); setSelectedSharedId(null); }}
            onUpdate={(id, title, content) => updateSharedNoteMutation.mutate({ id, title, content })}
            onToggleTodo={(id, content) => updateSharedContentMutation.mutate({ id, content })}
            t={t}
          />
        </div>
      </div>
    );
  }

  return null;
}

// ─── Messages Conversation List ───────────────────────────────────────────────

function MessagesConversationList({
  onOpenSage,
  onOpenGroupChat,
}: {
  onOpenSage: () => void;
  onOpenGroupChat: () => void;
}) {
  const { user } = useAuth();
  const hasGroup = !!user?.familyId;

  const { data: preview } = useQuery<MessagesPreview>({
    queryKey: ["/api/messages/preview"],
    enabled: hasGroup,
    refetchInterval: hasGroup ? 10000 : false,
  });

  const { data: familyInfo } = useQuery<FamilyInfo>({
    queryKey: ["/api/family/info"],
    enabled: hasGroup,
  });

  const lastMsg = preview?.lastMessage;
  const unreadCount = preview?.unreadCount ?? 0;
  const groupName = familyInfo?.name ?? "Group Chat";

  const lastMsgTime = lastMsg ? (() => {
    const d = new Date(lastMsg.createdAt);
    if (isToday(d)) return format(d, "h:mm a");
    if (isYesterday(d)) return "Yesterday";
    return format(d, "MMM d");
  })() : null;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Sage AI row — always first */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/40 transition-colors border-b border-border/30"
        onClick={onOpenSage}
        data-testid="button-open-sage-chat"
      >
        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Sage AI</span>
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">Beta</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">AI Financial Advisor</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      {/* Group Chat row — group users only */}
      {hasGroup && (
        <button
          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/40 transition-colors border-b border-border/30"
          onClick={onOpenGroupChat}
          data-testid="button-open-group-chat"
        >
          <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm truncate">{groupName}</span>
              {lastMsgTime && (
                <span className="text-[11px] text-muted-foreground shrink-0">{lastMsgTime}</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground truncate">
                {lastMsg ? lastMsg.content : "No messages yet — say hello!"}
              </p>
              {unreadCount > 0 && (
                <Badge className="h-5 min-w-5 px-1.5 text-[10px] shrink-0 bg-primary text-primary-foreground" data-testid="badge-unread-count">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
      )}

      {/* Solo user join prompt */}
      {!hasGroup && (
        <div className="p-6 text-center text-muted-foreground">
          <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">No group yet</p>
          <p className="text-xs mt-1">Create or join a group to chat with your household</p>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("messages");
  const [messagesView, setMessagesView] = useState<MessagesView>("list");
  const [pendingSagePrompt, setPendingSagePrompt] = useState<string | null>(null);
  const [pendingPageContext, setPendingPageContext] = useState<string | null>(null);
  const [pendingPageContextTopic, setPendingPageContextTopic] = useState<string | null>(null);

  const isSolo = !((user as any)?.familyId);
  const search = useSearch();

  // Read URL params for context-awareness (e.g. opened from Budget page or push notification).
  // Runs on mount and whenever search changes so NAVIGATE messages from the service worker
  // work correctly when this page is already open.
  useEffect(() => {
    const params = new URLSearchParams(search);
    const tab = params.get("tab");
    const sageContext = params.get("sageContext");
    const topic = params.get("topic");
    const q = params.get("q");
    const url = new URL(window.location.href);
    if (tab === "notes") {
      setActiveTab("notes");
      url.searchParams.delete("tab");
      window.history.replaceState({}, "", url.toString());
    } else if (sageContext) {
      setActiveTab("messages");
      setMessagesView("sage");
      setPendingPageContext(sageContext);
      if (topic) setPendingPageContextTopic(topic);
      if (q) setPendingSagePrompt(q);
      url.searchParams.delete("sageContext");
      url.searchParams.delete("topic");
      url.searchParams.delete("q");
      window.history.replaceState({}, "", url.toString());
    }
  }, [search]);

  const handleAskSageFromNote = (prompt: string) => {
    setPendingSagePrompt(prompt);
    setActiveTab("messages");
    setMessagesView("sage");
  };

  const { data: familyInfo } = useQuery<FamilyInfo>({
    queryKey: ["/api/family/info"],
    enabled: !isSolo,
  });

  return (
    <div
      className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-2rem)] -m-4 md:-m-8"
      data-tutorial="messages-area"
    >
      {/* 2-tab pill */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-xl">
          <button
            onClick={() => setActiveTab("messages")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
              activeTab === "messages"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground"
            )}
            data-testid="tab-messages"
          >
            <MessageCircle className="w-4 h-4" />
            {t("messages")}
          </button>
          <button
            onClick={() => setActiveTab("notes")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
              activeTab === "notes"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground"
            )}
            data-testid="tab-notes"
          >
            <StickyNote className="w-4 h-4" />
            Notes
          </button>
        </div>
      </div>

      {/* Messages tab */}
      {activeTab === "messages" && (
        <>
          {messagesView === "list" && (
            <MessagesConversationList
              onOpenSage={() => { captureEvent("sage_tab_opened"); setMessagesView("sage"); }}
              onOpenGroupChat={() => setMessagesView("group-chat")}
            />
          )}
          {messagesView === "sage" && (
            <SageTab
              onBack={() => setMessagesView("list")}
              initialPrompt={pendingSagePrompt}
              onInitialPromptHandled={() => setPendingSagePrompt(null)}
              pageContext={pendingPageContext}
              pageContextTopic={pendingPageContextTopic}
            />
          )}
          {messagesView === "group-chat" && (
            <GroupChatPanel
              onBack={() => setMessagesView("list")}
              groupName={familyInfo?.name ?? "Group Chat"}
            />
          )}
        </>
      )}

      {/* Notes tab */}
      {activeTab === "notes" && (
        <NotesTab onAskSage={handleAskSageFromNote} />
      )}
    </div>
  );
}
