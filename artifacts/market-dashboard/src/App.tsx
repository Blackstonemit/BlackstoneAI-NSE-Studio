import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";

import Dashboard from "@/pages/dashboard";
import SignalsBoard from "@/pages/signals";
import MarketFeed from "@/pages/market";
import OptionsChain from "@/pages/options";
import FuturesFeed from "@/pages/futures";
import AnalysisBoard from "@/pages/analysis";
import WatchlistBoard from "@/pages/watchlist";
import BacktestPage from "@/pages/backtest";
import SettingsDashboard from "@/pages/settings";
import ChartsPage from "@/pages/charts";
import BhavcopyPage from "@/pages/bhavcopy";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Layout>
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
        <Route path="/settings" component={SettingsDashboard} />
        <Route component={NotFound} />
      </Switch>
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
