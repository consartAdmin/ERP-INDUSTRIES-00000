import * as api from '../repositories/customerPriceTables/customerPriceTables.index.js';

function parsePositiveInteger(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    const error = new Error(
      `${fieldName} must be a positive integer`
    );

    error.status = 400;
    throw error;
  }

  return parsed;
}

function parseItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    const error = new Error('items must be a non-empty array');
    error.status = 400;
    throw error;
  }

  const items = rawItems.map((item, index) => {
    const productCode = String(
      item?.productCode || ''
    ).trim();

    const quantity = Number(item?.quantity);

    if (
      !productCode ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      const error = new Error(
        `Invalid productCode or quantity at items[${index}]`
      );

      error.status = 400;
      throw error;
    }

    return {
      productCode,
      quantity,
    };
  });

  const productCodes = items.map(
    (item) => item.productCode
  );

  if (new Set(productCodes).size !== productCodes.length) {
    const error = new Error(
      'Duplicate product codes are not allowed'
    );

    error.status = 400;
    throw error;
  }

  return items;
}

export function createCustomerPriceTablesController(db) {
  return {
    async listPriceTables(_req, res, next) {
      try {
        const priceTables =
          await api.listActivePriceTables(db);

        return res.json(priceTables);
      } catch (error) {
        return next(error);
      }
    },

    async getAssignment(req, res, next) {
      try {
        const customerId = parsePositiveInteger(
          req.params.customerId,
          'customerId'
        );

        const assignment =
          await api.getCustomerPriceTable(
            db,
            customerId
          );

        if (!assignment) {
          return res.status(404).json({
            error:
              'Customer has no assigned price table',
          });
        }

        return res.json(assignment);
      } catch (error) {
        return next(error);
      }
    },

    async assign(req, res, next) {
      try {
        const customerId = parsePositiveInteger(
          req.params.customerId,
          'customerId'
        );

        const priceId = parsePositiveInteger(
          req.body?.priceId,
          'priceId'
        );

        const assignment =
          await api.assignCustomerPriceTable(
            db,
            customerId,
            priceId
          );

        if (!assignment) {
          return res.status(404).json({
            error:
              'Active customer or active price table not found',
          });
        }

        return res.json(assignment);
      } catch (error) {
        return next(error);
      }
    },

    async listPricedProducts(req, res, next) {
      try {
        const customerId = parsePositiveInteger(
          req.params.customerId,
          'customerId'
        );

        const limit = Math.min(
          parsePositiveInteger(
            req.query.limit || 100,
            'limit'
          ),
          500
        );

        const offset = Math.max(
          Number.parseInt(
            req.query.offset || '0',
            10
          ) || 0,
          0
        );

        const products =
          await api.listCustomerPricedProducts(
            db,
            customerId,
            {
              search: req.query.search,
              limit,
              offset,
            }
          );

        return res.json({
          customerId,
          count: products.length,
          products,
        });
      } catch (error) {
        return next(error);
      }
    },

    async previewBudgetItems(req, res, next) {
      try {
        const customerId = parsePositiveInteger(
          req.params.customerId,
          'customerId'
        );

        const items = parseItems(req.body?.items);

        const result = await api.priceBudgetItems(
          db,
          customerId,
          items
        );

        return res.json(result);
      } catch (error) {
        return next(error);
      }
    },
  };
}