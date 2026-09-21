import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const Home = lazy(() => import("./pages/Home"));
const NotFound = lazy(() => import("./pages/NotFound"));

function RouteFallback() {
  return (
    <div className="loading-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
      <Loader2 className="spin" size={28} style={{ color: "var(--amber)" }} />
      <span style={{ fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>
        Loading workspace…
      </span>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <Toaster />
        <Suspense fallback={<RouteFallback />}>
          <Switch>
            <Route path="/" component={LandingPage} />
            <Route path="/app" component={Home} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

