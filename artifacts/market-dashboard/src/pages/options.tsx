import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetOptionsChain, 
  getGetOptionsChainQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export default function OptionsChain() {
  const [symbol, setSymbol] = useState("NIFTY");
  const [searchInput, setSearchInput] = useState("NIFTY");
  const [expiry, setExpiry] = useState<string>("");
  
  const queryClient = useQueryClient();

  const { data: chainData, isLoading } = useGetOptionsChain(
    { symbol, expiry: expiry || undefined },
    { query: { queryKey: getGetOptionsChainQueryKey({ symbol, expiry: expiry || undefined }) } }
  );

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetOptionsChainQueryKey({ symbol, expiry: expiry || undefined }) });
    }, 30000);
    return () => clearInterval(interval);
  }, [queryClient, symbol, expiry]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSymbol(searchInput.trim().toUpperCase());
      setExpiry(""); // Reset expiry when changing symbol
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight font-mono">OPTIONS CHAIN</h1>
        
        <div className="flex gap-4 items-center">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 w-[200px] font-mono border-muted bg-card uppercase"
              placeholder="SYMBOL..."
            />
          </form>

          {chainData && chainData.expiries.length > 0 && (
            <Select value={expiry || chainData.selectedExpiry} onValueChange={setExpiry}>
              <SelectTrigger className="w-[150px] font-mono border-muted bg-card">
                <SelectValue placeholder="EXPIRY" />
              </SelectTrigger>
              <SelectContent>
                {chainData.expiries.map(exp => (
                  <SelectItem key={exp} value={exp}>
                    {new Date(exp).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {isLoading ? (
        <Card className="rounded-sm border-muted">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-full" />
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : !chainData ? (
        <div className="py-20 text-center border border-muted border-dashed rounded-sm bg-card">
          <h3 className="text-lg font-mono font-bold text-muted-foreground">NO DATA FOUND FOR {symbol}</h3>
        </div>
      ) : (
        <Card className="rounded-sm border-muted overflow-hidden">
          <div className="p-4 bg-muted/20 border-b border-muted flex justify-center items-center">
            <div className="font-mono text-sm tracking-widest text-muted-foreground">
              UNDERLYING SPOT: <span className="font-bold text-foreground text-lg ml-2">{chainData.underlyingPrice.toFixed(2)}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-muted bg-card hover:bg-card">
                  {/* CALLS */}
                  <TableHead className="font-mono text-xs text-center border-r border-muted bg-success/5 text-success w-[40%]">CALLS</TableHead>
                  {/* STRIKE */}
                  <TableHead className="font-mono text-xs text-center font-bold w-[20%]">STRIKE</TableHead>
                  {/* PUTS */}
                  <TableHead className="font-mono text-xs text-center border-l border-muted bg-destructive/5 text-destructive w-[40%]">PUTS</TableHead>
                </TableRow>
                <TableRow className="border-muted hover:bg-transparent">
                  {/* CALLS COLUMNS */}
                  <TableHead className="p-0">
                    <div className="grid grid-cols-4 h-full border-r border-muted text-xs font-mono text-muted-foreground">
                      <div className="p-2 text-right">OI</div>
                      <div className="p-2 text-right">VOL</div>
                      <div className="p-2 text-right">IV</div>
                      <div className="p-2 text-right pr-4">LTP</div>
                    </div>
                  </TableHead>
                  <TableHead className="p-0"></TableHead>
                  {/* PUTS COLUMNS */}
                  <TableHead className="p-0">
                    <div className="grid grid-cols-4 h-full border-l border-muted text-xs font-mono text-muted-foreground">
                      <div className="p-2 text-left pl-4">LTP</div>
                      <div className="p-2 text-left">IV</div>
                      <div className="p-2 text-left">VOL</div>
                      <div className="p-2 text-left">OI</div>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chainData.calls.map((call, i) => {
                  const put = chainData.puts[i];
                  if (!put) return null;
                  const isCallITM = call.strikePrice < chainData.underlyingPrice;
                  const isPutITM = put.strikePrice > chainData.underlyingPrice;

                  return (
                    <TableRow key={call.strikePrice} className="border-muted hover:bg-muted/20">
                      {/* CALLS */}
                      <TableCell className={cn("p-0", isCallITM ? "bg-success/5" : "")}>
                        <div className="grid grid-cols-4 border-r border-muted font-mono text-xs">
                          <div className="p-2 text-right text-muted-foreground">{call.openInterest.toLocaleString()}</div>
                          <div className="p-2 text-right text-muted-foreground">{call.volume.toLocaleString()}</div>
                          <div className="p-2 text-right text-muted-foreground">{call.impliedVolatility.toFixed(2)}</div>
                          <div className="p-2 text-right pr-4 font-bold">{call.ltp.toFixed(2)}</div>
                        </div>
                      </TableCell>
                      
                      {/* STRIKE */}
                      <TableCell className="p-2 text-center font-mono font-bold bg-muted/10 border-x border-muted">
                        {call.strikePrice}
                      </TableCell>
                      
                      {/* PUTS */}
                      <TableCell className={cn("p-0", isPutITM ? "bg-destructive/5" : "")}>
                        <div className="grid grid-cols-4 border-l border-muted font-mono text-xs">
                          <div className="p-2 text-left pl-4 font-bold">{put.ltp.toFixed(2)}</div>
                          <div className="p-2 text-left text-muted-foreground">{put.impliedVolatility.toFixed(2)}</div>
                          <div className="p-2 text-left text-muted-foreground">{put.volume.toLocaleString()}</div>
                          <div className="p-2 text-left text-muted-foreground">{put.openInterest.toLocaleString()}</div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
