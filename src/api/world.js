import express from 'express';
import prisma from '../services/prismaClient.js';
import { databaseFailureMessage, requireSession } from './middleware.js';
import { getGameTime } from '../services/gameClockService.js';
import { describeWeather, getLocationWeather } from '../services/locationWeatherService.js';
import { HTTP_STATUS } from '../configs/constants.js';
import { databaseError } from '../database/databaseError.js';

const router = express.Router();

router.get('/time', (request, response) => {
  if (!requireSession(request, response)) return undefined;
  return response.json(getGameTime());
});

router.get('/weather', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return undefined;
  try {
    let character;
    try {
      character = await prisma.characters.findUnique({ where: { user_id: session.user_id }, select: { location_id: true } });
    } catch (error) {
      throw databaseError('getWorldWeather', 'load character location', error);
    }
    if (!character?.location_id) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character location was not found.' });
    const record = await getLocationWeather(character.location_id);
    if (!record) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Location weather was not found.' });
    return response.json(describeWeather(record));
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to load weather.') });
  }
});

export default router;
