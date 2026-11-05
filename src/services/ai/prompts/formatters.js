import { BASE_ATTRIBUTE_VALUE, CHARACTER_TYPE, DEFAULT_MAX_ENERGY, DEFAULT_MAX_HP, HEALTH_LABEL_THRESHOLDS, PARTY_MEMBER_ROLE } from '../../../configs/constants.js';

export function formatCharacterContext(character) {
  if (!character) return '[CHAR: Unknown Adventurer | Human Adventurer Lv.1]';

  const stats = character.character_stat || {};
  const equip = character.character_equipment || {};

  const equippedItems = [
    equip.left_hand ? `Main:${equip.left_hand.name}` : null,
    equip.right_hand ? `Offhand:${equip.right_hand.name}` : null,
    equip.armor ? `Armor:${equip.armor.name}` : null,
    equip.helmet ? `Helm:${equip.helmet.name}` : null,
    equip.gloves ? `Gloves:${equip.gloves.name}` : null,
    equip.shoes ? `Boots:${equip.shoes.name}` : null,
    equip.necklace ? `Necklace:${equip.necklace.name}` : null,
    equip.belt ? `Belt:${equip.belt.name}` : null
  ].filter(Boolean).join(' | ') || 'None';

  const backpackItems = (character.character_inventory?.item_inventory || [])
    .filter((entry) => !entry.deleted && entry.item && !entry.item.deleted && (entry.quantity ?? 1) > 0)
    .slice(0, 8)
    .map((entry) => `${entry.item.name} x${entry.quantity || 1}`)
    .join(', ') || 'Empty';

  return [
    '### Active Player Character Context [DSL Format]:',
    `[CHAR: ${character.name || 'Hero'} | ${character.race || 'Human'} ${character.job || 'Adventurer'} Lv.${character.level || 1} | ${character.alignment || 'Neutral'} | ◈${(character.player?.gold ?? 0).toLocaleString()}]`,
    `[VIT: HP ${stats.current_hp ?? DEFAULT_MAX_HP}/${stats.max_hp ?? DEFAULT_MAX_HP} | Energy ${stats.current_energy ?? DEFAULT_MAX_ENERGY}/${stats.max_energy ?? DEFAULT_MAX_ENERGY}]`,
    `[STAT: STR:${stats.strength ?? BASE_ATTRIBUTE_VALUE} DEX:${stats.dexterity ?? BASE_ATTRIBUTE_VALUE} INT:${stats.intelligent ?? BASE_ATTRIBUTE_VALUE} CHA:${stats.charisma ?? BASE_ATTRIBUTE_VALUE} CON:${stats.constitution ?? BASE_ATTRIBUTE_VALUE} WIS:${stats.wisdom ?? BASE_ATTRIBUTE_VALUE}]`,
    `[EQUIP: ${equippedItems}]`,
    `[BAG: ${backpackItems}]`
  ].join('\n');
}

function formatPartyEquipment(equipment = {}) {
  const weapon = equipment.left_hand?.name || equipment.right_hand?.name || 'Unarmed';
  const armor = equipment.armor?.name || 'Clothes';
  return `${weapon}, ${armor}`;
}

