import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStore } from "@/hooks/useActiveStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { maybeCreateAlert } from "@/lib/shrinkage";
import { toast } from "sonner";
import { Plus, Scan } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inventory")({ component: InventoryPage });

function InventoryPage() {
  const { active } = useActiveStore();
  const storeId = active?.id;
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const products = useQuery({
    queryKey: ["products", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase.from("products")
        .select("*").eq("store_id", storeId!).order("name");
      if (error) throw error;
      return data;
    },
  });

  if (!storeId) return <p className="text-sm text-muted-foreground">Select a store first.</p>;

  const filtered = (products.data ?? []).filter((p) =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode ?? "").includes(search),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {products.data?.length ?? 0} SKUs</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Search name, SKU, barcode…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
          <AddProductDialog storeId={storeId} onAdded={() => qc.invalidateQueries({ queryKey: ["products", storeId] })} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.sku}</TableCell>
                  <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                  <TableCell className="text-right">{p.current_stock}</TableCell>
                  <TableCell className="text-right">€{Number(p.unit_price).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <CountDialog product={p} storeId={storeId} />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No products. Add one or seed sample data in Stores.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AddProductDialog({ storeId, onAdded }: { storeId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", sku: "", barcode: "", category: "Grocery", unit_price: "0", unit_cost: "0", current_stock: "0" });

  const submit = async () => {
    const { error } = await supabase.from("products").insert({
      store_id: storeId, name: f.name, sku: f.sku, barcode: f.barcode || null,
      category: f.category, unit_price: Number(f.unit_price), unit_cost: Number(f.unit_cost),
      current_stock: Number(f.current_stock),
    });
    if (error) return toast.error(error.message);
    toast.success("Product added"); setOpen(false); onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Add product</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add product</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>SKU</Label><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></div>
          <div><Label>Barcode</Label><Input value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} /></div>
          <div><Label>Category</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
          <div><Label>Stock</Label><Input type="number" value={f.current_stock} onChange={(e) => setF({ ...f, current_stock: e.target.value })} /></div>
          <div><Label>Price (€)</Label><Input type="number" step="0.01" value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: e.target.value })} /></div>
          <div><Label>Cost (€)</Label><Input type="number" step="0.01" value={f.unit_cost} onChange={(e) => setF({ ...f, unit_cost: e.target.value })} /></div>
        </div>
        <Button onClick={submit} disabled={!f.name || !f.sku}>Save</Button>
      </DialogContent>
    </Dialog>
  );
}

function CountDialog({ product, storeId }: { product: { id: string; name: string; current_stock: number; category: string; unit_cost: number | string }; storeId: string }) {
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState("");
  const qc = useQueryClient();

  const expectedQ = useQuery({
    queryKey: ["expected", product.id],
    enabled: open,
    queryFn: async () => {
      const since = new Date(); since.setHours(0, 0, 0, 0);
      const { data } = await supabase.from("pos_sales")
        .select("quantity").eq("product_id", product.id).gte("sold_at", since.toISOString());
      const soldToday = (data ?? []).reduce((a, r) => a + r.quantity, 0);
      return Math.max(product.current_stock - soldToday, 0);
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const expected = expectedQ.data ?? product.current_stock;
      const countedN = Number(counted);
      const variance = countedN - expected;
      const variance_value = Math.abs(variance) * Number(product.unit_cost);
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("inventory_counts").insert({
        store_id: storeId, product_id: product.id,
        counted_qty: countedN, expected_qty: expected, variance,
        variance_value: Number(variance_value.toFixed(2)),
        counted_by: u.user!.id,
      });
      if (error) throw error;
      await supabase.from("products").update({ current_stock: countedN }).eq("id", product.id);
      await maybeCreateAlert({
        storeId, productId: product.id, category: product.category,
        expected, counted: countedN, unitCost: Number(product.unit_cost),
      });
    },
    onSuccess: () => {
      toast.success("Count saved");
      setOpen(false); setCounted("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><Scan className="h-3 w-3" /> Count</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{product.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-muted p-3 text-sm">
            Expected: <strong>{expectedQ.data ?? "…"}</strong> units (current stock minus today's POS sales)
          </div>
          <div><Label>Counted units</Label><Input type="number" value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus /></div>
          {counted && expectedQ.data != null && (
            <p className="text-sm text-muted-foreground">Variance: {Number(counted) - expectedQ.data}</p>
          )}
          <Button onClick={() => submit.mutate()} disabled={!counted || submit.isPending} className="w-full">Save count</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}