import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emergencyContacts, safetyResources } from "@/data/incidents";
import { Send, Phone, BookOpen, AlertCircle, ExternalLink, AlertTriangle, ShieldCheck } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

type Msg = { role: "user" | "bot"; text: string };

const seedReplies: Record<string, string> = {
  leopard:
    "If you see a leopard: stay calm, look large, maintain eye contact, and back away slowly. Never run. Call Campus Security: 10111.",
  baboon:
    "Chacma baboons: avoid eye contact, do not show food, never smile (bared teeth = threat). Move calmly indoors. Report to Campus Security: 10111.",
  snake:
    "Snake bite: keep the patient still, remove tight items, get to hospital fast. Call 10177 (ambulance). Don't cut, suck, or tourniquet. Note the snake's appearance.",
  bee: "African honey bees: RUN at least 100 m, cover your face, get indoors. Call 10177 for many stings or breathing trouble.",
  jackal:
    "Jackal/caracal: stand tall, shout, throw sticks toward (not at) it. Pick up small pets. Report to SANParks: +27 13 735 4325.",
  monkey:
    "Vervets: don't make eye contact with males, secure all food, close doors/windows. Never hand-feed.",
  dog: "For aggressive strays: avoid eye contact, back away slowly. Report to Campus Security with location and description.",
};

function botReply(text: string) {
  const t = text.toLowerCase();
  for (const k of Object.keys(seedReplies)) if (t.includes(k)) return seedReplies[k];
  return "I can help with leopard, baboon, snake, bee swarm, jackal, vervet monkey, or stray dog encounters. Tell me what you're seeing or call Campus Security at 10111.";
}

export default function Portal() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "bot", text: "Hi — I'm Wildwatch Assist. Describe what you're seeing or ask a safety question." },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = { role: "user" as const, text: input };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTimeout(() => {
      setMessages((m) => [...m, { role: "bot", text: botReply(userMsg.text) }]);
    }, 600);
  };

  return (
    <div className="container py-6 sm:py-8 md:py-10">
      <div className="max-w-2xl">
        <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Safety Portal
        </div>
        <h1 className="mt-2 font-display text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight break-words">
          Immediate Assistance
        </h1>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground">
          Chat with Wildwatch Assist for guidance on what to do during a wildlife encounter.
        </p>
      </div>

      <div className="mt-6 sm:mt-8 grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Chat */}
        <div className="flex min-w-0 flex-col rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-center gap-2 border-b border-border px-4 sm:px-5 py-3 sm:py-4">
            <div className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </div>
            <span className="ml-1 text-sm font-semibold truncate">Wildwatch Assist</span>
            <span className="ml-auto hidden sm:inline text-xs text-muted-foreground">online · ~15s response</span>
            <span className="ml-auto sm:hidden text-[10px] text-muted-foreground">online</span>
          </div>

          <div className="flex h-[55vh] min-h-[320px] sm:h-[420px] flex-col gap-3 overflow-y-auto px-4 sm:px-5 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] break-words rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-foreground text-background"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="rounded-full"
            />
            <Button type="submit" size="icon" className="shrink-0 rounded-full">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {/* Side panels */}
        <aside className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-2xl bg-gradient-emergency p-5 text-primary-foreground shadow-emergency">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <h3 className="text-xs font-bold uppercase tracking-[0.2em]">Emergency Contacts</h3>
            </div>
            <ul className="mt-3 space-y-2.5">
              {emergencyContacts.map((c) => (
                <li
                  key={c.value}
                  className="flex items-center gap-3 rounded-xl bg-primary-foreground/10 p-2.5 backdrop-blur"
                >
                  <span className="text-lg">{c.icon}</span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium opacity-80">{c.label}</div>
                    <a href={`tel:${c.value}`} className="block text-sm font-bold tabular-nums">
                      {c.value}
                    </a>
                  </div>
                  <Phone className="ml-auto h-4 w-4 opacity-70" />
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Safety Resources
              </h3>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Tap a card for life-saving steps, what NOT to do, and the right number to call.
            </p>
            <Accordion type="single" collapsible className="mt-3">
              {safetyResources.map((r) => {
                const tone =
                  r.severity === "critical"
                    ? "bg-destructive/10 text-destructive border-destructive/30"
                    : r.severity === "high"
                      ? "bg-orange-500/10 text-orange-600 border-orange-500/30 dark:text-orange-400"
                      : r.severity === "medium"
                        ? "bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400"
                        : "bg-muted text-muted-foreground border-border";
                return (
                  <AccordionItem
                    key={r.title}
                    value={r.title}
                    className="border-border data-[state=open]:bg-secondary/40 rounded-xl px-2 my-1 border"
                  >
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex w-full items-center gap-3 text-left">
                        <span className="text-2xl shrink-0" aria-hidden>
                          {r.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-semibold break-words">{r.title}</span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] uppercase tracking-wider ${tone}`}
                            >
                              {r.severity}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground break-words">{r.desc}</div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="space-y-3">
                        <div>
                          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck className="h-3 w-3" /> Do this
                          </div>
                          <ol className="space-y-1.5 pl-4">
                            {r.steps.map((s, i) => (
                              <li key={i} className="text-xs leading-relaxed list-decimal">
                                {s}
                              </li>
                            ))}
                          </ol>
                        </div>
                        <div>
                          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-destructive">
                            <AlertTriangle className="h-3 w-3" /> Never
                          </div>
                          <ul className="space-y-1 pl-4">
                            {r.doNot.map((s, i) => (
                              <li key={i} className="text-xs leading-relaxed list-disc">
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <a
                            href={`tel:${r.call.replace(/[^0-9+]/g, "")}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-2.5 py-1.5 text-xs font-semibold text-destructive-foreground shadow-emergency transition-smooth hover:opacity-90"
                          >
                            <Phone className="h-3 w-3" /> Call {r.call}
                          </a>
                          <a
                            href={r.link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:bg-secondary hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" /> {r.link.label}
                          </a>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </aside>
      </div>
    </div>
  );
}
