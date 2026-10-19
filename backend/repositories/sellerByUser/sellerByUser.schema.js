// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerByUser.schema.js — DDL + trigger updated_at                  ║
// ║ Tabela: public."sellerByUser"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB } from './sellerByUser.constants.js';

export const DDL = `
  CREATE TABLE IF NOT EXISTS ${TB} (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    seller_id   BIGINT NOT NULL,
    is_primary  BOOLEAN NOT NULL DEFAULT false,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_sellerByUser_user_id
    ON ${TB}(user_id);

  CREATE INDEX IF NOT EXISTS idx_sellerByUser_seller_id
    ON ${TB}(seller_id);

  -- Garante 1 principal por usuário (quando is_primary=true)
  CREATE UNIQUE INDEX IF NOT EXISTS ux_sellerByUser_user_primary
    ON ${TB}(user_id)
    WHERE is_primary = true;
`;

export const DDL_TRIGGER = `
  CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger AS $$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_sellerByUser_updated_at ON ${TB};

  CREATE TRIGGER trg_sellerByUser_updated_at
  BEFORE UPDATE ON ${TB}
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
`;
