-- Dev seed data — run manually, not in CI
-- Lead password is "test1234"

INSERT INTO stations (name, sequence) VALUES
  ('Station 1', 1), ('Station 2', 2), ('Station 3', 3), ('Station 4', 4),
  ('Station 5', 5), ('Station 6', 6), ('Station 7', 7), ('Station 8', 8);

INSERT INTO models (name) VALUES ('Model A'), ('Model B');

INSERT INTO leads (name, password_hash) VALUES
  ('Test Lead', '$2b$10$QwK/E5FFd65O.HbiMscSte0rUPX.A1i43fsHFzdz/wnCAof/3GwRa');
