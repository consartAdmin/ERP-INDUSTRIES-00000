// ╔══════════════════════════════════════════════════════════════════════╗
// ║ googleAdsCampaignDetailsRoutes.js — Campaign Details Routes          ║
// ║ CONSART ERP | ESM                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import * as C from '../controllers/googleAdsCampaignDetailsController.js';

const router = Router();

// Events
router.post('/events', C.ingestEventToDb);
router.get('/events/realtime', C.realtimeEventsByQuery);

// Campaign data
router.get('/campaigns/stats', C.campaignStats);
router.get('/campaigns/:campaignId/details', C.campaignDetails);
router.get('/campaigns/:campaignId/timeseries', C.campaignTimeseries);
router.get('/campaigns/:campaignId/devices', C.campaignDevices);
router.get('/campaigns/:campaignId/demographics', C.campaignDemographics);
router.get('/campaigns/:campaignId/keywords', C.campaignKeywords);
router.get('/campaigns/:campaignId/search-terms', C.campaignSearchTerms);
router.get('/campaigns/:campaignId/ads', C.campaignAds);
router.get('/campaigns/:campaignId/geo', C.campaignGeo);
router.get('/campaigns/:campaignId/changes', C.campaignChanges);
router.get('/campaigns/:campaignId/weekday-hour', C.campaignWeekdayHour);
router.get('/campaigns/:campaignId/events/realtime', C.campaignRealtimeEvents);
router.post('/campaigns/:campaignId/events/dispatch', C.dispatchEventToGoogleAds);
router.get('/campaigns/:campaignId/full', C.campaignFull);

export default router;
