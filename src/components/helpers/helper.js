const getUserFromInteraction = (interaction) => {
    if (!interaction) {
        return null;
    }
    return interaction.user;
}

const getChannelByUserNameFromInteraction = (user, interaction) => {
    if (!interaction) {
        return null;
    }
    const channelName = interaction.guild.channels.cache.some(channel => channel.name === user.username);
    if(!channelName){
        return null;
    }
    return channelName;
}

// Stats calculations
const statsCalculations = (character) => {
    const equipments = ["helmet","armor","gloves","shoes","left_hand","right_hand","left_earring","right_earring","left_ring","right_ring","necklace","belt"];
    let totalMaxHP = character.character_stat.max_hp;
    let totalPro = character.character_stat.proficiency;
    let totalInt = character.character_stat.intelligent;
    let totalStr = character.character_stat.strength;
    let totalDex = character.character_stat.dexterity;
    let totalCha = character.character_stat.charisma;
    let totalCon = character.character_stat.constitution;
    let totalWis = character.character_stat.wisdom;
    let totalAR = character.character_stat.armor;
    let totalMAR = character.character_stat.magic_armor;
    const elementalResistances = [
        'fire_element_resistant', 'ice_element_resistant', 'earth_element_resistant',
        'lightning_element_resistant', 'wind_element_resistant', 'holy_element_resistant',
        'dark_element_resistant'
    ];
    let totalSR = character.character_stat.status_resistant;
    const totals = Object.fromEntries(elementalResistances.map((field) => [field, character.character_stat[field] || 0]));
    equipments.map(equipment => {
        if(character.character_equipment?.[equipment]){
            const itemBonus = character.character_equipment[equipment].item_bonus;
            if (!itemBonus) return;
            totalMaxHP += (itemBonus.max_hp_bonus || 0) + (itemBonus.constitution_bonus || 0);
            totalPro +=  itemBonus.proficiency_bonus;
            totalInt +=  itemBonus.intelligent_bonus;
            totalStr +=  itemBonus.strength_bonus;
            totalDex +=  itemBonus.dexterity_bonus;
            totalCha +=  itemBonus.charisma_bonus;
            totalCon +=  itemBonus.constitution_bonus;
            totalWis +=  itemBonus.wisdom_bonus;
            totalAR +=  itemBonus.armor_bonus;
            totalMAR +=  itemBonus.magical_armor_bonus;
            elementalResistances.forEach((field) => { totals[field] += itemBonus[field] || 0; });
            totalSR += itemBonus.effect_resistant_bonus || 0;
        }
    });
    const resistanceText = elementalResistances.map((field) => `${field}:${totals[field]}`).join('\n');
    return `
hp:${character.character_stat.current_hp}/${totalMaxHP}
proficiency:${totalPro}
int:${totalInt}
str:${totalStr}
dex:${totalDex}
cha:${totalCha}
con:${totalCon}
wis:${totalWis}
armor:${totalAR}
magic-armor:${totalMAR}
${resistanceText}
status-resistant:${totalSR}
    `
}

// Change pronoun
const changePronoun = (gender, sentence) => {
    if (gender.toLowerCase() === 'female') {
        return sentence.replace(/\byou\b/gi, 'she').replace(/\byou are\b/gi,'she is').replace(/\byour\b/gi,'her');
    } else if (gender.toLowerCase() === 'male') {
        return sentence.replace(/\byou\b/gi, 'he').replace(/\byou are\b/gi,'he is').replace(/\byour\b/gi,'his');
    } else {
        return sentence; // Return original if gender is invalid
    }
}

export default { getUserFromInteraction, getChannelByUserNameFromInteraction, statsCalculations, changePronoun};
