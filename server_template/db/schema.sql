-- Hai bảng cho nghiệp vụ đăng nhập, bám FINAL ERD (account, auth_session).
-- Chạy an toàn nhiều lần: bảng/kiểu đã có thì bỏ qua.

DO $$ BEGIN
  CREATE TYPE account_role AS ENUM ('member', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE account_status AS ENUM ('active', 'locked', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS account (
  account_id          BIGSERIAL PRIMARY KEY,
  email               VARCHAR(255)   NOT NULL UNIQUE,
  password_hash       VARCHAR(255)   NOT NULL,
  role                account_role   NOT NULL DEFAULT 'member',
  status              account_status NOT NULL DEFAULT 'active',
  full_name           VARCHAR(120),
  avatar_url          VARCHAR(500),
  bio                 VARCHAR(500),
  failed_login_count  SMALLINT       NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  last_login_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Tìm theo email không phân biệt hoa/thường
CREATE UNIQUE INDEX IF NOT EXISTS account_email_lower_uq ON account (LOWER(email));

CREATE TABLE IF NOT EXISTS auth_session (
  session_id   UUID          PRIMARY KEY,
  account_id   BIGINT        NOT NULL REFERENCES account (account_id),
  token_hash   VARCHAR(255)  NOT NULL UNIQUE,
  device_id    VARCHAR(128),
  ip_address   VARCHAR(45),
  user_agent   VARCHAR(255),
  expires_at   TIMESTAMPTZ   NOT NULL,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_session_device_idx  ON auth_session (device_id);
CREATE INDEX IF NOT EXISTS auth_session_account_idx ON auth_session (account_id);
