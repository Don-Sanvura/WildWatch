import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { Incident, Status, initialIncidents } from "@/data/incidents";
import { supabase } from "@/integrations/supabase/client";

export type TimelineEvent = {
  at: string; // ISO
  label: string;
  detail?: string;
  kind: "reported" | "investigating" | "resolved" | "responder" | "note";
};

export type NewIncidentInput = Omit<
  Incident,
  "id" | "reportedAt" | "responders" | "status"
> & {
  lat?: number | null;
  lng?: number | null;
  photoPath?: string | null;
};

export type FullIncident = Incident & {
  lat: number | null;
  lng: number | null;
  photoPath: string | null;
};

type Ctx = {
  incidents: FullIncident[];
  loading: boolean;
  addIncident: (i: NewIncidentInput) => Promise<string | null>;
  updateStatus: (id: string, status: Status, note?: string) => Promise<void>;
  notifyResponders: (id: string, count?: number) => Promise<void>;
  getTimeline: (id: string) => TimelineEvent[];
  refresh: () => Promise<void>;
};

const IncidentsContext = createContext<Ctx | null>(null);

type DbRow = {
  id: string;
  animal: string;
  emoji: string;
  severity: string;
  status: string;
  location: string;
  reporter: string;
  description: string;
  responders: number;
  lat: number | null;
  lng: number | null;
  photo_path: string | null;
  created_at: string;
};

type DbEvent = {
  id: string;
  incident_id: string;
  kind: string;
  label: string;
  detail: string | null;
  created_at: string;
};

const isSeverity = (s: string): s is Incident["severity"] =>
  s === "critical" || s === "high" || s === "medium" || s === "low";
const isStatus = (s: string): s is Status =>
  s === "active" || s === "investigating" || s === "resolved";
const isEventKind = (s: string): s is TimelineEvent["kind"] =>
  s === "reported" || s === "investigating" || s === "resolved" || s === "responder" || s === "note";

function rowToIncident(r: DbRow): FullIncident {
  return {
    id: r.id,
    animal: r.animal,
    emoji: r.emoji,
    severity: isSeverity(r.severity) ? r.severity : "medium",
    status: isStatus(r.status) ? r.status : "active",
    location: r.location,
    reporter: r.reporter,
    description: r.description,
    responders: r.responders,
    reportedAt: r.created_at,
    lat: r.lat,
    lng: r.lng,
    photoPath: r.photo_path,
  };
}

