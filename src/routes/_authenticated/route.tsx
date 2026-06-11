import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger, SidebarFooter } from "@/components/ui/sidebar";
import { BarChart3, Boxes, Bell, Calendar, Clock, Users, Store, ShieldCheck, LogOut, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStores, useActiveStore } from "@/hooks/useActiveStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedShell,
});

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/alerts", label: "Shrinkage Alerts", icon: Bell },
  { to: "/schedule", label: "Schedule", icon: Calendar },
  { to: "/clock", label: "Clock In/Out", icon: Clock },
  { to: "/timesheets", label: "Timesheets", icon: FileText },
  { to: "/staff", label: "Staff", icon: Users },
  { to: "/stores", label: "Stores", icon: Store },
] as const;

function AuthedShell() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const storesQ = useStores();
  const stores = storesQ.data ?? [];
  const { active, select } = useActiveStore();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon">
          <SidebarContent>
            <div className="flex items-center gap-2 px-4 py-4 font-semibold">
              <ShieldCheck className="h-5 w-5 text-primary" /> RetailFlow
            </div>
            <SidebarGroup>
              <SidebarGroupLabel>Main</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nav.map((n) => (
                    <SidebarMenuItem key={n.to}>
                      <SidebarMenuButton asChild isActive={path === n.to}>
                        <Link to={n.to}>
                          <n.icon className="h-4 w-4" />
                          <span>{n.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <Button variant="ghost" size="sm" onClick={signOut} className="justify-start">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </SidebarFooter>
        </Sidebar>
        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center gap-3 border-b bg-card px-4">
            <SidebarTrigger />
            {stores.length > 0 && active ? (
              <Select value={active.id} onValueChange={select}>
                <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-sm text-muted-foreground">No store yet — create one in Stores</span>
            )}
          </header>
          <main className="flex-1 bg-background p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}