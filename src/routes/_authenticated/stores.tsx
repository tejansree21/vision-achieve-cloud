import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStores } from "@/hooks/useActiveStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { seedSampleProducts, seedMockSales } from "@/lib/seed";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/stores")({
  component: StoresPage,
});

function StoresPage() {
  const { data: stores, refetch } = useStores();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [city, setCity] = useState("Dublin");
  const [franchise, setFranchise] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("stores").insert({
        name, city, franchise_number: franchise, owner_id: u.user!.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Store created");
      setName(""); setFranchise("");
      qc.invalidateQueries({ queryKey: ["stores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const seed = async (storeId: string) => {
    try {
      toast.info("Seeding sample products & 7 days of POS sales…");
      await seedSampleProducts(storeId);
      await seedMockSales(storeId, 7);
      qc.invalidateQueries();
      toast.success("Seeded sample data");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stores</h1>
        <p className="text-sm text-muted-foreground">Create a store, then seed sample products and POS sales.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Create a new store</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="SPAR Rathmines" /></div>
          <div><Label>City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
          <div><Label>Franchise #</Label><Input value={franchise} onChange={(e) => setFranchise(e.target.value)} /></div>
          <div className="md:col-span-3">
            <Button disabled={!name || create.isPending} onClick={() => create.mutate()}>Create store</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {stores?.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.city ?? "—"} · {s.franchise_number ?? "no franchise #"} · {s.currency}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => seed(s.id)}>Seed sample data</Button>
            </CardContent>
          </Card>
        ))}
        {(!stores || stores.length === 0) && (
          <p className="text-sm text-muted-foreground">No stores yet.</p>
        )}
      </div>
    </div>
  );
}