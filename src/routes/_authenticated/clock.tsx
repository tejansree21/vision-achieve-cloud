import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStore } from "@/hooks/useActiveStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clock")({ component: ClockPage });

function ClockPage() {
  const { active } = useActiveStore();
  const storeId = active?.id;
  const qc = useQueryClient();

  const current = useQuery({
    queryKey: ["clock-current", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.from("time_clock_entries")
        .select("*").eq("user_id", u.user!.id).eq("store_id", storeId!)
        .is("clock_out", null).order("clock_in", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const history = useQuery({
    queryKey: ["clock-history", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.from("time_clock_entries")
        .select("*").eq("user_id", u.user!.id).eq("store_id", storeId!)
        .order("clock_in", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const clockIn = async () => {
    if (!storeId) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("time_clock_entries").insert({
      store_id: storeId, user_id: u.user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Clocked in");
    qc.invalidateQueries();
  };

  const clockOut = async () => {
    if (!current.data) return;
    const end = new Date();
    const start = new Date(current.data.clock_in);
    const duration = Math.round((end.getTime() - start.getTime()) / 60000);
    const { error } = await supabase.from("time_clock_entries").update({
      clock_out: end.toISOString(), duration_minutes: duration,
    }).eq("id", current.data.id);
    if (error) return toast.error(error.message);
    toast.success(`Clocked out · ${duration} min`);
    qc.invalidateQueries();
  };

  if (!storeId) return <p className="text-sm text-muted-foreground">Select a store first.</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clock In / Out</h1>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <Clock className="h-10 w-10 text-primary" />
          {current.data ? (
            <>
              <p className="text-lg">Clocked in at {new Date(current.data.clock_in).toLocaleTimeString()}</p>
              <Button size="lg" variant="destructive" className="w-full" onClick={clockOut}>Clock Out</Button>
            </>
          ) : (
            <>
              <p className="text-lg">You are not currently clocked in</p>
              <Button size="lg" className="w-full" onClick={clockIn}>Clock In</Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 font-semibold">Recent entries</h3>
          {history.data && history.data.length ? (
            <ul className="divide-y">
              {history.data.map((h) => (
                <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{new Date(h.clock_in).toLocaleString()}</span>
                  <span className="text-muted-foreground">
                    {h.clock_out ? `${h.duration_minutes} min` : "In progress"}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">No entries yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}