// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: locationsBarCode.filters.js                                  ║
// ║ MODULE: Locations Barcode — Filters                                ║
// ║ PRODNEX ERP · Frontend · ESM                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { state } from './locationsBarCode.state.js';
import { $, normalize } from './locationsBarCode.utils.js';

export function applyFilters() {
  const filters = {
    q: normalize($('#filterSearch')?.value),
    local: normalize($('#filterLocal')?.value),
    corridor: normalize($('#filterCorridor')?.value),
    shelf: normalize($('#filterShelf')?.value),
    bin: normalize($('#filterBin')?.value),
  };

  state.filteredBarcodes = state.cacheBarcodes.filter((row) => {
    const values = {
      barcode: normalize(row.barcode),
      local: normalize(row.local),
      corridor: normalize(row.corredor),
      shelf: normalize(row.prateleira),
      bin: normalize(row.bandeja),
      position: normalize(row.position),
      label: normalize(row.label),
    };
    const matchQuery =
      !filters.q ||
      Object.values(values).some((value) => value.includes(filters.q));
    return (
      matchQuery &&
      (!filters.local || values.local.includes(filters.local)) &&
      (!filters.corridor || values.corridor.includes(filters.corridor)) &&
      (!filters.shelf || values.shelf.includes(filters.shelf)) &&
      (!filters.bin || values.bin.includes(filters.bin))
    );
  });

  state.currentPage = 1;
}

export function clearFilters() {
  ['#filterSearch', '#filterLocal', '#filterCorridor', '#filterShelf', '#filterBin']
    .forEach((selector) => {
      const element = $(selector);
      if (element) element.value = '';
    });
  state.filteredBarcodes = [...state.cacheBarcodes];
  state.currentPage = 1;
}

