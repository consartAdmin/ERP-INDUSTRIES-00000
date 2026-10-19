// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalClassification.config.js                               ║
// ║ MODULE: Fiscal Classification — Configuration                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const ROUTES = Object.freeze({
  fiscalClassifications: '/api/v2/fiscal-classifications',
  fiscalClassificationById: (id) =>
    `/api/v2/fiscal-classifications/${encodeURIComponent(id)}`,
  fiscalClassificationActive: (id) =>
    `/api/v2/fiscal-classifications/${encodeURIComponent(id)}/active`,
  fiscalProfiles: '/api/v2/fiscal-profiles',
});

export const DEFAULT_PAGE_SIZE = 50;
