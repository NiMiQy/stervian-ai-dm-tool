import prisma from '../services/prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { broadcastToUsers } from '../services/webSocketService.js';
import { characterItemInclude, buildEquipment } from '../components/logics/characterItems.js';
import { getOnlineTracker } from '../services/onlineResourceService.js';
import {
  CHARACTER_TYPE,
  DEFAULT_TACTICS_ROLE,
  ITEM_LOCATION,
  MAX_PARTY_SIZE,
  PARTY_INVITE_STATUS,
  PARTY_MEMBER_ROLE,
  PARTY_STATUS,
  RECRUITED_COMPANION_RELATIONSHIP_SCORE,
  SAME_LOCATION_PARTY_ERROR,
  VALID_TACTICS,
  WEBSOCKET_EVENTS,
} from '../configs/constants.js';

export { MAX_PARTY_SIZE, VALID_TACTICS };

function areCoLocated(firstCharacter, secondCharacter) {
  return firstCharacter?.location_id != null &&
    firstCharacter.location_id === secondCharacter?.location_id &&
    (firstCharacter.sublocation_id ?? null) === (secondCharacter?.sublocation_id ?? null);
}

function formatPartyMember(member) {
  const char = member.character || {};
  const equipment = buildEquipment(char.character_items || []);
  const isPlayer = char.character_type === CHARACTER_TYPE.PLAYER;

  return {
    id: member.id,
    party_id: member.party_id,
    character_id: member.character_id,
    user_id: char.user_id || null,
    name: char.name || 'Unknown',
    character_type: char.character_type,
    is_player: isPlayer,
    is_leader: member.role === PARTY_MEMBER_ROLE.LEADER,
    is_online: isPlayer && Boolean(char.user_id && getOnlineTracker(char.user_id)),
    race: char.race || 'Human',
    appearance: char.appearance || null,
    role: member.role,
    tactics_role: member.tactics_role || DEFAULT_TACTICS_ROLE,
    relationship_score: member.relationship_score ?? 0,
    is_active: member.is_active,
    equipment
  };
}

const memberCharacterSelect = {
  id: true,
  user_id: true,
  name: true,
  race: true,
  appearance: true,
  character_type: true,
  character_items: {
    where: { deleted: false, location: ITEM_LOCATION.EQUIPPED },
    include: characterItemInclude,
    orderBy: { id: 'asc' }
  }
};

