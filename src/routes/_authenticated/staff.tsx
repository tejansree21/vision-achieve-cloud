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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/staff")({ component: StaffPage });

function StaffPage() {
  const { active } = useActiveStore();
  const storeId = active?.id;
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "staff">("staff");

  const team = useQuery({
    queryKey: ["team", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles")
        .select("*").eq("store_id", storeId!);
      const userIds = (roles ?? []).map((r) => r.user_id);
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("*").in("id", userIds)
        : { data: [] };
      return (roles ?? []).map((r) => ({
        ...r, profile: profiles?.find((p) => p.id === r.user_id),
      }));
    },
  });

  const invite = async () => {
    if (!storeId) return;
    const { data: profile, error: pErr } = await supabase.from("profiles")
      .select("id").eq("email", email).maybeSingle();
    if (pErr) return toast.error(pErr.message);
    if (!profile) return toast.error("No user with that email. Ask them to sign up first.");
    const { error } = await supabase.from("user_roles").insert({
      user_id: profile.id, store_id: storeId, role,
    });
    if (error) return toast.error(error.message);
    toast.success("Added to team");
    setEmail("");
    qc.invalidateQueries({ queryKey: ["team", storeId] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["team", storeId] });
  };

  if (!storeId) return <p className="text-sm text-muted-foreground">Select a store first.</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Staff</h1>
        <p className="text-sm text-muted-foreground">Manage who can access this store.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Add a team member</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="Email of an existing RetailFlow user" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select value={role} onValueChange={(v) => setRole(v as "manager" | "staff")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={invite} disabled={!email}>Add</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {team.data?.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">{m.profile?.first_name ?? ""} {m.profile?.last_name ?? ""}</div>
                <div className="text-xs text-muted-foreground">{m.profile?.email}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge>{m.role}</Badge>
                <Button variant="outline" size="sm" onClick={() => remove(m.id)}>Remove</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}