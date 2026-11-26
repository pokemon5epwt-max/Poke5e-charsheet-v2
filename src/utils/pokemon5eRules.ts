import {
  AbilityKey,
  AbilityScores,
  ActiveCharacter,
  DamageModifierType,
  Move,
  PartyWorkspace,
  PokemonSheet,
  PokemonType,
  RollCategory,
  SavingThrowProficiencies,
  SkillName,
  SkillProficiencies,
  StabBaseMode,
  TrainerItem,
  TrainerItemCategory,
  TrainerSheet,
} from '../types/pokemon5e';

export function getRollCategoryLabel(category: RollCategory): string {
  switch (category) {
    case 'ability':
      return 'Ability Check';
    case 'save':
      return 'Saving Throw';
    case 'skill':
      return 'Skill Check';
    case 'attack':
      return 'Move Attack';
    case 'damage':
      return 'Move Damage';
    case 'initiative':
      return 'Initiative';
    case 'custom':
    default:
      return 'Custom Roll';
  }
}

export const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const ABILITY_LABELS: Record<AbilityKey, { short: string; full: string }> = {
  str: { short: 'STR', full: 'Strength' },
  dex: { short: 'DEX', full: 'Dexterity' },
  con: { short: 'CON', full: 'Constitution' },
  int: { short: 'INT', full: 'Intelligence' },
  wis: { short: 'WIS', full: 'Wisdom' },
  cha: { short: 'CHA', full: 'Charisma' },
};

export const POKEMON_TYPES: PokemonType[] = [
  'Normal',
  'Fire',
  'Water',
  'Electric',
  'Grass',
  'Ice',
  'Fighting',
  'Poison',
  'Ground',
  'Flying',
  'Psychic',
  'Bug',
  'Rock',
  'Ghost',
  'Dragon',
  'Dark',
  'Steel',
  'Fairy',
];

export const TYPE_STYLES: Record<
  PokemonType,
  { hex: string; bg: string; text: string; border: string }
> = {
  Normal: {
    hex: '#94A3B8',
    bg: 'bg-slate-500/15',
    text: 'text-slate-200',
    border: 'border-slate-500/35',
  },
  Fire: {
    hex: '#F97316',
    bg: 'bg-orange-500/15',
    text: 'text-orange-300',
    border: 'border-orange-500/35',
  },
  Water: {
    hex: '#3B82F6',
    bg: 'bg-blue-500/15',
    text: 'text-blue-300',
    border: 'border-blue-500/35',
  },
  Electric: {
    hex: '#EAB308',
    bg: 'bg-yellow-500/15',
    text: 'text-yellow-300',
    border: 'border-yellow-500/35',
  },
  Grass: {
    hex: '#22C55E',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-300',
    border: 'border-emerald-500/35',
  },
  Ice: {
    hex: '#38BDF8',
    bg: 'bg-sky-400/15',
    text: 'text-sky-200',
    border: 'border-sky-400/35',
  },
  Fighting: {
    hex: '#EF4444',
    bg: 'bg-red-500/15',
    text: 'text-red-300',
    border: 'border-red-500/35',
  },
  Poison: {
    hex: '#A855F7',
    bg: 'bg-purple-500/15',
    text: 'text-purple-300',
    border: 'border-purple-500/35',
  },
  Ground: {
    hex: '#D97706',
    bg: 'bg-amber-600/15',
    text: 'text-amber-300',
    border: 'border-amber-600/35',
  },
  Flying: {
    hex: '#818CF8',
    bg: 'bg-indigo-400/15',
    text: 'text-indigo-200',
    border: 'border-indigo-400/35',
  },
  Psychic: {
    hex: '#EC4899',
    bg: 'bg-pink-500/15',
    text: 'text-pink-300',
    border: 'border-pink-500/35',
  },
  Bug: {
    hex: '#84CC16',
    bg: 'bg-lime-500/15',
    text: 'text-lime-300',
    border: 'border-lime-500/35',
  },
  Rock: {
    hex: '#A16207',
    bg: 'bg-yellow-700/20',
    text: 'text-amber-200',
    border: 'border-yellow-600/40',
  },
  Ghost: {
    hex: '#8B5CF6',
    bg: 'bg-violet-500/15',
    text: 'text-violet-300',
    border: 'border-violet-500/35',
  },
  Dragon: {
    hex: '#6366F1',
    bg: 'bg-indigo-500/20',
    text: 'text-indigo-300',
    border: 'border-indigo-500/40',
  },
  Dark: {
    hex: '#71717A',
    bg: 'bg-zinc-600/25',
    text: 'text-zinc-200',
    border: 'border-zinc-500/40',
  },
  Steel: {
    hex: '#64748B',
    bg: 'bg-slate-400/15',
    text: 'text-slate-200',
    border: 'border-slate-400/35',
  },
  Fairy: {
    hex: '#F472B6',
    bg: 'bg-pink-400/15',
    text: 'text-pink-200',
    border: 'border-pink-400/35',
  },
};

