import { useMemo, useState } from "react";
import { useIncidents } from "@/store/incidents";
import { IncidentCard } from "@/components/IncidentCard";
import { IncidentsMap } from "@/components/IncidentsMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, AlertTriangle, Search, Download, MapIcon, List, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { animalTypes, Severity, Status } from "@/data/incidents";
import type { FullIncident } from "@/store/incidents";

const statusFilters: ("all" | Status)[] = ["all", "active", "investigating", "resolved"];
const severityOptions: ("all" | Severity)[] = ["all", "critical", "high", "medium", "low"];
type SortKey = "newest" | "oldest" | "severity";

const severityRank: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function toCsv(rows: FullIncident[]) {
  const header = [
    "id",
    "animal",
    "severity",
    "status",
    "location",
    "reporter",
    "reportedAt",
    "responders",
    "lat",
    "lng",
    "description",
  ];
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.animal,
        r.severity,
        r.status,
        r.location,
        r.reporter,
        r.reportedAt,
        r.responders,
        r.lat ?? "",
        r.lng ?? "",
        r.description.replace(/\s+/g, " "),
      ]
        .map(escape)
        .join(","),
    );
  }
  return lines.join("\n");
}

export default function Incidents() {
  const { incidents, loading } = useIncidents();
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | Severity>("all");
  const [animalFilter, setAnimalFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<"list" | "map">("list");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = incidents.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (severityFilter !== "all" && i.severity !== severityFilter) return false;
      if (animalFilter !== "all" && i.animal !== animalFilter) return false;
      if (q && !`${i.animal} ${i.location} ${i.description} ${i.reporter} ${i.id}`.toLowerCase().includes(q))
        return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "newest") return b.reportedAt.localeCompare(a.reportedAt);
      if (sort === "oldest") return a.reportedAt.localeCompare(b.reportedAt);
      return severityRank[a.severity] - severityRank[b.severity];
    });
    return list;
  }, [incidents, statusFilter, severityFilter, animalFilter, query, sort]);

  const activeCount = incidents.filter((i) => i.status !== "resolved").length;
  const criticalCount = incidents.filter((i) => i.severity === "critical").length;
  const todayCount = incidents.filter((i) => {
    const d = new Date(i.reportedAt);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }).length;
  const responders = incidents.reduce((s, i) => s + i.responders, 0);

  const downloadCsv = () => {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wildwatch-incidents-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const animalChoices = useMemo(
    () => Array.from(new Set([...animalTypes.map((a) => a.label), ...incidents.map((i) => i.animal)])).sort(),
    [incidents],
  );

  return (
    <div className="container py-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Live Feed
          </div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Active Incidents
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Real-time wildlife sightings reported by the BC campus community.
          </p>
        </div>
        <Link to="/report">
          <Button size="lg" className="rounded-full shadow-emergency">
            <Plus className="mr-1 h-4 w-4" />
            New Report
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active" value={activeCount.toString().padStart(2, "0")} accent="primary" />
        <StatCard label="Critical" value={criticalCount.toString().padStart(2, "0")} accent="warning" />
        <StatCard label="Responders" value={responders.toString().padStart(2, "0")} accent="info" />
        <StatCard label="Today" value={todayCount.toString().padStart(2, "0")} accent="success" />
      </div>

      {/* Search + filters */}
      <div className="mt-8 grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search animal, location, reporter, ID..."
            className="pl-9"
          />
        </div>
        <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as typeof severityFilter)}>
          <SelectTrigger className="w-full md:w-[150px]"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            {severityOptions.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s === "all" ? "All severities" : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={animalFilter} onValueChange={setAnimalFilter}>
          <SelectTrigger className="w-full md:w-[170px]"><SelectValue placeholder="Animal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All animals</SelectItem>
            {animalChoices.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-full md:w-[150px]"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="severity">By severity</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={downloadCsv}
          disabled={filtered.length === 0}
          className="md:rounded-full"
        >
          <Download className="mr-1 h-4 w-4" />
          CSV
        </Button>
      </div>

      {/* Status pills + view toggle */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {statusFilters.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-smooth ${
              statusFilter === f
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <div className="ml-auto flex rounded-full border border-border bg-card p-1 text-xs">
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1 rounded-full px-3 py-1 font-semibold transition-smooth ${
              view === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
          <button
            onClick={() => setView("map")}
            className={`flex items-center gap-1 rounded-full px-3 py-1 font-semibold transition-smooth ${
              view === "map" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MapIcon className="h-3.5 w-3.5" /> Map
          </button>
        </div>
      </div>

      <div className="mt-2 text-xs text-muted-foreground">
        Showing <span className="font-mono">{filtered.length}</span> of <span className="font-mono">{incidents.length}</span> incidents
      </div>

      {/* Body */}
      <div className="mt-5">
        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-border p-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading incidents…
          </div>
        ) : view === "map" ? (
          <IncidentsMap incidents={filtered} height={520} />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <AlertTriangle className="mx-auto h-8 w-8 opacity-50" />
            <p className="mt-3 text-sm">No incidents match your filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((i, idx) => <IncidentCard key={i.id} incident={i} index={idx} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "primary" | "warning" | "info" | "success";
}) {
  const colors = {
    primary: "text-primary",
    warning: "text-warning",
    info: "text-info",
    success: "text-success",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-2 font-display text-3xl font-bold tabular-nums ${colors[accent]}`}>
        {value}
      </div>
    </div>
  );
}
