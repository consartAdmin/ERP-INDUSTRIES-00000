// ╔══════════════════════════════════════════════════════════════════════╗
// ║ usersProfile.state.js                                               ║
// ║ Estado central do módulo Perfis de Usuários                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const usersProfileState = {
  users: [],
  summaryByUser: new Map(),
  profiles: [],
  selectedUser: null,
  /** Módulos do usuário aberto no modal (cópia editável) */
  modules: [],
  /** Snapshot original para detectar alterações: modulo_id → JSON */
  original: new Map(),
  saving: false,
};

export function setUsers(rows) {
  usersProfileState.users = Array.isArray(rows) ? rows : [];
}

export function setSummary(rows = []) {
  usersProfileState.summaryByUser = new Map(
    rows.map((r) => [String(r.usuario_id), r])
  );
}

export function setProfiles(profiles) {
  usersProfileState.profiles = Array.isArray(profiles) ? profiles : [];
}

export function setSelectedUser(user) {
  usersProfileState.selectedUser = user || null;
}

export function setModules(modules = []) {
  usersProfileState.modules = modules.map((m) => ({ ...m }));
  usersProfileState.original = new Map(
    modules.map((m) => [String(m.modulo_id), snapshot(m)])
  );
}

export function setSaving(value) {
  usersProfileState.saving = Boolean(value);
}

export function findModule(moduloId) {
  return usersProfileState.modules.find(
    (m) => String(m.modulo_id) === String(moduloId)
  );
}

export function findProfile(code) {
  return usersProfileState.profiles.find((p) => p.code === code) || null;
}

/** Perfis personalizados liberam as caixas de permissão por módulo */
export function isCustomProfile(code) {
  const profile = findProfile(code);
  return profile ? Boolean(profile.is_custom) : false;
}

export function snapshot(m) {
  return JSON.stringify([
    m.profile,
    !!m.can_view,
    !!m.can_create,
    !!m.can_edit,
    !!m.can_delete,
    !!m.can_export,
  ]);
}

export function isChanged(m) {
  return usersProfileState.original.get(String(m.modulo_id)) !== snapshot(m);
}

export function getChangedModules() {
  return usersProfileState.modules.filter(isChanged);
}