export const SKILL_ABILITY_MAP: Record<SkillName, AbilityKey> = {
  Acrobatics: 'dex',
  'Animal Handling': 'wis',
  Arcana: 'int',
  Athletics: 'str',
  Deception: 'cha',
  History: 'int',
  Insight: 'wis',
  Intimidation: 'cha',
  Investigation: 'int',
  Medicine: 'wis',
  Nature: 'int',
  Perception: 'wis',
  Performance: 'cha',
  Persuasion: 'cha',
  Religion: 'int',
  'Sleight of Hand': 'dex',
  Stealth: 'dex',
  Survival: 'wis',
};

export const ALL_SKILLS = Object.keys(SKILL_ABILITY_MAP) as SkillName[];

export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatSignedModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function getProficiencyBonus(level: number, override?: number): number {
  if (typeof override === 'number' && !Number.isNaN(override)) {
    return override;
  }
  const clamped = Math.max(1, Math.min(20, Math.floor(level || 1)));
  return Math.ceil(clamped / 4) + 1;
}

export interface StabCalcOptions {
  stabOverride?: number;
  stabBase?: StabBaseMode;
  stabBonus?: number;
  proficiencyOverride?: number;
  movePowerMod?: number;
}

/**
 * Pokémon 5e STAB Calculation (poke5e.app/rules/combat):
 * - 2024 Standard ('default' / 'proficiency'): Equal to Proficiency Bonus (+2..+6), min 0.
 * - Legacy 2018 ('ruleset18'): Math.floor((level + 1) / 4) (+0..+5).
 * - 'movepower': Max(0, movePowerMod); 'none': 0.
 * - Adds optional stabBonus (e.g. Adaptability), clamped >= 0.
 */
export function getStabValue(
  level: number,
  overrideOrOptions?: number | StabCalcOptions
): number {
  const options: StabCalcOptions =
    typeof overrideOrOptions === 'number'
      ? { stabOverride: overrideOrOptions }
      : (overrideOrOptions ?? {});

  if (typeof options.stabOverride === 'number' && !Number.isNaN(options.stabOverride)) {
    return Math.max(0, options.stabOverride);
  }

  const lv = Math.max(1, Math.min(20, Math.floor(level || 1)));
  const profBonus = getProficiencyBonus(lv, options.proficiencyOverride);
  const mode = options.stabBase ?? 'default';

  let base = profBonus;
  if (mode === 'ruleset18') {
    base = Math.floor((lv + 1) / 4);
  } else if (mode === 'movepower') {
    base = Math.max(0, options.movePowerMod ?? 0);
  } else if (mode === 'none') {
    base = 0;
  }

  return Math.max(0, base + (options.stabBonus ?? 0));
}

export function getSavingThrowModifier(
  abilities: AbilityScores,
  savingThrows: SavingThrowProficiencies,
  key: AbilityKey,
  profBonus: number
): number {
  return getAbilityModifier(abilities[key]) + (savingThrows[key] ? profBonus : 0);
}

export function getSkillModifier(
  abilities: AbilityScores,
  skills: SkillProficiencies,
  skill: SkillName,
  profBonus: number
): number {
  const ability = SKILL_ABILITY_MAP[skill];
  const base = getAbilityModifier(abilities[ability]);
  const level = skills[skill];
  if (level === 'expertise') return base + profBonus * 2;
  if (level === 'proficient') return base + profBonus;
  return base;
}

