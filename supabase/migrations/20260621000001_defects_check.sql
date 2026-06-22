ALTER TABLE period_log
  ADD CONSTRAINT defects_lte_actual CHECK (defects <= actual);
