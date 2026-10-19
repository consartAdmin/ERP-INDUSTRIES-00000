// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBarCodeController.js — Controller | CONSART ERP            ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import pool from '../config/db.js';
import { productsBarCodeApi } from '../repositories/productsBarCode/productsBarCode.index.js';

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
function httpError(res, status, message, code = null) {
  return res.status(status).json({
    success: false,
    error: message,
    code,
  });
}

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const number = Number(String(value).replace(',', '.'));

  return Number.isFinite(number) ? number : null;
}

function toPositiveIntegerOrNull(value) {
  const number = toNumberOrNull(value);

  if (
    number === null ||
    !Number.isInteger(number) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}

function toBooleanOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();

  if (
    ['true', '1', 'yes', 'sim', 's', 'on'].includes(normalized)
  ) {
    return true;
  }

  if (
    ['false', '0', 'no', 'nao', 'não', 'n', 'off'].includes(normalized)
  ) {
    return false;
  }

  return null;
}

function getProductCode(req) {
  return String(
    req?.params?.product_code ??
    req?.query?.product_code ??
    req?.body?.product_code ??
    ''
  ).trim();
}

function getErrorStatus(error, fallback = 500) {
  const status = Number(error?.status);

  if (Number.isInteger(status) && status >= 400 && status <= 599) {
    return status;
  }

  if (error?.code === '23505') {
    return 409;
  }

  return fallback;
}

function getErrorCode(error) {
  return error?.code || null;
}