export function getMovePowerMod(pokemon: PokemonSheet, move: Move): number {
  if (move.movePower === 'none') return 0;
  return getAbilityModifier(pokemon.abilities[move.movePower] ?? 10);
}

export function hasMoveStab(pokemon: PokemonSheet, move: Move): boolean {
  if (move.isHealing) return false;
  if (move.damageModifierType === 'move+stab') return true;
  return Boolean(move.stabEligible && pokemon.types.includes(move.type));
}

export function getMoveAttackBonus(pokemon: PokemonSheet, move: Move): number {
  const prof = getProficiencyBonus(pokemon.level, pokemon.proficiencyOverride);
  const powerMod = getMovePowerMod(pokemon, move);
  return powerMod + prof + (move.toHitModifier ?? 0);
}

export function getMoveSaveDc(pokemon: PokemonSheet, move: Move): number {
  const prof = getProficiencyBonus(pokemon.level, pokemon.proficiencyOverride);
  const powerMod = getMovePowerMod(pokemon, move);
  return 8 + prof + powerMod + (move.saveDcModifier ?? 0);
}

export function getMoveDamageBonus(pokemon: PokemonSheet, move: Move): {
  modType: DamageModifierType;
  powerMod: number;
  levelBonus: number;
  flatRuleBonus: number;
  customDmgMod: number;
  stabBonus: number;
  baseDamageMod: number;
  totalBonus: number;
} {
  const modType: DamageModifierType = move.damageModifierType ?? 'move';
  const rawPowerMod = getMovePowerMod(pokemon, move);
  const powerMod = modType === 'none' || modType === 'level' ? 0 : rawPowerMod;
  const levelBonus = modType === 'level' ? pokemon.level : 0;
  const flatRuleBonus = modType === 'move+5' ? 5 : modType === 'move+10' ? 10 : 0;
  const customDmgMod = move.damageModifier ?? 0;

  const stabBonus = hasMoveStab(pokemon, move)
    ? getStabValue(pokemon.level, {
        stabOverride: pokemon.stabOverride,
        stabBase: pokemon.stabBase,
        stabBonus: pokemon.stabBonus,
        proficiencyOverride: pokemon.proficiencyOverride,
        movePowerMod: rawPowerMod,
      })
    : 0;

  const baseDamageMod = powerMod + levelBonus + flatRuleBonus;
  return {
    modType,
    powerMod,
    levelBonus,
    flatRuleBonus,
    customDmgMod,
    stabBonus,
    baseDamageMod,
    totalBonus: baseDamageMod + stabBonus + customDmgMod,
  };
}

export function createEmptySkills(): SkillProficiencies {
  return ALL_SKILLS.reduce((acc, skill) => {
    acc[skill] = 'none';
    return acc;
  }, {} as SkillProficiencies);
}

export function createEmptySaves(): SavingThrowProficiencies {
  return {
    str: false,
    dex: false,
    con: false,
    int: false,
    wis: false,
    cha: false,
  };
}

