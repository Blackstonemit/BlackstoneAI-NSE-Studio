import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Plus, Trash2, TrendingUp, TrendingDown, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface PriceAlert {
  id: number;
  symbol: string;
  name: string;
  condition: "ABOVE" | "BELOW";
  targetPrice: number;
  status: "ACTIVE" | "TRIGGERED" | "CANCELLED";
  triggeredAt: string | null;
  triggeredPrice: number | null;
  createdAt: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchAlerts(): Promise<PriceAlert[]> {
  const r = await fetch(`${BASE}/api/alerts`);
  if (!r.ok) throw new Error("Failed to fetch alerts");
  return r.json();
}

async function createAlert(body: { symbol: string; name: string; condition: "ABOVE" | "BELOW"; targetPrice: number }) {
  const r = await fetch(`${BASE}/api/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Failed to create alert");
  return r.json();
}

async function deleteAlert(id: number) {
  const r = await fetch(`${BASE}/api/alerts/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed to delete alert");
}

const STATUS_CONFIG = {
  ACTIVE:    { label: "Active",    color: "bg-blue-500/10 text-blue-400 border-blue-800/30",   icon: Clock },
  TRIGGERED: { label: "Triggered", color: "bg-green-500/10 text-green-400 border-green-800/30", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", color: "bg-muted/30 text-muted-foreground border-border",    icon: XCircle },
} as const;

export default function AlertsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: alerts = [], isLoading } = useQuery<PriceAlert[]>({
    queryKey: ["alerts"],
    queryFn: fetchAlerts,
    refetchInterval: 30_000,
  });

  const createMut = useMutation({
    mutationFn: createAlert,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      setForm({ symbol: "", name: "", condition: "ABOVE", targetPrice: "" });
      toast({ title: "Alert created", description: `Watching ${form.symbol.toUpperCase()}` });
    },
    onError: () => toast({ title: "Error", description: "Failed to create alert", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
    onError: () => toast({ title: "Error", description: "Failed to delete alert", variant: "destructive" }),
  });

  const [form, setForm] = useState<{ symbol: string; name: string; condition: "ABOVE" | "BELOW"; targetPrice: string }>({
    symbol: "", name: "", condition: "ABOVE", targetPrice: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price = parseFloat(form.targetPrice);
    if (!form.symbol.trim() || isNaN(price) || price <= 0) {
      toast({ title: "Invalid input", description: "Enter a valid symbol and price", variant: "destructive" });
      return;
    }
    createMut.mutate({
      symbol: form.symbol.trim().toUpperCase(),
      name: form.name.trim() || form.symbol.trim().toUpperCase(),
      condition: form.condition,
      targetPrice: price,
    });
  }

  const active    = alerts.filter((a) => a.status === "ACTIVE");
  const triggered = alerts.filter((a) => a.status === "TRIGGERED");
  const cancelled = alerts.filter((a) => a.status === "CANCELLED");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono flex items-center gap-2">
            <Bell className="h-6 w-6 text-yellow-400" />
            PRICE ALERTS
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {active.length} active · {triggered.length} triggered
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-xs">
          Auto-refresh 30s
        </Badge>
      </div>

      {/* Create Alert Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            NEW ALERT
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <Input
              placeholder="Symbol (e.g. RELIANCE)"
              value={form.symbol}
              onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
              className="font-mono uppercase text-sm"
            />
            <Input
              placeholder="Name (optional)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="text-sm"
            />
            <select
              value={form.condition}
              onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value as "ABOVE" | "BELOW" }))}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            >
              <option value="ABOVE">Price ABOVE ▲</option>
              <option value="BELOW">Price BELOW ▼</option>
            </select>
            <Input
              type="number"
              step="0.01"
              placeholder="Target price (₹)"
              value={form.targetPrice}
              onChange={(e) => setForm((f) => ({ ...f, targetPrice: e.target.value }))}
              className="font-mono text-sm"
            />
            <Button type="submit" disabled={createMut.isPending} className="font-mono">
              {createMut.isPending ? "Creating…" : "Set Alert"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Alerts Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground font-mono">
            Loading alerts…
          </CardContent>
        </Card>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bell className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">No alerts set. Create one above to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {[
            { label: "ACTIVE", items: active },
            { label: "TRIGGERED", items: triggered },
            { label: "CANCELLED", items: cancelled },
          ].filter((g) => g.items.length > 0).map((group) => (
            <Card key={group.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono text-muted-foreground tracking-widest">{group.label}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 text-muted-foreground">
                      <th className="text-left px-4 py-2">SYMBOL</th>
                      <th className="text-left px-4 py-2">CONDITION</th>
                      <th className="text-right px-4 py-2">TARGET</th>
                      <th className="text-right px-4 py-2">TRIGGERED @</th>
                      <th className="text-left px-4 py-2">STATUS</th>
                      <th className="text-left px-4 py-2">CREATED</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((alert) => {
                      const cfg = STATUS_CONFIG[alert.status];
                      const StatusIcon = cfg.icon;
                      return (
                        <tr key={alert.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">{alert.symbol}</div>
                            <div className="text-muted-foreground text-[10px]">{alert.name}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`flex items-center gap-1 ${alert.condition === "ABOVE" ? "text-green-400" : "text-red-400"}`}>
                              {alert.condition === "ABOVE"
                                ? <TrendingUp className="h-3 w-3" />
                                : <TrendingDown className="h-3 w-3" />}
                              {alert.condition}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-yellow-400">₹{alert.targetPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-right">
                            {alert.triggeredPrice != null
                              ? <span className="text-green-400">₹{alert.triggeredPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                              : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border text-[10px] ${cfg.color}`}>
                              <StatusIcon className="h-3 w-3" />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(alert.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteMut.mutate(alert.id)}
                              disabled={deleteMut.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </>
      )}

      <p className="text-xs text-muted-foreground/60 border-t border-border pt-3">
        ⚠ Alerts are checked on a polling basis. Trigger accuracy depends on data refresh intervals. Not financial advice.
      </p>
    </div>
  );
}
