import { NavLink, useNavigate } from "react-router-dom";
import { Activity, MessageCircle, BarChart3, FileText, Shield, LogIn, LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/store/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const tabs = [
  { to: "/", label: "Incidents", icon: Activity },
  { to: "/portal", label: "Safety Portal", icon: MessageCircle },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/report", label: "Report", icon: FileText },
];

export function Header() {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();

  const initials = (() => {
    const name =
      (user?.user_metadata?.display_name as string) ||
      (user?.user_metadata?.full_name as string) ||
      user?.email ||
      "";
    return name
      .replace(/@.*/, "")
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "U";
  })();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-4">
        <NavLink to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-emergency shadow-emergency">
            <Shield className="h-4.5 w-4.5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="font-display text-base font-bold tracking-tight">BC Wildwatch</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Campus Safety
            </div>
          </div>
        </NavLink>

        <nav className="hidden items-center gap-1 rounded-full border border-border bg-card p-1 shadow-card md:flex">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-smooth ${
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium md:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            System Live
          </div>

          {loading ? null : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 items-center gap-2 rounded-full border border-border bg-card px-1 pr-3 text-xs font-medium shadow-card transition-smooth hover:bg-secondary"
                  aria-label="Account menu"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-emergency text-[10px] font-bold text-primary-foreground">
                    {initials}
                  </span>
                  <span className="hidden max-w-[10rem] truncate sm:inline">
                    {user.email}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <UserIcon className="mr-2 h-4 w-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    navigate("/auth");
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <NavLink
              to="/auth"
              className="flex h-9 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-xs font-semibold text-background transition-smooth hover:opacity-90"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign in
            </NavLink>
          )}
        </div>
      </div>

      {/* Mobile tab bar */}
      <nav className="md:hidden border-t border-border bg-card">
        <div className="container grid grid-cols-4">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-smooth ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
}
