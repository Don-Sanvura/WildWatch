import { useIncidentsProviderMissing } from "@/store/incidents";
import { AlertTriangle } from "lucide-react";

/**
 * Dev-only banner shown when a child calls useIncidents without being
 * wrapped in <IncidentsProvider>. Replaces the previous blank-screen crash
 * with an actionable message.
 */
export function MissingProviderBanner() {
  const missing = useIncidentsProviderMissing();
  if (!missing || !import.meta.env.DEV) return null;

  return (
    <div className="container my-4">
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div>
          <p className="font-semibold text-foreground">
            IncidentsProvider is missing
          </p>
          <p className="mt-1 text-muted-foreground">
            A component on this page called <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">useIncidents()</code>{" "}
            without being wrapped in{" "}
            <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">&lt;IncidentsProvider&gt;</code>.
            The hook is returning an empty fallback so the page still renders.
            Wrap your route tree (see{" "}
            <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">src/components/AppLayout.tsx</code>) to restore
            real data.
          </p>
        </div>
      </div>
    </div>
  );
}
