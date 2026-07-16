import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { Loader2 } from "lucide-react";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const SignalsBoard = lazy(() => import("@/pages/signals"));
const MarketFeed = lazy(() => import("@/pages/market"));
const OptionsChain = lazy(() => import("@/pages/options"));
const FuturesFeed = lazy(() => import("@/pages/futures"));
const AnalysisBoard = lazy(() => import("@/pages/analysis"));
const WatchlistBoard = lazy(() => import("@/pages/watchlist"));
const BacktestPage = lazy(() => import("@/pages/backtest"));
const SettingsDashboard = lazy(() => import("@/pages/settings"));
const ChartsPage = lazy(() => import("@/pages/charts"));
const BhavcopyPage = lazy(() => import("@/pages/bhavcopy"));
const ScalpingPage = lazy(() => import("@/pages/scalping"));
const MultibaggerPage = lazy(() => import("@/pages/multibagger"));
const AlertsPage = lazy(() => import("@/pages/alerts"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageFallback = () => (
  <div className="flex items-center justify-center h-64">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

function Router() {
  return (
    <Layout>
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/signals" component={SignalsBoard} />
          <Route path="/market" component={MarketFeed} />
          <Route path="/options" component={OptionsChain} />
          <Route path="/futures" component={FuturesFeed} />
          <Route path="/analysis" component={AnalysisBoard} />
          <Route path="/watchlist" component={WatchlistBoard} />
          <Route path="/backtest" component={BacktestPage} />
          <Route path="/charts" component={ChartsPage} />
          <Route path="/bhavcopy" component={BhavcopyPage} />
          <Route path="/scalping" component={ScalpingPage} />
          <Route path="/multibagger" component={MultibaggerPage} />
          <Route path="/alerts" component={AlertsPage} />
          <Route path="/settings" component={SettingsDashboard} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
