import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./components/AppLayout";
import Incidents from "./pages/Incidents";
import IncidentDetails from "./pages/IncidentDetails";
import Portal from "./pages/Portal";
import Analytics from "./pages/Analytics";
import Report from "./pages/Report";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound.tsx";
import { IncidentsRouteGuard } from "./components/IncidentsRouteGuard";
import { AuthProvider } from "./store/auth";
import { MapContextProvider } from "./store/mapContext";

const queryClient = new QueryClient();

const guarded = (node: JSX.Element) => <IncidentsRouteGuard>{node}</IncidentsRouteGuard>;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <MapContextProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={guarded(<Incidents />)} />
              <Route path="/incidents/:id" element={guarded(<IncidentDetails />)} />
              <Route path="/portal" element={guarded(<Portal />)} />
              <Route path="/analytics" element={guarded(<Analytics />)} />
              <Route path="/report" element={guarded(<Report />)} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </MapContextProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
