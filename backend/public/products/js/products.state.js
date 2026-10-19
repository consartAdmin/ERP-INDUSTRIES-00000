// ╔══════════════════════════════════════════════════════════════════════╗
// ║ products.state.js — Estado do módulo de produtos                    ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const state = {
  page: 1,
  limit: 50,
  q: '',
  loading: false,
  aborter: null,

  // appFeature PRODUCT_SEARCH_IMAGE_MODE (IMAGE_HIDE → false)
  showImages: true,

  // appFeature PRODUCT_LOCATIONS (LOCATIONS_DISABLED → false)
  showLocations: true,

  filters: {
    status: '',
    manufacturer_id: '',
    supplier_id: '',
    group_id: '',
    subgroup_id: '',
  },
};