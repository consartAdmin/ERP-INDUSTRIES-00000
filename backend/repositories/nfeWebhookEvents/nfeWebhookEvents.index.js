// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeWebhookEvents.index.js — ponto de entrada (webhooks NF-e)         ║
// ║ Mantém a mesma API pública do antigo nfeWebhookEventsApi.js          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { insertWebhookEvent } from './nfeWebhookEventsCreate.repository.js';
import { listWebhookEvents, getWebhookEventById } from './nfeWebhookEventsQuery.repository.js';
import { deleteOldWebhookEvents } from './nfeWebhookEventsRemove.repository.js';

export {
  insertWebhookEvent,
  listWebhookEvents,
  getWebhookEventById,
  deleteOldWebhookEvents,
};

const nfeWebhookEventsApi = {
  insertWebhookEvent,
  listWebhookEvents,
  getWebhookEventById,
  deleteOldWebhookEvents
};

export default nfeWebhookEventsApi;
