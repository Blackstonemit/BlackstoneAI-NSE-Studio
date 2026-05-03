import { Link, useLocation } from "wouter";
import { 
  Activity, 
  LineChart, 
  BarChart2, 
  Layers, 
  TrendingUp, 
  List,
  TerminalSquare,
  FlaskConical,
  Settings2,
  CandlestickChart
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Live Dashboard", icon: Activity },
  { href: "/signals", label: "Signals Board", icon: TerminalSquare },
  { href: "/market", label: "Market Feed", icon: LineChart },
  { href: "/options", label: "Options Chain", icon: Layers },
  { href: "/futures", label: "Futures", icon: BarChart2 },
  { href: "/analysis", label: "Technical Analysis", icon: TrendingUp },
  { href: "/charts", label: "Charts", icon: CandlestickChart },
  { href: "/backtest", label: "Backtest", icon: FlaskConical },
  { href: "/watchlist", label: "Watchlist", icon: List },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border h-screen flex flex-col fixed top-0 left-0 z-20">
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 text-primary font-bold text-lg font-mono">
          <TerminalSquare className="h-5 w-5" />
          <span>TERMINAL</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className="block">
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-4 border-t border-sidebar-border text-xs text-muted-foreground font-mono">
        <div>SYSTEM: ONLINE</div>
        <div className="text-success">LATENCY: 12ms</div>
      </div>
    </div>
  );
}
