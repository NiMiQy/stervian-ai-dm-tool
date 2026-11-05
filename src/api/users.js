import express from 'express';
import { getUserAccount } from '../containers/userContainer.js';
import { getOwnedRecord } from './middleware.js';

const router = express.Router();

router.get('/:id', (request, response) => getOwnedRecord(request, response, getUserAccount, 'user'));

export default router;
