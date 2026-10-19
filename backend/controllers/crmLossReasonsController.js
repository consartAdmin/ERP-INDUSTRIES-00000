/*||============================================================||
  ||------------------------------------------------------------||
  ||-------- crmLossReasonsController.js -----------------------||
  ||------------------------------------------------------------||
  || Controller for CRM Loss Reasons                           ||
  || CONSART ERP                                               ||
  ||============================================================||*/

import crmLossReasonsApi from '../repositories/crmLossReasons/crmLossReasons.index.js';

/*================================================
 * HELPERS
 *================================================*/
function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return fallback;

  const v = String(value).trim().toLowerCase();

  if (['true', '1', 'yes', 'y', 'on'].includes(v)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(v)) return false;

  return fallback;
}

function buildErrorPayload(error, fallbackMessage = 'Internal server error.') {
  return {
    success: false,
    message: error?.message || fallbackMessage
  };
}

/*================================================
 * CONTROLLER
 *================================================*/
const crmLossReasonsController = {
  /*----------------------------------------------
   * GET /api/crm-loss-reasons
   * Optional query:
   *   ?onlyActive=true
   *---------------------------------------------*/
  async list(req, res) {
    try {
      const onlyActive = normalizeBoolean(req.query.onlyActive, false);

      const rows = onlyActive
        ? await crmLossReasonsApi.listActive()
        : await crmLossReasonsApi.listAll();

      return res.status(200).json({
        success: true,
        message: 'CRM loss reasons loaded successfully.',
        data: rows,
        total: rows.length
      });
    } catch (error) {
      console.error('[crmLossReasonsController.list] Error:', error);

      return res.status(500).json(
        buildErrorPayload(error, 'Failed to load CRM loss reasons.')
      );
    }
  },

  /*----------------------------------------------
   * GET /api/crm-loss-reasons/:id
   *---------------------------------------------*/
  async getById(req, res) {
    try {
      const { id } = req.params;

      const row = await crmLossReasonsApi.getById(id);

      if (!row) {
        return res.status(404).json({
          success: false,
          message: 'CRM loss reason not found.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'CRM loss reason loaded successfully.',
        data: row
      });
    } catch (error) {
      console.error('[crmLossReasonsController.getById] Error:', error);

      const status =
        error?.message === 'Invalid id.' ? 400 : 500;

      return res.status(status).json(
        buildErrorPayload(
          error,
          status === 400
            ? 'Invalid CRM loss reason id.'
            : 'Failed to load CRM loss reason.'
        )
      );
    }
  },

  /*----------------------------------------------
   * POST /api/crm-loss-reasons
   * Body:
   *   {
   *     reason_name: string,
   *     is_active?: boolean
   *   }
   *---------------------------------------------*/
  async create(req, res) {
    try {
      const payload = {
        reason_name: req.body?.reason_name,
        is_active: req.body?.is_active
      };

      const created = await crmLossReasonsApi.create(payload);

      return res.status(201).json({
        success: true,
        message: 'CRM loss reason created successfully.',
        data: created
      });
    } catch (error) {
      console.error('[crmLossReasonsController.create] Error:', error);

      let status = 500;

      if (
        error?.message === 'reason_name is required.' ||
        error?.message === 'Invalid id.'
      ) {
        status = 400;
      }

      if (error?.message === 'A loss reason with this name already exists.') {
        status = 409;
      }

      return res.status(status).json(
        buildErrorPayload(error, 'Failed to create CRM loss reason.')
      );
    }
  }
};

export default crmLossReasonsController;