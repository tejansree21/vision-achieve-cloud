import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const KEY = "rf_active_store";

export function useStores() {
  return useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useActiveStore() {
  const { data: stores, isLoading } = useStores();
  const [activeId, setActiveId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(KEY) : null,
  );

  useEffect(() => {
    if (!activeId && stores && stores.length > 0) {
      setActiveId(stores[0].id);
      localStorage.setItem(KEY, stores[0].id);
    }
  }, [stores, activeId]);

  const select = (id: string) => {
    setActiveId(id);
    localStorage.setItem(KEY, id);
  };

  const active = stores?.find((s) => s.id === activeId) ?? stores?.[0] ?? null;
  return { stores: stores ?? [], active, select, loading: isLoading };
}