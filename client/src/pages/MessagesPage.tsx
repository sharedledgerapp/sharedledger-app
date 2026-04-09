import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";

type TabType = "messages" | "notes";

interface MessageItem {
  id: number;
  familyId: number;
  userId: number;
  content: string;
  createdAt: string;
  senderName: string;
}

interface NoteItem {
  id: number;
  familyId: number;
  userId: number;
  title: string;
  content: string | null;
  isCompleted: boolean;
  createdAt: string;
  creatorName: string;
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

/** Returns the format prefix of a line, or '' for plain text */
function detectLinePrefix(line: string): string {
  if (line.startsWith("- ")) return "- ";
  if (line.startsWith("[ ] ") || line.startsWith("[x] ")) return "[ ] ";
  const m = line.match(/^(\d+)\. /);
  if (m) return `${parseInt(m[1]) + 1}. `;
  return "";
}

function stripLinePrefix(line: string): string {
  if (line.startsWith("- ")) return line.slice(2);
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
          return (
            <p key={i} className="text-xs text-muted-foreground leading-relaxed">
              {block.text}
            </p>
          );
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
              <span className="text-primary shrink-0 font-semibold tabular-nums min-w-[1.25rem]">
                {block.num}.
              </span>
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
              <span
                className={cn(
                  "mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                  block.checked
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-muted-foreground/40 group-hover:border-primary/60"
                )}
              >
                {block.checked && <Check className="w-2.5 h-2.5" />}
              </span>
              <span
                className={cn(
                  "text-muted-foreground transition-colors",
                  block.checked && "line-through opacity-50"
                )}
              >
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

function useSmartTextarea(
  value: string,
  onChange: (v: string) => void,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Enter") return;
      const ta = textareaRef.current;
      if (!ta) return;

      const cursor = ta.selectionStart;
      const [lineStart, lineEnd] = getLineRange(value, cursor);
      const currentLine = value.slice(lineStart, lineEnd);
      const prefix = detectLinePrefix(currentLine);
      const text = stripLinePrefix(currentLine);

      if (!prefix) return;

      if (!text.trim()) {
        // Empty list item → break out of list format
        e.preventDefault();
        const newValue = value.slice(0, lineStart) + value.slice(lineEnd);
        onChange(newValue);
        setTimeout(() => {
          ta.setSelectionRange(lineStart, lineStart);
        }, 0);
        return;
      }

      e.preventDefault();
      const insertion = "\n" + prefix;
      const newValue = value.slice(0, cursor) + insertion + value.slice(cursor);
      onChange(newValue);
      const newCursor = cursor + insertion.length;
      setTimeout(() => {
        ta.setSelectionRange(newCursor, newCursor);
      }, 0);
    },
    [value, onChange, textareaRef]
  );

  return { handleKeyDown };
}

// ─── Messages tab ─────────────────────────────────────────────────────────────

function formatMessageTime(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return "Yesterday " + format(date, "h:mm a");
  return format(date, "MMM d, h:mm a");
}

function MessagesTab() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread"] });
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={cn("flex gap-2", i % 2 === 0 ? "justify-end" : "")}>
            <Skeleton className="h-12 w-48 rounded-2xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-1">
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
                new Date(messages[index + 1].createdAt).getTime() -
                  new Date(msg.createdAt).getTime() >
                  300000;

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

      <div className="border-t border-border/40 p-3 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
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

// ─── Notes tab ────────────────────────────────────────────────────────────────

