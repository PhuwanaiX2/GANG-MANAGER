ALTER TABLE transactions ADD COLUMN batch_id text;
ALTER TABLE transactions ADD COLUMN settled_at integer;
ALTER TABLE transactions ADD COLUMN settled_by_transaction_id text;

CREATE INDEX IF NOT EXISTS transactions_batch_id_idx ON transactions(batch_id);
CREATE INDEX IF NOT EXISTS transactions_settled_at_idx ON transactions(settled_at);
