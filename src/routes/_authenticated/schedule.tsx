import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStore } from "@/hooks/useActiveStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/schedule")({ component: SchedulePage });

function SchedulePage() {
  const { active } = useActiveStore();
  const storeId = active?.id;
  const qc = useQueryClient();
  const [form, setForm] = useState({ user_id: "", starts_at: "", ends_at: "" });

  const team = useQuery({
    queryKey: ["team-min", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("store_id", storeId!);
      const ids = new Set<string>([u.user!.id, ...(roles ?? []).map((r) => r.user_id)]);
      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, email").in("id", [...ids]);
      return profiles ?? [];
    },
  });

  const shifts = useQuery({
    queryKey: ["shifts", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data } = await supabase.from("shifts").select("*").eq("store_id", storeId!).order("starts_at");
      return data ?? [];
    },
  });

  const create = async () => {
    if (!storeId) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("shifts").insert({
      store_id: storeId, user_id: form.user_id,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      created_by: u.user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Shift created");
    setForm({ user_id: "", starts_at: "", ends_at: "" });
    qc.invalidateQueries({ queryKey: ["shifts", storeId] });
  };

  const remove = async (id: string) => {
    await supabase.from("shifts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["shifts", storeId] });
  };

  const nameOf = (uid: string) => {
    const p = team.data?.find((x) => x.id === uid);
    if (!p) return uid.slice(0, 8);
    return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email;
  };

  if (!storeId) return <p className="text-sm text-muted-foreground">Select a store first.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-sm text-muted-foreground">Plan shifts for your team.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>New shift</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>Person</Label>
            <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {team.data?.map((p) => <SelectItem key={p.id} value={p.id}>{nameOf(p.id)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Start</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
          <div><Label>End</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
          <div className="flex items-end"><Button onClick={create} disabled={!form.user_id || !form.starts_at || !form.ends_at}>Add shift</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Upcoming shifts</CardTitle></CardHeader>
        <CardContent>
          {shifts.data && shifts.data.length > 0 ? (
            <ul className="divide-y">
              {shifts.data.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{nameOf(s.user_id)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(s.starts_at).toLocaleString()} → {new Date(s.ends_at).toLocaleString()}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => remove(s.id)}>Delete</Button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">No shifts scheduled.</p>}
        </CardContent>
      </Card>
    </div>
  );
}