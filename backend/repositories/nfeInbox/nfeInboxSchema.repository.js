// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInboxSchema.repository.js — ensureTable (idempotente + migração)  ║
// ║ Tabela: public."nfeInbox"                                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './nfeInbox.constants.js';

// ======================================================================
// CREATE / MIGRATE TABLE (idempotente + ajustes de colunas)
// ======================================================================
export async function ensureTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB} (
        id                 SERIAL PRIMARY KEY,
        cnpj_empresa       VARCHAR(14) NOT NULL,
        chave_nfe          VARCHAR(44) NOT NULL UNIQUE,

        nsu                BIGINT,
        situacao           VARCHAR(20) NOT NULL,

        tipo_operacao      VARCHAR(10),
        modelo             VARCHAR(4),
        serie              VARCHAR(10),
        numero             VARCHAR(20),

        emitente_cnpj      VARCHAR(14),
        emitente_razao     TEXT,
        destinatario_cnpj  VARCHAR(14),
        destinatario_razao TEXT,

        data_emissao       TIMESTAMP,
        data_autorizacao   TIMESTAMP,
        valor_total        NUMERIC(18,2),

        xml_resumido       JSONB,
        xml_completo       TEXT,

        manifestacao       JSONB,
        manifestado_em     TIMESTAMP,

        created_at         TIMESTAMP NOT NULL DEFAULT now(),
        updated_at         TIMESTAMP NOT NULL DEFAULT now(),

        origem             VARCHAR(30),
        entrada_criada     BOOLEAN DEFAULT false
      );
    `);

    // Migra / garante colunas
    await client.query(`ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS nsu BIGINT;`);
    await client.query(`ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS tipo_operacao VARCHAR(10);`);
    await client.query(`ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS xml_resumido JSONB;`);
    await client.query(`ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS xml_completo TEXT;`);
    await client.query(`ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS manifestacao JSONB;`);
    await client.query(`ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS manifestado_em TIMESTAMP;`);
    await client.query(`ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS origem VARCHAR(30);`);
    await client.query(`ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS entrada_criada BOOLEAN DEFAULT false;`);

    // CREATE TABLE IF NOT EXISTS não altera tabela pré-existente: se o banco
    // foi criado antes do UNIQUE, todo ON CONFLICT (chave_nfe) falha com
    // 42P10. Falhar aqui, no boot, é o momento certo de descobrir — e vai
    // falhar ruidosamente se já existirem chaves duplicadas a resolver.
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = '${TB}'::regclass
            AND contype = 'u'
        ) THEN
          ALTER TABLE ${TB}
            ADD CONSTRAINT nfeinbox_chave_nfe_key UNIQUE (chave_nfe);
        END IF;
      END $$;
    `);

    // Índices redundantes/obsoletos removidos:
    //  - idx_nfeinbox_chave: duplicava o índice implícito do UNIQUE;
    //  - idx_nfeinbox_data: (data_emissao, data_autorizacao) não atende o
    //    COALESCE da listagem e nenhuma outra query usa;
    //  - idx_nfeinbox_data_ord: versão antiga sem NULLS LAST, que o planner
    //    nunca conseguia usar. Recriado abaixo com outro nome, porque
    //    CREATE INDEX IF NOT EXISTS não redefine índice já existente.
    await client.query(`DROP INDEX IF EXISTS public.idx_nfeinbox_chave;`);
    await client.query(`DROP INDEX IF EXISTS public.idx_nfeinbox_data;`);
    await client.query(`DROP INDEX IF EXISTS public.idx_nfeinbox_data_ord;`);

    // Índices
    await client.query(`CREATE INDEX IF NOT EXISTS idx_nfeinbox_cnpj_empresa ON ${TB} (cnpj_empresa);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_nfeinbox_destinatario ON ${TB} (destinatario_cnpj);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_nfeinbox_situacao ON ${TB} (situacao);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_nfeinbox_nsu ON ${TB} (nsu);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_nfeinbox_entrada_criada ON ${TB} (entrada_criada);`);

    // Ordenação padrão da listagem (sem filtro de empresa).
    // NULLS LAST tem que espelhar exatamente o ORDER BY de buildOrderBy().
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_nfeinbox_data_ord_v2
      ON ${TB} (COALESCE(data_autorizacao, data_emissao) DESC NULLS LAST, id DESC);
    `);

    // Caso real mais comum: filtra por empresa e ordena por data.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_nfeinbox_empresa_data_ord
      ON ${TB} (cnpj_empresa, COALESCE(data_autorizacao, data_emissao) DESC NULLS LAST, id DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_nfeinbox_manifestacao_gin
      ON ${TB} USING GIN (manifestacao);
    `);

    await client.query('COMMIT');
  } catch (err) {
    // ROLLBACK pode falhar se a conexão caiu; sem o catch, o erro do
    // rollback substituiria o erro original e esconderia a causa real.
    await client.query('ROLLBACK').catch(() => { });
    console.error('ensureTable(nfeInbox) failed:', err);
    throw err;
  } finally {
    client.release();
  }
}
