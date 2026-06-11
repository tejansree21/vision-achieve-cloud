import { supabase } from "@/integrations/supabase/client";

export type SeverityLevel = "low" | "medium" | "high";

export function classifyVariance(pct: number): SeverityLevel {
  const a = Math.abs(pct);
  if (a >= 3) return "high";
  if (a >= 1) return "medium";
  return "low";
}

export async function maybeCreateAlert(opts: {
  storeId: string;
  productId: string;
  category: string;
  expected: number;
  counted: number;
  unitCost: number;
}) {
  const { storeId, productId, category, expected, counted, unitCost } = opts;
  if (expected <= 0) return;
  const variance = counted - expected;
  const variancePct = (variance / expected) * 100;
  if (Math.abs(variancePct) < 1) return;
  const variance_value = Math.abs(variance) * unitCost;
  const severity = classifyVariance(variancePct);
  await supabase.from("shrinkage_alerts").insert({
    store_id: storeId,
    product_id: productId,
    category,
    variance_pct: Number(variancePct.toFixed(2)),
    variance_value: Number(variance_value.toFixed(2)),
    expected_qty: expected,
    counted_qty: counted,
    severity,
    status: "open",
    message: `${category}: ${variance} unit variance (${variancePct.toFixed(1)}%)`,
  });
}