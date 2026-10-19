// ╔══════════════════════════════════════════════════════════════════════╗
// ║ appFeatures.index.js — ponto de entrada do módulo de funcionalidades ║
// ║ Mantém a mesma API pública do antigo appFeaturesApi.js               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { SCHEMAS } from './appFeatures.constants.js';
import { configureAppFeaturesDb } from './appFeaturesDb.repository.js';
import {
    listFeatures,
    getFeatureByCode,
    listFeatureOptions,
} from './appFeaturesQuery.repository.js';
import { resolveFeature } from './appFeaturesResolve.repository.js';
import {
    upsertFeatureAssignment,
    removeFeatureAssignment,
} from './appFeaturesAssignment.repository.js';

/* ==========================================================================
   Exposed catalog metadata
   ========================================================================== */

// Optional export for repositories/tests that need to inspect the exact catalog
// objects used by this API without importing the three files again.
export const appFeaturesCatalogs = SCHEMAS;

export {
    configureAppFeaturesDb,
    listFeatures,
    getFeatureByCode,
    listFeatureOptions,
    resolveFeature,
    upsertFeatureAssignment,
    removeFeatureAssignment,
};

export default {
    configureAppFeaturesDb,
    listFeatures,
    getFeatureByCode,
    listFeatureOptions,
    resolveFeature,
    upsertFeatureAssignment,
    removeFeatureAssignment,
    catalogs: appFeaturesCatalogs,
};
