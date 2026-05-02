import { ReactNode, useEffect, useReducer, useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertTriangle, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { useIncidentsProviderMissing } from "@/store/incidents";

const ROUTE_NAMES: Record<string, string> = {
  "/": "Active Incidents",
  "/portal": "Safety Portal",
  "/analytics": "Analytics",
  "/report": "Report",
};

function routeName(pathname: string) {
  if (ROUTE_NAMES[pathname]) return ROUTE_NAMES[pathname];
  if (pathname.startsWith("/incidents/")) return `Incident Details (${pathname.split("/")[2]})`;
  return pathname;
}

const SESSION_KEY = "wildwatch:missing-provider-logged";

/**
 * Returns true the first time it's called for a given route in this browser
 * session, false on subsequent calls. Uses sessionStorage so the dedupe
 * survives HMR and re-renders within the same tab.
 */
function shouldLogOncePerSession(pathname: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    const seen: string[] = raw ? JSON.parse(raw) : [];
    if (seen.includes(pathname)) return false;
    seen.push(pathname);
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(seen));
    return true;
  } catch {
    // sessionStorage unavailable (private mode, etc.) — fall back to module-level set
    if (memoryFallback.has(pathname)) return false;
    memoryFallback.add(pathname);
    return true;
  }
}

const memoryFallback = new Set<string>();

// Session-wide counters for the debug panel.
type Counters = {
  detections: Record<string, number>;
  logs: Record<string, number>;
  totalDetections: number;
  totalLogs: number;
};

const COUNTERS_KEY = "wildwatch:missing-provider-counters";

function emptyCounters(): Counters {
  return { detections: {}, logs: {}, totalDetections: 0, totalLogs: 0 };
}

function loadCounters(): Counters {
  if (typeof window === "undefined") return emptyCounters();
  try {
    const raw = window.sessionStorage.getItem(COUNTERS_KEY);
    if (!raw) return emptyCounters();
    const parsed = JSON.parse(raw) as Partial<Counters>;
    return {
      detections: parsed.detections ?? {},
      logs: parsed.logs ?? {},
      totalDetections: parsed.totalDetections ?? 0,
      totalLogs: parsed.totalLogs ?? 0,
    };
  } catch {
    return emptyCounters();
  }
}

function persistCounters() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(COUNTERS_KEY, JSON.stringify(counters));
  } catch {
    // sessionStorage unavailable — counters remain in-memory only
  }
}

const counters: Counters = loadCounters();

const counterListeners = new Set<() => void>();
function notifyCounters() {
  counterListeners.forEach((cb) => cb());
}

// ---- Detection timeline ----
type TimelineEntry = { t: string; route: string; logged: boolean };
const TIMELINE_KEY = "wildwatch:missing-provider-timeline";
const TIMELINE_MAX = 50;

// ---- Auto-safeguard ----
// When totalDetections crosses this threshold within a session we stop
// further console logging and stop appending timeline entries (counters
// keep accumulating so devs can still see the magnitude).
const SAFEGUARD_THRESHOLD = 500;
const SAFEGUARD_KEY = "wildwatch:missing-provider-safeguard";

function loadSafeguard(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SAFEGUARD_KEY) === "1";
  } catch {
    return false;
  }
}

let safeguardTriggered = loadSafeguard();

function persistSafeguard() {
  if (typeof window === "undefined") return;
  try {
    if (safeguardTriggered) window.sessionStorage.setItem(SAFEGUARD_KEY, "1");
    else window.sessionStorage.removeItem(SAFEGUARD_KEY);
  } catch {
    // ignore
  }
}

function loadTimeline(): TimelineEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(TIMELINE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TimelineEntry[]).slice(-TIMELINE_MAX) : [];
  } catch {
    return [];
  }
}

function persistTimeline() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(TIMELINE_KEY, JSON.stringify(timeline));
  } catch {
    // sessionStorage unavailable — timeline remains in-memory only
  }
}

const timeline: TimelineEntry[] = loadTimeline();

