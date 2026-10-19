// ╔══════════════════════════════════════════════════════════════════════╗
// ║ transportersController.js                                           ║
// ║ Controller — Transporters                                           ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import transportersApi from '../repositories/transporters/transporters.index.js';
import transportersAttachmentsApi from '../repositories/transporters/transportersAttachments.repository.js';

function getStatusFromError(error) {
  const message = String(error?.message || '').toLowerCase();

  if (message.includes('invalid')) return 400;
  if (message.includes('required')) return 400;
  if (message.includes('provide either')) return 400;
  if (message.includes('not found')) return 404;
  if (message.includes('no file')) return 400;

  return 500;
}

function errorResponse(res, error, publicMessage) {
  return res.status(getStatusFromError(error)).json({
    error: publicMessage,
    message: error?.message || publicMessage,
  });
}

async function list(req, res) {
  try {
    const data = await transportersApi.list();
    return res.status(200).json(data);
  } catch (error) {
    console.error('[transportersController.list]', error);
    return errorResponse(res, error, 'Error listing transporters.');
  }
}

async function getById(req, res) {
  try {
    const data = await transportersApi.getById(req.params.id);

    if (!data) {
      return res.status(404).json({ error: 'Transporter not found.' });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('[transportersController.getById]', error);
    return errorResponse(res, error, 'Error fetching transporter.');
  }
}

async function create(req, res) {
  try {
    const data = await transportersApi.create(req.body || {});
    return res.status(201).json(data);
  } catch (error) {
    console.error('[transportersController.create]', error);
    return errorResponse(res, error, 'Error creating transporter.');
  }
}

async function update(req, res) {
  try {
    const data = await transportersApi.update(req.params.id, req.body || {});

    if (!data) {
      return res.status(404).json({ error: 'Transporter not found.' });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('[transportersController.update]', error);
    return errorResponse(res, error, 'Error updating transporter.');
  }
}

async function remove(req, res) {
  try {
    const removed = await transportersApi.remove(req.params.id);

    if (!removed) {
      return res.status(404).json({ error: 'Transporter not found.' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[transportersController.remove]', error);
    return errorResponse(res, error, 'Error deleting transporter.');
  }
}

async function listAttachments(req, res) {
  try {
    const data = await transportersAttachmentsApi.list(req.params.id);
    return res.status(200).json(data);
  } catch (error) {
    console.error('[transportersController.listAttachments]', error);
    return errorResponse(res, error, 'Error listing transporter attachments.');
  }
}

async function uploadAttachment(req, res) {
  try {
    const data = await transportersAttachmentsApi.upload(req.params.id, req.file);
    return res.status(201).json(data);
  } catch (error) {
    console.error('[transportersController.uploadAttachment]', error);
    return errorResponse(res, error, 'Error uploading transporter attachment.');
  }
}

async function deleteAttachment(req, res) {
  try {
    const removed = await transportersAttachmentsApi.remove(
      req.params.id,
      req.params.attachmentId,
    );

    if (!removed) {
      return res.status(404).json({ error: 'Attachment not found.' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[transportersController.deleteAttachment]', error);
    return errorResponse(res, error, 'Error deleting transporter attachment.');
  }
}

export default {
  list,
  getById,
  create,
  update,
  remove,
  listAttachments,
  uploadAttachment,
  deleteAttachment,
};

