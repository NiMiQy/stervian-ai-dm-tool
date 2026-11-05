import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getUserActiveParty } from '../../../../containers/partyContainer.js';
import { CHARACTER_TYPE } from '../../../../configs/constants.js';

export const checkPartyStatusTool = tool(
  async ({ user_id }, config) => {
    try {
      const partyData = await getUserActiveParty(user_id);
      const party = partyData?.party;
      if (!party || !Array.isArray(party.members) || party.members.length === 0) {
        return JSON.stringify({ inParty: false, message: 'Adventuring solo (No active party).' });
      }

      const members = party.members.map((m) => ({
        name: m.name,
        race: m.race,
        isLeader: m.is_leader || m.role === 'LEADER',
        isHumanPlayer: m.is_player || m.character_type === CHARACTER_TYPE.PLAYER,
        tactics: m.tactics_role || 'BALANCED'
      }));

      return JSON.stringify({
        inParty: true,
        partyName: party.name,
        memberCount: members.length,
        members
      });
    } catch (err) {
      return JSON.stringify({ error: 'Failed to retrieve party.', detail: err.message });
    }
  },
  {
    name: 'check_party_status',
    description: 'Check active party members, who is party leader, which members are real humans versus AI companions, and tactics.',
    schema: z.object({
      user_id: z.string().describe('The active user ID.')
    })
  }
);
