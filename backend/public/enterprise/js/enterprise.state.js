// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterprise.state.js                                                 ║
// ║ Estado central do módulo Empresas                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const enterpriseState = {
  rows: [],
  selectedEnterprise: null,
  loading: false,
  saving: false,
  filters: {
    q: '',
    is_active: '',
  },
};

export function setEnterpriseRows(rows) {
  enterpriseState.rows = Array.isArray(rows) ? rows : [];
}

export function setSelectedEnterprise(enterprise) {
  enterpriseState.selectedEnterprise = enterprise || null;
}

export function setEnterpriseLoading(value) {
  enterpriseState.loading = Boolean(value);
}

export function setEnterpriseSaving(value) {
  enterpriseState.saving = Boolean(value);
}

export function setEnterpriseFilters(filters = {}) {
  enterpriseState.filters = {
    ...enterpriseState.filters,
    ...filters,
  };
}
