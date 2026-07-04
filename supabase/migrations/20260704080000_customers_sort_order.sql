ALTER TABLE customers ADD COLUMN sort_order INT NOT NULL DEFAULT 100;

UPDATE customers SET sort_order = 0 WHERE name = 'Meanwell';
UPDATE customers SET sort_order = 1 WHERE name = 'Martindale';
