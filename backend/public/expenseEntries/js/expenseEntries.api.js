// ╔══════════════════════════════════════════════════════════════════════╗
// ║ expenseEntries.api.js — API client (PRODNEX ERP)                    ║
// ║ Path: backend/public/expenseEntries/expenseEntries.api.js            ║
// ║ API: /api/expense-entries + /import-xml + /:id/post                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

export async function http(url, { method = 'GET', headers = {}, body } = {}) {
  const requestHeaders = { 'Content-Type': 'application/json', ...headers };
  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || json?.ok === false) {
    throw new Error(json?.message || `HTTP ${response.status}`);
  }

  return json;
}

export async function uploadXml(url, file) {
  const formData = new FormData();
  formData.append('xml', file);

  const response = await fetch(url, { method: 'POST', body: formData });
  const json = await response.json().catch(() => null);

  if (!response.ok || json?.ok === false) {
    throw new Error(json?.message || `HTTP ${response.status}`);
  }

  return json;
}

