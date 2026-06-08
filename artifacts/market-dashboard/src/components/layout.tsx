import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
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
        <main className="pl-64 min-h-screen pb-12">
          <div className="max-w-[1600px] mx-auto p-6">
            {children}
          </div>
        </main>
        <QuickTradeBar />
        <PaperTradePanel />
      </div>
    </PaperTradeProvider>
  );
}
