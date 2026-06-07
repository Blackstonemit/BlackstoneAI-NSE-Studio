import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAnthropicConversations,
  getListAnthropicConversationsQueryKey,
  useCreateAnthropicConversation,
  useDeleteAnthropicConversation,
  useGetAnthropicConversation,
  getGetAnthropicConversationQueryKey,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  Send,
  Loader2,
  BotMessageSquare,
  User,
  Sparkles,
  ChevronRight,
} from "lucide-react";

type LocalMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
};

const STARTERS = [
  "What does a high RSI reading mean for NIFTY right now?",
  "Explain the BUY signal for RELIANCE — what indicators confirm it?",
  "How do I set up a Bull Call Spread on BANKNIFTY?",
  "What is the significance of VWAP for intraday trading?",
  "When should I use ATR for stop-loss placement?",
];

function MessageBubble({ msg }: { msg: LocalMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3 group", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "h-7 w-7 rounded-sm flex items-center justify-center shrink-0 mt-0.5",
          isUser ? "bg-primary/20 text-primary" : "bg-emerald-500/20 text-emerald-400"
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
      </div>
      <div
        className={cn(
          "max-w-[78%] rounded-sm px-4 py-3 text-sm font-mono leading-relaxed",
          isUser
            ? "bg-primary/10 border border-primary/20 text-foreground"
            : "bg-muted/40 border border-muted/60 text-foreground"
        )}
      >
        {msg.content ? (
          <FormattedMessage content={msg.content} />
        ) : (
          <span className="inline-block w-1.5 h-4 bg-emerald-400 animate-pulse" />
        )}
        {msg.streaming && msg.content && (
          <span className="inline-block ml-0.5 w-1.5 h-3.5 bg-emerald-400 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}

function FormattedMessage({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      if (inCode) {
        elements.push(
          <pre key={key++} className="bg-black/40 border border-muted/40 rounded-sm px-3 py-2 my-2 text-xs overflow-x-auto text-emerald-300 whitespace-pre">
            {codeLines.join("\n")}
          </pre>
        );
        codeLines = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    if (line.startsWith("### ")) {
      elements.push(<p key={key++} className="font-bold text-primary mt-3 mb-1">{line.slice(4)}</p>);
    } else if (line.startsWith("## ")) {
      elements.push(<p key={key++} className="font-bold text-foreground mt-3 mb-1 text-base">{line.slice(3)}</p>);
    } else if (line.startsWith("# ")) {
      elements.push(<p key={key++} className="font-bold text-foreground mt-2 mb-1 text-base">{line.slice(2)}</p>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={key++} className="flex gap-2 my-0.5">
          <span className="text-primary shrink-0 mt-0.5">▸</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\. /.test(line)) {
      const match = line.match(/^(\d+)\. (.*)$/);
      if (match) {
        elements.push(
          <div key={key++} className="flex gap-2 my-0.5">
            <span className="text-muted-foreground shrink-0 w-5 text-right">{match[1]}.</span>
            <span>{renderInline(match[2])}</span>
          </div>
        );
      }
    } else if (line === "") {
      elements.push(<div key={key++} className="h-2" />);
    } else {
      elements.push(<p key={key++} className="my-0.5">{renderInline(line)}</p>);
    }
  }

  return <div className="space-y-0">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="bg-black/40 px-1 rounded text-emerald-300 text-xs">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export default function ChatPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeId, setActiveId] = useState<number | null>(null);
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: convList, isLoading: loadingList } = useListAnthropicConversations();
  const { data: activeConv, isLoading: loadingConv } = useGetAnthropicConversation(
    activeId ?? 0,
    {
      query: {
        enabled: activeId !== null,
        queryKey: getGetAnthropicConversationQueryKey(activeId ?? 0),
      },
    }
  );

  const createConv = useCreateAnthropicConversation();
  const deleteConv = useDeleteAnthropicConversation();

  useEffect(() => {
    if (!activeConv) return;
    setLocalMessages(
      activeConv.messages.map((m) => ({
        id: String(m.id),
        role: m.role as "user" | "assistant",
        content: m.content,
      }))
    );
  }, [activeConv]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  const handleNewChat = useCallback(() => {
    const title = `Chat ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
    createConv.mutate(
      { data: { title } },
      {
        onSuccess: (conv) => {
          queryClient.invalidateQueries({ queryKey: getListAnthropicConversationsQueryKey() });
          setActiveId(conv.id);
          setLocalMessages([]);
          setInput("");
        },
        onError: () => toast({ title: "Error", description: "Could not create chat.", variant: "destructive" }),
      }
    );
  }, [createConv, queryClient, toast]);

  const handleDelete = useCallback(
    (id: number) => {
      deleteConv.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListAnthropicConversationsQueryKey() });
            if (activeId === id) {
              setActiveId(null);
              setLocalMessages([]);
            }
          },
          onError: () => toast({ title: "Error", description: "Could not delete chat.", variant: "destructive" }),
        }
      );
    },
    [deleteConv, queryClient, activeId, toast]
  );

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming || activeId === null) return;
    const userText = input.trim();
    setInput("");

    const userMsgId = `u-${Date.now()}`;
    const assistantMsgId = `a-${Date.now()}`;

    setLocalMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: userText },
      { id: assistantMsgId, role: "assistant", content: "", streaming: true },
    ]);

    setStreaming(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/anthropic/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userText }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(part.slice(6));
            if (json.done) break;
            if (json.error) throw new Error(json.error);
            if (json.content) {
              setLocalMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: m.content + json.content }
                    : m
                )
              );
            }
          } catch {}
        }
      }

      setLocalMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, streaming: false } : m))
      );
      queryClient.invalidateQueries({ queryKey: getGetAnthropicConversationQueryKey(activeId) });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setLocalMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
      toast({ title: "Error", description: "Failed to get a response.", variant: "destructive" });
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, activeId, queryClient, toast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleStarter = (text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex h-[calc(100vh-2rem)] gap-0 -m-6 overflow-hidden">
      {/* ── Conversation sidebar ── */}
      <div className="w-64 shrink-0 border-r border-border flex flex-col bg-card/30">
        <div className="p-3 border-b border-border">
          <Button
            onClick={handleNewChat}
            disabled={createConv.isPending}
            size="sm"
            className="w-full gap-2 font-mono text-xs"
          >
            {createConv.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            NEW CHAT
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {loadingList ? (
            <div className="px-3 py-2 text-xs font-mono text-muted-foreground">Loading…</div>
          ) : !convList?.length ? (
            <div className="px-3 py-4 text-xs font-mono text-muted-foreground text-center">
              No conversations yet.
              <br />Click <strong>NEW CHAT</strong> to start.
            </div>
          ) : (
            convList.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors",
                  activeId === conv.id
                    ? "bg-primary/10 border-l-2 border-primary"
                    : "hover:bg-muted/30 border-l-2 border-transparent"
                )}
                onClick={() => {
                  setActiveId(conv.id);
                  setLocalMessages([]);
                }}
              >
                <BotMessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-xs font-mono truncate">{conv.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="p-3 border-t border-border text-[10px] font-mono text-muted-foreground/50 text-center">
          CLAUDE SONNET 4.6 · NSE/BSE ASSISTANT
        </div>
      </div>

      {/* ── Chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeId === null ? (
          /* Welcome screen */
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-4">
                <div className="h-14 w-14 rounded-sm bg-emerald-500/20 flex items-center justify-center">
                  <Sparkles className="h-7 w-7 text-emerald-400" />
                </div>
              </div>
              <h2 className="text-xl font-bold font-mono">CLAUDE TRADING ASSISTANT</h2>
              <p className="text-sm text-muted-foreground font-mono max-w-md">
                Ask anything about NSE/BSE markets, technical indicators, options strategies,
                or the signals shown on this terminal.
              </p>
            </div>
            <div className="grid gap-2 w-full max-w-lg">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    handleNewChat();
                    setTimeout(() => handleStarter(s), 400);
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 text-left text-sm font-mono border border-border rounded-sm bg-card hover:bg-muted/40 hover:border-primary/40 transition-all group"
                >
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="truncate">{s}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {loadingConv && localMessages.length === 0 ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm font-mono">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation…
                </div>
              ) : localMessages.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground font-mono pt-8">
                  Start the conversation below.
                </div>
              ) : (
                localMessages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-4">
              <div className="flex gap-3 items-end max-w-4xl mx-auto">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about markets, indicators, signals… (Enter to send, Shift+Enter for newline)"
                  rows={1}
                  disabled={streaming}
                  className="flex-1 resize-none rounded-sm border border-border bg-card px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40 disabled:opacity-50 overflow-hidden leading-relaxed"
                  style={{ minHeight: "42px" }}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || streaming}
                  size="sm"
                  className="shrink-0 h-[42px] px-4 gap-2 font-mono text-xs"
                >
                  {streaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  SEND
                </Button>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground/40 text-center mt-2">
                AI responses are for informational purposes only. Always do your own research before trading.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