export function IncidentsProvider({ children }: { children: ReactNode }) {
  const [incidents, setIncidents] = useState<FullIncident[]>([]);
  const [timelines, setTimelines] = useState<Record<string, TimelineEvent[]>>({});
  const [loading, setLoading] = useState(true);
  const seededRef = useRef(false);

  const refresh = async () => {
    const { data, error } = await supabase
      .from("incidents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[incidents] fetch failed:", error);
      setLoading(false);
      return;
    }
    const list = (data as DbRow[]).map(rowToIncident);
    setIncidents(list);
    // One-time seed if DB is empty (mock data so the app isn't blank on first run).
    if (list.length === 0 && !seededRef.current) {
      seededRef.current = true;
      const seedRows = initialIncidents.map((i) => ({
        animal: i.animal,
        emoji: i.emoji,
        severity: i.severity,
        status: i.status,
        location: i.location,
        reporter: i.reporter,
        description: i.description,
        responders: i.responders,
        created_at: i.reportedAt,
      }));
      const { error: seedErr } = await supabase.from("incidents").insert(seedRows);
      if (seedErr) console.warn("[incidents] seed failed:", seedErr);
      else {
        const { data: refetched } = await supabase
          .from("incidents")
          .select("*")
          .order("created_at", { ascending: false });
        setIncidents(((refetched ?? []) as DbRow[]).map(rowToIncident));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    void refresh();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("incidents-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = rowToIncident(payload.new as DbRow);
            setIncidents((prev) => (prev.some((p) => p.id === row.id) ? prev : [row, ...prev]));
          } else if (payload.eventType === "UPDATE") {
            const row = rowToIncident(payload.new as DbRow);
            setIncidents((prev) => prev.map((p) => (p.id === row.id ? row : p)));
          } else if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id?: string })?.id;
            if (oldId) setIncidents((prev) => prev.filter((p) => p.id !== oldId));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "incident_events" },
        (payload) => {
          const ev = payload.new as DbEvent;
          if (!isEventKind(ev.kind)) return;
          const kind: TimelineEvent["kind"] = ev.kind;
          setTimelines((prev) => {
            const list = prev[ev.incident_id] ?? [];
            if (list.some((t) => t.at === ev.created_at && t.label === ev.label)) return prev;
            return {
              ...prev,
              [ev.incident_id]: [
                ...list,
                { at: ev.created_at, label: ev.label, detail: ev.detail ?? undefined, kind },
              ],
            };
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTimeline = async (id: string) => {
    const { data, error } = await supabase
      .from("incident_events")
      .select("*")
      .eq("incident_id", id)
      .order("created_at", { ascending: true });
    if (error || !data) return;
    const events: TimelineEvent[] = (data as DbEvent[])
      .filter((e) => isEventKind(e.kind))
      .map((e) => ({
        at: e.created_at,
        label: e.label,
        detail: e.detail ?? undefined,
        kind: e.kind as TimelineEvent["kind"],
      }));
    setTimelines((prev) => ({ ...prev, [id]: events }));
  };

  const addIncident: Ctx["addIncident"] = async (i) => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    const { data, error } = await supabase
      .from("incidents")
      .insert({
        animal: i.animal,
        emoji: i.emoji,
        severity: i.severity,
        location: i.location,
        reporter: i.reporter,
        description: i.description,
        lat: i.lat ?? null,
        lng: i.lng ?? null,
        photo_path: i.photoPath ?? null,
        reporter_id: uid,
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[incidents] insert failed:", error);
      return null;
    }
    if (uid) {
      await supabase.from("incident_events").insert({
        incident_id: data.id,
        kind: "reported",
        label: "Report submitted",
        detail: `Filed by ${i.reporter}`,
        actor_id: uid,
      });
    }
    return data.id;
  };

  const updateStatus: Ctx["updateStatus"] = async (id, status, note) => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    const { error } = await supabase.from("incidents").update({ status }).eq("id", id);
    if (error) {
      console.error("[incidents] status update failed:", error);
      return;
    }
    if (uid) {
      await supabase.from("incident_events").insert({
        incident_id: id,
        kind: status === "resolved" ? "resolved" : status === "investigating" ? "investigating" : "note",
        label:
          status === "resolved"
            ? "Marked resolved"
            : status === "investigating"
              ? "Moved to investigating"
              : "Reopened as active",
        detail: note ?? null,
        actor_id: uid,
      });
    }
  };

  const notifyResponders: Ctx["notifyResponders"] = async (id, count = 1) => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    const target = incidents.find((i) => i.id === id);
    const next = (target?.responders ?? 0) + count;
    const { error } = await supabase.from("incidents").update({ responders: next }).eq("id", id);
    if (error) {
      console.error("[incidents] responders update failed:", error);
      return;
    }
    if (uid) {
      await supabase.from("incident_events").insert({
        incident_id: id,
        kind: "responder",
        label: `${count} responder${count > 1 ? "s" : ""} notified`,
        actor_id: uid,
      });
    }
  };

  const getTimeline: Ctx["getTimeline"] = (id) => {
    if (!timelines[id]) {
      void fetchTimeline(id);
      // synchronous fallback while we fetch
      const inc = incidents.find((i) => i.id === id);
      if (inc) {
        return [{ at: inc.reportedAt, label: "Report submitted", detail: `Filed by ${inc.reporter}`, kind: "reported" }];
      }
      return [];
    }
    return timelines[id];
  };

  const value = useMemo<Ctx>(
    () => ({ incidents, loading, addIncident, updateStatus, notifyResponders, getTimeline, refresh }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [incidents, loading, timelines],
  );

  return <IncidentsContext.Provider value={value}>{children}</IncidentsContext.Provider>;
}

const noopCtx: Ctx = {
  incidents: [],
  loading: false,
  addIncident: async () => null,
  updateStatus: async () => {},
  notifyResponders: async () => {},
  getTimeline: () => [],
  refresh: async () => {},
};

let warned = false;

export function useIncidents() {
  const ctx = useContext(IncidentsContext);
  if (!ctx) {
    if (!warned && typeof console !== "undefined") {
      warned = true;
      console.warn(
        "[useIncidents] Called outside <IncidentsProvider>. Returning empty fallback. " +
          "Wrap your route tree with <IncidentsProvider> (see src/components/AppLayout.tsx)."
      );
    }
    return noopCtx;
  }
  return ctx;
}

export function useIncidentsProviderMissing() {
  return useContext(IncidentsContext) === null;
}

// Helper for components that need a public photo URL from a storage path.
export function getPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from("incident-photos").getPublicUrl(path).data.publicUrl;
}
