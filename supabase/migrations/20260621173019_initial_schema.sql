-- ── Reference tables ─────────────────────────────────────────────────────────

CREATE TABLE stations (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name     TEXT NOT NULL,
  sequence INT  NOT NULL,
  active   BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE models (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name   TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE model_station_config (
  model_id   UUID NOT NULL REFERENCES models(id),
  station_id UUID NOT NULL REFERENCES stations(id),
  active     BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (model_id, station_id)
);

-- ── Orders ───────────────────────────────────────────────────────────────────

CREATE TABLE orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,
  order_date   DATE NOT NULL,
  due_date     DATE NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE order_lines (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  model_id UUID NOT NULL REFERENCES models(id),
  quantity INT  NOT NULL CHECK (quantity > 0),
  active   BOOLEAN NOT NULL DEFAULT true
);

-- ── People ───────────────────────────────────────────────────────────────────

CREATE TABLE leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE user_roles (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    TEXT NOT NULL CHECK (role IN ('supervisor', 'admin')),
  UNIQUE (user_id)
);

-- ── Production data ──────────────────────────────────────────────────────────

CREATE TABLE period_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE NOT NULL,
  period       TEXT NOT NULL CHECK (period IN ('P1','P2','P3','P4','P5','P6')),
  station_id   UUID NOT NULL REFERENCES stations(id),
  model_id     UUID NOT NULL REFERENCES models(id),
  target       INT  NOT NULL CHECK (target >= 0),
  actual       INT  NOT NULL CHECK (actual >= 0),
  pax          INT  NOT NULL CHECK (pax >= 0),
  defects      INT  NOT NULL CHECK (defects >= 0),
  submitted_by UUID NOT NULL REFERENCES leads(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE period_log_edits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_log_id   UUID NOT NULL REFERENCES period_log(id),
  edited_by       UUID NOT NULL REFERENCES leads(id),
  edited_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  prev_target     INT NOT NULL,
  new_target      INT NOT NULL,
  prev_actual     INT NOT NULL,
  new_actual      INT NOT NULL,
  prev_pax        INT NOT NULL,
  new_pax         INT NOT NULL,
  prev_defects    INT NOT NULL,
  new_defects     INT NOT NULL
);

-- ── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE stations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE models               ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_station_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines          ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads                ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_log_edits     ENABLE ROW LEVEL SECURITY;

-- Helper: returns the calling user's role (null if not a supervisor/admin)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER AS $$
  SELECT role FROM user_roles WHERE user_id = auth.uid()
$$;

-- Reference tables: anon can SELECT (entry form dropdowns use anon key)
--                   supervisor/admin can INSERT/UPDATE
CREATE POLICY "stations_select"  ON stations             FOR SELECT USING (true);
CREATE POLICY "stations_modify"  ON stations             FOR ALL    USING (get_user_role() IN ('supervisor','admin'));
CREATE POLICY "models_select"    ON models               FOR SELECT USING (true);
CREATE POLICY "models_modify"    ON models               FOR ALL    USING (get_user_role() IN ('supervisor','admin'));
CREATE POLICY "msc_select"       ON model_station_config FOR SELECT USING (true);
CREATE POLICY "msc_modify"       ON model_station_config FOR ALL    USING (get_user_role() IN ('supervisor','admin'));
CREATE POLICY "orders_select"    ON orders               FOR SELECT USING (true);
CREATE POLICY "orders_modify"    ON orders               FOR ALL    USING (get_user_role() IN ('supervisor','admin'));
CREATE POLICY "ol_select"        ON order_lines          FOR SELECT USING (true);
CREATE POLICY "ol_modify"        ON order_lines          FOR ALL    USING (get_user_role() IN ('supervisor','admin'));

-- leads: anon SELECT for name dropdown; service role handles password_hash (never queried via anon key)
CREATE POLICY "leads_select"  ON leads FOR SELECT USING (true);
CREATE POLICY "leads_modify"  ON leads FOR ALL    USING (get_user_role() IN ('supervisor','admin'));

-- user_roles: admin only
CREATE POLICY "user_roles_all" ON user_roles FOR ALL USING (get_user_role() = 'admin');

-- period_log / period_log_edits: service role for writes; supervisors/admins can SELECT
CREATE POLICY "pl_select"  ON period_log       FOR SELECT USING (get_user_role() IN ('supervisor','admin'));
CREATE POLICY "ple_select" ON period_log_edits FOR SELECT USING (get_user_role() IN ('supervisor','admin'));