function NotesTab() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const newContentRef = useRef<HTMLTextAreaElement>(null);

  const { data: notesList, isLoading } = useQuery<NoteItem[]>({
    queryKey: ["/api/notes"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      const res = await apiRequest("POST", "/api/notes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setNewTitle("");
      setNewContent("");
      setShowAddForm(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: number; isCompleted: boolean }) => {
      const res = await apiRequest("PATCH", `/api/notes/${id}`, { isCompleted });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notes"] }),
  });

  const updateContentMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const res = await apiRequest("PATCH", `/api/notes/${id}`, { content });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notes"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/notes/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notes"] }),
  });

  const handleCreate = () => {
    if (newTitle.trim()) {
      createMutation.mutate({ title: newTitle.trim(), content: newContent.trim() });
    }
  };

  const { handleKeyDown: handleSmartKeyDown } = useSmartTextarea(
    newContent,
    setNewContent,
    newContentRef
  );

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const activeNotes = notesList?.filter((n) => !n.isCompleted) || [];
  const completedNotes = notesList?.filter((n) => n.isCompleted) || [];

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <Button
        variant="outline"
        className="w-full rounded-xl border-dashed"
        onClick={() => setShowAddForm(!showAddForm)}
        data-testid="button-add-note"
      >
        {showAddForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
        {showAddForm ? t("cancel") : t("addNote")}
      </Button>

      {showAddForm && (
        <Card className="p-4 space-y-3">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t("noteTitlePlaceholder")}
            data-testid="input-note-title"
          />
          <div className="space-y-2">
            <FormatToolbar
              textareaRef={newContentRef}
              value={newContent}
              onChange={setNewContent}
            />
            <Textarea
              ref={newContentRef}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              onKeyDown={handleSmartKeyDown}
              placeholder={t("noteContentPlaceholder")}
              rows={4}
              className="resize-none font-mono text-sm"
              data-testid="input-note-content"
            />
            <p className="text-[10px] text-muted-foreground">
              Use the toolbar above to add bullets, numbered lists, or to-do items. Press Enter to continue a list.
            </p>
          </div>
          <Button
            onClick={handleCreate}
            disabled={!newTitle.trim() || createMutation.isPending}
            className="w-full rounded-xl"
            data-testid="button-save-note"
          >
            {t("save")}
          </Button>
        </Card>
      )}

      {activeNotes.length === 0 && completedNotes.length === 0 && !showAddForm && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <StickyNote className="w-12 h-12 mb-3 opacity-20" />
          <p className="font-medium">{t("noNotes")}</p>
          <p className="text-sm mt-1">{t("addFirstNote")}</p>
        </div>
      )}

      {activeNotes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          currentUserId={user?.id}
          onToggleNote={() => toggleMutation.mutate({ id: note.id, isCompleted: true })}
          onDelete={() => deleteMutation.mutate(note.id)}
          onToggleTodo={(noteId, newContent) =>
            updateContentMutation.mutate({ id: noteId, content: newContent })
          }
          t={t}
        />
      ))}

      {completedNotes.length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide px-1">
            {t("statusCompleted")} ({completedNotes.length})
          </p>
          {completedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              currentUserId={user?.id}
              onToggleNote={() => toggleMutation.mutate({ id: note.id, isCompleted: false })}
              onDelete={() => deleteMutation.mutate(note.id)}
              onToggleTodo={(noteId, newContent) =>
                updateContentMutation.mutate({ id: noteId, content: newContent })
              }
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Note card ────────────────────────────────────────────────────────────────

function NoteCard({
  note,
  currentUserId,
  onToggleNote,
  onDelete,
  onToggleTodo,
  t,
}: {
  note: NoteItem;
  currentUserId?: number;
  onToggleNote: () => void;
  onDelete: () => void;
  onToggleTodo: (noteId: number, newContent: string) => void;
  t: (key: any) => string;
}) {
  const blocks = parseContent(note.content);

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
          <p
            className={cn(
              "font-medium text-sm",
              note.isCompleted && "line-through text-muted-foreground"
            )}
          >
            {note.title}
          </p>

          {blocks.length > 0 && (
            <NoteContentRenderer
              blocks={blocks}
              noteId={note.id}
              rawContent={note.content ?? ""}
              onToggleTodo={onToggleTodo}
            />
          )}

          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-muted-foreground">
              {t("by")} {note.creatorName}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(note.createdAt), "MMM d")}
            </span>
          </div>
        </div>

        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          className="shrink-0 text-muted-foreground hover:text-destructive"
          data-testid={`button-delete-note-${note.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>("messages");

  return (
    <div
      className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-2rem)] -m-4 md:-m-8"
      data-tutorial="messages-area"
    >
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
            {t("savedNotes")}
          </button>
        </div>
      </div>

      {activeTab === "messages" ? <MessagesTab /> : <NotesTab />}
    </div>
  );
}
