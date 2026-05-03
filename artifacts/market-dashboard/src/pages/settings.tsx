import { useState } from "react";
import { useSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Settings2, RefreshCw, BarChart2, Eye, Save, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <CardHeader className="p-4 border-b border-muted">
      <CardTitle className="text-sm font-mono flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </CardTitle>
    </CardHeader>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-muted/40 last:border-0">
      <div>
        <div className="text-sm font-mono font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      <div className="ml-4 shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsDashboard() {
  const { settings, update, reset } = useSettings();
  const { toast } = useToast();
  const [local, setLocal] = useState(settings);

  const handleSave = () => {
    update(local);
    toast({ title: "Settings Saved", description: "Your preferences have been saved." });
  };

  const handleReset = () => {
    setLocal({ ...DEFAULT_SETTINGS });
    reset();
    toast({ title: "Settings Reset", description: "All settings restored to defaults." });
  };

  const set = <K extends keyof typeof local>(key: K, val: (typeof local)[K]) =>
    setLocal((prev) => ({ ...prev, [key]: val }));

  const intervalOptions = [
    { label: "15 seconds", value: 15000 },
    { label: "30 seconds", value: 30000 },
    { label: "1 minute", value: 60000 },
    { label: "5 minutes", value: 300000 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight font-mono">SETTINGS</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} className="font-mono border-muted">
            <RotateCcw className="h-4 w-4 mr-2" />
            RESET DEFAULTS
          </Button>
          <Button onClick={handleSave} className="font-mono bg-primary text-primary-foreground hover:bg-primary/90">
            <Save className="h-4 w-4 mr-2" />
            SAVE SETTINGS
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* General */}
        <Card className="rounded-sm border-muted bg-card">
          <SectionHeader icon={Settings2} title="GENERAL" />
          <CardContent className="p-4">
            <Row label="Default Symbol" hint="Symbol loaded by default in Options & Analysis">
              <Input
                value={local.defaultSymbol}
                onChange={(e) => set("defaultSymbol", e.target.value.toUpperCase())}
                className="w-32 font-mono bg-background border-muted uppercase text-sm"
              />
            </Row>
            <Row label="Default Exchange">
              <Select value={local.defaultExchange} onValueChange={(v: "NSE" | "BSE") => set("defaultExchange", v)}>
                <SelectTrigger className="w-24 font-mono border-muted bg-background text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NSE">NSE</SelectItem>
                  <SelectItem value="BSE">BSE</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="NIFTY Lot Size" hint="Used in backtest P&L calculation">
              <Input
                type="number"
                value={local.lotSize}
                onChange={(e) => set("lotSize", Number(e.target.value))}
                className="w-24 font-mono bg-background border-muted text-sm"
              />
            </Row>
            <Row label="Risk-Free Rate (%)" hint="Used for Black-Scholes option pricing">
              <Input
                type="number"
                step="0.1"
                value={local.riskFreeRate}
                onChange={(e) => set("riskFreeRate", Number(e.target.value))}
                className="w-24 font-mono bg-background border-muted text-sm"
              />
            </Row>
            <Row label="Default IV (%)" hint="Initial IV for backtest if not specified">
              <Input
                type="number"
                step="0.5"
                value={local.defaultIV}
                onChange={(e) => set("defaultIV", Number(e.target.value))}
                className="w-24 font-mono bg-background border-muted text-sm"
              />
            </Row>
          </CardContent>
        </Card>

        {/* Refresh */}
        <Card className="rounded-sm border-muted bg-card">
          <SectionHeader icon={RefreshCw} title="AUTO-REFRESH" />
          <CardContent className="p-4">
            <Row label="Auto-Refresh" hint="Automatically refresh market data">
              <Toggle checked={local.autoRefresh} onChange={(v) => set("autoRefresh", v)} />
            </Row>
            <Row label="Refresh Interval" hint="How often to fetch new data">
              <Select
                value={String(local.refreshInterval)}
                onValueChange={(v) => set("refreshInterval", Number(v))}
              >
                <SelectTrigger className="w-36 font-mono border-muted bg-background text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {intervalOptions.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
          </CardContent>
        </Card>

        {/* Signals */}
        <Card className="rounded-sm border-muted bg-card">
          <SectionHeader icon={BarChart2} title="SIGNALS" />
          <CardContent className="p-4">
            <Row label="Default Timeframe" hint="Default timeframe for signal generation">
              <Select
                value={local.defaultTimeframe}
                onValueChange={(v: "INTRADAY" | "SWING" | "POSITIONAL") => set("defaultTimeframe", v)}
              >
                <SelectTrigger className="w-36 font-mono border-muted bg-background text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTRADAY">INTRADAY</SelectItem>
                  <SelectItem value="SWING">SWING</SelectItem>
                  <SelectItem value="POSITIONAL">POSITIONAL</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="Signal Symbols" hint="Comma-separated symbols for AI signal generation">
              <Input
                value={local.signalSymbols}
                onChange={(e) => set("signalSymbols", e.target.value.toUpperCase())}
                className="w-64 font-mono bg-background border-muted text-sm uppercase"
                placeholder="NIFTY,BANKNIFTY,RELIANCE"
              />
            </Row>
          </CardContent>
        </Card>

        {/* Display */}
        <Card className="rounded-sm border-muted bg-card">
          <SectionHeader icon={Eye} title="DISPLAY" />
          <CardContent className="p-4">
            <Row label="Show Synthetic Data" hint="Show synthetic options data when live NSE feed is unavailable">
              <Toggle checked={local.showSyntheticData} onChange={(v) => set("showSyntheticData", v)} />
            </Row>
            <Row label="Highlight ATM Strike" hint="Visually highlight the At-The-Money strike in options chain">
              <Toggle checked={local.highlightATM} onChange={(v) => set("highlightATM", v)} />
            </Row>
          </CardContent>
        </Card>
      </div>

      {/* Info panel */}
      <Card className="rounded-sm border-muted/40 bg-muted/10">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <div className="text-muted-foreground mb-1">CURRENT SYMBOL</div>
              <div className="font-bold">{local.defaultSymbol} / {local.defaultExchange}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">REFRESH</div>
              <div className="font-bold">{local.autoRefresh ? `Every ${local.refreshInterval / 1000}s` : "PAUSED"}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">LOT SIZE</div>
              <div className="font-bold">{local.lotSize} units</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">RISK-FREE RATE</div>
              <div className="font-bold">{local.riskFreeRate}% p.a.</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
