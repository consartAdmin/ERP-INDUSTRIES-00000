import { API_BASE }
  from './customerStatusTypes.config.js';

/* =====================================================================
   SAFE FETCH
===================================================================== */

async function safeFetch(url, options = {}) {
  const response = await fetch(url, options);

  const contentType =
    response.headers.get('content-type') || '';

  let payload = null;

  if (contentType.includes('application/json')) {
    payload = await response.json();
  } else {
    const text = await response.text();

    payload = text
      ? { message: text }
      : null;
  }

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      `HTTP ${response.status} ao acessar ${url}`;

    throw new Error(message);
  }

  return payload;
}

/* =====================================================================
   CUSTOMER STATUS TYPES API
===================================================================== */

export const customerStatusTypesApi = {

  /* -------------------------------------------------------------------
     LISTAR TIPOS
  ------------------------------------------------------------------- */

  listTypes: () =>
    safeFetch(
      `${API_BASE}/customer-status-types?limit=100&is_active=true`
    ),

  /* -------------------------------------------------------------------
     CRIAR TIPO
  ------------------------------------------------------------------- */

  createType: (data) =>
    safeFetch(
      `${API_BASE}/customer-status-types`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify(data)
      }
    ),

  /* -------------------------------------------------------------------
     ATUALIZAR TIPO
  ------------------------------------------------------------------- */

  updateType: (id, data) =>
    safeFetch(
      `${API_BASE}/customer-status-types/${id}`,
      {
        method: 'PUT',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify(data)
      }
    ),

  /* -------------------------------------------------------------------
     EXCLUIR TIPO
  ------------------------------------------------------------------- */

  deleteType: (id) =>
    safeFetch(
      `${API_BASE}/customer-status-types/${id}`,
      {
        method: 'DELETE'
      }
    )
};