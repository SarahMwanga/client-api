CREATE TABLE IF NOT EXISTS clients (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name  TEXT        NOT NULL,
  last_name   TEXT        NOT NULL,
  email       TEXT        NOT NULL UNIQUE,   -- unique index doubles as a fast email lookup
  phone       TEXT,
  company     TEXT,
  address     TEXT,
  city        TEXT,
  country     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