/* ------------------------------------------------------------------ */
/* Controller                                                         */
/* ------------------------------------------------------------------ */
export const productsBarCodeController = {
  /* ================================================================ */
  /* RESOLVE BARCODE                                                  */
  /* ================================================================ */
  async resolve(req, res) {
    try {
      const barcode = String(req.query?.barcode ?? '').trim();

      if (!barcode) {
        return httpError(res, 400, 'barcode is required');
      }

      const data = await productsBarCodeApi.resolve(pool, barcode);

      return res.json(data || null);
    } catch (error) {
      console.error('[productsBarCode.resolve]', error);

      return httpError(
        res,
        getErrorStatus(error),
        error?.message || 'Erro ao resolver barcode',
        getErrorCode(error)
      );
    }
  },

  /* ================================================================ */
  /* LIST BY UNIT                                                     */
  /* ================================================================ */
  async listByUnit(req, res) {
    try {
      const product_code = getProductCode(req);

      const product_unit_id = toPositiveIntegerOrNull(
        req.params?.product_unit_id ??
        req.query?.product_unit_id
      );

      if (!product_code) {
        return httpError(res, 400, 'product_code is required');
      }

      if (!product_unit_id) {
        return httpError(res, 400, 'product_unit_id inválido');
      }

      const rows = await productsBarCodeApi.getByUnitId(
        pool,
        product_code,
        product_unit_id
      );

      return res.json(rows);
    } catch (error) {
      console.error('[productsBarCode.listByUnit]', error);

      return httpError(
        res,
        getErrorStatus(error),
        error?.message || 'Erro ao listar barcodes',
        getErrorCode(error)
      );
    }
  },

  /* ================================================================ */
  /* ACTIVE BY UNIT                                                   */
  /* ================================================================ */
  async activeByUnit(req, res) {
    try {
      const product_code = getProductCode(req);

      const product_unit_id = toPositiveIntegerOrNull(
        req.params?.product_unit_id ??
        req.query?.product_unit_id
      );

      if (!product_code) {
        return httpError(res, 400, 'product_code is required');
      }

      if (!product_unit_id) {
        return httpError(res, 400, 'product_unit_id inválido');
      }

      const row = await productsBarCodeApi.getActiveByUnitId(
        pool,
        product_code,
        product_unit_id
      );

      return res.json(row || null);
    } catch (error) {
      console.error('[productsBarCode.activeByUnit]', error);

      return httpError(
        res,
        getErrorStatus(error),
        error?.message || 'Erro ao buscar barcode ativo',
        getErrorCode(error)
      );
    }
  },

  /* ================================================================ */
  /* LIST BY PRODUCT                                                  */
  /* ================================================================ */
  async listByProduct(req, res) {
    try {
      const product_code = getProductCode(req);

      if (!product_code) {
        return httpError(res, 400, 'product_code is required');
      }

      const rows = await productsBarCodeApi.getByProductCode(
        pool,
        product_code
      );

      return res.json(rows);
    } catch (error) {
      console.error('[productsBarCode.listByProduct]', error);

      return httpError(
        res,
        getErrorStatus(error),
        error?.message || 'Erro ao listar barcodes',
        getErrorCode(error)
      );
    }
  },

  /* ================================================================ */
  /* UPSERT                                                           */
  /* ================================================================ */
  async upsert(req, res) {
    try {
      const body = req.body ?? {};

      const product_code = String(
        body.product_code ?? ''
      ).trim();

      const product_unit_id = toPositiveIntegerOrNull(
        body.product_unit_id
      );

      const barcode = String(
        body.barcode ?? ''
      ).trim();

      if (!product_code) {
        return httpError(res, 400, 'product_code is required');
      }

      if (!product_unit_id) {
        return httpError(res, 400, 'product_unit_id inválido');
      }

      if (!barcode) {
        return httpError(res, 400, 'barcode is required');
      }

      const isActiveWasProvided =
        body.is_active !== undefined &&
        body.is_active !== null &&
        body.is_active !== '';

      const standardWasProvided =
        body.standard !== undefined &&
        body.standard !== null &&
        body.standard !== '';

      const parsedIsActive = toBooleanOrNull(body.is_active);
      const parsedStandard = toBooleanOrNull(body.standard);

      if (isActiveWasProvided && parsedIsActive === null) {
        return httpError(res, 400, 'is_active inválido');
      }

      if (standardWasProvided && parsedStandard === null) {
        return httpError(res, 400, 'standard inválido');
      }

      const result = await productsBarCodeApi.upsertForUnit(
        pool,
        {
          product_code,
          product_unit_id,
          barcode,

          is_active: isActiveWasProvided
            ? parsedIsActive
            : true,

          unit: body.unit ?? null,

          fator: toNumberOrNull(body.fator),

          description: body.description ?? null,

          standard: standardWasProvided
            ? parsedStandard
            : undefined,

          unit_id: toNumberOrNull(body.unit_id),

          width_cm: toNumberOrNull(body.width_cm),
          length_cm: toNumberOrNull(body.length_cm),
          height_cm: toNumberOrNull(body.height_cm),
          weight_kg: toNumberOrNull(body.weight_kg),
        }
      );

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('[productsBarCode.upsert]', error);

      return httpError(
        res,
        getErrorStatus(error),
        error?.message || 'Erro ao salvar barcode',
        getErrorCode(error)
      );
    }
  },

  /* ================================================================ */
  /* SET ACTIVE                                                       */
  /* ================================================================ */
  async setActive(req, res) {
    try {
      const barcode_id = toPositiveIntegerOrNull(
        req.params?.barcode_id
      );

      const rawStatus = req.body?.is_active;

      if (!barcode_id) {
        return httpError(res, 400, 'barcode_id inválido');
      }

      if (
        rawStatus === undefined ||
        rawStatus === null ||
        rawStatus === ''
      ) {
        return httpError(res, 400, 'is_active is required');
      }

      const is_active = toBooleanOrNull(rawStatus);

      if (is_active === null) {
        return httpError(res, 400, 'is_active inválido');
      }

      const row = await productsBarCodeApi.setActive(
        pool,
        {
          barcode_id,
          is_active,
        }
      );

      if (!row) {
        return httpError(res, 404, 'Barcode não encontrado');
      }

      return res.json({
        success: true,
        data: row,
      });
    } catch (error) {
      console.error('[productsBarCode.setActive]', error);

      return httpError(
        res,
        getErrorStatus(error),
        error?.message || 'Erro ao atualizar status',
        getErrorCode(error)
      );
    }
  },

  /* ================================================================ */
  /* ACTIVE UNITS BY PRODUCT                                          */
  /* ================================================================ */
  async listActiveUnitsByProduct(req, res) {
    try {
      const product_code = getProductCode(req);

      if (!product_code) {
        return httpError(res, 400, 'product_code is required');
      }

      const rows =
        await productsBarCodeApi.getActiveUnitsByProductCode(
          pool,
          product_code
        );

      return res.json(rows);
    } catch (error) {
      console.error(
        '[productsBarCode.listActiveUnitsByProduct]',
        error
      );

      return httpError(
        res,
        getErrorStatus(error),
        error?.message ||
        'Erro ao listar unidades ativas do produto',
        getErrorCode(error)
      );
    }
  },

  /* ================================================================ */
  /* DELETE BARCODE                                                   */
  /* ================================================================ */
  async delete(req, res) {
    try {
      const barcode_id = toPositiveIntegerOrNull(
        req.params?.barcode_id
      );

      if (!barcode_id) {
        return httpError(res, 400, 'barcode_id inválido');
      }

      const deleted = await productsBarCodeApi.deleteById(
        pool,
        barcode_id
      );

      if (!deleted) {
        return httpError(res, 404, 'Barcode não encontrado');
      }

      if (!rowCount) {
        return httpError(res, 404, 'Barcode não encontrado');
      }

      return res.json({
        success: true,
        deleted: true,
        barcode_id,
      });
    } catch (error) {
      console.error('[productsBarCode.delete]', error);

      return httpError(
        res,
        getErrorStatus(error),
        error?.message || 'Erro ao remover barcode',
        getErrorCode(error)
      );
    }
  },

  /* ================================================================ */
  /* FACTORS BY PRODUCT CODES                                         */
  /* ================================================================ */
  async factors(req, res) {
    try {
      const skus = String(req.query?.skus ?? '')
        .split(',')
        .map((sku) => sku.trim())
        .filter(Boolean);

      if (!skus.length) {
        return res.json({
          ok: true,
          source: 'productsBarCode',
          rows: [],
        });
      }

      const rows =
        await productsBarCodeApi.getFactorsByProductCodes(
          pool,
          skus
        );

      return res.json({
        ok: true,
        source: 'productsBarCode',
        rows,
      });
    } catch (error) {
      console.error('[productsBarCode.factors]', error);

      return res.status(getErrorStatus(error)).json({
        ok: false,
        error: error?.message || 'Erro ao buscar fatores',
        code: getErrorCode(error),
      });
    }
  },

  /* ================================================================ */
  /* UPDATE BY ID                                                     */
  /* ================================================================ */
  async update(req, res) {
    try {
      const barcode_id = toPositiveIntegerOrNull(
        req.params?.barcode_id
      );

      if (!barcode_id) {
        return httpError(res, 400, 'barcode_id inválido');
      }

      const body = req.body ?? {};

      const isActiveWasProvided =
        body.is_active !== undefined &&
        body.is_active !== null &&
        body.is_active !== '';

      const standardWasProvided =
        body.standard !== undefined &&
        body.standard !== null &&
        body.standard !== '';

      const parsedIsActive = toBooleanOrNull(body.is_active);
      const parsedStandard = toBooleanOrNull(body.standard);

      if (isActiveWasProvided && parsedIsActive === null) {
        return httpError(res, 400, 'is_active inválido');
      }

      if (standardWasProvided && parsedStandard === null) {
        return httpError(res, 400, 'standard inválido');
      }

      const row = await productsBarCodeApi.updateById(
        pool,
        {
          barcode_id,

          product_code:
            body.product_code === undefined
              ? undefined
              : String(body.product_code ?? '').trim(),

          product_unit_id:
            body.product_unit_id === undefined
              ? undefined
              : toPositiveIntegerOrNull(body.product_unit_id),

          barcode:
            body.barcode === undefined
              ? undefined
              : String(body.barcode ?? '').trim(),

          is_active: isActiveWasProvided
            ? parsedIsActive
            : undefined,

          unit:
            body.unit === undefined
              ? undefined
              : body.unit,

          fator:
            body.fator === undefined
              ? undefined
              : toNumberOrNull(body.fator),

          description:
            body.description === undefined
              ? undefined
              : body.description,

          standard: standardWasProvided
            ? parsedStandard
            : undefined,

          unit_id:
            body.unit_id === undefined
              ? undefined
              : toNumberOrNull(body.unit_id),

          width_cm:
            body.width_cm === undefined
              ? undefined
              : toNumberOrNull(body.width_cm),

          length_cm:
            body.length_cm === undefined
              ? undefined
              : toNumberOrNull(body.length_cm),

          height_cm:
            body.height_cm === undefined
              ? undefined
              : toNumberOrNull(body.height_cm),

          weight_kg:
            body.weight_kg === undefined
              ? undefined
              : toNumberOrNull(body.weight_kg),
        }
      );

      if (!row) {
        return httpError(res, 404, 'Barcode não encontrado');
      }

      return res.json({
        success: true,
        data: row,
      });
    } catch (error) {
      console.error('[productsBarCode.update]', error);

      return httpError(
        res,
        getErrorStatus(error),
        error?.message || 'Erro ao atualizar barcode',
        getErrorCode(error)
      );
    }
  },
};