function recordTimelineEntry(pathname: string, logged: boolean) {
  if (safeguardTriggered) return;
  timeline.push({ t: new Date().toISOString(), route: pathname, logged });
  if (timeline.length > TIMELINE_MAX) timeline.splice(0, timeline.length - TIMELINE_MAX);
  persistTimeline();
}

function recordDetection(pathname: string) {
  counters.detections[pathname] = (counters.detections[pathname] ?? 0) + 1;
  counters.totalDetections += 1;
  if (!safeguardTriggered && counters.totalDetections >= SAFEGUARD_THRESHOLD) {
    safeguardTriggered = true;
    persistSafeguard();
    // eslint-disable-next-line no-console
    console.warn(
      `[IncidentsRouteGuard] Auto-safeguard triggered after ${SAFEGUARD_THRESHOLD} detections — ` +
        `further console logs and timeline entries are suppressed for this session. ` +
        `Use "Reset debug counters" to re-enable.`,
    );
  }
  persistCounters();
  notifyCounters();
}

function recordLog(pathname: string) {
  counters.logs[pathname] = (counters.logs[pathname] ?? 0) + 1;
  counters.totalLogs += 1;
  persistCounters();
  notifyCounters();
}

function resetCounters() {
  counters.detections = {};
  counters.logs = {};
  counters.totalDetections = 0;
  counters.totalLogs = 0;
  timeline.length = 0;
  safeguardTriggered = false;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(COUNTERS_KEY);
      window.sessionStorage.removeItem(SESSION_KEY);
      window.sessionStorage.removeItem(TIMELINE_KEY);
      window.sessionStorage.removeItem(SAFEGUARD_KEY);
    } catch {
      // sessionStorage unavailable — nothing to clear
    }
  }
  memoryFallback.clear();
  notifyCounters();
}

function useCountersSubscription() {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    counterListeners.add(force);
    return () => {
      counterListeners.delete(force);
    };
  }, []);
}

/**
 * Route-level guard. If a child of this route calls useIncidents but no
 * <IncidentsProvider> is in the tree, render a clear in-page banner naming
 * the failing route instead of crashing or showing a blank screen.
 */
