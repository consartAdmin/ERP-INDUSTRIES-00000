/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: deliveryTripsSchema.js                                        ║
   ║ MODULE: Entregas (Motoristas / Veículos / Rotas do Dia / Paradas)   ║
   ║ DESCRIPTION: DDL idempotente das tabelas do módulo                  ║
   ║   public."drivers"            → motorista (1:1 com employees)       ║
   ║   public."vehicles"           → frota                               ║
   ║   public."deliveryTrips"      → rota com data/motorista/veículo     ║
   ║   public."deliveryTripStops"  → paradas (ENTREGA / COLETA) ligadas  ║
   ║                                  a Pedidos (orders) ou Orçamentos   ║
   ║ CONSART ERP · PostgreSQL · ESM                                      ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import pool from '../../config/db.js';

/* ─────────────────────────── Domínios ─────────────────────────── */

export const TRIP_STATUS = Object.freeze(['PLANEJADA', 'EM_ROTA', 'CONCLUIDA', 'CANCELADA']);
export const STOP_STATUS = Object.freeze(['PENDENTE', 'CONCLUIDA', 'FALHOU', 'CANCELADA']);
export const MOVEMENT_TYPES = Object.freeze(['ENTREGA', 'COLETA']);
export const SOURCE_TYPES = Object.freeze(['PEDIDO', 'ORCAMENTO', 'NFE', 'AVULSO']);
export const VEHICLE_TYPES = Object.freeze(['CARRO', 'MOTO', 'VAN', 'UTILITARIO', 'CAMINHAO', 'OUTRO']);

const sqlList = (arr) => arr.map((v) => `'${v}'`).join(',');

/* ─────────────────────────── DDL ─────────────────────────── */

const DDL = `
CREATE OR REPLACE FUNCTION public.fn_delivery_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TABLE IF NOT EXISTS public."drivers" (
  driver_id        SERIAL PRIMARY KEY,
  employee_id      INTEGER NOT NULL
                   REFERENCES public.employees(employee_id) ON DELETE RESTRICT,
  cnh_number       VARCHAR(20),
  cnh_category     VARCHAR(5),
  cnh_expiration   DATE,
  phone            VARCHAR(30),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT drivers_employee_id_key UNIQUE (employee_id)
);

CREATE TABLE IF NOT EXISTS public."vehicles" (
  vehicle_id       SERIAL PRIMARY KEY,
  plate            VARCHAR(10) NOT NULL,
  description      VARCHAR(120) NOT NULL,
  brand            VARCHAR(60),
  vehicle_type     VARCHAR(20) NOT NULL DEFAULT 'CARRO'
                   CONSTRAINT vehicles_vehicle_type_check CHECK (vehicle_type IN (${sqlList(VEHICLE_TYPES)})),
  model_year       SMALLINT,
  renavam          VARCHAR(20),
  capacity_kg      NUMERIC(12,2),
  capacity_m3      NUMERIC(12,3),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_plate_uq ON public."vehicles" (UPPER(plate));

CREATE TABLE IF NOT EXISTS public."deliveryTrips" (
  trip_id          BIGSERIAL PRIMARY KEY,
  trip_date        DATE NOT NULL,
  name             VARCHAR(120),
  status           VARCHAR(20) NOT NULL DEFAULT 'PLANEJADA'
                   CONSTRAINT "deliveryTrips_status_check" CHECK (status IN (${sqlList(TRIP_STATUS)})),
  driver_id        INTEGER REFERENCES public."drivers"(driver_id) ON DELETE RESTRICT,
  vehicle_id       INTEGER REFERENCES public."vehicles"(vehicle_id) ON DELETE RESTRICT,
  start_km         INTEGER,
  end_km           INTEGER,
  departed_at      TIMESTAMPTZ,
  finished_at      TIMESTAMPTZ,
  notes            TEXT,
  created_by       INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "deliveryTrips_trip_date_idx" ON public."deliveryTrips" (trip_date DESC);
CREATE INDEX IF NOT EXISTS "deliveryTrips_driver_idx" ON public."deliveryTrips" (driver_id);

CREATE TABLE IF NOT EXISTS public."deliveryTripStops" (
  stop_id          BIGSERIAL PRIMARY KEY,
  trip_id          BIGINT NOT NULL REFERENCES public."deliveryTrips"(trip_id) ON DELETE CASCADE,
  stop_order       INTEGER NOT NULL DEFAULT 1,
  movement_type    VARCHAR(10) NOT NULL DEFAULT 'ENTREGA'
                   CONSTRAINT "deliveryTripStops_movement_check" CHECK (movement_type IN (${sqlList(MOVEMENT_TYPES)})),
  source_type      VARCHAR(10) NOT NULL DEFAULT 'AVULSO'
                   CONSTRAINT "deliveryTripStops_source_check" CHECK (source_type IN (${sqlList(SOURCE_TYPES)})),
  order_id         BIGINT REFERENCES public.orders(order_id) ON DELETE SET NULL,
  budget_id        BIGINT REFERENCES public.budgets(budget_id) ON DELETE SET NULL,
  invoice_id       BIGINT REFERENCES public."invoicesIssued"(invoice_id) ON DELETE SET NULL,
  customer_id      INTEGER,
  recipient_name   VARCHAR(255) NOT NULL,
  tax_id           VARCHAR(32),
  contact_phone    VARCHAR(50),
  address          VARCHAR(500),
  neighborhood     VARCHAR(120),
  city             VARCHAR(120),
  state            VARCHAR(2),
  postal_code      VARCHAR(12),
  volumes          INTEGER,
  gross_weight     NUMERIC(12,3),
  document_amount  NUMERIC(14,2),
  status           VARCHAR(12) NOT NULL DEFAULT 'PENDENTE'
                   CONSTRAINT "deliveryTripStops_status_check" CHECK (status IN (${sqlList(STOP_STATUS)})),
  received_by      VARCHAR(150),
  failure_reason   TEXT,
  completed_at     TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "deliveryTripStops_trip_idx" ON public."deliveryTripStops" (trip_id, stop_order);
CREATE INDEX IF NOT EXISTS "deliveryTripStops_order_idx" ON public."deliveryTripStops" (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS "deliveryTripStops_budget_idx" ON public."deliveryTripStops" (budget_id) WHERE budget_id IS NOT NULL;

-- Migração: paradas a partir de Notas Fiscais (invoicesIssued)
ALTER TABLE public."deliveryTripStops" ADD COLUMN IF NOT EXISTS invoice_id BIGINT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deliveryTripStops_invoice_id_fkey') THEN
    ALTER TABLE public."deliveryTripStops"
      ADD CONSTRAINT "deliveryTripStops_invoice_id_fkey"
      FOREIGN KEY (invoice_id) REFERENCES public."invoicesIssued"(invoice_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'deliveryTripStops_source_check'
       AND pg_get_constraintdef(oid) LIKE '%NFE%'
  ) THEN
    ALTER TABLE public."deliveryTripStops" DROP CONSTRAINT IF EXISTS "deliveryTripStops_source_check";
    ALTER TABLE public."deliveryTripStops"
      ADD CONSTRAINT "deliveryTripStops_source_check" CHECK (source_type IN (${sqlList(SOURCE_TYPES)}));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "deliveryTripStops_invoice_idx" ON public."deliveryTripStops" (invoice_id) WHERE invoice_id IS NOT NULL;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['drivers','vehicles','deliveryTrips','deliveryTripStops'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_' || t || '_updated_at'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_delivery_set_updated_at()',
        'trg_' || t || '_updated_at', t
      );
    END IF;
  END LOOP;
END $$;
`;

