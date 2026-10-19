// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalProfileV2.sanitizers.js — Validação / normalização           ║
// ╚════════════════════════════════════════════════════════════════════╝

export function badRequest(message, errors = []) {
  return Object.assign(new Error(message), { status: 400, errors });
}

export function parseBoolean(value, fieldName) {
  if (value === true || value === false) return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  throw badRequest(`${fieldName} must be a boolean`);
}

export function normalizePagination(limit, offset) {
  const parsedLimit = Number.parseInt(limit, 10);
  const parsedOffset = Number.parseInt(offset, 10);

  return {
    limit: Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 500)
      : 100,
    offset: Number.isFinite(parsedOffset)
      ? Math.max(parsedOffset, 0)
      : 0,
  };
}

export function writableEntries(prepared) {
  if (!prepared.valid) {
    throw badRequest('Invalid fiscal profile payload', prepared.errors);
  }

  const entries = Object.entries(prepared.data);
  if (!entries.length) throw badRequest('No valid fields supplied');
  return entries;
}
