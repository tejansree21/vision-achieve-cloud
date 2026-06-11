import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStore } from "@/hooks/useActiveStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/timesheets")({ component: TimesheetsPage });

function TimesheetsPage() {
  const { active } = useActiveStore();
  const storeId = active?.id;

  const entries = useQuery({
    queryKey: ["timesheets", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: tc } = await supabase.from("time_clock_entries")
        .select("*").eq("store_id", storeId!).gte("clock_in", since)
        .order("clock_in", { ascending: false });
      const uids = [...new Set((tc ?? []).map((t) => t.user_id))];
      const { data: profiles } = uids.length
        ? await supabase.from("profiles").select("id, first_name, last_name, email").in("id", uids)
        : { data: [] };
      return (tc ?? []).map((t) => ({
        ...t,
        name: (() => {
          const p = profiles?.find((x) => x.id === t.user_id);
          return p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email : t.user_id.slice(0, 8);
        })(),
      }));
    },
  });

  const exportCsv = () => {
    const rows = entries.data ?? [];
    const header = "Name,Clock In,Clock Out,Minutes\n";
    const body = rows.map((r) =>
      [r.name, new Date(r.clock_in).toISOString(), r.clock_out ? new Date(r.clock_out).toISOString() : "", r.duration_minutes ?? ""].join(",")
    ).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `timesheets-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (!storeId) return <p className="text-sm text-muted-foreground">Select a store first.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Timesheets</h1>
          <p className="text-sm text-muted-foreground">Last 30 days · export to send to payroll.</p>
        </div>
        <Button onClick={exportCsv} disabled={!entries.data?.length}><Download className="h-4 w-4" /> Export CSV</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Clock In</TableHead><TableHead>Clock Out</TableHead><TableHead className="text-right">Minutes</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(entries.data ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.name}</TableCell>
                  <TableCell>{new Date(e.clock_in).toLocaleString()}</TableCell>
                  <TableCell>{e.clock_out ? new Date(e.clock_out).toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-right">{e.duration_minutes ?? "—"}</TableCell>
                </TableRow>
              ))}
              {!entries.data?.length && <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No entries.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}