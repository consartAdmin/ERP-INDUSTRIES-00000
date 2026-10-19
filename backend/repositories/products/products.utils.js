// ╔══════════════════════════════════════════════════════════════════════╗
// ║ products.utils.js — ProductsApiError e tratamento de erros           ║
// ╚══════════════════════════════════════════════════════════════════════╝

export class ProductsApiError extends Error {
    constructor(message, { code = 'PRODUCTS_API_ERROR', status = 500, details } = {}) {
        super(message);
        this.name = 'ProductsApiError';
        this.code = code;
        this.status = status;
        this.details = details;
    }
}

export function normalizePgError(error) {
    if (error instanceof ProductsApiError) return error;

    if (error?.code === '23505') {
        return new ProductsApiError('O product_code informado já existe.', {
            code: 'PRODUCT_CODE_CONFLICT',
            status: 409,
            details: error.detail,
        });
    }

    if (error?.code === '23503') {
        return new ProductsApiError('Uma referência vinculada ao produto é inválida.', {
            code: 'PRODUCT_FOREIGN_KEY_ERROR',
            status: 409,
            details: error.detail,
        });
    }

    return error;
}

export function throwValidation(errors) {
    throw new ProductsApiError('Dados do produto inválidos.', {
        code: 'PRODUCT_VALIDATION_ERROR',
        status: 400,
        details: errors,
    });
}
