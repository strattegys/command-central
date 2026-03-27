-- Runs only on first Postgres data directory init (docker-entrypoint-initdb.d).
-- Existing volumes get extension via web/scripts/migrate-vector-memory.sql (deploy + manual).
CREATE EXTENSION IF NOT EXISTS vector;
