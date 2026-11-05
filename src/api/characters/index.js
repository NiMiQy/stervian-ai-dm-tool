import express from 'express';
import actionsRouter from './actions.js';
import dialogueRouter from './dialogue.js';
import historyRouter from './history.js';
import inventoryRouter from './inventory.js';
import managementRouter from './management.js';
import worldTravelRouter from './worldTravel.js';
import scenesRouter from './scenes.js';
import observeRouter from './observe.js';

const router = express.Router();

router.use('/', managementRouter);
router.use('/', worldTravelRouter);
router.use('/', inventoryRouter);
router.use('/', actionsRouter);
router.use('/', historyRouter);
router.use('/', dialogueRouter);
router.use('/', scenesRouter);
router.use('/', observeRouter);

export default router;
