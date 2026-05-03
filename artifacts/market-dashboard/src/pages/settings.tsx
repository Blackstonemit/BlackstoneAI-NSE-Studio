import { useState, useEffect } from "react";
import { useSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Settings2, RefreshCw, BarChart2, Eye, Save, RotateCcw, BrainCircuit, Sliders, Layers, CheckCircle2, XCircle, ExternalLink, Eye as EyeIcon, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ProviderStatus = {
  provider: "nvidia" | "openai" | "claude" | "gemini";
  configured: boolean;
  enabled: boolean;
  isDefault: boolean;
};

const PROVIDER_META: Record<string, { label: string; color: string; keyUrl: string; keyHint: string; model: string }> = {
  nvidia: {
    label: "NVIDIA NIM",
    color: "text-green-400",
    keyUrl: "https://build.nvidia.com/explore/discover",
    keyHint: "nvapi-...",
    model: "Qwen 3.5 122B",
  },
  openai: {
    label: "OpenAI",
    color: "text-blue-400",
    keyUrl: "https://platform.openai.com/api-keys",
    keyHint: "sk-...",
    model: "GPT-4o Mini",
  },
  claude: {
    label: "Anthropic Claude",
    color: "text-orange-400",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyHint: "sk-ant-...",
    model: "Claude 3.5 Haiku",
  },
  gemini: {
    label: "Google Gemini",
    color: "text-yellow-400",
    keyUrl: "https://aistudio.google.com/apikey",
    keyHint: "AIza...",
    model: "Gemini 1.5 Flash",
  },
};

function AIProvidersCard() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/ai-providers/status");
      const data = await res.json() as ProviderStatus[];
      setProviders(data);
    } catch {
      toast({ title: "Error", description: "Could not load AI provider status.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchStatus(); }, []);

  const handleSaveKey = async (provider: "openai" | "claude" | "gemini") => {
    const key = keyInputs[provider]?.trim();
    if (!key || key.length < 8) {
      toast({ title: "Invalid Key", description: "Please enter a valid API key.", variant: "destructive" });
      return;
    }
    setSaving((p) => ({ ...p, [provider]: true }));
    try {
      const res = await fetch(`/api/ai-providers/${provider}/key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({ title: "API Key Saved", description: `${PROVIDER_META[provider].label} is now active as a fallback.` });
      setKeyInputs((p) => ({ ...p, [provider]: "" }));
      await fetchStatus();
    } catch {
      toast({ title: "Error", description: "Failed to save API key.", variant: "destructive" });
    } finally {
      setSaving((p) => ({ ...p, [provider]: false }));
    }
  };

  const handleOpenKeyPage = (provider: string) => {
    window.open(PROVIDER_META[provider]?.keyUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Card className="rounded-sm border-primary/20 bg-card">
      <CardHeader className="p-4 border-b border-muted">
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          AI PROVIDERS
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full border border-muted text-muted-foreground font-normal tracking-wider">
            AUTO-FALLBACK
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground font-mono">
          When the primary provider fails, the system automatically tries the next configured one in order.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono py-4">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading provider status…
          </div>
        ) : (
          <div className="space-y-3">
            {providers.map((p, idx) => {
              const meta = PROVIDER_META[p.provider];
              if (!meta) return null;
              const isNvidia = p.provider === "nvidia";

              return (
                <div key={p.provider} className={cn(
                  "rounded-sm border p-3 space-y-2 transition-colors",
                  p.configured ? "border-muted bg-muted/5" : "border-muted/40 bg-muted/5 opacity-70"
                )}>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground/50 w-5">#{idx + 1}</span>
                    <div className={cn("font-mono font-bold text-sm", meta.color)}>{meta.label}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{meta.model}</div>
                    <div className="ml-auto flex items-center gap-1.5">
                      {p.configured ? (
                        <div className="flex items-center gap-1 text-[10px] font-mono text-green-400">
                          <CheckCircle2 className="h-3 w-3" />
                          CONNECTED
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/50">
                          <XCircle className="h-3 w-3" />
                          NOT CONFIGURED
                        </div>
                      )}
                    </div>
                  </div>

                  {!isNvidia && (
                    <div className="flex items-center gap-2 pt-1">
                      <div className="relative flex-1">
                        <Input
                          type={showKey[p.provider] ? "text" : "password"}
                          value={keyInputs[p.provider] ?? ""}
                          onChange={(e) => setKeyInputs((prev) => ({ ...prev, [p.provider]: e.target.value }))}
                          placeholder={p.configured ? "Enter new key to update…" : meta.keyHint}
                          className="font-mono text-xs bg-background border-muted pr-8 h-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey((prev) => ({ ...prev, [p.provider]: !prev[p.provider] }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showKey[p.provider] ? <EyeOff className="h-3 w-3" /> : <EyeIcon className="h-3 w-3" />}
                        </button>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenKeyPage(p.provider)}
                        className="font-mono text-xs border-muted h-8 gap-1 shrink-0"
                        title={`Get ${meta.label} API key`}
                      >
                        <ExternalLink className="h-3 w-3" />
                        GET KEY
                      </Button>
                      <Button
                        size="sm"
                        disabled={!keyInputs[p.provider] || saving[p.provider]}
                        onClick={() => handleSaveKey(p.provider as "openai" | "gemini")}
                        className="font-mono text-xs h-8 shrink-0"
                      >
                        {saving[p.provider] ? <Loader2 className="h-3 w-3 animate-spin" /> : "SAVE"}
                      </Button>
                    </div>
                  )}

                  {isNvidia && (
                    <p className="text-[10px] text-muted-foreground font-mono">
                      Configured via environment variable. Primary provider for all AI analysis.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionHeader({ icon: Icon, title, badge }: { icon: React.ElementType; title: string; badge?: string }) {
  return (
    <CardHeader className="p-4 border-b border-muted">
      <CardTitle className="text-sm font-mono flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        {title}
        {badge && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full border border-primary/30 text-primary bg-primary/10 font-normal tracking-wider">
            {badge}
          </span>
        )}
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
      <span className={cn(
        "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
        checked ? "translate-x-4" : "translate-x-0.5"
      )} />
    </button>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-muted/40 last:border-0">
      <div className="flex-1 min-w-0 mr-4">
        <div className="text-sm font-mono font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function StyleBadge({ style }: { style: string }) {
  const colors: Record<string, string> = {
    conservative: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    moderate: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    aggressive: "bg-red-500/20 text-red-300 border-red-500/30",
  };
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 border rounded-full font-mono font-bold uppercase tracking-wider", colors[style] ?? "bg-muted/20 text-muted-foreground")}>
      {style}
    </span>
  );
}

export default function SettingsDashboard() {
  const { settings, update, reset } = useSettings();
  const { toast } = useToast();
  const [local, setLocal] = useState(settings);

  const handleSave = () => {
    update(local);
    toast({ title: "Settings Saved", description: "All preferences saved successfully." });
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

  const styleDesc: Record<string, string> = {
    conservative: "Fewer, high-confidence signals. Tighter SL/target ratios. Prefer confirmation.",
    moderate: "Balanced signals. Standard risk/reward. Default for most traders.",
    aggressive: "More signals, wider targets, higher risk tolerance. Suitable for active traders.",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight font-mono">SETTINGS</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} className="font-mono border-muted">
            <RotateCcw className="h-4 w-4 mr-2" />RESET DEFAULTS
          </Button>
          <Button onClick={handleSave} className="font-mono bg-primary text-primary-foreground hover:bg-primary/90">
            <Save className="h-4 w-4 mr-2" />SAVE SETTINGS
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* General */}
        <Card className="rounded-sm border-muted bg-card">
          <SectionHeader icon={Settings2} title="GENERAL" />
          <CardContent className="p-4">
            <Row label="Default Symbol" hint="Symbol loaded by default in Options & Analysis">
              <Input value={local.defaultSymbol} onChange={(e) => set("defaultSymbol", e.target.value.toUpperCase())}
                className="w-32 font-mono bg-background border-muted uppercase text-sm" />
            </Row>
            <Row label="Default Exchange">
              <Select value={local.defaultExchange} onValueChange={(v: "NSE" | "BSE") => set("defaultExchange", v)}>
                <SelectTrigger className="w-24 font-mono border-muted bg-background text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NSE">NSE</SelectItem>
                  <SelectItem value="BSE">BSE</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="NIFTY Lot Size" hint="Used in backtest P&L calculation">
              <Input type="number" value={local.lotSize} onChange={(e) => set("lotSize", Number(e.target.value))}
                className="w-24 font-mono bg-background border-muted text-sm" />
            </Row>
            <Row label="Risk-Free Rate (%)" hint="Used for Black-Scholes option pricing">
              <Input type="number" step="0.1" value={local.riskFreeRate} onChange={(e) => set("riskFreeRate", Number(e.target.value))}
                className="w-24 font-mono bg-background border-muted text-sm" />
            </Row>
            <Row label="Default IV (%)" hint="Initial IV for backtest if not specified">
              <Input type="number" step="0.5" value={local.defaultIV} onChange={(e) => set("defaultIV", Number(e.target.value))}
                className="w-24 font-mono bg-background border-muted text-sm" />
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
              <Select value={String(local.refreshInterval)} onValueChange={(v) => set("refreshInterval", Number(v))}>
                <SelectTrigger className="w-36 font-mono border-muted bg-background text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {intervalOptions.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
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
              <Select value={local.defaultTimeframe} onValueChange={(v: "INTRADAY" | "SWING" | "POSITIONAL") => set("defaultTimeframe", v)}>
                <SelectTrigger className="w-36 font-mono border-muted bg-background text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTRADAY">INTRADAY</SelectItem>
                  <SelectItem value="SWING">SWING</SelectItem>
                  <SelectItem value="POSITIONAL">POSITIONAL</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="Signal Symbols" hint="Comma-separated symbols for AI signal generation">
              <Input value={local.signalSymbols} onChange={(e) => set("signalSymbols", e.target.value.toUpperCase())}
                className="w-64 font-mono bg-background border-muted text-sm uppercase" placeholder="NIFTY,BANKNIFTY,RELIANCE" />
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

      {/* ── AI Agent Settings (full width) ─────────────────────────────────── */}
      <Card className="rounded-sm border-primary/30 bg-card">
        <SectionHeader icon={BrainCircuit} title="AI AGENT" badge="NVIDIA QWEN" />
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            {/* Left column */}
            <div>
              <Row label="Default Instrument Type" hint="Type of instrument the agent analyses by default">
                <Select value={local.agentInstrumentType} onValueChange={(v: typeof local.agentInstrumentType) => set("agentInstrumentType", v)}>
                  <SelectTrigger className="w-36 font-mono border-muted bg-background text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STOCK">STOCK</SelectItem>
                    <SelectItem value="INDEX">INDEX</SelectItem>
                    <SelectItem value="OPTIONS">OPTIONS</SelectItem>
                    <SelectItem value="FUTURES">FUTURES</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Agent Timeframe" hint="Default analysis horizon for agent signals">
                <Select value={local.agentTimeframe} onValueChange={(v: typeof local.agentTimeframe) => set("agentTimeframe", v)}>
                  <SelectTrigger className="w-36 font-mono border-muted bg-background text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INTRADAY">INTRADAY</SelectItem>
                    <SelectItem value="SWING">SWING</SelectItem>
                    <SelectItem value="POSITIONAL">POSITIONAL</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Max Signals" hint="Maximum number of signals per agent run (1–5)">
                <div className="flex items-center gap-3">
                  <Slider
                    min={1} max={5} step={1}
                    value={[local.agentNumSignals]}
                    onValueChange={([v]) => set("agentNumSignals", v)}
                    className="w-28"
                  />
                  <span className="font-mono font-bold text-sm w-4">{local.agentNumSignals}</span>
                </div>
              </Row>
              <Row label="Max Response Tokens" hint="Higher = more detailed analysis (512–4096)">
                <div className="flex items-center gap-3">
                  <Slider
                    min={512} max={4096} step={256}
                    value={[local.agentMaxTokens]}
                    onValueChange={([v]) => set("agentMaxTokens", v)}
                    className="w-28"
                  />
                  <span className="font-mono font-bold text-sm w-12">{local.agentMaxTokens}</span>
                </div>
              </Row>
            </div>

            {/* Right column */}
            <div>
              <Row label="Confidence Threshold (%)" hint="Only show signals above this confidence level">
                <div className="flex items-center gap-3">
                  <Slider
                    min={0} max={90} step={5}
                    value={[local.agentConfidenceThreshold]}
                    onValueChange={([v]) => set("agentConfidenceThreshold", v)}
                    className="w-28"
                  />
                  <span className={cn("font-mono font-bold text-sm w-8",
                    local.agentConfidenceThreshold >= 70 ? "text-green-400" :
                    local.agentConfidenceThreshold >= 40 ? "text-yellow-400" : "text-muted-foreground"
                  )}>{local.agentConfidenceThreshold}%</span>
                </div>
              </Row>
              <Row label="Auto-Run on Page Load" hint="Automatically run agent analysis when opening Technical Analysis">
                <Toggle checked={local.agentAutoRun} onChange={(v) => set("agentAutoRun", v)} />
              </Row>
              <Row label="Save Signals to DB" hint="Persist AI-generated signals to the signals board">
                <Toggle checked={local.agentSaveSignals} onChange={(v) => set("agentSaveSignals", v)} />
              </Row>
              <Row label="Auto-Generate Signals" hint="Server auto-generates signals every 30 min during market hours">
                <Toggle checked={local.agentAutoGenerate} onChange={(v) => set("agentAutoGenerate", v)} />
              </Row>
            </div>
          </div>

          {/* Trading style (full width) */}
          <div className="mt-2 pt-4 border-t border-muted/40 space-y-3">
            <div className="flex items-center gap-2">
              <Sliders className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-mono font-bold tracking-wider text-muted-foreground">TRADING STYLE</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(["conservative", "moderate", "aggressive"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("agentStyle", s)}
                  className={cn(
                    "rounded-sm border p-3 text-left transition-all",
                    local.agentStyle === s
                      ? s === "conservative" ? "border-blue-500/50 bg-blue-500/10"
                        : s === "moderate" ? "border-yellow-500/50 bg-yellow-500/10"
                        : "border-red-500/50 bg-red-500/10"
                      : "border-muted bg-muted/5 hover:bg-muted/20"
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono font-bold text-sm uppercase tracking-wide">{s}</span>
                    <StyleBadge style={s} />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{styleDesc[s]}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom context */}
          <div className="mt-4 pt-4 border-t border-muted/40 space-y-2">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-mono font-bold tracking-wider text-muted-foreground">CUSTOM CONTEXT / INSTRUCTIONS</span>
              <span className="text-xs text-muted-foreground font-mono">(optional — injected into every agent prompt)</span>
            </div>
            <Textarea
              value={local.agentCustomContext}
              onChange={(e) => set("agentCustomContext", e.target.value)}
              placeholder='e.g. "Focus only on large-cap NSE stocks. Prefer options strategies. I hold overnight positions."'
              className="font-mono text-xs bg-background border-muted resize-none h-20 placeholder:text-muted-foreground/50"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── AI Providers (full width) ──────────────────────────────────────── */}
      <AIProvidersCard />

      {/* Status summary */}
      <Card className="rounded-sm border-muted/40 bg-muted/10">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs font-mono">
            <div><div className="text-muted-foreground mb-1">SYMBOL / EXCH</div><div className="font-bold">{local.defaultSymbol} / {local.defaultExchange}</div></div>
            <div><div className="text-muted-foreground mb-1">REFRESH</div><div className="font-bold">{local.autoRefresh ? `Every ${local.refreshInterval / 1000}s` : "PAUSED"}</div></div>
            <div><div className="text-muted-foreground mb-1">LOT SIZE</div><div className="font-bold">{local.lotSize} units</div></div>
            <div><div className="text-muted-foreground mb-1">AGENT STYLE</div><div className="font-bold"><StyleBadge style={local.agentStyle} /></div></div>
            <div><div className="text-muted-foreground mb-1">MIN CONFIDENCE</div><div className="font-bold">{local.agentConfidenceThreshold}%</div></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
