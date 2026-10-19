// ╔══════════════════════════════════════════════════════════════════════╗
// ║ backend/controllers/betterDateToBuyController.js                   ║
// ║ Better Date To Buy Controller                                      ║
// ║ CONSART ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import * as api from '../repositories/betterDateToBuy/betterDateToBuy.index.js';


// ──────────────────────────────────────────────────────────────────────
// LIST ALL
// ──────────────────────────────────────────────────────────────────────
export async function list(req, res) {
  try {
    const data = await api.getAllBetterDates();

    res.json({
      ok: true,
      data
    });

  } catch (err) {
    console.error(
      '[betterDateToBuy][LIST]',
      err
    );

    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}


// ──────────────────────────────────────────────────────────────────────
// GET BY ID
// ──────────────────────────────────────────────────────────────────────
export async function getById(req, res) {
  try {
    const id = req.params.id;

    const item =
      await api.getBetterDateById(id);

    if (!item) {
      return res.status(404).json({
        ok: false,
        error: 'Record not found'
      });
    }

    res.json({
      ok: true,
      data: item
    });

  } catch (err) {
    console.error(
      '[betterDateToBuy][GET BY ID]',
      err
    );

    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}


// ──────────────────────────────────────────────────────────────────────
// CREATE
// ──────────────────────────────────────────────────────────────────────
export async function create(req, res) {
  try {
    const {
      customer_id,
      alert_day,
      notes
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        ok: false,
        error: 'customer_id is required'
      });
    }

    if (
      !alert_day ||
      Number(alert_day) < 1 ||
      Number(alert_day) > 31
    ) {
      return res.status(400).json({
        ok: false,
        error:
          'alert_day must be between 1 and 31'
      });
    }

    const created =
      await api.createBetterDate({
        customer_id,
        alert_day,
        notes
      });

    res.status(201).json({
      ok: true,
      data: created
    });

  } catch (err) {
    console.error(
      '[betterDateToBuy][CREATE]',
      err
    );

    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}


// ──────────────────────────────────────────────────────────────────────
// UPDATE
// ──────────────────────────────────────────────────────────────────────
export async function update(req, res) {
  try {
    const id = req.params.id;

    const {
      customer_id,
      alert_day,
      notes,
      status
    } = req.body;

    const updated =
      await api.updateBetterDate(
        id,
        {
          customer_id,
          alert_day,
          notes,
          status
        }
      );

    if (!updated) {
      return res.status(404).json({
        ok: false,
        error: 'Record not found'
      });
    }

    res.json({
      ok: true,
      data: updated
    });

  } catch (err) {
    console.error(
      '[betterDateToBuy][UPDATE]',
      err
    );

    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}


// ──────────────────────────────────────────────────────────────────────
// MARK ALERT AS SENT
// ──────────────────────────────────────────────────────────────────────
export async function markSent(req, res) {
  try {
    const updated =
      await api.markAlertSent(
        req.params.id
      );

    if (!updated) {
      return res.status(404).json({
        ok: false,
        error: 'Record not found'
      });
    }

    res.json({
      ok: true,
      data: updated
    });

  } catch (err) {
    console.error(
      '[betterDateToBuy][MARK SENT]',
      err
    );

    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}


// ──────────────────────────────────────────────────────────────────────
// DELETE
// ──────────────────────────────────────────────────────────────────────
export async function remove(req, res) {
  try {
    await api.deleteBetterDate(
      req.params.id
    );

    res.json({
      ok: true,
      success: true
    });

  } catch (err) {
    console.error(
      '[betterDateToBuy][DELETE]',
      err
    );

    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}


// ──────────────────────────────────────────────────────────────────────
// TODAY ALERTS
// ──────────────────────────────────────────────────────────────────────
export async function todayAlerts(
  req,
  res
) {
  try {
    const data =
      await api.getTodayAlerts();

    res.json({
      ok: true,
      count: data.length,
      data
    });

  } catch (err) {
    console.error(
      '[betterDateToBuy][TODAY ALERTS]',
      err
    );

    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}