-- Dev seed data — run manually, not in CI
-- Lead password is "test1234"

INSERT INTO customers (name) VALUES ('Meanwell'), ('Martindale'), ('Other');

INSERT INTO stations (name, sequence, customer_id) VALUES
  ('Station 1', 1, (SELECT id FROM customers WHERE name = 'Meanwell')),
  ('Station 2', 2, (SELECT id FROM customers WHERE name = 'Meanwell')),
  ('Station 3', 3, (SELECT id FROM customers WHERE name = 'Meanwell')),
  ('Station 4', 4, (SELECT id FROM customers WHERE name = 'Meanwell')),
  ('Station 5', 5, (SELECT id FROM customers WHERE name = 'Meanwell')),
  ('Station 6', 6, (SELECT id FROM customers WHERE name = 'Meanwell')),
  ('Station 7', 7, (SELECT id FROM customers WHERE name = 'Meanwell')),
  ('Station 8', 8, (SELECT id FROM customers WHERE name = 'Meanwell')),
  ('MX Station 1', 1, (SELECT id FROM customers WHERE name = 'Martindale')),
  ('MX Station 2', 2, (SELECT id FROM customers WHERE name = 'Martindale')),
  ('MX Station 3', 3, (SELECT id FROM customers WHERE name = 'Martindale'));

INSERT INTO models (name, customer_id) VALUES
  ('Model A', (SELECT id FROM customers WHERE name = 'Meanwell')),
  ('Model B', (SELECT id FROM customers WHERE name = 'Meanwell')),
  ('MX Model A', (SELECT id FROM customers WHERE name = 'Martindale'));

INSERT INTO leads (name, password_hash) VALUES
  ('Test Lead', '$2b$10$QwK/E5FFd65O.HbiMscSte0rUPX.A1i43fsHFzdz/wnCAof/3GwRa');
