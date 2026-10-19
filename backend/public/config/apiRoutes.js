/*||============================================================||
  ||------------------------------------------------------------||
  ||-------- apiRoutes.js --------------------------------------||
  ||------------------------------------------------------------||
  || Central API routes registry for PRODNEX ERP               ||
  || Used by all frontend modules                              ||
  || IMPORTANT: routes here are RELATIVE to apiUrl()           ||
  || So DO NOT prefix with /api                                ||
  ||============================================================||*/

'use strict';

/*================================================
 * API ROUTES
 *================================================*/

export const API_ROUTES = Object.freeze({

  /*=============================================
    CRM
  =============================================*/
  crm: Object.freeze({

    deals: Object.freeze({
      list: '/crm/deals',
      getById: (id) => `/crm/deals/${encodeURIComponent(String(id))}`,
      create: '/crm/deals',
      update: (id) => `/crm/deals/${encodeURIComponent(String(id))}`,
      delete: (id) => `/crm/deals/${encodeURIComponent(String(id))}`,

      move: (id) => `/crm/deals/${encodeURIComponent(String(id))}/move`,
      setStatusType: (id) => `/crm/deals/${encodeURIComponent(String(id))}/status-type`,
      registerOutcome: (id) => `/crm/deals/${encodeURIComponent(String(id))}/outcome`
    }),

    lossReasons: Object.freeze({
      list: '/crm-loss-reasons',
      active: '/crm-loss-reasons?onlyActive=true',
      getById: (id) => `/crm-loss-reasons/${encodeURIComponent(String(id))}`,
      create: '/crm-loss-reasons'
    }),

    statusTypes: Object.freeze({
      list: '/crm/status-types'
    }),

    stages: Object.freeze({
      list: '/crm/stages'
    }),

    leadSources: Object.freeze({
      list: '/crm/lead-sources'
    }),

    dealOutcomes: Object.freeze({
      list: '/crm/deal-outcomes'
    }),

    leadConclusionSummary: Object.freeze({
      list: '/crm/conclusion/summary'
    }),

    outcomesSummary: Object.freeze({
      list: '/crm/outcomes/summary'
    }),

    outcomes: Object.freeze({
      list: '/crm/outcomes'
    })

  })

});