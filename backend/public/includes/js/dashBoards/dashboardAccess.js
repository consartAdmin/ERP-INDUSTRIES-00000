// ╔══════════════════════════════════════════════════════════════════════╗
// ║ dashboardAccess.js — Home dashboard access control                 ║
// ║ PRODNEX ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

const API_BASE = '/api/users-dashboard-access';

function getToken() {
  return (
    localStorage.getItem('token') ||
    sessionStorage.getItem('token') ||
    ''
  );
}

function authHeaders() {
  const token = getToken();

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

export async function getDashboardAccess(userId) {
  const parsedUserId = Number(userId);

  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    console.warn(
      '[dashboardAccess] Invalid user ID:',
      userId
    );

    return new Set();
  }

  try {
    const response = await fetch(
      `${API_BASE}/${encodeURIComponent(parsedUserId)}`,
      {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {
          ...authHeaders(),
        },
      }
    );

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
        `Dashboard access request failed with HTTP ${response.status}.`
      );
    }

    const dashboards = Array.isArray(data?.dashboards)
      ? data.dashboards
      : [];

    return new Set(
      dashboards
        .filter((item) => item?.canView === true)
        .map((item) => String(item.dashboardKey || '').trim())
        .filter(Boolean)
    );
  } catch (error) {
    console.error(
      '[dashboardAccess] Failed to load permissions:',
      error
    );

    // Fail closed: no permission data = no dashboard access.
    return new Set();
  }
}

export function applyDashboardAccess(
  root,
  allowedDashboards
) {
  if (!root) {
    return;
  }

  const allowed =
    allowedDashboards instanceof Set
      ? allowedDashboards
      : new Set();

  root
    .querySelectorAll('.dash-card')
    .forEach((card) => {
      const dashboardKey =
        card.dataset.dashboardKey ||
        card.dataset.id ||
        '';

      card.hidden = !allowed.has(dashboardKey);
    });
}
