// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterpriseSchema.repository.js — ensureTable                         ║
// ║ Tabela: enterprises                                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

export async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS enterprises (
      id BIGSERIAL PRIMARY KEY,
      corporate_name           VARCHAR(200) NOT NULL,
      trade_name               VARCHAR(200),
      cnpj                     VARCHAR(18) NOT NULL UNIQUE,
      state_registration       VARCHAR(30),
      municipal_registration   VARCHAR(30),
      tax_regime_code          VARCHAR(2),
      cnae                     VARCHAR(20),
      opening_date             DATE,
      status                   VARCHAR(30) DEFAULT 'ACTIVE',
      zip_code                 VARCHAR(10),
      address                  VARCHAR(200),
      address_number           VARCHAR(20),
      address_complement       VARCHAR(100),
      district                 VARCHAR(100),
      city                     VARCHAR(100),
      state                    VARCHAR(2),
      city_ibge_code           VARCHAR(10),
      phone                    VARCHAR(30),
      whatsapp                 VARCHAR(30),
      email                    VARCHAR(150),
      website                  VARCHAR(150),
      financial_contact        VARCHAR(150),
      fiscal_contact           VARCHAR(150),
      commercial_contact       VARCHAR(150),
      nfe_environment          VARCHAR(20) DEFAULT 'homologation',
      nfe_series               VARCHAR(10),
      next_nfe_number          INTEGER DEFAULT 1,
      nfce_series              VARCHAR(10),
      next_nfce_number         INTEGER DEFAULT 1,
      default_cfop_sale        VARCHAR(10),
      default_cfop_purchase    VARCHAR(10),
      sped_profile             VARCHAR(5),
      sped_activity_type       VARCHAR(5),
      logo_url                 TEXT,
      slogan                   VARCHAR(255),
      document_notes           TEXT,
      pdf_footer               TEXT,
      certificate_a1_path      TEXT,
      certificate_password     TEXT,
      accountant_name          VARCHAR(150),
      accountant_cpf           VARCHAR(14),
      accountant_crc           VARCHAR(30),
      accountant_email         VARCHAR(150),
      accountant_phone         VARCHAR(30),
      is_active                BOOLEAN NOT NULL DEFAULT TRUE,
      created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at               TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}
