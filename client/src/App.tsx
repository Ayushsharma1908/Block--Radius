import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <Toaster />
        <Switch>
          <Route path="/" component={LandingPage} />
          <Route path="/app" component={Home} />
          <Route component={NotFound} />
        </Switch>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

