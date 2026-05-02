import { Severity } from "@/data/incidents";
import { cn } from "@/lib/utils";

const styles: Record<Severity, string> = {
  critical: "bg-severity-critical text-primary-foreground",
  high: "bg-severity-high text-primary-foreground",
  medium: "bg-severity-medium text-foreground",
  low: "bg-severity-low text-primary-foreground",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        styles[severity]
      )}
    >
      <span className="h-1 w-1 rounded-full bg-current opacity-90" />
      {severity}
    </span>
  );
}
