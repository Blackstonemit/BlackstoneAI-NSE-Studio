import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { PaperTradeProvider } from "@/hooks/use-paper-trade";
import { PaperTradePanel } from "./paper-trade-panel";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <PaperTradeProvider>
      <div className="min-h-screen bg-background text-foreground dark">
        <Sidebar />
        <main className="pl-64 min-h-screen">
          <div className="max-w-[1600px] mx-auto p-6">
            {children}
          </div>
        </main>
        <PaperTradePanel />
      </div>
    </PaperTradeProvider>
  );
}
