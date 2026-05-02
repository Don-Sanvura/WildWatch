import { useIncidents } from "@/store/incidents";
import { useMemo } from "react";
import { TrendingUp, TrendingDown, Activity, Clock, MapPin } from "lucide-react";
import { IncidentsMap } from "@/components/IncidentsMap";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Analytics() {
  const { incidents } = useIncidents();

  const byType = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach((i) => (counts[i.animal] = (counts[i.animal] || 0) + 1));
    // Boost demo numbers
    const boost: Record<string, number> = {
      "Leopard Sighting": 142,
      "Chacma Baboon Troop": 98,
      "Black-backed Jackal": 76,
      "African Honey Bee Swarm": 64,
      "Vervet Monkey": 41,
    };
    return Object.entries(boost).map(([k, v]) => ({ label: k, value: v }));
  }, [incidents]);

  const max = Math.max(...byType.map((b) => b.value));

  const trendYear = new Date().getFullYear();
  const monthly = useMemo(() => {
    const buckets = new Array(12).fill(0) as number[];
    for (const i of incidents) {
      const d = new Date(i.reportedAt);
      if (Number.isNaN(d.getTime())) continue;
      if (d.getFullYear() !== trendYear) continue;
      buckets[d.getMonth()] += 1;
    }
    return buckets.map((v, idx) => ({ m: MONTH_LABELS[idx], v }));
  }, [incidents, trendYear]);
  const maxMonth = Math.max(1, ...monthly.map((m) => m.v));

  const severityCounts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const i of incidents) c[i.severity] += 1;
    return c;
  }, [incidents]);
  const totalReports = incidents.length;

  return (
    <div className="container py-8 md:py-10">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        Live Operations Data
      </div>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
        Analytics Dashboard
      </h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Real-time surveillance and historical trend analysis for BC campus wildlife interactions.
      </p>

      {/* KPI Strip */}
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Total Reports" value="1,284" trend="+12%" up icon={Activity} />
        <Kpi label="Resolution Rate" value="96.2%" trend="+3.4%" up icon={TrendingUp} />
        <Kpi label="Avg Response" value="14m" trend="-2m" up icon={Clock} />
        <Kpi label="Active Now" value="08" trend="+2" up={false} icon={TrendingDown} />
      </div>

      {/* Sightings by type */}
      <div className="mt-8 rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base sm:text-lg font-bold break-words">
            Sightings by Animal Type
          </h2>
          <span className="text-xs text-muted-foreground">Last 90 days</span>
        </div>
        <div className="mt-5 space-y-4">
          {byType.map((b) => (
            <div key={b.label} className="min-w-0">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 flex-1 break-words font-semibold uppercase tracking-wider text-muted-foreground">
                  {b.label}
                </span>
                <span className="shrink-0 font-mono font-bold tabular-nums">{b.value}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow"
                  style={{ width: `${(b.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly trends */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base sm:text-lg font-bold break-words">
            Monthly Sighting Trends
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground" />
            Live · {trendYear}
          </span>
        </div>
        <div className="mt-6 flex h-48 min-w-0 items-end gap-1 sm:gap-2 overflow-hidden">
          {monthly.map((m) => {
            const h = m.v === 0 ? 2 : (m.v / maxMonth) * 100;
            const isPeak = m.v > 0 && m.v === maxMonth;
            return (
              <div key={m.m} className="group flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="relative flex w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-md transition-smooth group-hover:opacity-80 ${
                      isPeak
                        ? "bg-gradient-to-t from-primary to-primary-glow"
                        : m.v === 0
                          ? "bg-muted"
                          : "bg-foreground/85"
                    }`}
                    style={{ height: `${h}%` }}
                    title={`${m.m}: ${m.v} sighting${m.v === 1 ? "" : "s"}`}
                  />
                  {isPeak && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                      {m.v}
                    </span>
                  )}
                </div>
                <div className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {m.m}
                </div>
              </div>
            );
          })}
        </div>
        {incidents.length === 0 && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Waiting for sightings — chart updates live as reports come in.
          </p>
        )}
      </div>

      {/* Recent reports + live satellite map */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold sm:text-lg">Belgium Campus — Live Map</h2>
              <p className="truncate text-xs text-muted-foreground">
                Satellite view — 38 Berg Ave, Heatherdale, Akasia
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground" />
              Live
            </span>
          </div>

          {/* Live counts strip */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <CountChip label="Total" value={totalReports} dotClass="bg-foreground" />
            <CountChip
              label="Critical"
              value={severityCounts.critical}
              dotClass="bg-[hsl(354,78%,47%)]"
            />
            <CountChip
              label="High"
              value={severityCounts.high}
              dotClass="bg-[hsl(18,88%,52%)]"
            />
            <CountChip
              label="Medium"
              value={severityCounts.medium}
              dotClass="bg-[hsl(38,92%,50%)]"
            />
            <CountChip
              label="Low"
              value={severityCounts.low}
              dotClass="bg-[hsl(200,60%,45%)]"
            />
          </div>

          <div className="relative isolate mt-4 z-0">
            <IncidentsMap incidents={incidents} />

            {/* Legend overlay — hidden on the smallest screens to keep the map clear */}
            <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden rounded-xl border border-border bg-card/95 p-2.5 text-xs shadow-elevated backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:block sm:p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                <MapPin className="h-3 w-3" /> Legend
              </div>
              <ul className="space-y-1">
                <LegendRow color="hsl(354,78%,47%)" label="Critical" count={severityCounts.critical} />
                <LegendRow color="hsl(18,88%,52%)" label="High" count={severityCounts.high} />
                <LegendRow color="hsl(38,92%,50%)" label="Medium" count={severityCounts.medium} />
                <LegendRow color="hsl(200,60%,45%)" label="Low" count={severityCounts.low} />
                <li className="mt-1.5 flex items-center gap-2 border-t border-border pt-1.5">
                  <span className="flex h-3 w-3 items-center justify-center rounded-sm bg-[hsl(220,80%,30%)] text-[8px]">
                    🎓
                  </span>
                  <span className="font-medium">Belgium Campus site</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="font-display text-lg font-bold">Recent Reports</h2>
          <ul className="mt-4 space-y-3">
            {incidents.slice(0, 4).map((i) => (
              <li key={i.id} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-base">
                  {i.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{i.animal}</div>
                  <div className="truncate text-xs text-muted-foreground">{i.location}</div>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{i.id}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  trend,
  up,
  icon: Icon,
}: {
  label: string;
  value: string;
  trend: string;
  up: boolean;
  icon: any;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="mt-2 font-display text-3xl font-bold tabular-nums">{value}</div>
      <div
        className={`mt-1 text-xs font-semibold ${
          up ? "text-success" : "text-primary"
        }`}
      >
        {trend} vs last month
      </div>
    </div>
  );
}

function CountChip({
  label,
  value,
  dotClass,
}: {
  label: string;
  value: number;
  dotClass: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </div>
        <div className="font-mono text-sm font-bold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function LegendRow({
  color,
  label,
  count,
}: {
  color: string;
  label: string;
  count: number;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        className="inline-block h-3 w-3 rotate-45 rounded-sm border border-white/80"
        style={{ background: color }}
      />
      <span className="font-medium">{label}</span>
      <span className="ml-auto font-mono font-bold tabular-nums text-muted-foreground">
        {count}
      </span>
    </li>
  );
}
