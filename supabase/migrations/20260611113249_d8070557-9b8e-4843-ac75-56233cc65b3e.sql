
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'staff');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Stores
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  phone TEXT,
  franchise_number TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'Europe/Dublin',
  currency TEXT NOT NULL DEFAULT 'EUR',
  opening_hours JSONB,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- User-store role mapping (separate so we can do RLS without recursion)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, store_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security-definer helpers
CREATE OR REPLACE FUNCTION public.has_store_access(_user_id UUID, _store_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores WHERE id = _store_id AND owner_id = _user_id
    UNION
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND store_id = _store_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_store_role(_user_id UUID, _store_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores WHERE id = _store_id AND owner_id = _user_id AND _role = 'owner'
    UNION
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND store_id = _store_id AND role = _role
  );
$$;

-- Stores policies
CREATE POLICY "stores_select" ON public.stores FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_store_access(auth.uid(), id));
CREATE POLICY "stores_insert" ON public.stores FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "stores_update" ON public.stores FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "stores_delete" ON public.stores FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- user_roles policies
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));
CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));
CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));

-- Products (SKUs)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  current_stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, sku)
);
CREATE INDEX idx_products_store ON public.products(store_id);
CREATE INDEX idx_products_barcode ON public.products(barcode);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_access" ON public.products FOR ALL TO authenticated
  USING (public.has_store_access(auth.uid(), store_id))
  WITH CHECK (public.has_store_access(auth.uid(), store_id));

-- POS sales (mock POS data)
CREATE TABLE public.pos_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  cashier_id UUID REFERENCES auth.users(id),
  sold_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pos_sales_store_time ON public.pos_sales(store_id, sold_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_sales TO authenticated;
GRANT ALL ON public.pos_sales TO service_role;
ALTER TABLE public.pos_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos_sales_access" ON public.pos_sales FOR ALL TO authenticated
  USING (public.has_store_access(auth.uid(), store_id))
  WITH CHECK (public.has_store_access(auth.uid(), store_id));

-- Inventory counts
CREATE TABLE public.inventory_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  counted_qty INTEGER NOT NULL,
  expected_qty INTEGER NOT NULL,
  variance INTEGER NOT NULL,
  variance_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  counted_by UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  counted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inv_counts_store_time ON public.inventory_counts(store_id, counted_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_counts TO authenticated;
GRANT ALL ON public.inventory_counts TO service_role;
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_counts_access" ON public.inventory_counts FOR ALL TO authenticated
  USING (public.has_store_access(auth.uid(), store_id))
  WITH CHECK (public.has_store_access(auth.uid(), store_id));

-- Shrinkage alerts
CREATE TABLE public.shrinkage_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  variance_pct NUMERIC(5,2) NOT NULL,
  variance_value NUMERIC(10,2) NOT NULL,
  expected_qty INTEGER NOT NULL,
  counted_qty INTEGER NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  message TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_store_status ON public.shrinkage_alerts(store_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shrinkage_alerts TO authenticated;
GRANT ALL ON public.shrinkage_alerts TO service_role;
ALTER TABLE public.shrinkage_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_access" ON public.shrinkage_alerts FOR ALL TO authenticated
  USING (public.has_store_access(auth.uid(), store_id))
  WITH CHECK (public.has_store_access(auth.uid(), store_id));

-- Shifts (schedules)
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_shifts_store_time ON public.shifts(store_id, starts_at);
CREATE INDEX idx_shifts_user_time ON public.shifts(user_id, starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shifts_select" ON public.shifts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_store_access(auth.uid(), store_id));
CREATE POLICY "shifts_modify" ON public.shifts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
         OR public.has_store_role(auth.uid(), store_id, 'manager'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
              OR public.has_store_role(auth.uid(), store_id, 'manager'));

-- Time clock entries
CREATE TABLE public.time_clock_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out TIMESTAMPTZ,
  duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tc_user ON public.time_clock_entries(user_id, clock_in DESC);
CREATE INDEX idx_tc_store ON public.time_clock_entries(store_id, clock_in DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_clock_entries TO authenticated;
GRANT ALL ON public.time_clock_entries TO service_role;
ALTER TABLE public.time_clock_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tc_select" ON public.time_clock_entries FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_store_access(auth.uid(), store_id));
CREATE POLICY "tc_insert" ON public.time_clock_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.has_store_access(auth.uid(), store_id));
CREATE POLICY "tc_update" ON public.time_clock_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_stores_updated BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Profile auto-create on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (NEW.id, NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name');
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
