import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MessageCircle, X, Send, Loader2, Sparkles, Trash2, Copy, Check, ShieldAlert, MapPin, FileEdit, Crosshair } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useIncidents } from "@/store/incidents";
import { useMapContext } from "@/store/mapContext";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const PUBLIC_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const STORAGE_KEY = "wildwatch:chat:history";

const SUGGESTIONS = [
  { icon: "🚨", label: "I just saw a snake — what do I do?" },
  { icon: "📝", label: "How do I report an incident?" },
  { icon: "🐆", label: "What counts as a critical sighting?" },
  { icon: "🐝", label: "Bee swarm safety basics" },
];

function loadHistory(): Msg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Msg[]) : [];
  } catch {
    return [];
  }
}

function persistHistory(messages: Msg[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // ignore
  }
}

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>(() => loadHistory());
  const [streaming, setStreaming] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();
  const { incidents } = useIncidents();
  const location = useLocation();
  const navigate = useNavigate();
  const mapCtx = useMapContext();
  const [geoBusy, setGeoBusy] = useState(false);

  // Live context the model can ground on
  const liveContext = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const i of incidents) counts[i.severity] += 1;
    const active = incidents.filter((i) => i.status === "active").length;
    return {
      route: location.pathname,
      total_incidents: incidents.length,
      active_incidents: active,
      by_severity: counts,
      map_view: mapCtx.label
        ? { label: mapCtx.label, lat: mapCtx.lat, lng: mapCtx.lng }
        : null,
      latest: incidents.slice(0, 3).map((i) => ({
        id: i.id,
        animal: i.animal,
        severity: i.severity,
        location: i.location,
      })),
    };
  }, [incidents, location.pathname, mapCtx.label, mapCtx.lat, mapCtx.lng]);

  /** Capture the user's GPS, push it into both the chat and map context. */
  const useMyCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      toast({ title: "Not supported", description: "Geolocation isn't available in this browser.", variant: "destructive" });
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const label = `My location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        mapCtx.setLocation({ label, lat, lng });
        toast({ title: "Location captured", description: label });
        setGeoBusy(false);
        void sendMessage(`Use my current location: ${label}. What should I do or report from here?`);
      },
      (err) => {
        setGeoBusy(false);
        toast({ title: "Location error", description: err.message || "Couldn't get your location", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  /** Open the report form, prefilled with whatever location context we have. */
  const openReportForm = () => {
    const params = new URLSearchParams();
    if (mapCtx.label) params.set("location", mapCtx.label);
    if (typeof mapCtx.lat === "number") params.set("lat", String(mapCtx.lat));
    if (typeof mapCtx.lng === "number") params.set("lng", String(mapCtx.lng));
    const qs = params.toString();
    navigate(qs ? `/report?${qs}` : "/report");
    setOpen(false);
  };

  useEffect(() => {
    persistHistory(messages);
  }, [messages]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
        inputRef.current?.focus();
      });
    }
  }, [open, messages.length]);

  // Auto-grow textarea
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [input]);

  const sendMessage = async (text: string) => {
    if (!text || streaming) return;
    setInput("");
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setStreaming(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PUBLIC_KEY}`,
        },
        body: JSON.stringify({ messages: next, context: liveContext }),
        signal: controller.signal,
      });

      if (resp.status === 429) {
        toast({ title: "Slow down", description: "Too many requests — try again in a moment.", variant: "destructive" });
        setMessages(next);
        setStreaming(false);
        return;
      }
      if (resp.status === 402) {
        toast({
          title: "AI credits exhausted",
          description: "Add credits in Lovable → Settings → Workspace → Usage.",
          variant: "destructive",
        });
        setMessages(next);
        setStreaming(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error(`Chat failed (${resp.status})`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(payload);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        // user cancelled — keep partial response
      } else {
        console.error(err);
        toast({
          title: "Chat error",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const send = () => sendMessage(input.trim());

  const stop = () => {
    abortRef.current?.abort();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const clearChat = () => {
    setMessages([]);
    persistHistory([]);
  };

  const copyMessage = async (idx: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1400);
    } catch {
      // ignore
    }
  };

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          style={{
            bottom: "max(0.75rem, env(safe-area-inset-bottom))",
            right: "max(0.75rem, env(safe-area-inset-right))",
          }}
          className="animate-pop-in fixed z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-emergency text-primary-foreground shadow-emergency transition-smooth hover:scale-105 active:scale-95 after:absolute after:inset-0 after:-z-10 after:animate-ping after:rounded-full after:bg-primary/40 sm:h-14 sm:w-14"
        >
          <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="BC Wildwatch assistant"
          className="animate-slide-up fixed inset-x-0 bottom-0 z-50 flex max-w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-elevated sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[36rem] sm:w-[26rem] sm:max-w-[calc(100vw-3rem)] sm:rounded-2xl"
          style={{
            maxHeight: "100dvh",
            height: "min(36rem, 100dvh)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {/* Header */}
          <header className="relative overflow-hidden border-b border-border">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-card to-card" />
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-2xl" />
            <div className="relative flex items-center justify-between gap-2 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-emergency text-primary-foreground shadow-card">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" />
                </div>
                <div className="leading-tight">
                  <div className="font-display text-sm font-bold">Wildwatch Assistant</div>
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-success" />
                    Online · safety co-pilot
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={clearChat}
                    title="Clear conversation"
                    className="rounded-md p-1.5 text-muted-foreground transition-smooth hover:bg-secondary hover:text-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1.5 text-muted-foreground transition-smooth hover:bg-secondary hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-background/40 to-background/0 px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="mb-1.5 flex items-center gap-2 text-sm font-bold">
                    <span>👋</span> Hi, I'm your safety co-pilot
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Ask me about reporting incidents, severity guidance, what to do during an
                    encounter, or how to use BC Wildwatch on your campus.
                  </p>
                </div>

                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div className="text-xs leading-relaxed">
                      <div className="font-semibold text-foreground">In an emergency</div>
                      <div className="text-muted-foreground">
                        Call <span className="font-mono font-bold text-foreground">10111</span> (security)
                        or <span className="font-mono font-bold text-foreground">10177</span> (medical).
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Try asking
                  </div>
                  <div className="grid gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => void sendMessage(s.label)}
                        className="group flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left text-xs transition-smooth hover:border-primary/40 hover:bg-secondary"
                      >
                        <span className="text-base">{s.icon}</span>
                        <span className="flex-1 font-medium">{s.label}</span>
                        <Send className="h-3 w-3 -translate-x-1 opacity-0 transition-smooth group-hover:translate-x-0 group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              const isUser = m.role === "user";
              return (
                <div key={i} className={cn("group flex gap-2", isUser ? "justify-end" : "justify-start")}>
                  {!isUser && (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-emergency text-[11px] text-primary-foreground shadow-card">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div className={cn("flex max-w-[82%] flex-col gap-1", isUser && "items-end")}>
                    <div
                      className={cn(
                        "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                        isUser
                          ? "rounded-br-sm bg-foreground text-background"
                          : "rounded-bl-sm border border-border bg-card text-foreground",
                      )}
                    >
                      {m.content ? (
                        isUser ? (
                          <span className="whitespace-pre-wrap">{m.content}</span>
                        ) : (
                          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:mb-1 prose-headings:mt-2 prose-pre:my-2 prose-code:rounded prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:text-[12px] prose-code:before:content-none prose-code:after:content-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                          </div>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <TypingDots />
                        </span>
                      )}
                    </div>
                    {!isUser && m.content && (
                      <button
                        type="button"
                        onClick={() => copyMessage(i, m.content)}
                        className="flex items-center gap-1 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground opacity-0 transition-smooth hover:text-foreground group-hover:opacity-100"
                      >
                        {copiedIdx === i ? (
                          <>
                            <Check className="h-3 w-3" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copy
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick actions — context bar */}
          <div className="border-t border-border bg-secondary/40 px-3 py-2">
            {mapCtx.label && (
              <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-medium text-muted-foreground">
                <MapPin className="h-3 w-3 text-primary" />
                <span className="truncate">Map view: <span className="text-foreground">{mapCtx.label}</span></span>
              </div>
            )}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={useMyCurrentLocation}
                disabled={geoBusy || streaming}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold transition-smooth hover:border-primary/40 hover:bg-card hover:text-foreground disabled:opacity-60"
                title="Share your current GPS with the assistant"
              >
                {geoBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crosshair className="h-3 w-3 text-primary" />}
                Use my location
              </button>
              <button
                type="button"
                onClick={openReportForm}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-emergency px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-card transition-smooth hover:opacity-90"
                title={mapCtx.label ? `Open report form prefilled with ${mapCtx.label}` : "Open the incident report form"}
              >
                <FileEdit className="h-3 w-3" />
                Open report form
              </button>
            </div>
          </div>

          {/* Composer */}
          <div className="border-t border-border bg-card/50 p-3 backdrop-blur">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-2 py-1.5 transition-smooth focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/40">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={1}
                placeholder="Ask about a sighting, severity, or reporting…"
                className="max-h-32 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
                disabled={streaming}
              />
              {streaming ? (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  onClick={stop}
                  className="h-8 w-8 shrink-0"
                  aria-label="Stop"
                  title="Stop generating"
                >
                  <span className="h-2.5 w-2.5 rounded-sm bg-foreground" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  onClick={send}
                  disabled={!input.trim()}
                  className="h-8 w-8 shrink-0"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1">
              <p className="text-[10px] text-muted-foreground">
                Enter to send · Shift+Enter for newline
              </p>
              {streaming && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" /> generating…
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
    </span>
  );
}
