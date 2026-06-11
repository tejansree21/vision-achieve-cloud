import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStore } from "@/hooks/useActiveStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Boxes, TrendingDown, Euro } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { active } = useActiveStore();
  const storeId = active?.id;

  const kpi = useQuery({
    queryKey: ["kpi", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const [sales, alerts, counts, products] = await Promise.all([
        supabase.from("pos_sales").select("total").eq("store_id", storeId!).gte("sold_at", since),
        supabase.from("shrinkage_alerts").select("variance_value,status").eq("store_id", storeId!),
        supabase.from("inventory_counts").select("variance_value").eq("store_id", storeId!).gte("counted_at", since),
        supabase.from("products").select("id").eq("store_id", storeId!),
      ]);
      const totalSales = (sales.data ?? []).reduce((a, r) => a + Number(r.total), 0);
      const openAlerts = (alerts.data ?? []).filter((a) => a.status === "open").length;
      const shrinkageValue = (alerts.data ?? []).reduce((a, r) => a + Number(r.variance_value), 0);
      const variancePct = totalSales > 0 ? (shrinkageValue / totalSales) * 100 : 0;
      return {
        totalSales, openAlerts, shrinkageValue, variancePct,
        skuCount: products.data?.length ?? 0,
        countsThisWeek: counts.data?.length ?? 0,
      };
    },
  });

  const recentAlerts = useQuery({
    queryKey: ["alerts-recent", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data } = await supabase.from("shrinkage_alerts")
        .select("*").eq("store_id", storeId!).eq("status", "open")
        .order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  if (!storeId) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-xl font-semibold">Create your first store</h2>
        <p className="mt-2 text-sm text-muted-foreground">You need a store before you can track inventory or shrinkage.</p>
        <Button asChild className="mt-4"><Link to="/stores">Go to Stores</Link></Button>
      </div>
    );
  }

  const cards = [
    { label: "7-day sales", value: `€${(kpi.data?.totalSales ?? 0).toFixed(2)}`, icon: Euro },
    { label: "Open alerts", value: kpi.data?.openAlerts ?? 0, icon: Bell },
    { label: "Shrinkage value", value: `€${(kpi.data?.shrinkageValue ?? 0).toFixed(2)}`, icon: TrendingDown },
    { label: "Variance %", value: `${(kpi.data?.variancePct ?? 0).toFixed(2)}%`, icon: TrendingDown },
    { label: "SKUs tracked", value: kpi.data?.skuCount ?? 0, icon: Boxes },
    { label: "Counts this week", value: kpi.data?.countsThisWeek ?? 0, icon: Boxes },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{active?.name}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{c.value}</div></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Recent open alerts</CardTitle></CardHeader>
        <CardContent>
          {recentAlerts.data && recentAlerts.data.length > 0 ? (
            <ul className="divide-y">
              {recentAlerts.data.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{a.category}</div>
                    <div className="text-xs text-muted-foreground">{a.message}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">€{Number(a.variance_value).toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">{Number(a.variance_pct).toFixed(1)}%</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No open alerts. Nice work.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}