export function buildProductSearchParams(code, priceId) {
  const params = new URLSearchParams({ q: String(code || '').trim() });
  if (priceId) params.set('price_id', String(priceId));
  return params;
}

