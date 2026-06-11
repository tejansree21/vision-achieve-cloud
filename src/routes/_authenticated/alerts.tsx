import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStore } from "@/hooks/useActiveStore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/alerts")({ component: AlertsPage });

function AlertsPage() {
  const { active } = useActiveStore();
  const storeId = active?.id;
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["alerts", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase.from("shrinkage_alerts")
        .select("*").eq("store_id", storeId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const update = async (id: string, status: string) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("shrinkage_alerts").update({
      status, resolved_at: status === "open" ? null : new Date().toISOString(),
      resolved_by: status === "open" ? null : u.user!.id,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "open" ? "Reopened" : "Updated");
    qc.invalidateQueries({ queryKey: ["alerts", storeId] });
  };

  if (!storeId) return <p className="text-sm text-muted-foreground">Select a store first.</p>;

  const open = (list.data ?? []).filter((a) => a.status === "open");
  const investigating = (list.data ?? []).filter((a) => a.status === "investigating");
  const resolved = (list.data ?? []).filter((a) => a.status === "resolved" || a.status === "dismissed");

  const Row = (a: NonNullable<typeof list.data>[number]) => (
    <Card key={a.id}>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{a.category}</span>
            <Badge variant={a.severity === "high" ? "destructive" : a.severity === "medium" ? "default" : "secondary"}>
              {a.severity}
            </Badge>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{a.message}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Expected {a.expected_qty} · Counted {a.counted_qty} · {new Date(a.created_at).toLocaleString()}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold">€{Number(a.variance_value).toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">{Number(a.variance_pct).toFixed(1)}%</div>
        </div>
        <div className="flex gap-2">
          {a.status === "open" && <Button size="sm" onClick={() => update(a.id, "investigating")}>Investigate</Button>}
          {a.status === "investigating" && <Button size="sm" onClick={() => update(a.id, "resolved")}>Resolve</Button>}
          {a.status !== "dismissed" && a.status !== "resolved" && <Button size="sm" variant="outline" onClick={() => update(a.id, "dismissed")}>Dismiss</Button>}
          {(a.status === "resolved" || a.status === "dismissed") && <Button size="sm" variant="outline" onClick={() => update(a.id, "open")}>Reopen</Button>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shrinkage Alerts</h1>
        <p className="text-sm text-muted-foreground">Created from inventory counts with &gt;1% variance.</p>
      </div>
      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open ({open.length})</TabsTrigger>
          <TabsTrigger value="investigating">Investigating ({investigating.length})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({resolved.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="space-y-3 pt-4">{open.length ? open.map(Row) : <p className="text-sm text-muted-foreground">No open alerts.</p>}</TabsContent>
        <TabsContent value="investigating" className="space-y-3 pt-4">{investigating.length ? investigating.map(Row) : <p className="text-sm text-muted-foreground">None.</p>}</TabsContent>
        <TabsContent value="closed" className="space-y-3 pt-4">{resolved.length ? resolved.map(Row) : <p className="text-sm text-muted-foreground">None.</p>}</TabsContent>
      </Tabs>
    </div>
  );
}