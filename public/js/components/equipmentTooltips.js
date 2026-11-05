import { ITEM_TYPE } from '../constants.js';

const equipment = {
  helmet: { icon: '🪶' }, armor: { icon: '🥋' }, gloves: { icon: '🧤' },
  necklace: { icon: '📿' }, 'left-earring': { icon: '💠' }, 'right-earring': { icon: '💠' },
  'left-hand': { icon: '⚔️' }, 'right-hand': { icon: '🛡️' }, belt: { icon: '🧰' },
  'left-ring': { icon: '💍' }, 'right-ring': { icon: '💍' }, shoes: { icon: '👢' }
};

const equipmentFields = Object.fromEntries(Object.keys(equipment).map((slot) => [slot, slot.replaceAll('-', '_')]));

const bonusLabels = [['proficiency_bonus', 'PRO'], ['intelligent_bonus', 'INT'], ['strength_bonus', 'STR'], ['dexterity_bonus', 'DEX'], ['charisma_bonus', 'CHA'], ['constitution_bonus', 'CON'], ['wisdom_bonus', 'WIS'], ['armor_bonus', 'Armor'], ['magical_armor_bonus', 'Magic armor'], ['physical_attack_bonus', 'Physical attack'], ['magical_attack_bonus', 'Magical attack'], ['effect_resistant_bonus', 'Effect resist'], ['fire_element_resistant', 'Fire resist'], ['ice_element_resistant', 'Ice resist'], ['earth_element_resistant', 'Earth resist'], ['lightning_element_resistant', 'Lightning resist'], ['wind_element_resistant', 'Wind resist'], ['holy_element_resistant', 'Holy resist'], ['dark_element_resistant', 'Dark resist']];

function itemStats(item) {
  const effect = item?.item_bonus;
  if (!effect) return '';
  return bonusLabels.filter(([field]) => effect[field]).map(([field, label]) => `${label}: ${effect[field] > 0 ? '+' : ''}${effect[field]}`).join(' · ');
}

export function initialiseEquipmentTooltips(character, onSlotClick) {
  const characterEquipment = character?.character_equipment || {};
  const isTwoHandEquipped = characterEquipment.left_hand?.type === ITEM_TYPE.TWO_HAND;
  Object.entries(equipment).forEach(([slot, item]) => {
    const element = document.querySelector(`.equipment-slot.${slot}`);
    if (!element) return;
    const field = equipmentFields[slot];
    const itemId = characterEquipment[`${field}_id`];
    const actualItem = itemId ? characterEquipment[field] || null : null;
    const displayName = actualItem?.name || 'Empty';
    const stats = itemStats(actualItem) || (actualItem ? 'No bonuses' : '');
    element.querySelectorAll('.equipment-image, .equipment-tooltip').forEach((child) => child.remove());
    element.removeAttribute('tabindex');
    element.removeAttribute('role');
    element.removeAttribute('aria-label');
    element.onclick = null;
    element.onkeydown = null;
    element.classList.remove('blocked');

    if (slot === 'right-hand' && isTwoHandEquipped) {
      element.querySelector('b').textContent = 'Blocked (2H)';
      element.classList.remove('empty', 'equipped');
      element.classList.add('blocked');
      element.setAttribute('tabindex', '0');
      element.setAttribute('role', 'button');
      element.setAttribute('aria-label', 'Right hand blocked. You are already equipped with a two-handed weapon.');
      element.insertAdjacentHTML('afterbegin', '<span class="equipment-image" aria-hidden="true">🚫</span>');
      element.insertAdjacentHTML('beforeend', '<span class="equipment-tooltip" role="tooltip"><b>Blocked Hand</b><span>You are already equipped with a two-handed weapon.</span></span>');
      if (typeof onSlotClick === 'function') {
        element.onclick = () => onSlotClick({ slot, field, isBlocked: true, item: null, element });
        element.onkeydown = (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSlotClick({ slot, field, isBlocked: true, item: null, element });
          }
        };
      }
      return;
    }

    element.querySelector('b').textContent = displayName;
    element.classList.toggle('empty', !actualItem);
    element.classList.toggle('equipped', Boolean(actualItem));
    if (!actualItem) return;
    element.setAttribute('tabindex', '0');
    element.setAttribute('role', 'button');
    element.setAttribute('aria-label', `${displayName}. Equipped in ${element.querySelector('span')?.textContent || slot}. ${stats}. Click to unequip.`);
    const isShield = actualItem?.name?.toLowerCase().includes('shield');
    const icon = isShield ? '🛡️' : (actualItem.type === ITEM_TYPE.MAIN_HAND || actualItem.type === ITEM_TYPE.TWO_HAND ? '⚔️' : actualItem.type === ITEM_TYPE.SUB_HAND ? '🛡️' : item.icon);
    element.insertAdjacentHTML('afterbegin', `<span class="equipment-image" aria-hidden="true">${icon}</span>`);
    element.insertAdjacentHTML('beforeend', `<span class="equipment-tooltip" role="tooltip"><b>${displayName}</b><span>${stats}</span></span>`);
    if (typeof onSlotClick === 'function') {
      element.onclick = () => onSlotClick({ slot, field, item: actualItem, element });
      element.onkeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSlotClick({ slot, field, item: actualItem, element });
        }
      };
    }
  });
}