export function formatLocationContext(location, sublocation, nearbyNpcs = [], targetNpc = null, totalNpcCount = 0) {
  const locName = location?.name || "Warden's Crossing";
  const locDesc = location?.description || 'A weathered crossroads in the wild.';
  const regionName = location?.region?.name || 'Stervian Land';
  const regionDesc = location?.region?.description || '';

  const sublocText = sublocation
    ? `INSIDE SUBLOCATION: "${sublocation.name}" (${sublocation.sublocation_type || 'Area'}). ${sublocation.description || ''}\n- Spatial Rule: The player is INDOORS inside "${sublocation.name}". Only NPCs present in this specific sublocation can be interacted with.\n- Scene Transition: If previous conversation history occurred outdoors or in a different sublocation, that scene has concluded because the player is now inside "${sublocation.name}". Do NOT carry over NPCs, speakers, or conversations from the previous scene. NPCs from earlier turns who are not listed below are NOT present and must not speak or be referred to as nearby.`
    : `None (OUTDOORS / MAIN AREA): The player is OUTSIDE in the open area of ${locName}. They are NOT inside any sublocation, inn, tavern, shop, dojo, or building.\n- Spatial Rule: The player is in the open outdoor environment. NPCs who reside inside specific sublocations (such as innkeepers, shopkeepers) are indoors and NOT present out here. Do NOT mention them or assume they are present unless the player specifically enters their building.\n- Scene Transition: If previous conversation history occurred inside a sublocation (such as an inn or tavern), that indoor scene has concluded because the player is now outside. Do NOT carry over indoor sublocation NPCs, patrons, or indoor scenery into this outdoor scene.`;

  const targetName = (targetNpc?.character?.name || targetNpc?.name || '').toLowerCase();

  const npcsText = nearbyNpcs.length
    ? [
        'NPC_TYPE | NAME | RACE_JOB | ALIGNMENT | STATUS | ENGAGEMENT | APPEARANCE',
        ...nearbyNpcs.map((npc) => {
          const char = npc.character || npc;
          const isTarget = targetName && (
            (char.name && char.name.toLowerCase() === targetName) ||
            (npc.character_id && targetNpc?.character_id && npc.character_id === targetNpc.character_id)
          );
          const targetTag = isTarget ? '[ENGAGED]' : '[BACKGROUND]';
          const speakable = npc.is_speakable !== false ? 'Speakable' : 'Silent';
          const appearance = char.appearance ? char.appearance.replace(/\n+/g, ' ').slice(0, 90) : 'None';
          return `NPC | ${char.name} | ${char.race || 'Human'} ${char.job || 'NPC'} | ${char.alignment || 'Neutral'} | ${speakable} | ${targetTag} | ${appearance}`;
        })
      ].join('\n')
    : 'No notable figures nearby at this exact spot.';

  const crowdNote = totalNpcCount > 10
    ? `\n- Crowd Notice: The area is bustling with a large crowd of over ${totalNpcCount} people. In your narration or in suggested choices, remind the player that there are other figures and characters in the surrounding area waiting to be explored, observed, or interacted with.`
    : '';

  return `
### Location & Environment:
- Territory: ${regionName} (${regionDesc})
- Current Location: ${locName}
- Details: ${locDesc}
- Sublocation Status: ${sublocText}${crowdNote}

### Nearby NPCs Present in this Area:
${npcsText}
`.trim();
}

export function formatPartyContext(party, activeCharacter = null) {
  if (!party || !Array.isArray(party.members) || party.members.length <= 1) {
    return 'Traveling solo (No active party companions).';
  }

  const otherMembers = party.members.filter((m) => {
    if (activeCharacter?.id && m.character_id === activeCharacter.id) return false;
    if (activeCharacter?.name && m.name === activeCharacter.name) return false;
    return true;
  });

  if (!otherMembers.length) return 'Traveling solo (No active party companions).';

  const lines = otherMembers.map((m) => {
    const isHuman = m.is_player || m.character_type === CHARACTER_TYPE.PLAYER;
    const gear = formatPartyEquipment(m.equipment);
    const health = typeof m.current_hp === 'number' && typeof m.max_hp === 'number'
      ? (m.current_hp / m.max_hp > HEALTH_LABEL_THRESHOLDS.HEALTHY ? 'Healthy' : m.current_hp / m.max_hp > HEALTH_LABEL_THRESHOLDS.WOUNDED ? 'Wounded' : 'Severely Injured')
      : 'Condition Normal';

    if (isHuman) {
      const roleTag = m.is_leader || m.role === PARTY_MEMBER_ROLE.LEADER ? 'Leader' : 'Member';
      return `* [REAL HUMAN PLAYER - DO NOT CONTROL] ${m.name} (${m.race || 'Human'}): Wields ${gear}. ${health}. (${roleTag})`;
    } else {
      const tactics = m.tactics_role ? ` [Tactics: ${m.tactics_role}]` : '';
      return `* [AI NPC COMPANION] ${m.name} (${m.race || 'NPC'}): Wields ${gear}.${tactics} ${health}.`;
    }
  });

  return [
    `### Active Party: "${party.name || 'Adventuring Party'}" (Active: ${activeCharacter?.name || 'Leader'})`,
    lines.join('\n'),
    'Rules: Never control or speak for [REAL HUMAN PLAYER] characters.'
  ].join('\n');
}
