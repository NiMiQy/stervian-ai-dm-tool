function valueOrUnknown(value) {
  return value === null || value === undefined || value === '' ? 'Unknown' : String(value);
}

function formatStats(stats) {
  if (!stats) return 'Stats: unavailable';

  const attributes = [
    ['Intelligence', stats.intelligent],
    ['Strength', stats.strength],
    ['Dexterity', stats.dexterity],
    ['Charisma', stats.charisma],
    ['Constitution', stats.constitution],
    ['Wisdom', stats.wisdom],
  ];

  return [
    'Stats:',
    `  Attributes: ${attributes.map(([name, value]) => `${name} ${valueOrUnknown(value)}`).join(', ')}`,
    `  HP: ${valueOrUnknown(stats.current_hp)} / ${valueOrUnknown(stats.max_hp)}`,
    `  Food: ${valueOrUnknown(stats.current_food)} / ${valueOrUnknown(stats.max_food)}`,
    `  Energy: ${valueOrUnknown(stats.current_energy)} / ${valueOrUnknown(stats.max_energy)}`,
    `  Armor: ${valueOrUnknown(stats.armor)}`,
    `  Magic armor: ${valueOrUnknown(stats.magic_armor)}`,
  ].join('\n');
}

function formatInventory(inventory) {
  const items = inventory?.item_inventory || [];
  if (!items.length) return 'Inventory: empty';

  return [
    `Inventory (${items.length}/${valueOrUnknown(inventory.max_slots)} slots):`,
    ...items.map((entry) => `  - ${valueOrUnknown(entry.item?.name)} x${valueOrUnknown(entry.quantity)}`),
  ].join('\n');
}

function formatEquipment(equipment) {
  if (!equipment) return 'Equipment: unavailable';

  const slots = [
    ['Helmet', equipment.helmet], ['Armor', equipment.armor], ['Gloves', equipment.gloves],
    ['Shoes', equipment.shoes], ['Left hand', equipment.left_hand], ['Right hand', equipment.right_hand],
    ['Left earring', equipment.left_earring], ['Right earring', equipment.right_earring],
    ['Left ring', equipment.left_ring], ['Right ring', equipment.right_ring],
    ['Necklace', equipment.necklace], ['Belt', equipment.belt],
  ];

  return ['Equipment:', ...slots.map(([slot, item]) => `  ${slot}: ${valueOrUnknown(item?.name)}`)].join('\n');
}

export function formatCharacterInfo(character) {
  const location = character.location;
  const regionName = location?.region?.name ? `, ${location.region.name}` : '';

  return [
    `Character: ${valueOrUnknown(character.name)}`,
    `Character ID: ${character.id}`,
    `Type: ${valueOrUnknown(character.character_type)}`,
    `Level: ${valueOrUnknown(character.level)} (EXP ${valueOrUnknown(character.current_exp)})`,
    `Race: ${valueOrUnknown(character.race)}`,
    `Job: ${valueOrUnknown(character.job)}`,
    `Sex: ${valueOrUnknown(character.sex)}`,
    `Age: ${valueOrUnknown(character.age)}`,
    `Alignment: ${valueOrUnknown(character.alignment)}`,
    `Location: ${valueOrUnknown(location?.name)}${regionName}`,
    `Respawn location: ${valueOrUnknown(character.respawn_location?.name)}`,
    '',
    formatStats(character.character_stat),
    formatInventory(character.character_inventory),
    formatEquipment(character.character_equipment),
    `Memories: ${character.character_memories?.length || 0}`,
    `Life skills: ${character.character_lifeskills?.length || 0}`,
  ].join('\n');
}
