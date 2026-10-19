export const state = {
  currentEditId: null,
  currentList: [],
  pagination: {
    page: 1,
    rowsPerPage: 50,
  },
  designer: {
    selectedId: null,
    drag: {
      active: false,
      elementId: null,
      pointerOffsetXmm: 0,
      pointerOffsetYmm: 0,
    },
    layout: { version: 1, elements: [] },
  },
};
