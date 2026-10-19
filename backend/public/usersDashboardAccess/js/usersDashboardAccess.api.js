// ╔══════════════════════════════════════════════════════════════════════╗
// ║ usersDashboardAccess.api.js — Frontend API client                   ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

const API_BASE = '/api/users-dashboard-access';


// ======================================================================
// AUTH
// ======================================================================

function getToken() {
  return localStorage.getItem('token') || '';
}


function authHeaders() {
  const token = getToken();

  return token
    ? {
      Authorization: `Bearer ${token}`,
    }
    : {};
}


// ======================================================================
// REQUEST
// ======================================================================

async function request(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',

    ...options,

    headers: {
      'Content-Type': 'application/json',

      ...authHeaders(),

      ...(options.headers || {}),
    },
  });


  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }


  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Request failed with HTTP ${response.status}.`;

    const error = new Error(message);

    error.status = response.status;
    error.data = data;

    throw error;
  }


  return data;
}


// ======================================================================
// LIST USER DASHBOARD ACCESS
// GET /api/users-dashboard-access/:userId
// ======================================================================

export async function listUserDashboardAccess(userId) {
  if (!userId) {
    throw new Error('userId is required.');
  }

  return request(
    `${API_BASE}/${encodeURIComponent(userId)}`
  );
}


// ======================================================================
// REPLACE ALL USER DASHBOARD ACCESS
// PUT /api/users-dashboard-access/:userId/all
// ======================================================================

export async function replaceUserDashboardAccess(
  userId,
  dashboards
) {
  if (!userId) {
    throw new Error('userId is required.');
  }

  if (!Array.isArray(dashboards)) {
    throw new Error('dashboards must be an array.');
  }

  return request(
    `${API_BASE}/${encodeURIComponent(userId)}/all`,
    {
      method: 'PUT',

      body: JSON.stringify({
        dashboards,
      }),
    }
  );
}


// ======================================================================
// SAVE / UPSERT ONE DASHBOARD ACCESS
// PUT /api/users-dashboard-access/:userId
// ======================================================================

export async function saveUserDashboardAccess(
  userId,
  dashboardKey,
  canView
) {
  if (!userId) {
    throw new Error('userId is required.');
  }

  if (!dashboardKey) {
    throw new Error('dashboardKey is required.');
  }

  if (typeof canView !== 'boolean') {
    throw new Error('canView must be boolean.');
  }

  return request(
    `${API_BASE}/${encodeURIComponent(userId)}`,
    {
      method: 'PUT',

      body: JSON.stringify({
        dashboardKey,
        canView,
      }),
    }
  );
}


// ======================================================================
// GET ONE DASHBOARD ACCESS
// GET /api/users-dashboard-access/:userId/:dashboardKey
// ======================================================================

export async function getUserDashboardAccess(
  userId,
  dashboardKey
) {
  if (!userId) {
    throw new Error('userId is required.');
  }

  if (!dashboardKey) {
    throw new Error('dashboardKey is required.');
  }

  return request(
    `${API_BASE}/${encodeURIComponent(userId)}/${encodeURIComponent(dashboardKey)}`
  );
}


// ======================================================================
// DELETE ONE DASHBOARD ACCESS
// DELETE /api/users-dashboard-access/:userId/:dashboardKey
// ======================================================================

export async function deleteUserDashboardAccess(
  userId,
  dashboardKey
) {
  if (!userId) {
    throw new Error('userId is required.');
  }

  if (!dashboardKey) {
    throw new Error('dashboardKey is required.');
  }

  return request(
    `${API_BASE}/${encodeURIComponent(userId)}/${encodeURIComponent(dashboardKey)}`,
    {
      method: 'DELETE',
    }
  );
}


// ======================================================================
// DELETE ALL DASHBOARD ACCESS FOR USER
// DELETE /api/users-dashboard-access/:userId
// ======================================================================

export async function deleteAllUserDashboardAccess(userId) {
  if (!userId) {
    throw new Error('userId is required.');
  }

  return request(
    `${API_BASE}/${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
    }
  );
}