ALTER TABLE orders ADD COLUMN customer_id UUID REFERENCES customers(id);

UPDATE orders SET customer_id = (SELECT id FROM customers WHERE name = 'Meanwell');

ALTER TABLE orders ALTER COLUMN customer_id SET NOT NULL;
