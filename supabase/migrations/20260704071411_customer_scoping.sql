CREATE TABLE customers (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name   TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE stations ADD COLUMN customer_id UUID REFERENCES customers(id);
ALTER TABLE models   ADD COLUMN customer_id UUID REFERENCES customers(id);

INSERT INTO customers (name) VALUES ('Meanwell'), ('Martindale');

UPDATE stations SET customer_id = (SELECT id FROM customers WHERE name = 'Meanwell');
UPDATE models   SET customer_id = (SELECT id FROM customers WHERE name = 'Meanwell');

ALTER TABLE stations ALTER COLUMN customer_id SET NOT NULL;
ALTER TABLE models   ALTER COLUMN customer_id SET NOT NULL;

ALTER TABLE stations ADD CONSTRAINT stations_customer_sequence_unique UNIQUE (customer_id, sequence);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_select" ON customers FOR SELECT USING (true);
CREATE POLICY "customers_modify" ON customers FOR ALL    USING (get_user_role() IN ('supervisor','admin'));
