import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { StockSearch } from "./stock-search";
import { PaperTradeProvider } from "@/hooks/use-paper-trade";
import { PaperTradePanel } from "./paper-trade-panel";
import { QuickTradeBar } from "./quick-trade-bar";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <PaperTradeProvider>
      <div className="min-h-screen bg-background text-foreground dark">
        <Sidebar />
        <div className="pl-64 flex flex-col min-h-screen">
          {/* Global sticky top bar with search */}
          <header className="sticky top-0 z-30 h-13 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex items-center px-6 gap-4">
            <StockSearch />
            <span className="text-[10px] text-muted-foreground/40 font-mono whitespace-nowrap hidden lg:block">
              NSE &amp; BSE · Real-time
            </span>
          </header>
          <main className="flex-1 pb-12">
            <div className="max-w-[1600px] mx-auto p-6">
              {children}
            </div>
          </main>
        </div>
        <QuickTradeBar />
        <PaperTradePanel />
      </div>
    </PaperTradeProvider>
  );
}
