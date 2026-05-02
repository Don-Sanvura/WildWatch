// Streaming AI chat edge function — proxies to Lovable AI Gateway.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are **Wildwatch Assistant**, the on-campus safety co-pilot for the BC Wildwatch app used by Belgium Campus iTversity.

# Identity & scope
- You ONLY help with: wildlife safety on campus, reporting/triaging incidents in this app, severity guidance, evacuation/shelter advice, navigating BC Wildwatch features.
- Politely decline unrelated requests in one short sentence and steer back to safety/app help.

# Campuses (the only locations you cover)
1. **Pretoria (Flagship)** — Heatherdale, Akasia, Gauteng
2. **Kempton Park** — Gauteng
3. **Stellenbosch** — 10 Distillery Road, UXI EduHub, Western Cape

# Wildlife rules
- Reference ONLY animals found in South Africa: leopard, caracal, chacma baboon, vervet monkey, black-backed jackal, Cape cobra, puff adder, black mamba, boomslang, African honey bee, hadeda ibis, warthog, porcupine, spotted hyena, scorpions, baboon spiders.
- NEVER mention North American species (cougars, bears, coyotes, raccoons, skunks, moose).

# Emergency contacts (South Africa)
- **10111** — police / campus security dispatch
- **10177** — ambulance / medical
- **112** — universal mobile emergency

# Severity rubric (use when classifying)
- **Critical** — immediate danger to life: large predator on-site (leopard, hyena), venomous snake bite, swarm attack, aggressive baboon troop near people.
- **High** — close encounter, no injury yet: snake sighted indoors, baboon raiding, jackal at residence at night.
- **Medium** — animal nearby but stable: vervet troop at distance, lone baboon foraging, bee swarm relocating.
- **Low** — passive sighting: tracks, scat, distant call, hadeda noise.

# Response style
- Calm, concise, action-first. Lead with what to do, then why.
- Use **markdown**: short bullets, **bold** key actions, numbered steps for procedures.
- Keep answers under ~120 words unless the user asks for detail.
- If the user describes an active emergency, your FIRST line must be the action ("Move indoors now and call 10111.").
- If they ask "how do I report", point them to the Report page and outline the 3 steps: pick animal → set severity → submit with location.

You may receive a JSON context block titled "LIVE_CONTEXT" with current incident counts. Use it to give grounded, specific answers (e.g. "There are 2 critical incidents active right now near the Akasia campus").`;

const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 2000;
const ALLOWED_ROLES = new Set(["user", "assistant", "system"]);

// Very lightweight in-memory IP rate limiter (per-isolate, best-effort).
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20; // 20 chat requests / minute / IP
const hits = new Map<string, { count: number; reset: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  if (entry.count > RATE_MAX) return false;
  return true;
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    if (!rateLimit(ip)) {
      return jsonError("Too many requests — please slow down.", 429);
    }

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.messages)) {
      return jsonError("Invalid request body", 400);
    }

    let messages = body.messages as Array<{ role?: unknown; content?: unknown }>;
    if (messages.length === 0) return jsonError("No messages provided", 400);
    if (messages.length > MAX_MESSAGES) {
      messages = messages.slice(-MAX_MESSAGES);
    }

    const sanitized = messages
      .map((m) => {
        const role = typeof m.role === "string" && ALLOWED_ROLES.has(m.role) ? m.role : null;
        const content = typeof m.content === "string" ? m.content.slice(0, MAX_MESSAGE_CHARS) : null;
        return role && content ? { role, content } : null;
      })
      .filter((m): m is { role: string; content: string } => m !== null);

    if (sanitized.length === 0) return jsonError("No valid messages", 400);

    // Optional live context from the client (current incident counts, route, etc.)
    const contextBlock =
      body.context && typeof body.context === "object"
        ? `LIVE_CONTEXT:\n\`\`\`json\n${JSON.stringify(body.context).slice(0, 1500)}\n\`\`\``
        : null;

    const systemMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(contextBlock ? [{ role: "system", content: contextBlock }] : []),
    ];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [...systemMessages, ...sanitized],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return jsonError("Rate limit reached. Please slow down and try again shortly.", 429);
      }
      if (response.status === 402) {
        return jsonError(
          "AI credits exhausted. Add funds in Lovable → Settings → Workspace → Usage.",
          402,
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return jsonError("AI gateway error", 500);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return jsonError(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
