// ╔════════════════════════════════════════════════════════════════════╗
// ║ balancoPatrimonialSchema.repository.js — ensureTable (idempotente) ║
// ║ Tabelas: balancoPatrimonial / balancoPatrimonialAnexos             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

/** Criação das tabelas (idempotente) */
export async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public."balancoPatrimonial" (
      id                   BIGSERIAL PRIMARY KEY,
      asset_code           VARCHAR(50)  NOT NULL,
      descricao            VARCHAR(255) NOT NULL,
      categoria            VARCHAR(100),
      data_aquisicao       DATE         NOT NULL,
      valor_aquisicao      NUMERIC(14,2) NOT NULL,
      vida_util_meses      INTEGER,
      metodo_depreciacao   VARCHAR(30),
      taxa_anual           NUMERIC(6,3),
      valor_residual       NUMERIC(14,2),
      centro_custo_id      INTEGER,
      nfe_chave            VARCHAR(60),
      nfe_arquivo_url      TEXT,
      anexos_count         INTEGER NOT NULL DEFAULT 0,
      observacao           TEXT,
      ativo                BOOLEAN NOT NULL DEFAULT TRUE,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public."balancoPatrimonialAnexos" (
      id                BIGSERIAL PRIMARY KEY,
      balanco_id        BIGINT NOT NULL REFERENCES public."balancoPatrimonial"(id) ON DELETE CASCADE,
      tipo              VARCHAR(20) NOT NULL,
      filename          VARCHAR(255) NOT NULL,
      url               TEXT NOT NULL,
      mime              VARCHAR(100),
      tamanho_bytes     BIGINT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_bp_asset_code ON public."balancoPatrimonial"("asset_code");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_bp_categoria ON public."balancoPatrimonial"("categoria");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_bp_data_aquisicao ON public."balancoPatrimonial"("data_aquisicao");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_bpa_balanco_id ON public."balancoPatrimonialAnexos"("balanco_id");`);
}
