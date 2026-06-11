import { supabase } from "@/integrations/supabase/client";

const SAMPLE = [
  { sku: "MILK-1L", barcode: "5012345000017", name: "Whole Milk 1L", category: "Dairy", price: 1.85, cost: 1.10 },
  { sku: "BRD-WHT", barcode: "5012345000024", name: "White Bread 800g", category: "Bakery", price: 2.20, cost: 1.20 },
  { sku: "YOG-STR", barcode: "5012345000031", name: "Strawberry Yogurt", category: "Dairy", price: 1.30, cost: 0.65 },
  { sku: "BAN-KG", barcode: "5012345000048", name: "Bananas 1kg", category: "Produce", price: 1.50, cost: 0.80 },
  { sku: "COL-500", barcode: "5012345000055", name: "Cola 500ml", category: "Beverages", price: 1.95, cost: 0.85 },
  { sku: "CHP-150", barcode: "5012345000062", name: "Crisps 150g", category: "Snacks", price: 2.40, cost: 1.05 },
  { sku: "PIZ-FRZ", barcode: "5012345000079", name: "Frozen Pizza", category: "Frozen", price: 4.50, cost: 2.20 },
  { sku: "ICE-CRM", barcode: "5012345000086", name: "Ice Cream 500ml", category: "Frozen", price: 3.99, cost: 1.80 },
  { sku: "CHOC-100", barcode: "5012345000093", name: "Chocolate Bar 100g", category: "Snacks", price: 1.75, cost: 0.70 },
  { sku: "EGG-12", barcode: "5012345000109", name: "Eggs 12pk", category: "Dairy", price: 3.20, cost: 1.90 },
  { sku: "PST-500", barcode: "5012345000116", name: "Pasta 500g", category: "Grocery", price: 1.45, cost: 0.60 },
  { sku: "BEER-4PK", barcode: "5012345000123", name: "Beer 4-pack", category: "Alcohol", price: 8.50, cost: 5.00 },
];

export async function seedSampleProducts(storeId: string) {
  const rows = SAMPLE.map((p) => ({
    store_id: storeId,
    sku: p.sku,
    barcode: p.barcode,
    name: p.name,
    category: p.category,
    unit_price: p.price,
    unit_cost: p.cost,
    current_stock: 100 + Math.floor(Math.random() * 200),
  }));
  const { error } = await supabase.from("products").upsert(rows, { onConflict: "store_id,sku" });
  if (error) throw error;
}

export async function seedMockSales(storeId: string, days = 7) {
  const { data: products, error: pErr } = await supabase
    .from("products").select("id, unit_price").eq("store_id", storeId);
  if (pErr) throw pErr;
  if (!products || products.length === 0) return;

  const sales: Array<{
    store_id: string; product_id: string; quantity: number;
    unit_price: number; total: number; sold_at: string;
  }> = [];
  const now = Date.now();
  for (let d = 0; d < days; d++) {
    for (let i = 0; i < 30; i++) {
      const p = products[Math.floor(Math.random() * products.length)];
      const qty = 1 + Math.floor(Math.random() * 4);
      const ts = new Date(now - d * 86400000 - Math.floor(Math.random() * 86400000));
      sales.push({
        store_id: storeId,
        product_id: p.id,
        quantity: qty,
        unit_price: Number(p.unit_price),
        total: Number((qty * Number(p.unit_price)).toFixed(2)),
        sold_at: ts.toISOString(),
      });
    }
  }
  for (let i = 0; i < sales.length; i += 100) {
    const chunk = sales.slice(i, i + 100);
    const { error } = await supabase.from("pos_sales").insert(chunk);
    if (error) throw error;
  }
}