export function IncidentsRouteGuard({ children }: { children: ReactNode }) {
  const missing = useIncidentsProviderMissing();
  const { pathname } = useLocation();
  const [debugOpen, setDebugOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  // "current" = current pathname, "all" = all routes, otherwise a specific recorded route.
  const [timelineFilter, setTimelineFilter] = useState<string>("current");
  const [confirmReset, setConfirmReset] = useState(false);
  useCountersSubscription();

  useEffect(() => {
    if (!missing) return;
    recordDetection(pathname);
    const willLog = !safeguardTriggered && shouldLogOncePerSession(pathname);
    recordTimelineEntry(pathname, willLog);
    notifyCounters();
    if (!willLog) return;
    recordLog(pathname);
    // eslint-disable-next-line no-console
    console.groupCollapsed(
      `%c[IncidentsRouteGuard] Provider missing on ${pathname}`,
      "color:#b45309;font-weight:bold"
    );
    // eslint-disable-next-line no-console
    console.log("route:", pathname);
    // eslint-disable-next-line no-console
    console.log("hook:", "useIncidents");
    // eslint-disable-next-line no-console
    console.log("provider:", "IncidentsProvider (not found in ancestor tree)");
    // eslint-disable-next-line no-console
    console.log("timestamp:", new Date().toISOString());
    // eslint-disable-next-line no-console
    console.log("note:", "logged once per session for this route");
    // eslint-disable-next-line no-console
    console.groupEnd();
  }, [missing, pathname]);

  if (!missing) return <>{children}</>;

  const name = routeName(pathname);
  const routeDetections = counters.detections[pathname] ?? 0;
  const routeLogs = counters.logs[pathname] ?? 0;
  const debugInfo = {
    route: pathname,
    routeName: name,
    hook: "useIncidents",
    provider: "IncidentsProvider",
    found: false,
    timestamp: new Date().toISOString(),
    detectionsThisRoute: routeDetections,
    logsThisRoute: routeLogs,
    detectionsTotal: counters.totalDetections,
    logsTotal: counters.totalLogs,
  };


  return (
    <div className="container py-10">
      <div
        role="alert"
        className="mx-auto max-w-2xl rounded-2xl border border-warning/40 bg-warning/10 p-6 shadow-card"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/20">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-warning">
              Provider missing
            </div>
            <h1 className="mt-1 font-display text-xl font-bold">
              "{name}" can't load incident data
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The route{" "}
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">
                {pathname}
              </code>{" "}
              uses{" "}
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">
                useIncidents()
              </code>
              , but no{" "}
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">
                &lt;IncidentsProvider&gt;
              </code>{" "}
              was found in its ancestor tree.
            </p>
            <div className="mt-4 rounded-lg border border-border bg-background/60 p-3 text-xs">
              <div className="font-semibold text-foreground">How to fix</div>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-muted-foreground">
                <li>
                  Open{" "}
                  <code className="font-mono">src/components/AppLayout.tsx</code>.
                </li>
                <li>
                  Ensure this route is nested under{" "}
                  <code className="font-mono">&lt;AppLayout /&gt;</code> in{" "}
                  <code className="font-mono">src/App.tsx</code>.
                </li>
                <li>
                  Or wrap the route element directly in{" "}
                  <code className="font-mono">&lt;IncidentsProvider&gt;</code>.
                </li>
              </ol>
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-border bg-background/60 text-xs">
              <button
                type="button"
                onClick={() => setDebugOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 font-semibold text-foreground transition-smooth hover:bg-secondary/60"
                aria-expanded={debugOpen}
              >
                <span className="flex items-center gap-1.5">
                  {debugOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  Debug panel
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  logged to console
                </span>
              </button>
              {debugOpen && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-border bg-card px-3 py-2.5 font-mono text-[11px]">
                  <dt className="text-muted-foreground">route</dt>
                  <dd className="text-foreground">{debugInfo.route}</dd>
                  <dt className="text-muted-foreground">name</dt>
                  <dd className="text-foreground">{debugInfo.routeName}</dd>
                  <dt className="text-muted-foreground">hook</dt>
                  <dd className="text-foreground">{debugInfo.hook}()</dd>
                  <dt className="text-muted-foreground">provider</dt>
                  <dd className="text-foreground">
                    {debugInfo.provider}{" "}
                    <span className="text-warning">· not found</span>
                  </dd>
                  <dt className="text-muted-foreground">at</dt>
                  <dd className="text-foreground">{debugInfo.timestamp}</dd>
                  <dt className="col-span-2 mt-1.5 border-t border-border pt-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Counters (this session)
                  </dt>
                  <dt className="text-muted-foreground">this route</dt>
                  <dd className="text-foreground">
                    <span className="text-warning">{debugInfo.detectionsThisRoute}</span> detected
                    {" · "}
                    <span className="text-success">{debugInfo.logsThisRoute}</span> logged
                  </dd>
                  <dt className="text-muted-foreground">all routes</dt>
                  <dd className="text-foreground">
                    <span className="text-warning">{debugInfo.detectionsTotal}</span> detected
                    {" · "}
                    <span className="text-success">{debugInfo.logsTotal}</span> logged
                  </dd>
                  <dt className="text-muted-foreground">suppressed</dt>
                  <dd className="text-foreground">
                    {debugInfo.detectionsTotal - debugInfo.logsTotal} (deduped per session)
                  </dd>

                  <div className="col-span-2 mt-2 border-t border-border pt-2">
                    <button
                      type="button"
                      onClick={() => setTimelineOpen((v) => !v)}
                      aria-expanded={timelineOpen}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-smooth hover:text-foreground"
                    >
                      <span className="flex items-center gap-1.5">
                        {timelineOpen ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        <Clock className="h-3 w-3" />
                        {timelineOpen ? "Hide" : "Show"} detection timeline
                      </span>
                      <span className="font-mono normal-case tracking-normal text-muted-foreground">
                        {timeline.length}/{TIMELINE_MAX}
                      </span>
                    </button>
                    {timelineOpen && (
                      <div className="mt-2 rounded-md border border-border bg-background/60">
                        <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
                          <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Filter
                            {(() => {
                              const recordedRoutes = Array.from(
                                new Set(timeline.map((e) => e.route)),
                              ).sort();
                              return (
                                <select
                                  value={timelineFilter}
                                  onChange={(e) => setTimelineFilter(e.target.value)}
                                  className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] normal-case tracking-normal text-foreground outline-none focus:ring-1 focus:ring-ring"
                                >
                                  <option value="current">This route ({pathname})</option>
                                  <option value="all">All routes</option>
                                  {recordedRoutes.length > 0 && (
                                    <optgroup label="Recorded routes">
                                      {recordedRoutes.map((r) => (
                                        <option key={r} value={r}>
                                          {r}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                </select>
                              );
                            })()}
                          </label>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            newest first
                          </span>
                        </div>
                        {(() => {
                          const filtered =
                            timelineFilter === "all"
                              ? timeline
                              : timelineFilter === "current"
                                ? timeline.filter((e) => e.route === pathname)
                                : timeline.filter((e) => e.route === timelineFilter);
                          const reversed = [...filtered].reverse();
                          if (reversed.length === 0) {
                            return (
                              <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                                No detections recorded yet.
                              </div>
                            );
                          }
                          return (
                            <ol className="max-h-48 divide-y divide-border overflow-y-auto">
                              {reversed.map((entry, i) => {
                                const d = new Date(entry.t);
                                const time = isNaN(d.getTime())
                                  ? entry.t
                                  : d.toLocaleTimeString(undefined, {
                                      hour12: false,
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                    }) +
                                    "." +
                                    String(d.getMilliseconds()).padStart(3, "0");
                                return (
                                  <li
                                    key={`${entry.t}-${i}`}
                                    className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-2 py-1.5 font-mono text-[11px]"
                                  >
                                    <span className="text-muted-foreground">{time}</span>
                                    <span className="truncate text-foreground" title={entry.route}>
                                      {entry.route}
                                    </span>
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                                        entry.logged
                                          ? "bg-success/15 text-success"
                                          : "bg-muted text-muted-foreground"
                                      }`}
                                    >
                                      {entry.logged ? "logged" : "suppressed"}
                                    </span>
                                  </li>
                                );
                              })}
                            </ol>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {safeguardTriggered && (
                    <div className="col-span-2 mt-2 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-2 text-[11px] text-warning">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div>
                        <div className="font-semibold uppercase tracking-wider text-[10px]">
                          Auto-safeguard active
                        </div>
                        <div className="mt-0.5 normal-case tracking-normal text-foreground/80">
                          Threshold of {SAFEGUARD_THRESHOLD} detections reached. Console logs and
                          new timeline entries are paused. Counters keep accumulating. Reset to
                          re-enable.
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="col-span-2 mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-2">
                    {confirmReset ? (
                      <>
                        <span className="font-mono text-[10px] normal-case tracking-normal text-muted-foreground">
                          Clear all counters, timeline & dedupe?
                        </span>
                        <button
                          type="button"
                          onClick={() => setConfirmReset(false)}
                          className="rounded-md border border-border bg-background px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-smooth hover:bg-secondary hover:text-foreground"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            resetCounters();
                            setConfirmReset(false);
                            setTimelineFilter("current");
                          }}
                          className="rounded-md border border-warning/40 bg-warning/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-warning transition-smooth hover:bg-warning/25"
                        >
                          Confirm reset
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmReset(true)}
                        className="rounded-md border border-border bg-background px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-foreground transition-smooth hover:bg-secondary"
                      >
                        Reset debug counters
                      </button>
                    )}
                  </div>
                </dl>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
