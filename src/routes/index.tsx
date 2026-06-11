import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, BarChart3, Boxes, Clock, Bell, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RetailFlow — Shrinkage detection for convenience stores" },
      { name: "description", content: "Track inventory, detect shrinkage, schedule staff, clock in & out — built for SPAR and convenience retailers." },
      { property: "og:title", content: "RetailFlow" },
      { property: "og:description", content: "POS-integrated shrinkage detection & store ops." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Boxes, title: "Inventory counts", desc: "Barcode-ready counts with live POS-derived expected stock." },
  { icon: ShieldCheck, title: "Shrinkage alerts", desc: "Variance flagged by category, SKU, time and staff shift." },
  { icon: BarChart3, title: "Owner dashboard", desc: "KPIs you actually use: sales, variance %, value lost." },
  { icon: Calendar, title: "Staff scheduling", desc: "Simple shift planning. Staff see their schedule on mobile." },
  { icon: Clock, title: "Clock in & out", desc: "One-tap clock-in. Auto timesheet export for payroll." },
  { icon: Bell, title: "Urgent only", desc: "Alerts you can act on. No notification spam." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" />
            RetailFlow
          </div>
          <Button asChild size="sm"><Link to="/auth">Sign in</Link></Button>
        </div>
      </header>
      <main>
        <section className="mx-auto max-w-6xl px-6 py-20 text-center">
          <p className="mb-3 text-sm font-medium text-primary">Built for SPAR & convenience retailers</p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            What happened to my inventory?
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            RetailFlow detects shrinkage in real time. See variance by category, time, and staff. Cut shrink by 0.5–1%.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg"><Link to="/auth">Get started</Link></Button>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-6">
                <f.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} RetailFlow
      </footer>
    </div>
  );
}