/* ─────────────────────────── ensureTables (memoizado) ─────────────────────────── */

let readyPromise = null;

export function ensureDeliveryTables() {
  if (!readyPromise) {
    readyPromise = (async () => {
      const client = await pool.connect();
      try {
        await client.query(`SELECT pg_advisory_lock(hashtext('deliveryTrips_ddl')::bigint)`);
        await client.query(DDL);
      } finally {
        await client.query(`SELECT pg_advisory_unlock(hashtext('deliveryTrips_ddl')::bigint)`).catch(() => {});
        client.release();
      }
    })().catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

/* ─────────────────────────── Helpers compartilhados ─────────────────────────── */

export function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function toInt(v, d = null) {
  if (v === null || v === undefined || v === '') return d;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : d;
}

export function toNum(v, d = null) {
  if (v === null || v === undefined || v === '') return d;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : d;
}

export function cleanText(v, maxLen = null) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  return maxLen && s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function toBool(v, d = null) {
  if (v === undefined || v === null || v === '') return d;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'yes', 'sim', 's'].includes(s)) return true;
  if (['false', '0', 'no', 'nao', 'não', 'n'].includes(s)) return false;
  return d;
}

export function toEnum(v, allowed, errorCode, d = undefined) {
  if ((v === undefined || v === null || v === '') && d !== undefined) return d;
  const s = String(v ?? '').trim().toUpperCase();
  if (!allowed.includes(s)) throw httpError(errorCode, 400);
  return s;
}

export function toDate(v) {
  const s = cleanText(v, 10);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw httpError('INVALID_DATE', 400);
  return s;
}

/** Traduz erros de constraint do Postgres para códigos da API */
export function mapDbError(err) {
  if (err?.status) return err;
  if (err?.code === '23505') {
    if (err.constraint === 'drivers_employee_id_key') return httpError('EMPLOYEE_ALREADY_DRIVER', 409);
    if (err.constraint === 'vehicles_plate_uq') return httpError('PLATE_ALREADY_EXISTS', 409);
    return httpError('DUPLICATE', 409);
  }
  if (err?.code === '23503') {
    if (/delete|update/i.test(err.message || '') && /still referenced/i.test(err.detail || '')) {
      return httpError('IN_USE_BY_TRIPS', 409);
    }
    return httpError('REFERENCE_NOT_FOUND', 404);
  }
  if (err?.code === '23514') return httpError('INVALID_VALUE', 400);
  return err;
}