export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getPoke5eSpeciesSlug(species: string): string {
  const cleaned = species
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/♀/g, '-f')
    .replace(/♂/g, '-m')
    .replace(/['’.]/g, '')
    .replace(/[:_]+/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned;
}

export function getPoke5eSpeciesArtworkUrl(
  species: string,
  isShiny = false
): string | undefined {
  const slug = getPoke5eSpeciesSlug(species);
  if (!slug || slug === 'unknown' || slug === 'imported-pokemon') return undefined;
  return `https://poke5e.app/assets/pokemon/${slug}/${isShiny ? 'main-shiny' : 'main'}.png`;
}

export function resolveCharacterAvatarUrl(
  character: Pick<ActiveCharacter, 'kind' | 'avatarUrl'> & {
    species?: string;
    isShiny?: boolean;
  }
): string | undefined {
  const custom = character.avatarUrl?.trim();
  if (custom) return custom;
  if (character.kind === 'pokemon' && character.species) {
    return getPoke5eSpeciesArtworkUrl(character.species, Boolean(character.isShiny));
  }
  return undefined;
}

export function parseHpText(hpText?: string): {
  hpCurrent?: number;
  hpMax?: number;
} {
  if (!hpText) return {};
  const trimmed = hpText.trim();
  const slashMatch = trimmed.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (slashMatch) {
    const hpCurrent = Math.max(0, parseInt(slashMatch[1], 10));
    const hpMax = Math.max(1, parseInt(slashMatch[2], 10));
    return { hpCurrent, hpMax };
  }
  const singleMatch = trimmed.match(/^(\d+)$/);
  if (singleMatch) {
    const val = Math.max(1, parseInt(singleMatch[1], 10));
    return { hpCurrent: val, hpMax: val };
  }
  return {};
}

export const TRAINER_ITEM_CATEGORIES: Array<{
  id: TrainerItemCategory;
  label: string;
  shortLabel: string;
}> = [
  { id: 'pokeballs', label: 'Poké Balls', shortLabel: 'Balls' },
  { id: 'medicine', label: 'Medicine', shortLabel: 'Medicine' },
  { id: 'held', label: 'Held Items', shortLabel: 'Held' },
  { id: 'key', label: 'Key Items', shortLabel: 'Key' },
  { id: 'gear', label: 'Adventure Gear', shortLabel: 'Gear' },
];

export const TRAINER_ITEM_PRESETS: Array<{
  name: string;
  category: TrainerItemCategory;
  description: string;
}> = [
  {
    name: 'Poké Ball',
    category: 'pokeballs',
    description: 'Standard capture ball (+0 catch modifier).',
  },
  {
    name: 'Great Ball',
    category: 'pokeballs',
    description: 'Improved capture ball (+2 catch modifier).',
  },
  {
    name: 'Ultra Ball',
    category: 'pokeballs',
    description: 'High-performance capture ball (+4 catch modifier).',
  },
  {
    name: 'Potion',
    category: 'medicine',
    description: 'Restores 2d4 + 2 HP to a Pokémon.',
  },
  {
    name: 'Super Potion',
    category: 'medicine',
    description: 'Restores 4d4 + 4 HP to a Pokémon.',
  },
  {
    name: 'Hyper Potion',
    category: 'medicine',
    description: 'Restores 10d4 + 20 HP to a Pokémon.',
  },
  {
    name: 'Antidote',
    category: 'medicine',
    description: 'Cures the Poisoned status condition.',
  },
  {
    name: 'Revive',
    category: 'medicine',
    description: 'Revives a fainted Pokémon with half its max HP.',
  },
  {
    name: 'Oran Berry',
    category: 'held',
    description: 'Held/consumable: restores 10 HP when below 50% HP.',
  },
  {
    name: 'Escape Rope',
    category: 'gear',
    description: 'Quickly escape from caves or dungeons.',
  },
];

export function classifyTrainerItemCategory(nameOrId: string): TrainerItemCategory {
  const s = nameOrId.trim().toLowerCase();
  if (/ball\b|pokeball|greatball|ultraball|masterball/.test(s)) {
    return 'pokeballs';
  }
  if (
    /potion|antidote|heal|revive|elixir|ether|remedy|medicine|spray|powder|milk|water|soda|lemonade/.test(
      s
    )
  ) {
    return 'medicine';
  }
  if (
    /berry|band|scarf|specs|orb|leftovers|charcoal|magnet|silk|stone|plate|vest|helmet|focus|bell|claw|fang|herb|tm\d|hm\d|technical machine/.test(
      s
    )
  ) {
    return 'held';
  }
  if (
    /pokedex|pokédex|badge|map|bike|bicycle|rod|pass|ticket|flute|scope|detector|coin case|key|egg|fossil|silph|parcel|diary/.test(
      s
    )
  ) {
    return 'key';
  }
  return 'gear';
}

export function mapPoke5eItemTypeToCategory(
  poke5eType?: string,
  nameOrId?: string
): TrainerItemCategory {
  const t = (poke5eType ?? '').trim().toLowerCase();
  if (t === 'pokeball') return 'pokeballs';
  if (t === 'medicine') return 'medicine';
  if (t === 'held item' || t === 'berry' || t === 'evolution') return 'held';
  if (t === 'trainer gear') {
    const inferred = classifyTrainerItemCategory(nameOrId ?? '');
    return inferred === 'key' ? 'key' : 'gear';
  }
  return classifyTrainerItemCategory(nameOrId ?? '');
}

export function normalizeTrainerItems(
  trainer: Partial<TrainerSheet>
): TrainerItem[] {
  if (Array.isArray(trainer.items)) {
    return trainer.items
      .filter((it) => it && typeof it.name === 'string' && it.name.trim().length > 0)
      .map((it) => ({
        id: it.id || createId('item'),
        name: it.name.trim(),
        category: it.category || classifyTrainerItemCategory(it.name),
        quantity: Math.max(0, Math.floor(Number(it.quantity ?? 0) || 0)),
        description: it.description?.trim() || undefined,
        ...(typeof it.poke5eId === 'number' ? { poke5eId: it.poke5eId } : {}),
        ...(it.poke5eItemId !== undefined ? { poke5eItemId: it.poke5eItemId } : {}),
        ...(typeof it.poke5eRank === 'number' ? { poke5eRank: it.poke5eRank } : {}),
      }));
  }

  const migrated: TrainerItem[] = [];
  const balls = trainer.pokeballs;
  if (balls) {
    migrated.push({
      id: 'item-pokeball',
      name: 'Poké Ball',
      category: 'pokeballs',
      quantity: Math.max(0, Number(balls.pokeBall ?? 0)),
      description: 'Standard capture ball (+0 catch modifier).',
    });
    if ((balls.greatBall ?? 0) > 0) {
      migrated.push({
        id: 'item-greatball',
        name: 'Great Ball',
        category: 'pokeballs',
        quantity: Math.max(0, Number(balls.greatBall ?? 0)),
        description: 'Improved capture ball (+2 catch modifier).',
      });
    }
    if ((balls.ultraBall ?? 0) > 0) {
      migrated.push({
        id: 'item-ultraball',
        name: 'Ultra Ball',
        category: 'pokeballs',
        quantity: Math.max(0, Number(balls.ultraBall ?? 0)),
        description: 'High-performance capture ball (+4 catch modifier).',
      });
    }

    if (balls.other && balls.other.trim()) {
      const parts = balls.other
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      for (const part of parts) {
        const qtyMatch = part.match(/^(\d+)\s*[x×]\s+(.+)$/i);
        const quantity = qtyMatch ? Math.max(1, parseInt(qtyMatch[1], 10)) : 1;
        const name = (qtyMatch ? qtyMatch[2] : part).trim();
        if (!name) continue;
        migrated.push({
          id: createId('item'),
          name,
          category: classifyTrainerItemCategory(name),
          quantity,
        });
      }
    }
  }

  return migrated;
}

export function syncPokeballsFromItems(
  items: TrainerItem[],
  fallback?: TrainerSheet['pokeballs']
): TrainerSheet['pokeballs'] {
  let pokeBall = 0;
  let greatBall = 0;
  let ultraBall = 0;
  const otherList: string[] = [];

  for (const item of items) {
    const key = item.name.trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (key === 'pokeball' || key === 'pokéball' || key === 'pokeballs') {
      pokeBall += item.quantity;
    } else if (key === 'greatball' || key === 'greatballs') {
      greatBall += item.quantity;
    } else if (key === 'ultraball' || key === 'ultraballs') {
      ultraBall += item.quantity;
    } else if (item.quantity > 0) {
      otherList.push(`${item.quantity}x ${item.name}`);
    }
  }

  return {
    pokeBall: items.length > 0 ? pokeBall : (fallback?.pokeBall ?? 0),
    greatBall: items.length > 0 ? greatBall : (fallback?.greatBall ?? 0),
    ultraBall: items.length > 0 ? ultraBall : (fallback?.ultraBall ?? 0),
    other: otherList.slice(0, 8).join(', '),
  };
}

export function createStarterParty(): PartyWorkspace {
  const trainerSkills = createEmptySkills();
  trainerSkills.Athletics = 'proficient';
  trainerSkills['Animal Handling'] = 'proficient';
  trainerSkills.Perception = 'proficient';
  trainerSkills.Persuasion = 'proficient';

  const pikachuSkills = createEmptySkills();
  pikachuSkills.Acrobatics = 'proficient';
  pikachuSkills.Perception = 'proficient';
  pikachuSkills.Stealth = 'proficient';

  const charmeleonSkills = createEmptySkills();
  charmeleonSkills.Athletics = 'proficient';
  charmeleonSkills.Intimidation = 'proficient';

  return {
    trainer: {
      id: 'trainer',
      kind: 'trainer',
      name: 'Kael Vance',
      level: 5,
      trainerClass: 'Ace Trainer',
      origin: 'Cerulean Outpost',
      hpCurrent: 42,
      hpMax: 42,
      tempHp: 0,
      ac: 14,
      speed: 30,
      hitDice: '5d8',
      abilities: {
        str: 12,
        dex: 15,
        con: 14,
        int: 12,
        wis: 14,
        cha: 16,
      },
      savingThrows: {
        str: false,
        dex: true,
        con: false,
        int: false,
        wis: false,
        cha: true,
      },
      skills: trainerSkills,
      pokeballs: {
        pokeBall: 8,
        greatBall: 4,
        ultraBall: 1,
        other: '1x Premier Ball, 2x Dusk Ball',
      },
      items: [
        {
          id: 'item-pokeball',
          name: 'Poké Ball',
          category: 'pokeballs',
          quantity: 8,
          description: 'Standard capture ball (+0 catch modifier).',
        },
        {
          id: 'item-greatball',
          name: 'Great Ball',
          category: 'pokeballs',
          quantity: 4,
          description: 'Improved capture ball (+2 catch modifier).',
        },
        {
          id: 'item-ultraball',
          name: 'Ultra Ball',
          category: 'pokeballs',
          quantity: 1,
          description: 'High-performance capture ball (+4 catch modifier).',
        },
        {
          id: 'item-premierball',
          name: 'Premier Ball',
          category: 'pokeballs',
          quantity: 1,
          description: 'Commemorative capture ball.',
        },
        {
          id: 'item-duskball',
          name: 'Dusk Ball',
          category: 'pokeballs',
          quantity: 2,
          description: 'Bonus catch modifier in caves or at night.',
        },
        {
          id: 'item-super-potion',
          name: 'Super Potion',
          category: 'medicine',
          quantity: 3,
          description: 'Restores 4d4 + 4 HP to a Pokémon.',
        },
        {
          id: 'item-antidote',
          name: 'Antidote',
          category: 'medicine',
          quantity: 2,
          description: 'Cures the Poisoned status condition.',
        },
        {
          id: 'item-oran-berry',
          name: 'Oran Berry',
          category: 'held',
          quantity: 2,
          description: 'Held/consumable: restores 10 HP when below 50% HP.',
        },
        {
          id: 'item-pokedex',
          name: 'Pokédex v2',
          category: 'key',
          quantity: 1,
          description: 'Identifies species SR, types, and abilities.',
        },
        {
          id: 'item-town-map',
          name: 'Town Map',
          category: 'key',
          quantity: 1,
          description: 'Regional navigation map.',
        },
        {
          id: 'item-medic-kit',
          name: 'Field Medic Kit',
          category: 'gear',
          quantity: 1,
          description: 'Supplies for stabilizing fainted Pokémon in the field.',
        },
      ],
      money: 4250,
      badges: 3,
      trainerPaths: 'Ace Trainer (Tactician) · Field Medic Specialization',
      notes:
        'Bonus action to issue tactical command (+1 AC or advantage on next save).',
    },
    pokemon: [
      {
        id: 'poke-pikachu',
        kind: 'pokemon',
        name: 'Sparky',
        species: 'Pikachu',
        level: 5,
        sr: '2',
        types: ['Electric'],
        nature: 'Jolly',
        ability: 'Static',
        abilityDescription:
          'Melee attackers that hit this Pokémon must succeed on a CON save or become Paralyzed until the end of their next turn.',
        hpCurrent: 38,
        hpMax: 38,
        tempHp: 0,
        ac: 15,
        speed: 35,
        hitDice: '5d8',
        abilities: {
          str: 10,
          dex: 18,
          con: 12,
          int: 10,
          wis: 12,
          cha: 14,
        },
        savingThrows: {
          str: false,
          dex: true,
          con: false,
          int: false,
          wis: false,
          cha: true,
        },
        skills: pikachuSkills,
        heldItem: 'Light Ball',
        statusCondition: 'Healthy',
        avatarUrl: 'https://poke5e.app/assets/pokemon/pikachu/main.png',
        notes: 'High initiative scout. Uses Quick Attack to close distance before Thunderbolt.',
        moves: [
          {
            id: 'mv-thunderbolt',
            name: 'Thunderbolt',
            type: 'Electric',
            ppCurrent: 15,
            ppMax: 15,
            movePower: 'dex',
            damageDice: '2d8',
            damageModifierType: 'move',
            isAttack: true,
            stabEligible: true,
            range: '60 ft',
            castingTime: '1 Action',
            description:
              'A strong electric blast crashes down on a target. On a roll of 19-20 on the attack die, the target is Paralyzed.',
          },
          {
            id: 'mv-quick-attack',
            name: 'Quick Attack',
            type: 'Normal',
            ppCurrent: 20,
            ppMax: 20,
            movePower: 'dex',
            damageDice: '1d6',
            damageModifierType: 'none',
            isAttack: true,
            stabEligible: true,
            range: 'Melee (5 ft)',
            castingTime: '1 Bonus Action',
            description: 'Lunges at blinding speed. Can be used as a bonus action after moving (no MOVE bonus to damage).',
          },
          {
            id: 'mv-thunder-wave',
            name: 'Thunder Wave',
            type: 'Electric',
            ppCurrent: 10,
            ppMax: 10,
            movePower: 'dex',
            damageDice: '',
            isAttack: false,
            saveAbility: 'con',
            stabEligible: false,
            range: '30 ft',
            castingTime: '1 Action',
            description: 'A weak electric charge that paralyzes the target on a failed CON save.',
          },
        ],
      },
      {
        id: 'poke-charmeleon',
        kind: 'pokemon',
        name: 'Cinder',
        species: 'Charmeleon',
        level: 5,
        sr: '5',
        types: ['Fire'],
        nature: 'Brave',
        ability: 'Blaze',
        abilityDescription:
          'When at or below 25% max HP, Fire-type moves gain +2 to damage rolls.',
        hpCurrent: 49,
        hpMax: 52,
        tempHp: 0,
        ac: 14,
        speed: 30,
        hitDice: '5d10',
        abilities: {
          str: 16,
          dex: 14,
          con: 15,
          int: 10,
          wis: 11,
          cha: 13,
        },
        savingThrows: {
          str: true,
          dex: false,
          con: true,
          int: false,
          wis: false,
          cha: false,
        },
        skills: charmeleonSkills,
        heldItem: 'Charcoal',
        statusCondition: 'Healthy',
        avatarUrl: 'https://poke5e.app/assets/pokemon/charmeleon/main.png',
        notes: 'Frontline striker.',
        moves: [
          {
            id: 'mv-flamethrower',
            name: 'Flamethrower',
            type: 'Fire',
            ppCurrent: 14,
            ppMax: 15,
            movePower: 'str',
            availablePowers: ['str', 'dex'],
            damageDice: '2d10',
            damageModifierType: 'move',
            isAttack: false,
            saveAbility: 'dex',
            stabEligible: true,
            range: 'Self (40 ft cone)',
            castingTime: '1 Action',
            description:
              'Scorches targets in a 40 ft cone. Targets must succeed on a DEX save or take 2d10 + MOVE Fire damage (half on success).',
          },
          {
            id: 'mv-slash',
            name: 'Slash',
            type: 'Normal',
            ppCurrent: 20,
            ppMax: 20,
            movePower: 'str',
            damageDice: '1d10',
            damageModifierType: 'move',
            isAttack: true,
            stabEligible: true,
            range: 'Melee (5 ft)',
            castingTime: '1 Action',
            description: 'High critical hit ratio (critical hit on 19-20).',
          },
        ],
      },
    ],
  };
}
