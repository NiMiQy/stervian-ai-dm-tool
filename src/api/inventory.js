import express from 'express';
import { getShopItems } from '../containers/sublocationContainer.js';
import { getCharacterVault, transferToVault, transferFromVault, transferVaultGold, VaultAccessError } from '../containers/vaultContainer.js';
import { databaseFailureMessage, requireOutOfCombat, requireSession } from './middleware.js';
import { ERROR_NAMES, HTTP_STATUS } from '../configs/constants.js';

const router = express.Router();

router.get('/sublocations/:id/shop', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    const shop = await getShopItems(Number(request.params.id), session.id, session.user_id);
    return shop ? response.json(shop) : response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Shop not found.' });
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to load the shop.') });
  }
});

router.get('/vault', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    return response.json(await getCharacterVault(session.user_id));
  } catch (error) {
    return response.status(error instanceof VaultAccessError ? HTTP_STATUS.FORBIDDEN : HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: error instanceof VaultAccessError ? error.message : databaseFailureMessage(error, 'Unable to load the vault.')
    });
  }
});

router.post('/vault/deposit', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    return response.json(await transferToVault(session.user_id, request.body));
  } catch (error) {
    const isRuleError = error instanceof VaultAccessError || error.name === ERROR_NAMES.VAULT_RULE;
    return response.status(error instanceof VaultAccessError ? HTTP_STATUS.FORBIDDEN : HTTP_STATUS.BAD_REQUEST).json({
      error: isRuleError ? error.message : databaseFailureMessage(error, 'Unable to store that item.')
    });
  }
});

router.post('/vault/withdraw', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    return response.json(await transferFromVault(session.user_id, request.body));
  } catch (error) {
    const isRuleError = error instanceof VaultAccessError || error.name === ERROR_NAMES.VAULT_RULE;
    return response.status(error instanceof VaultAccessError ? HTTP_STATUS.FORBIDDEN : HTTP_STATUS.BAD_REQUEST).json({
      error: isRuleError ? error.message : databaseFailureMessage(error, 'Unable to withdraw that item.')
    });
  }
});

router.post('/vault/gold', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    return response.json(await transferVaultGold(session.user_id, request.body));
  } catch (error) {
    const isRuleError = error instanceof VaultAccessError || error.name === ERROR_NAMES.VAULT_RULE;
    return response.status(error instanceof VaultAccessError ? HTTP_STATUS.FORBIDDEN : HTTP_STATUS.BAD_REQUEST).json({
      error: isRuleError ? error.message : databaseFailureMessage(error, 'Unable to transfer gold.')
    });
  }
});

export default router;
