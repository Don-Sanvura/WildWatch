import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useIncidents } from "@/store/incidents";
import { timeAgo } from "@/data/incidents";
import { SeverityBadge } from "@/components/SeverityBadge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  MapPin,
  User,
  Clock,
  Users,
  CheckCircle2,
  Search,
  BellRing,
  Share2,
  AlertTriangle,
  Circle,
  RotateCcw,
} from "lucide-react";

const statusMeta = {
  active: { label: "Active", cls: "text-primary", dot: "bg-primary" },
  investigating: { label: "Investigating", cls: "text-warning", dot: "bg-warning" },
  resolved: { label: "Resolved", cls: "text-success", dot: "bg-success" },
} as const;

const kindIcon = {
  reported: AlertTriangle,
  investigating: Search,
  resolved: CheckCircle2,
  responder: BellRing,
  note: Circle,
} as const;

export default function IncidentDetails() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { incidents, updateStatus, notifyResponders, getTimeline } = useIncidents();

  const incident = useMemo(() => incidents.find((i) => i.id === id), [incidents, id]);
  const timeline = incident ? getTimeline(incident.id) : [];

  if (!incident) {
    return (
      <div className="container py-16 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl font-bold">Incident not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been removed or the link is incorrect.
        </p>
        <Link to="/" className="mt-6 inline-block">
          <Button variant="outline" className="rounded-full">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to incidents
          </Button>
        </Link>
      </div>
    );
  }

  const status = statusMeta[incident.status];

  const handleResolve = () => {
    updateStatus(incident.id, "resolved");
    toast({ title: "Incident resolved", description: `${incident.id} marked as resolved.` });
  };

  const handleInvestigate = () => {
    updateStatus(incident.id, "investigating");
    toast({ title: "Status updated", description: `${incident.id} is now under investigation.` });
  };

  const handleReopen = () => {
    updateStatus(incident.id, "active");
    toast({ title: "Reopened", description: `${incident.id} returned to active.` });
  };

  const handleNotify = () => {
    notifyResponders(incident.id, 1);
    toast({ title: "Responders notified", description: "A responder has been dispatched." });
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Share with your team." });
    } catch {
      toast({ title: "Copy failed", description: url });
    }
  };

  return (
    <div className="container py-8 md:py-10">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-smooth hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      {/* Hero */}
      <div className="mt-4 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
        {incident.severity === "critical" && (
          <div className="h-1 w-full bg-gradient-to-r from-primary to-primary-glow" />
        )}
        <div className="flex flex-col gap-6 p-6 md:flex-row md:items-start md:p-8">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-secondary text-5xl">
            {incident.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={incident.severity} />
              <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                {incident.id}
              </span>
              <span className={`flex items-center gap-1.5 text-xs font-semibold ${status.cls}`}>
                <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
              {incident.animal}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              {incident.description}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Meta icon={MapPin} label="Location" value={incident.location} />
              <Meta icon={User} label="Reporter" value={incident.reporter} />
              <Meta
                icon={Clock}
                label="Reported"
                value={timeAgo(incident.reportedAt)}
                hint={new Date(incident.reportedAt).toLocaleString()}
              />
              <Meta
                icon={Users}
                label="Responders"
                value={`${incident.responders} on scene`}
              />
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-secondary/40 px-6 py-4 md:px-8">
          {incident.status !== "resolved" ? (
            <Button onClick={handleResolve} className="rounded-full">
              <CheckCircle2 className="mr-1 h-4 w-4" />
              Mark resolved
            </Button>
          ) : (
            <Button onClick={handleReopen} variant="outline" className="rounded-full">
              <RotateCcw className="mr-1 h-4 w-4" />
              Reopen
            </Button>
          )}
          {incident.status === "active" && (
            <Button onClick={handleInvestigate} variant="outline" className="rounded-full">
              <Search className="mr-1 h-4 w-4" />
              Move to investigating
            </Button>
          )}
          <Button onClick={handleNotify} variant="outline" className="rounded-full">
            <BellRing className="mr-1 h-4 w-4" />
            Notify responders
          </Button>
          <Button onClick={handleShare} variant="ghost" className="ml-auto rounded-full">
            <Share2 className="mr-1 h-4 w-4" />
            Share
          </Button>
        </div>
      </div>

      {/* Body grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Timeline */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                History
              </div>
              <h2 className="mt-1 font-display text-xl font-bold">Status timeline</h2>
            </div>
            <span className="text-xs text-muted-foreground">{timeline.length} events</span>
          </div>

          <ol className="relative mt-6 space-y-5 border-l border-border pl-6">
            {[...timeline].reverse().map((ev, idx) => {
              const Icon = kindIcon[ev.kind];
              return (
                <li key={`${ev.at}-${idx}`} className="relative">
                  <span className="absolute -left-[34px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background">
                    <Icon className="h-3 w-3 text-foreground" />
                  </span>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold">{ev.label}</p>
                    <span className="text-[11px] text-muted-foreground">
                      {timeAgo(ev.at)}
                    </span>
                  </div>
                  {ev.detail && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{ev.detail}</p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        {/* Side info */}
        <aside className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Safety guidance
            </div>
            <h3 className="mt-1 font-display text-lg font-bold">If you're nearby</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>• Maintain a safe distance and avoid sudden movement.</li>
              <li>• Do not attempt to feed or approach the animal.</li>
              <li>• Alert others in the area and clear the path.</li>
              <li>• Call campus security if behavior escalates.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Coordination
            </div>
            <h3 className="mt-1 font-display text-lg font-bold">Assigned team</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {incident.responders > 0
                ? `${incident.responders} responder${incident.responders > 1 ? "s" : ""} currently engaged.`
                : "No responders assigned yet."}
            </p>
            <Button
              onClick={handleNotify}
              variant="outline"
              size="sm"
              className="mt-4 w-full rounded-full"
            >
              <BellRing className="mr-1 h-4 w-4" />
              Dispatch another
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
