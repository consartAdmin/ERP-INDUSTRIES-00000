// ╔════════════════════════════════════════════════════════════════════╗
// ║ usersDashboardAccess.index.js — ponto de entrada permissões de     ║
// ║ dashboards. Mesma API pública do antigo usersDashboardAccessApi.js ║
// ╚════════════════════════════════════════════════════════════════════╝

export {
  listUserDashboardAccess,
  getUserDashboardAccess,
  canUserViewDashboard,
} from './usersDashboardAccessQuery.repository.js';
export {
  upsertUserDashboardAccess,
  replaceUserDashboardAccess,
} from './usersDashboardAccessUpsert.repository.js';
export {
  deleteUserDashboardAccess,
  deleteAllUserDashboardAccess,
} from './usersDashboardAccessRemove.repository.js';
