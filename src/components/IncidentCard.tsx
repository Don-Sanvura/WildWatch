import { Incident, timeAgo } from "@/data/incidents";
import { SeverityBadge } from "./SeverityBadge";
import { MapPin, Users, ChevronRight, Image as ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { getPhotoUrl, type FullIncident } from "@/store/incidents";

const statusLabels = {
  active: { label: "Active", cls: "text-primary" },
  investigating: { label: "Investigating", cls: "text-warning" },
  resolved: { label: "Resolved", cls: "text-success" },
};

export function IncidentCard({ incident, index = 0 }: { incident: Incident; index?: number }) {
  const status = statusLabels[incident.status];
  return (
    <Link
      to={`/incidents/${incident.id}`}
      className="group relative block overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-smooth hover:-translate-y-0.5 hover:shadow-elevated animate-slide-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {incident.severity === "critical" && (
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary to-primary-glow" />
      )}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-2xl">
          {incident.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={incident.severity} />
            <span className="text-[10px] font-mono font-medium text-muted-foreground">
              {incident.id}
            </span>
          </div>
          <h3 className="mt-1.5 font-display text-lg font-bold leading-tight">
            {incident.animal}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {incident.description}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {incident.location}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {incident.responders} responders
            </span>
            <span className={`font-semibold ${status.cls}`}>● {status.label}</span>
            <span className="ml-auto">{timeAgo(incident.reportedAt)}</span>
          </div>
        </div>
        <ChevronRight className="hidden h-5 w-5 shrink-0 text-muted-foreground transition-smooth group-hover:translate-x-0.5 group-hover:text-foreground sm:block" />
      </div>
    </Link>
  );
}
