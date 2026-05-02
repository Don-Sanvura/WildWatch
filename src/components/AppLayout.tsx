import { Outlet } from "react-router-dom";
import { Header } from "@/components/Header";
import { ChatBot } from "@/components/ChatBot";
import { IncidentsProvider } from "@/store/incidents";

export default function AppLayout() {
  return (
    <IncidentsProvider>
      <div className="min-h-screen bg-gradient-subtle">
        <Header />
        <main className="pb-16">
          <Outlet />
        </main>
        <footer className="border-t border-border bg-card">
          <div className="container flex flex-col gap-2 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>© BC Wildwatch — Campus Wildlife Safety Network</span>
            <span className="font-mono">v1.0 · Built on Microsoft Power Platform</span>
          </div>
        </footer>
        <ChatBot />
      </div>
    </IncidentsProvider>
  );
}
