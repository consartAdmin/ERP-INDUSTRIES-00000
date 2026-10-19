import {
  createProductLmRef,
  deleteProductLmRef,
  findAllProductsLmRef,
  findProductLmRefById,
  updateProductLmRef,
} from '../repositories/productsLmRef/productsLmRef.index.js';

const parsePositiveInteger = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseBoolean = (value) => {
  if (value === undefined) return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
};

const toApiPayload = (body = {}) => ({
  supplierId: body.supplierId ?? body.supplier_id,
  nfProductCode: body.nfProductCode ?? body.nf_product_code,
  productCode: body.productCode ?? body.product_code,
  description: body.description,
  isActive: body.isActive ?? body.is_active,
});

const handleDatabaseError = (error, res, next) => {
  if (error.code === '23505') {
    return res.status(409).json({ message: 'Product reference already exists.' });
  }

  if (error.code === '23503') {
    return res.status(400).json({ message: 'The supplied supplier does not exist.' });
  }

  return next(error);
};

export async function listProductsLmRef(req, res, next) {
  try {
    const supplierId = req.query.supplierId === undefined
      ? undefined
      : parsePositiveInteger(req.query.supplierId);
    const isActive = parseBoolean(req.query.isActive);
    const limit = Math.min(parsePositiveInteger(req.query.limit) ?? 50, 200);
    const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);

    if (req.query.supplierId !== undefined && supplierId === null) {
      return res.status(400).json({ message: 'supplierId must be a positive integer.' });
    }

    if (req.query.isActive !== undefined && isActive === null) {
      return res.status(400).json({ message: 'isActive must be true or false.' });
    }

    const products = await findAllProductsLmRef({
      supplierId,
      isActive,
      search: req.query.search?.trim(),
      limit,
      offset,
    });

    return res.status(200).json(products);
  } catch (error) {
    return next(error);
  }
}

export async function getProductLmRef(req, res, next) {
  try {
    const productLmRefId = parsePositiveInteger(req.params.productLmRefId);

    if (!productLmRefId) {
      return res.status(400).json({ message: 'Invalid product reference id.' });
    }

    const product = await findProductLmRefById(productLmRefId);

    if (!product) {
      return res.status(404).json({ message: 'Product reference not found.' });
    }

    return res.status(200).json(product);
  } catch (error) {
    return next(error);
  }
}

export async function postProductLmRef(req, res, next) {
  const payload = toApiPayload(req.body);
  payload.isActive = parseBoolean(payload.isActive);

  if (!parsePositiveInteger(payload.supplierId)) {
    return res.status(400).json({ message: 'supplierId is required and must be a positive integer.' });
  }

  if (!payload.nfProductCode || !payload.productCode || !payload.description) {
    return res.status(400).json({
      message: 'nfProductCode, productCode, and description are required.',
    });
  }

  if (payload.isActive === null) {
    return res.status(400).json({ message: 'isActive must be true or false.' });
  }

  try {
    const product = await createProductLmRef(payload);
    return res.status(201).json(product);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
}

export async function patchProductLmRef(req, res, next) {
  const productLmRefId = parsePositiveInteger(req.params.productLmRefId);
  const payload = toApiPayload(req.body);

  if (!productLmRefId) {
    return res.status(400).json({ message: 'Invalid product reference id.' });
  }

  if (payload.supplierId !== undefined && !parsePositiveInteger(payload.supplierId)) {
    return res.status(400).json({ message: 'supplierId must be a positive integer.' });
  }

  if (payload.isActive !== undefined) {
    payload.isActive = parseBoolean(payload.isActive);
    if (payload.isActive === null) {
      return res.status(400).json({ message: 'isActive must be true or false.' });
    }
  }

  try {
    const product = await updateProductLmRef(productLmRefId, payload);

    if (!product) {
      return res.status(404).json({ message: 'Product reference not found.' });
    }

    return res.status(200).json(product);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
}

export async function removeProductLmRef(req, res, next) {
  try {
    const productLmRefId = parsePositiveInteger(req.params.productLmRefId);

    if (!productLmRefId) {
      return res.status(400).json({ message: 'Invalid product reference id.' });
    }

    const product = await deleteProductLmRef(productLmRefId);

    if (!product) {
      return res.status(404).json({ message: 'Product reference not found.' });
    }

    return res.status(200).json(product);
  } catch (error) {
    return next(error);
  }
}