export async function getUserActiveParty(userId) {
  try {
    const character = await prisma.characters.findUnique({
      where: { user_id: userId },
      select: { id: true, name: true, location_id: true, sublocation_id: true }
    });
    if (!character) return { party: null, pendingInvites: [] };

    // Find party membership
    const membership = await prisma.party_members.findFirst({
      where: {
        character_id: character.id,
        deleted: false,
        party: { status: PARTY_STATUS.ACTIVE, deleted: false }
      },
      include: {
        party: {
          include: {
            members: {
              where: { deleted: false },
              include: { character: { select: memberCharacterSelect } },
              orderBy: { slot_order: 'asc' }
            }
          }
        }
      }
    });

    // Find incoming pending invites for this player
    const pendingInvites = await prisma.party_invites.findMany({
      where: {
        invitee_character_id: character.id,
        status: PARTY_INVITE_STATUS.PENDING,
        deleted: false,
        party: { status: PARTY_STATUS.ACTIVE, deleted: false }
      },
      include: {
        party: { select: { id: true, name: true } },
        inviter: { select: { id: true, name: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    let recruitableNpcs = [];
    if (character.location_id || character.sublocation_id) {
      const appearanceScope = character.sublocation_id
        ? { sublocation_id: character.sublocation_id }
        : { location_id: character.location_id };
      const appearances = await prisma.npcs_in_locations_or_sublocations.findMany({
        where: {
          deleted: false,
          ...appearanceScope,
          npc: {
            is: {
              deleted: false,
              is_recruitable: true,
              npc_monsters: { is: null },
              character: { is: { character_type: CHARACTER_TYPE.NPC, deleted: false } }
            }
          }
        },
        include: {
          npc: {
            include: {
              character: {
                select: {
                  id: true,
                  name: true,
                  race: true,
                  job: true,
                  level: true,
                  appearance: true
                }
              }
            }
          }
        }
      });

      recruitableNpcs = appearances
        .filter((a) => a.npc?.character)
        .map((a) => ({
          npc_id: a.npc.character_id,
          character_id: a.npc.character.id,
          name: a.npc.character.name,
          race: a.npc.character.race,
          job: a.npc.character.job,
          level: a.npc.character.level,
          appearance: a.npc.character.appearance
        }));
    }

    if (!membership?.party) {
      return {
        party: null,
        pendingInvites: pendingInvites.map((inv) => ({
          id: inv.id,
          party_id: inv.party_id,
          party_name: inv.party.name,
          inviter_id: inv.inviter_character_id,
          inviter_name: inv.inviter.name,
          created_at: inv.created_at
        })),
        recruitableNpcs
      };
    }

    const party = membership.party;
    const formattedMembers = party.members.map(formatPartyMember);

    return {
      party: {
        id: party.id,
        name: party.name,
        leader_character_id: party.leader_character_id,
        max_size: party.max_size,
        status: party.status,
        member_count: formattedMembers.length,
        is_leader: party.leader_character_id === character.id,
        members: formattedMembers
      },
      pendingInvites: pendingInvites.map((inv) => ({
        id: inv.id,
        party_id: inv.party_id,
        party_name: inv.party.name,
        inviter_id: inv.inviter_character_id,
        inviter_name: inv.inviter.name,
        created_at: inv.created_at
      })),
      recruitableNpcs
    };
  } catch (error) {
    throw databaseError('getUserActiveParty', 'read', error);
  }
}

export async function createParty(userId, name = null) {
  try {
    const character = await prisma.characters.findUnique({
      where: { user_id: userId },
      select: { id: true, name: true }
    });
    if (!character) return { error: 'Character not found.' };

    const existingMembership = await prisma.party_members.findFirst({
      where: {
        character_id: character.id,
        deleted: false,
        party: { status: PARTY_STATUS.ACTIVE, deleted: false }
      }
    });
    if (existingMembership) {
      return { error: 'You are already in an active party. Leave your current party first.' };
    }

    const partyName = name?.trim() || `${character.name}'s Party`;

    const party = await prisma.$transaction(async (tx) => {
      const created = await tx.parties.create({
        data: {
          name: partyName,
          leader_character_id: character.id,
          max_size: MAX_PARTY_SIZE,
          status: PARTY_STATUS.ACTIVE
        }
      });

      await tx.party_members.create({
        data: {
          party_id: created.id,
          character_id: character.id,
          role: PARTY_MEMBER_ROLE.LEADER,
          slot_order: 1,
          tactics_role: DEFAULT_TACTICS_ROLE
        }
      });

      return created;
    });

    return await getUserActiveParty(userId);
  } catch (error) {
    throw databaseError('createParty', 'create', error);
  }
}

export async function invitePlayer(userId, targetIdentifier) {
  if (!targetIdentifier || typeof targetIdentifier !== 'string' || !targetIdentifier.trim()) {
    return { error: 'Player name or username is required.' };
  }
  const cleanId = targetIdentifier.trim();

  try {
    const leaderChar = await prisma.characters.findUnique({
      where: { user_id: userId },
      select: { id: true, name: true, user_id: true, location_id: true, sublocation_id: true }
    });
    if (!leaderChar) return { error: 'Character not found.' };

    // Find target character by username, character name, or ID
    const targetChar = await prisma.characters.findFirst({
      where: {
        character_type: CHARACTER_TYPE.PLAYER,
        deleted: false,
        OR: [
          { name: cleanId },
          { user: { username: cleanId } },
          ...(Number.isInteger(Number(cleanId)) ? [{ id: Number(cleanId) }] : [])
        ]
      },
      include: { user: { select: { user_id: true, username: true } } }
    });

    if (!targetChar) {
      return { error: `Player "${cleanId}" not found.` };
    }

    if (targetChar.id === leaderChar.id) {
      return { error: 'You cannot invite yourself to your party.' };
    }

    if (!areCoLocated(leaderChar, targetChar)) {
      return { error: SAME_LOCATION_PARTY_ERROR };
    }

    // Get or auto-create party after validating the target's location.
    let partyInfo = await getUserActiveParty(userId);
    let party = partyInfo.party;
    if (!party) {
      const created = await createParty(userId);
      if (created.error) return created;
      party = created.party;
    }

    if (party.leader_character_id !== leaderChar.id) {
      return { error: 'Only the party leader can invite players.' };
    }

    if (party.members.length >= party.max_size) {
      return { error: `Party is full (maximum ${party.max_size} members).` };
    }

    // Check if target is already in an active party
    const targetMembership = await prisma.party_members.findFirst({
      where: {
        character_id: targetChar.id,
        deleted: false,
        party: { status: PARTY_STATUS.ACTIVE, deleted: false }
      }
    });
    if (targetMembership) {
      return { error: `${targetChar.name} is already in another party.` };
    }

    // Check existing pending invite
    const existingInvite = await prisma.party_invites.findFirst({
      where: {
        party_id: party.id,
        invitee_character_id: targetChar.id,
        status: PARTY_INVITE_STATUS.PENDING,
        deleted: false
      }
    });
    if (existingInvite) {
      return { error: `An invitation has already been sent to ${targetChar.name}.` };
    }

    const invite = await prisma.party_invites.create({
      data: {
        party_id: party.id,
        inviter_character_id: leaderChar.id,
        invitee_character_id: targetChar.id,
        status: PARTY_INVITE_STATUS.PENDING
      }
    });

    // Notify target via WebSocket if online
    if (targetChar.user_id) {
      broadcastToUsers(targetChar.user_id, WEBSOCKET_EVENTS.PARTY_INVITE, {
        inviteId: invite.id,
        partyId: party.id,
        partyName: party.name,
        inviterName: leaderChar.name
      });
    }

    return {
      success: true,
      message: `Invitation sent to ${targetChar.name}.`,
      invite: {
        id: invite.id,
        party_id: party.id,
        target_name: targetChar.name
      }
    };
  } catch (error) {
    throw databaseError('invitePlayer', 'create', error);
  }
}

export async function respondToInvite(userId, inviteId, accept) {
  const invId = Number(inviteId);
  if (!Number.isInteger(invId) || invId <= 0) return { error: 'Invalid invite ID.' };

  try {
    const character = await prisma.characters.findUnique({
      where: { user_id: userId },
      select: { id: true, name: true, user_id: true, location_id: true, sublocation_id: true }
    });
    if (!character) return { error: 'Character not found.' };

    const invite = await prisma.party_invites.findUnique({
      where: { id: invId },
      include: {
        party: {
          include: {
            members: { where: { deleted: false } }
          }
        },
        inviter: { select: { user_id: true, name: true } }
      }
    });

    if (!invite || invite.deleted || invite.invitee_character_id !== character.id) {
      return { error: 'Invitation not found or not addressed to you.' };
    }

    if (invite.status !== PARTY_INVITE_STATUS.PENDING) {
      return { error: `This invitation has already been ${invite.status.toLowerCase()}.` };
    }

    if (invite.party.status !== PARTY_STATUS.ACTIVE || invite.party.deleted) {
      await prisma.party_invites.update({ where: { id: invId }, data: { status: PARTY_INVITE_STATUS.EXPIRED } });
      return { error: 'The party has been disbanded.' };
    }

    if (!accept) {
      await prisma.party_invites.update({ where: { id: invId }, data: { status: PARTY_INVITE_STATUS.DECLINED } });
      if (invite.inviter?.user_id) {
        broadcastToUsers(invite.inviter.user_id, WEBSOCKET_EVENTS.PARTY_INVITE_DECLINED, {
          inviteId: invId,
          playerName: character.name
        });
      }
      return { success: true, status: PARTY_INVITE_STATUS.DECLINED, message: 'Invitation declined.' };
    }

    const leaderCharacter = await prisma.characters.findUnique({
      where: { id: invite.party.leader_character_id },
      select: { id: true, name: true, location_id: true, sublocation_id: true }
    });
    if (!leaderCharacter || !areCoLocated(leaderCharacter, character)) {
      return { error: SAME_LOCATION_PARTY_ERROR };
    }

    // Accepting invite
    if (invite.party.members.length >= invite.party.max_size) {
      await prisma.party_invites.update({ where: { id: invId }, data: { status: PARTY_INVITE_STATUS.EXPIRED } });
      return { error: 'The party is now full.' };
    }

    // Ensure invitee has no other active party
    const existingMembership = await prisma.party_members.findFirst({
      where: {
        character_id: character.id,
        deleted: false,
        party: { status: PARTY_STATUS.ACTIVE, deleted: false }
      }
    });
    if (existingMembership) {
      return { error: 'You are already in a party. Leave it before accepting this invite.' };
    }

    const nextSlot = invite.party.members.length + 1;

    await prisma.$transaction(async (tx) => {
      await tx.party_invites.update({
        where: { id: invId },
        data: { status: PARTY_INVITE_STATUS.ACCEPTED }
      });

      await tx.party_members.create({
        data: {
          party_id: invite.party_id,
          character_id: character.id,
          role: PARTY_MEMBER_ROLE.MEMBER,
          slot_order: nextSlot,
          tactics_role: DEFAULT_TACTICS_ROLE
        }
      });
    });

    // Notify all party members
    const updatedPartyInfo = await getUserActiveParty(userId);
    const memberUserIds = (updatedPartyInfo.party?.members || [])
      .map((m) => m.user_id)
      .filter(Boolean);

    broadcastToUsers(memberUserIds, WEBSOCKET_EVENTS.PARTY_MEMBER_JOINED, {
      partyId: invite.party_id,
      memberName: character.name,
      party: updatedPartyInfo.party
    });

    return {
      success: true,
      message: `You joined ${invite.party.name}!`,
      party: updatedPartyInfo.party
    };
  } catch (error) {
    throw databaseError('respondToInvite', 'update', error);
  }
}

export async function recruitNpcCompanion(userId, npcCharacterId) {
  const npcId = Number(npcCharacterId);
  if (!Number.isInteger(npcId) || npcId <= 0) return { error: 'Invalid NPC ID.' };

  try {
    const leaderChar = await prisma.characters.findUnique({
      where: { user_id: userId },
      select: { id: true, name: true, location_id: true, sublocation_id: true }
    });
    if (!leaderChar) return { error: 'Character not found.' };

    // Find the NPC
    const npcChar = await prisma.characters.findFirst({
      where: {
        id: npcId,
        character_type: CHARACTER_TYPE.NPC,
        deleted: false,
        npc: { is: { is_recruitable: true, deleted: false } }
      },
      include: {
        npc: {
          include: {
            npcs_in_locations_or_sublocations: { where: { deleted: false } }
          }
        }
      }
    });

    if (!npcChar) {
      return { error: 'This NPC cannot be recruited into your party.' };
    }

    // Location check: NPC must be in the same location or sublocation
    const appearances = npcChar.npc?.npcs_in_locations_or_sublocations || [];
    const sameLocation = appearances.some((app) =>
      (app.sublocation_id && leaderChar.sublocation_id && app.sublocation_id === leaderChar.sublocation_id) ||
      (app.location_id && leaderChar.location_id && app.location_id === leaderChar.location_id)
    );
    if (!sameLocation && appearances.length > 0) {
      return { error: `${npcChar.name} is not in your current location.` };
    }

    // Get or auto-create party
    let partyInfo = await getUserActiveParty(userId);
    let party = partyInfo.party;
    if (!party) {
      const created = await createParty(userId);
      if (created.error) return created;
      party = created.party;
    }

    if (party.leader_character_id !== leaderChar.id) {
      return { error: 'Only the party leader can recruit companions.' };
    }

    if (party.members.length >= party.max_size) {
      return { error: `Party is full (maximum ${party.max_size} members).` };
    }

    // Check if NPC is already in this party
    const alreadyInParty = party.members.some((m) => m.character_id === npcId);
    if (alreadyInParty) {
      return { error: `${npcChar.name} is already in your party.` };
    }

    const nextSlot = party.members.length + 1;

    const newMember = await prisma.party_members.create({
      data: {
        party_id: party.id,
        character_id: npcId,
        role: PARTY_MEMBER_ROLE.MEMBER,
        slot_order: nextSlot,
        tactics_role: DEFAULT_TACTICS_ROLE,
        relationship_score: RECRUITED_COMPANION_RELATIONSHIP_SCORE
      }
    });

    const updatedPartyInfo = await getUserActiveParty(userId);
    const memberUserIds = (updatedPartyInfo.party?.members || [])
      .map((m) => m.user_id)
      .filter(Boolean);

    broadcastToUsers(memberUserIds, WEBSOCKET_EVENTS.PARTY_MEMBER_JOINED, {
      partyId: party.id,
      memberName: npcChar.name,
      party: updatedPartyInfo.party
    });

    return {
      success: true,
      message: `${npcChar.name} has joined your party!`,
      member: newMember,
      companion: { id: npcChar.id, name: npcChar.name },
      party: updatedPartyInfo.party
    };
  } catch (error) {
    throw databaseError('recruitNpcCompanion', 'create', error);
  }
}

export async function dismissCompanion(userId, companionCharacterId) {
  const compId = Number(companionCharacterId);
  if (!Number.isInteger(compId) || compId <= 0) return { error: 'Invalid companion ID.' };

  try {
    const leaderChar = await prisma.characters.findUnique({
      where: { user_id: userId },
      select: { id: true }
    });
    if (!leaderChar) return { error: 'Character not found.' };

    const partyInfo = await getUserActiveParty(userId);
    const party = partyInfo.party;
    if (!party || party.leader_character_id !== leaderChar.id) {
      return { error: 'Only the party leader can dismiss companions.' };
    }

    const targetMember = party.members.find((m) => m.character_id === compId || m.id === compId);
    if (!targetMember) return { error: 'Companion not found in your party.' };

    await prisma.party_members.delete({
      where: { id: targetMember.id }
    });

    // Re-order slots
    const remaining = await prisma.party_members.findMany({
      where: { party_id: party.id, deleted: false },
      orderBy: { slot_order: 'asc' }
    });
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].slot_order !== i + 1) {
        await prisma.party_members.update({
          where: { id: remaining[i].id },
          data: { slot_order: i + 1 }
        });
      }
    }

    const updatedPartyInfo = await getUserActiveParty(userId);
    const memberUserIds = (updatedPartyInfo.party?.members || [])
      .map((m) => m.user_id)
      .filter(Boolean);

    broadcastToUsers(memberUserIds, WEBSOCKET_EVENTS.PARTY_MEMBER_LEFT, {
      partyId: party.id,
      memberName: targetMember.name,
      party: updatedPartyInfo.party
    });

    return {
      success: true,
      message: `${targetMember.name} has left the party.`,
      party: updatedPartyInfo.party
    };
  } catch (error) {
    throw databaseError('dismissCompanion', 'delete', error);
  }
}

export async function leaveParty(userId) {
  try {
    const character = await prisma.characters.findUnique({
      where: { user_id: userId },
      select: { id: true, name: true }
    });
    if (!character) return { error: 'Character not found.' };

    const partyInfo = await getUserActiveParty(userId);
    const party = partyInfo.party;
    if (!party) return { error: 'You are not in an active party.' };

    const myMembership = party.members.find((m) => m.character_id === character.id);
    if (!myMembership) return { error: 'Membership not found.' };

    const remainingMembers = party.members.filter((m) => m.character_id !== character.id);
    const remainingHumanMembers = remainingMembers.filter((m) => m.is_player);

    if (party.is_leader) {
      if (remainingHumanMembers.length > 0) {
        // Transfer leadership to next human player
        const newLeader = remainingHumanMembers[0];
        await prisma.$transaction(async (tx) => {
          await tx.party_members.delete({ where: { id: myMembership.id } });
          await tx.party_members.update({
            where: { id: newLeader.id },
            data: { role: PARTY_MEMBER_ROLE.LEADER }
          });
          await tx.parties.update({
            where: { id: party.id },
            data: { leader_character_id: newLeader.character_id }
          });
        });
        const remainingUserIds = remainingHumanMembers.map((m) => m.user_id).filter(Boolean);
        broadcastToUsers(remainingUserIds, WEBSOCKET_EVENTS.PARTY_MEMBER_LEFT, {
          partyId: party.id,
          memberName: character.name,
          newLeaderName: newLeader.name
        });
      } else {
        // Disband party (no other players)
        await prisma.$transaction(async (tx) => {
          await tx.parties.update({ where: { id: party.id }, data: { status: PARTY_STATUS.DISBANDED, deleted: true } });
          await tx.party_members.deleteMany({ where: { party_id: party.id } });
          await tx.party_invites.updateMany({ where: { party_id: party.id, status: PARTY_INVITE_STATUS.PENDING }, data: { status: PARTY_INVITE_STATUS.EXPIRED } });
        });
      }
    } else {
      // Regular member leaving
      await prisma.party_members.delete({ where: { id: myMembership.id } });
      const memberUserIds = party.members
        .map((m) => m.user_id)
        .filter((uid) => uid && uid !== userId);

      broadcastToUsers(memberUserIds, WEBSOCKET_EVENTS.PARTY_MEMBER_LEFT, {
        partyId: party.id,
        memberName: character.name
      });
    }

    return { success: true, message: 'You left the party.' };
  } catch (error) {
    throw databaseError('leaveParty', 'update', error);
  }
}

export async function updateCompanionTactics(userId, companionCharacterId, tacticsRole) {
  const compId = Number(companionCharacterId);
  const cleanRole = String(tacticsRole || '').trim().toUpperCase();
  if (!VALID_TACTICS.includes(cleanRole)) {
    return { error: `Invalid tactics role. Must be one of: ${VALID_TACTICS.join(', ')}.` };
  }

  try {
    const leaderChar = await prisma.characters.findUnique({
      where: { user_id: userId },
      select: { id: true }
    });
    if (!leaderChar) return { error: 'Character not found.' };

    const partyInfo = await getUserActiveParty(userId);
    const party = partyInfo.party;
    if (!party || party.leader_character_id !== leaderChar.id) {
      return { error: 'Only the party leader can adjust companion tactics.' };
    }

    const companionMember = party.members.find((m) => m.character_id === compId || m.id === compId);
    if (!companionMember) return { error: 'Companion not found in your party.' };

    await prisma.party_members.update({
      where: { id: companionMember.id },
      data: { tactics_role: cleanRole }
    });

    return {
      success: true,
      member: { ...companionMember, tactics_role: cleanRole },
      companionId: compId,
      tacticsRole: cleanRole
    };
  } catch (error) {
    throw databaseError('updateCompanionTactics', 'update', error);
  }
}

/**
 * Returns fully formed character objects for all active party members for battle initialization.
 */
export async function getPartyCombatants(userId) {
  try {
    const partyInfo = await getUserActiveParty(userId);
    if (!partyInfo.party || !partyInfo.party.members.length) {
      return null;
    }
    return partyInfo.party.members;
  } catch {
    return null;
  }
}

export default {
  getUserActiveParty,
  createParty,
  invitePlayer,
  respondToInvite,
  recruitNpcCompanion,
  dismissCompanion,
  leaveParty,
  updateCompanionTactics,
  getPartyCombatants
};
