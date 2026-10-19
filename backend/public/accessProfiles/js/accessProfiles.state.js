// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accessProfiles.state.js                                             ║
// ║ Estado central do Cadastro de Perfis                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const accessProfilesState = {
  rows: [],
  editing: null,
  saving: false,
};

export function setRows(rows) {
  accessProfilesState.rows = Array.isArray(rows) ? rows : [];
}

export function setEditing(profile) {
  accessProfilesState.editing = profile || null;
}

export function setSaving(value) {
  accessProfilesState.saving = Boolean(value);
}

export function findRow(id) {
  return accessProfilesState.rows.find((r) => String(r.id) === String(id)) || null;
}
