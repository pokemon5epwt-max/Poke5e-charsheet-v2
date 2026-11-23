import {
  AbilityKey,
  DamageModifierType,
  Move,
  PartyWorkspace,
  Poke5eFileEntry,
  Poke5eImportResult,
  PokemonSheet,
  PokemonType,
  SkillName,
  SkillProficiencies,
  StabBaseMode,
  TrainerItem,
  TrainerSheet,
} from '../types/pokemon5e';
import {
  ABILITY_KEYS,
  ALL_SKILLS,
  POKEMON_TYPES,
  createEmptySaves,
  createEmptySkills,
  createId,
  mapPoke5eItemTypeToCategory,
  normalizeTrainerItems,
  syncPokeballsFromItems,
} from './pokemon5eRules';

/**
 * Public Supabase configuration embedded in the open-source poke5e.app client
 * (Auroratide/poke5e). Access to trainer rows is gated server-side by each
 * trainer's unique `read_key` inside Supabase RPCs.
 */
const POKE5E_SUPABASE_URL = 'https://logncbjjfmnvbfrjdxmg.supabase.co';
const POKE5E_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZ25jYmpqZm1udmJmcmpkeG1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE2Njk1ODY2MzEsImV4cCI6MTk4NTE2MjYzMX0.RXw9pfN-4qOR2AbqPoM6GMzjDGRwYnClF9LEiI2VE5k';

interface Poke5eMoveRef {
  id: string;
  name: string;
  type: string;
  power?: string[] | string;
  time?: string;
  pp?: number;
  range?: string;
  description?: string[];
  attack?: {
    scope?: string;
  };
  save?: {
    attribute?: string[];
    dc?: string | number;
  };
  damage?: {
    dice?: Record<string, string | number>;
    modifier?: string | number;
    type?: string[] | string;
  };
}

interface Poke5eSpeciesRef {
  id: string;
  name: string;
  sr?: number | string;
  type?: string[];
}

export interface Poke5eItemRef {
  id: string;
  name: string;
  type?: string;
  cost?: number | null;
  description?: string[];
}

let cachedRefData: {
  movesById: Map<string, Poke5eMoveRef>;
  speciesById: Map<string, Poke5eSpeciesRef>;
  itemsById: Map<string, Poke5eItemRef>;
  itemsByName: Map<string, Poke5eItemRef>;
  itemsList: Poke5eItemRef[];
} | null = null;

async function getPoke5eReferenceData() {
  if (cachedRefData) return cachedRefData;

  const movesById = new Map<string, Poke5eMoveRef>();
  const speciesById = new Map<string, Poke5eSpeciesRef>();
  const itemsById = new Map<string, Poke5eItemRef>();
  const itemsByName = new Map<string, Poke5eItemRef>();
  const itemsList: Poke5eItemRef[] = [];

  await Promise.all([
    fetch('https://poke5e.app/moves.json')
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as { moves?: Poke5eMoveRef[] };
        for (const mv of json.moves ?? []) {
          if (mv?.id) movesById.set(mv.id.toLowerCase(), mv);
        }
      })
      .catch(() => {}),
    fetch('https://poke5e.app/pokemon.json')
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as { items?: Poke5eSpeciesRef[] };
        for (const sp of json.items ?? []) {
          if (sp?.id) speciesById.set(sp.id.toLowerCase(), sp);
        }
      })
      .catch(() => {}),
    fetch('https://poke5e.app/data/items.json')
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as { items?: Poke5eItemRef[] };
        for (const item of json.items ?? []) {
          if (!item?.id || !item?.name) continue;
          itemsList.push(item);
          itemsById.set(item.id.toLowerCase(), item);
          itemsByName.set(item.name.trim().toLowerCase(), item);
        }
      })
      .catch(() => {}),
  ]);

  const data = { movesById, speciesById, itemsById, itemsByName, itemsList };
  if (movesById.size > 0 || speciesById.size > 0 || itemsList.length > 0) {
    cachedRefData = data;
  }
  return data;
}

export async function getPoke5eCatalogItems(): Promise<Poke5eItemRef[]> {
  const ref = await getPoke5eReferenceData();
  return ref.itemsList;
}

export async function findPoke5eCatalogItem(
  nameOrId: string
): Promise<Poke5eItemRef | undefined> {
  const key = nameOrId.trim().toLowerCase();
  if (!key) return undefined;
  const ref = await getPoke5eReferenceData();
  return (
    ref.itemsById.get(key) ??
    ref.itemsByName.get(key) ??
    ref.itemsById.get(key.replace(/[\s_]+/g, '-'))
  );
}

async function callPoke5eRpc<T>(
  fnName: string,
  params: Record<string, unknown>,
  singleObject = false
): Promise<T> {
  const res = await fetch(`${POKE5E_SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: POKE5E_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${POKE5E_SUPABASE_ANON_KEY}`,
      ...(singleObject ? { Accept: 'application/vnd.pgrst.object+json' } : {}),
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`poke5e RPC ${fnName} failed (${res.status}): ${errText}`);
  }

  return (await res.json()) as T;
}

/**
 * Normalizes a string into a valid PokemonType, defaulting to 'Normal'.
 */
function normalizePokemonType(raw: unknown): PokemonType {
  if (typeof raw !== 'string') return 'Normal';
  const normalized = raw.trim().toLowerCase();
  const match = POKEMON_TYPES.find((t) => t.toLowerCase() === normalized);
  return match ?? 'Normal';
}

function normalizeAbilityKey(raw: unknown): AbilityKey {
  if (typeof raw !== 'string') return 'str';
  const val = raw.trim().toLowerCase();
  if (val.startsWith('str')) return 'str';
  if (val.startsWith('dex')) return 'dex';
  if (val.startsWith('con')) return 'con';
  if (val.startsWith('int')) return 'int';
  if (val.startsWith('wis')) return 'wis';
  if (val.startsWith('cha')) return 'cha';
  return 'str';
}

function parseAttributes(raw: Record<string, unknown> | undefined) {
  const defaults = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  if (!raw || typeof raw !== 'object') return defaults;

  for (const key of ABILITY_KEYS) {
    const candidate =
      raw[key] ??
      raw[key.toUpperCase()] ??
      raw[
        key === 'str'
          ? 'strength'
          : key === 'dex'
            ? 'dexterity'
            : key === 'con'
              ? 'constitution'
              : key === 'int'
                ? 'intelligence'
                : key === 'wis'
                  ? 'wisdom'
                  : 'charisma'
      ];
    if (typeof candidate === 'number' && !Number.isNaN(candidate)) {
      defaults[key] = candidate;
    } else if (typeof candidate === 'string' && /^\d+$/.test(candidate)) {
      defaults[key] = parseInt(candidate, 10);
    }
  }
  return defaults;
}

function parseSaves(raw: unknown) {
  const saves = createEmptySaves();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      saves[normalizeAbilityKey(item)] = true;
    }
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const key of ABILITY_KEYS) {
      saves[key] = Boolean(obj[key] ?? obj[key.toUpperCase()]);
    }
  }
  return saves;
}

function parseSkills(raw: unknown) {
  const skills = createEmptySkills();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item !== 'string') continue;
      const found = ALL_SKILLS.find(
        (s) => s.toLowerCase() === item.trim().toLowerCase()
      );
      if (found) skills[found] = 'proficient';
    }
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const skill of ALL_SKILLS) {
      const val =
        obj[skill] ??
        obj[skill.toLowerCase()] ??
        obj[skill.toLowerCase().replace(/\s+/g, '')];
      if (val === 'expertise' || val === 2) {
        skills[skill] = 'expertise';
      } else if (val === true || val === 'proficient' || val === 1) {
        skills[skill] = 'proficient';
      }
    }
  }
  return skills;
}

function normalizeStabBase(raw: unknown): StabBaseMode | undefined {
  if (typeof raw !== 'string') return undefined;
  const val = raw.trim().toLowerCase();
  if (
    val === 'default' ||
    val === 'proficiency' ||
    val === 'movepower' ||
    val === 'ruleset18' ||
    val === 'none'
  ) {
    return val;
  }
  return undefined;
}

function mapDamageModifierType(raw: unknown): DamageModifierType {
  if (raw === 0 || raw === '0') return 'none';
  if (typeof raw !== 'string') return 'move';
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  if (normalized === 'NONE' || normalized === '0') return 'none';
  if (normalized === 'LEVEL') return 'level';
  if (normalized === 'MOVE + 5' || normalized === 'MOVE+5') return 'move+5';
  if (normalized === 'MOVE + 10' || normalized === 'MOVE+10') return 'move+10';
  if (normalized === 'MOVE + STAB' || normalized === 'MOVE+STAB') return 'move+stab';
  return 'move';
}

function parseMove(raw: Record<string, unknown>): Move {
  const ppRaw = raw.pp as Record<string, unknown> | number | undefined;
  let ppCurrent = 10;
  let ppMax = 10;
  if (typeof ppRaw === 'number') {
    ppCurrent = ppRaw;
    ppMax = ppRaw;
  } else if (ppRaw && typeof ppRaw === 'object') {
    ppCurrent = Number(ppRaw.current ?? ppRaw.max ?? 10);
    ppMax = Number(ppRaw.max ?? ppCurrent ?? 10);
  } else if (raw.ppCurrent !== undefined || raw.ppMax !== undefined) {
    ppCurrent = Number(raw.ppCurrent ?? raw.ppMax ?? 10);
    ppMax = Number(raw.ppMax ?? ppCurrent ?? 10);
  }

  const powerRaw = Array.isArray(raw.movePower)
    ? raw.movePower[0]
    : raw.movePower ?? raw.power ?? raw.ability ?? 'str';

  const movePower: AbilityKey | 'none' =
    typeof powerRaw === 'string' && powerRaw.trim().toLowerCase() === 'none'
      ? 'none'
      : normalizeAbilityKey(powerRaw);

  const availablePowers = Array.isArray(raw.availablePowers)
    ? Array.from(new Set(raw.availablePowers.map(normalizeAbilityKey)))
    : undefined;

  const damageDice = String(
    raw.damageDice ?? raw.damage ?? raw.dice ?? ''
  ).trim();

  const isAttack =
    typeof raw.isAttack === 'boolean'
      ? raw.isAttack
      : Boolean(damageDice) && !raw.saveAbility;

  const damageModifierType: DamageModifierType =
    typeof raw.damageModifierType === 'string'
      ? mapDamageModifierType(raw.damageModifierType)
      : 'move';

  return {
    id: String(raw.id || createId('mv')),
    name: String(raw.name || 'Unnamed Move'),
    type: normalizePokemonType(raw.type),
    ppCurrent: Number.isFinite(ppCurrent) ? ppCurrent : 10,
    ppMax: Number.isFinite(ppMax) ? ppMax : 10,
    movePower,
    ...(availablePowers && availablePowers.length > 0 ? { availablePowers } : {}),
    damageDice,
    damageModifierType,
    isAttack,
    saveAbility: raw.saveAbility ? normalizeAbilityKey(raw.saveAbility) : undefined,
    stabEligible:
      typeof raw.stabEligible === 'boolean' ? raw.stabEligible : Boolean(damageDice),
    ...(raw.isHealing ? { isHealing: true } : {}),
    ...(typeof raw.toHitModifier === 'number' ? { toHitModifier: raw.toHitModifier } : {}),
    ...(typeof raw.damageModifier === 'number' ? { damageModifier: raw.damageModifier } : {}),
    ...(typeof raw.saveDcModifier === 'number' ? { saveDcModifier: raw.saveDcModifier } : {}),
    range: String(raw.range || 'Melee (5 ft)'),
    castingTime: String(raw.castingTime || raw.time || '1 Action'),
    description: String(raw.description || raw.effect || ''),
  };
}

function parsePokemon(raw: Record<string, unknown>): PokemonSheet {
  const hpObj = raw.hp as Record<string, unknown> | undefined;
  const hpMax = Number(raw.hpMax ?? hpObj?.max ?? raw.maxHp ?? 30);
  const hpCurrent = Number(raw.hpCurrent ?? hpObj?.current ?? raw.currentHp ?? hpMax);

  const typesRaw = Array.isArray(raw.types)
    ? raw.types
    : raw.type
      ? [raw.type]
      : ['Normal'];

  const movesRaw = Array.isArray(raw.moves) ? raw.moves : [];
  const rawAbilities = (raw.abilities ?? raw.attributes ?? raw.stats) as
    | Record<string, unknown>
    | undefined;

  return {
    id: String(raw.id || createId('poke')),
    kind: 'pokemon',
    name: String(raw.nickname || raw.name || raw.species || 'Imported Pokémon'),
    species: String(raw.species || raw.pokemon || raw.name || 'Unknown'),
    level: Math.max(1, Math.min(20, Number(raw.level ?? 1))),
    sr: String(raw.sr ?? raw.speciesRating ?? '1'),
    types: typesRaw.map(normalizePokemonType).slice(0, 2),
    nature: String(raw.nature || 'Hardy'),
    ability: String(raw.ability || raw.pokeAbility || 'None'),
    abilityDescription: String(raw.abilityDescription || ''),
    hpCurrent: Number.isFinite(hpCurrent) ? hpCurrent : 30,
    hpMax: Number.isFinite(hpMax) ? hpMax : 30,
    tempHp: Number(raw.tempHp ?? 0),
    ac: Number(raw.ac ?? raw.armorClass ?? 12),
    speed: Number(raw.speed ?? 30),
    hitDice: String(raw.hitDice || `${Math.max(1, Number(raw.level ?? 1))}d8`),
    ...(normalizeStabBase(raw.stabBase) ? { stabBase: normalizeStabBase(raw.stabBase) } : {}),
    ...(typeof raw.stabBonus === 'number' ? { stabBonus: raw.stabBonus } : {}),
    ...(typeof raw.stabOverride === 'number' ? { stabOverride: raw.stabOverride } : {}),
    ...(typeof raw.proficiencyOverride === 'number'
      ? { proficiencyOverride: raw.proficiencyOverride }
      : {}),
    abilities: parseAttributes(rawAbilities),
    savingThrows: parseSaves(raw.savingThrows ?? raw.saves),
    skills: parseSkills(raw.skills ?? raw.proficientSkills),
    moves: movesRaw
      .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === 'object'))
      .map(parseMove),
    heldItem: String(raw.heldItem || raw.item || ''),
    statusCondition: String(raw.statusCondition || 'Healthy'),
    notes: String(raw.notes || ''),
  };
}

/**
 * Extracts readKey / accessKey from a poke5e.app share URL or raw key string.
 * Supports:
 * - https://poke5e.app/trainers?id=READ_KEY
 * - https://poke5e.app/trainers?id=READ_KEY&access_key=WRITE_KEY
 * - Raw READ_KEY string
 */
export function parsePoke5eUrlOrKey(input: string): {
  readKey: string;
  accessKey?: string;
} | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed) || trimmed.includes('poke5e.app')) {
    try {
      const normalizedUrl = /^https?:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;
      const url = new URL(normalizedUrl);
      const id =
        url.searchParams.get('id') ||
        url.searchParams.get('trainer') ||
        url.searchParams.get('readKey') ||
        url.searchParams.get('read_key');
      const accessKey =
        url.searchParams.get('access_key') ||
        url.searchParams.get('accessKey') ||
        url.searchParams.get('write_key') ||
        url.searchParams.get('writeKey') ||
        undefined;

      if (id && id.trim()) {
        return {
          readKey: id.trim(),
          accessKey: accessKey?.trim() || undefined,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  // Raw Trainer Read Key (alphanumeric/dash/underscore token)
  if (/^[a-zA-Z0-9_-]{4,64}$/.test(trimmed)) {
    return { readKey: trimmed };
  }

  return null;
}

/**
 * Extracts a poke5e write/access key from either a full share URL (`&access_key=...`)
 * or a raw key token.
 */
export function parsePoke5eAccessKey(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed) || trimmed.includes('poke5e.app') || trimmed.includes('access_key=')) {
    try {
      const normalizedUrl = /^https?:\/\//i.test(trimmed)
        ? trimmed
        : trimmed.includes('poke5e.app')
          ? `https://${trimmed}`
          : `https://poke5e.app/trainers?${trimmed.replace(/^\?/, '')}`;
      const url = new URL(normalizedUrl);
      const accessKey =
        url.searchParams.get('access_key') ||
        url.searchParams.get('accessKey') ||
        url.searchParams.get('write_key') ||
        url.searchParams.get('writeKey');
      return accessKey?.trim() || null;
    } catch {
      return null;
    }
  }

  if (/^[a-zA-Z0-9_-]{4,64}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

interface SupabaseTrainerRow {
  id: string;
  read_key: string;
  name: string;
  description?: string | null;
  level: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  ac: number;
  hp_cur: number;
  hp_max: number;
  hit_dice_cur?: number;
  hit_dice_max?: number;
  home_region?: string | null;
  background?: string | null;
  money?: number;
  path_name?: string | null;
  save_str?: boolean;
  save_dex?: boolean;
  save_con?: boolean;
  save_int?: boolean;
  save_wis?: boolean;
  save_cha?: boolean;
  [key: string]: unknown;
}

interface SupabasePokemonRow {
  id: number;
  trainer_id: string;
  species: string;
  nickname: string;
  type: string[];
  nature: string;
  level: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  ac: number;
  hp_cur: number;
  hp_max: number;
  hit_dice_cur?: number;
  hit_dice_max?: number;
  hit_dice_size?: string | null;
  ability?: string | null;
  abilities?: Array<{ referenceId?: string; name?: string; description?: string }>;
  notes?: string | null;
  status?: string | null;
  held_item?: string | null;
  speed_walking?: number | null;
  stab_base?: string | null;
  stab_bonus?: number | null;
  save_str?: boolean;
  save_dex?: boolean;
  save_con?: boolean;
  save_int?: boolean;
  save_wis?: boolean;
  save_cha?: boolean;
  [key: string]: unknown;
}

interface SupabaseMoveRow {
  id: number | string;
  pokemon_id: number;
  move_id: string;
  pp_cur: number;
  pp_max: number;
  notes?: string | null;
  custom_type?: string | null;
  custom_powers?: string[] | null;
  custom_time?: string | null;
  custom_range_type?: string | null;
  custom_range_value?: number | null;
  to_hit_modifier?: number | null;
  damage_modifier?: number | null;
  save_dc_modifier?: number | null;
}

interface SupabaseHeldItemRow {
  pokemon_id: number;
  item_id?: string | null;
  custom_name?: string | null;
}

interface SupabaseInventoryRow {
  id?: number;
  trainer_id?: string;
  item_id?: string | null;
  custom_name?: string | null;
  description?: string | null;
  quantity?: number;
  rank?: number;
}

function mapSupabaseSkills(row: Record<string, unknown>): SkillProficiencies {
  const mapping: Array<[SkillName, string]> = [
    ['Athletics', 'athletics'],
    ['Acrobatics', 'acrobatics'],
    ['Sleight of Hand', 'sleight_of_hand'],
    ['Stealth', 'stealth'],
    ['Arcana', 'arcana'],
    ['History', 'history'],
    ['Investigation', 'investigation'],
    ['Nature', 'nature'],
    ['Religion', 'religion'],
    ['Animal Handling', 'animal_handling'],
    ['Insight', 'insight'],
    ['Medicine', 'medicine'],
    ['Perception', 'perception'],
    ['Survival', 'survival'],
    ['Deception', 'deception'],
    ['Intimidation', 'intimidation'],
    ['Performance', 'performance'],
    ['Persuasion', 'persuasion'],
  ];

  const skills = createEmptySkills();
  for (const [skillName, col] of mapping) {
    const rank = Number(row[`rank_${col}`] ?? 0);
    const prof = Boolean(row[`prof_${col}`]);
    if (rank >= 2) skills[skillName] = 'expertise';
    else if (rank === 1 || prof) skills[skillName] = 'proficient';
  }
  return skills;
}

function pickScaledDamageDice(
  refMove: Poke5eMoveRef | undefined,
  pokemonLevel: number
): string {
  if (refMove?.damage?.dice) {
    const thresholds = Object.keys(refMove.damage.dice)
      .map((k) => parseInt(k, 10))
      .filter((n) => !Number.isNaN(n) && n <= pokemonLevel)
      .sort((a, b) => b - a);
    if (thresholds.length > 0) {
      return String(refMove.damage.dice[String(thresholds[0])]);
    }
    const firstKey = Object.keys(refMove.damage.dice)[0];
    if (firstKey) return String(refMove.damage.dice[firstKey]);
  }

  // If the move exists in official moves.json and defines no damage dice, don't
  // misread duration/effect dice in description text (e.g. "1d4 rounds") as move damage.
  if (refMove) {
    return '';
  }

  return '';
}

function resolveMovePower(
  customPowers: string[] | null | undefined,
  refPower: string[] | string | undefined,
  pokemonAbilities: Record<AbilityKey, number>
): { movePower: AbilityKey | 'none'; availablePowers: AbilityKey[] } {
  const source =
    Array.isArray(customPowers) && customPowers.length > 0
      ? customPowers
      : refPower;

  if (!source) {
    return { movePower: 'str', availablePowers: ['str'] };
  }

  const tokens = Array.isArray(source) ? source : [source];
  const lowerTokens = tokens.map((t) => String(t).trim().toLowerCase());

  if (lowerTokens.length === 1 && lowerTokens[0] === 'none') {
    return { movePower: 'none', availablePowers: [] };
  }

  let availablePowers: AbilityKey[];
  if (lowerTokens.some((t) => t === 'any' || t === 'varies')) {
    availablePowers = [...ABILITY_KEYS];
  } else {
    availablePowers = Array.from(
      new Set(
        lowerTokens
          .filter((t) => t !== 'none')
          .map(normalizeAbilityKey)
      )
    );
  }

  if (availablePowers.length === 0) {
    return { movePower: 'none', availablePowers: [] };
  }

  // Pick whichever allowed Move Power ability is highest on this Pokémon
  const bestPower = availablePowers.reduce(
    (best, curr) =>
      pokemonAbilities[curr] > pokemonAbilities[best] ? curr : best,
    availablePowers[0]
  );

  return { movePower: bestPower, availablePowers };
}

function mapSupabaseMove(
  row: SupabaseMoveRow,
  pokemonLevel: number,
  pokemonAbilities: Record<AbilityKey, number>,
  movesById: Map<string, Poke5eMoveRef>
): Move {
  const ref = movesById.get(String(row.move_id).toLowerCase());
  const desc = ref?.description?.join(' ') ?? row.notes ?? '';

  const { movePower, availablePowers } = resolveMovePower(
    row.custom_powers,
    ref?.power,
    pokemonAbilities
  );

  let damageDice = pickScaledDamageDice(ref, pokemonLevel);
  if (!ref && desc) {
    const diceMatch = desc.match(/\b(\d+d\d+)\b/i);
    damageDice = diceMatch ? diceMatch[1] : '';
  }

  const fallbackSaveMatch = desc.match(
    /\b(STR|DEX|CON|INT|WIS|CHA)\s+(?:saving\s+throw|save)\b/i
  );

  const saveAbility: AbilityKey | undefined = ref
    ? ref.save?.attribute?.[0]
      ? normalizeAbilityKey(ref.save.attribute[0])
      : undefined
    : fallbackSaveMatch
      ? normalizeAbilityKey(fallbackSaveMatch[1])
      : undefined;

  const isAttack = ref
    ? Boolean(ref.attack)
    : /\b(?:melee|ranged)\s+attack\b|\bmake\s+an\s+attack\b/i.test(desc) ||
      (!fallbackSaveMatch && Boolean(damageDice));

  const damageModifierType: DamageModifierType = ref?.damage
    ? mapDamageModifierType(ref.damage.modifier)
    : 'move';

  const isHealing = ref?.damage?.type === 'healing';
  const rawTypeToken = String(row.custom_type ?? ref?.type ?? 'Normal')
    .trim()
    .toLowerCase();
  const isTypeless =
    rawTypeToken === 'typeless' || ref?.damage?.type === 'typeless';

  const customRange =
    row.custom_range_type === 'ranged' && row.custom_range_value
      ? `${row.custom_range_value} ft`
      : row.custom_range_type || ref?.range || 'Melee (5 ft)';

  return {
    id: String(row.id || createId('mv')),
    name:
      ref?.name ||
      String(row.move_id)
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    type: normalizePokemonType(row.custom_type ?? ref?.type ?? 'Normal'),
    ppCurrent: Number(row.pp_cur ?? ref?.pp ?? 15),
    ppMax: Number(row.pp_max ?? ref?.pp ?? 15),
    movePower,
    ...(availablePowers.length > 0 ? { availablePowers } : {}),
    damageDice,
    damageModifierType,
    isAttack,
    saveAbility,
    stabEligible:
      Boolean(damageDice) &&
      !isHealing &&
      (!isTypeless || damageModifierType === 'move+stab'),
    ...(isHealing ? { isHealing: true } : {}),
    ...(typeof row.to_hit_modifier === 'number' && row.to_hit_modifier !== 0
      ? { toHitModifier: row.to_hit_modifier }
      : {}),
    ...(typeof row.damage_modifier === 'number' && row.damage_modifier !== 0
      ? { damageModifier: row.damage_modifier }
      : {}),
    ...(typeof row.save_dc_modifier === 'number' && row.save_dc_modifier !== 0
      ? { saveDcModifier: row.save_dc_modifier }
      : {}),
    range: customRange,
    castingTime: row.custom_time || ref?.time || '1 Action',
    description: desc,
  };
}

function mapSupabaseInventoryRowsToBag(
  rows: SupabaseInventoryRow[],
  itemsById: Map<string, Poke5eItemRef>
): {
  items: TrainerItem[];
  pokeballs: TrainerSheet['pokeballs'];
} {
  const sorted = [...rows].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const trainerItems: TrainerItem[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const row = sorted[i];
    const catalogId = row.item_id ? String(row.item_id).trim() : null;
    const ref = catalogId ? itemsById.get(catalogId.toLowerCase()) : undefined;
    const rawName = String(row.custom_name || ref?.name || catalogId || '').trim();
    if (!rawName) continue;

    const displayName = row.custom_name?.trim()
      ? row.custom_name.trim()
      : ref?.name
        ? ref.name
        : rawName
            .replace(/[-_]+/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());

    const description =
      row.description?.trim() ||
      (ref?.description && ref.description.length > 0
        ? ref.description.join(' ')
        : undefined);

    const qty = Math.max(0, Number(row.quantity ?? 1) || 0);
    const remoteId =
      typeof row.id === 'number' && Number.isFinite(row.id) ? row.id : undefined;

    trainerItems.push({
      id: remoteId !== undefined ? `poke5e-item-${remoteId}` : createId('item'),
      name: displayName,
      category: mapPoke5eItemTypeToCategory(ref?.type, catalogId || displayName),
      quantity: qty,
      description,
      poke5eId: remoteId,
      poke5eItemId: catalogId,
      poke5eRank: typeof row.rank === 'number' ? row.rank : i,
    });
  }

  return {
    items: trainerItems,
    pokeballs: syncPokeballsFromItems(trainerItems),
  };
}

/**
 * Fetches a full Trainer + Pokémon team directly from poke5e.app using a
 * poke5e.app share link (`https://poke5e.app/trainers?id=...`) or raw Read Key.
 */
export async function importFromPoke5eLink(
  urlOrKey: string
): Promise<Poke5eImportResult> {
  const parsed = parsePoke5eUrlOrKey(urlOrKey);
  if (!parsed) {
    return {
      success: false,
      tier: 'link-fetch',
      message:
        'Invalid poke5e.app link or Trainer ID. Paste a URL like https://poke5e.app/trainers?id=...',
      warnings: [],
    };
  }

  try {
    const trainerRow = await callPoke5eRpc<SupabaseTrainerRow | null>(
      'get_trainer',
      { _read_key: parsed.readKey },
      true
    );

    if (!trainerRow || !trainerRow.id) {
      return {
        success: false,
        tier: 'link-fetch',
        message: `No trainer found on poke5e.app for ID "${parsed.readKey}".`,
        warnings: ['Check that the share link contains the full ?id=... parameter.'],
      };
    }

    const effectiveReadKey = trainerRow.read_key || parsed.readKey;
    let inventoryFetchFailed = false;

    const [pokemonRows, moveRows, heldItemRows, inventoryRows, refData] =
      await Promise.all([
        callPoke5eRpc<SupabasePokemonRow[]>('get_pokemon', {
          _trainer_id: trainerRow.id,
        }).catch(() => []),
        callPoke5eRpc<SupabaseMoveRow[]>('get_trainer_movesets', {
          _trainer_id: trainerRow.id,
        }).catch(() => []),
        callPoke5eRpc<SupabaseHeldItemRow[]>('get_trainer_held_items', {
          _trainer_id: trainerRow.id,
        }).catch(() => []),
        callPoke5eRpc<SupabaseInventoryRow[]>('get_inventory_items', {
          _read_key: effectiveReadKey,
        }).catch(() => {
          inventoryFetchFailed = true;
          return [];
        }),
        getPoke5eReferenceData(),
      ]);

    const mappedBag = mapSupabaseInventoryRowsToBag(
      inventoryRows ?? [],
      refData.itemsById
    );
    const nowIso = new Date().toISOString();

    const trainer: TrainerSheet = {
      id: 'trainer',
      kind: 'trainer',
      name: trainerRow.name || 'Imported Trainer',
      level: Math.max(1, Math.min(20, Number(trainerRow.level ?? 1))),
      trainerClass: trainerRow.path_name || trainerRow.background || 'Pokémon Trainer',
      origin: trainerRow.home_region || '',
      hpCurrent: Number(trainerRow.hp_cur ?? 20),
      hpMax: Number(trainerRow.hp_max ?? 20),
      tempHp: 0,
      ac: Number(trainerRow.ac ?? 12),
      speed: 30,
      hitDice: `${Math.max(1, Number(trainerRow.level ?? 1))}d8`,
      abilities: {
        str: Number(trainerRow.strength ?? 10),
        dex: Number(trainerRow.dexterity ?? 10),
        con: Number(trainerRow.constitution ?? 10),
        int: Number(trainerRow.intelligence ?? 10),
        wis: Number(trainerRow.wisdom ?? 10),
        cha: Number(trainerRow.charisma ?? 10),
      },
      savingThrows: {
        str: Boolean(trainerRow.save_str),
        dex: Boolean(trainerRow.save_dex),
        con: Boolean(trainerRow.save_con),
        int: Boolean(trainerRow.save_int),
        wis: Boolean(trainerRow.save_wis),
        cha: Boolean(trainerRow.save_cha),
      },
      skills: mapSupabaseSkills(trainerRow),
      pokeballs: mappedBag.pokeballs,
      items: mappedBag.items,
      money: Number(trainerRow.money ?? 0),
      badges: 0,
      trainerPaths: trainerRow.path_name || '',
      notes: trainerRow.description || '',
      poke5eMeta: {
        trainerId: trainerRow.id,
        readKey: effectiveReadKey,
        accessKey: parsed.accessKey,
        importedAt: nowIso,
        bagSyncedAt: inventoryFetchFailed ? undefined : nowIso,
      },
    };

    const movesByPokemon = new Map<number, SupabaseMoveRow[]>();
    for (const mv of moveRows ?? []) {
      const list = movesByPokemon.get(mv.pokemon_id) ?? [];
      list.push(mv);
      movesByPokemon.set(mv.pokemon_id, list);
    }

    const heldByPokemon = new Map<number, string>();
    for (const hi of heldItemRows ?? []) {
      const label = hi.custom_name || hi.item_id || '';
      if (label) heldByPokemon.set(hi.pokemon_id, label);
    }

    const allRows = pokemonRows ?? [];
    const warnings: string[] = [];
    if (inventoryFetchFailed) {
      warnings.push(
        'Could not fetch Trainer inventory from poke5e.app; try Sync Bag again in a moment.'
      );
    }
    if (allRows.length > 6) {
      warnings.push(
        `This trainer has ${allRows.length} Pokémon on poke5e.app; the first 6 were loaded into your active party.`
      );
    }

    const pokemon: PokemonSheet[] = allRows.slice(0, 6).map((row) => {
      const spRef = refData.speciesById.get(String(row.species).toLowerCase());
      const abilityEntry =
        row.abilities && row.abilities.length > 0 ? row.abilities[0] : undefined;
      const abilityName =
        row.ability ||
        abilityEntry?.name ||
        abilityEntry?.referenceId ||
        'None';

      const abilities = {
        str: Number(row.strength ?? 10),
        dex: Number(row.dexterity ?? 10),
        con: Number(row.constitution ?? 10),
        int: Number(row.intelligence ?? 10),
        wis: Number(row.wisdom ?? 10),
        cha: Number(row.charisma ?? 10),
      };

      const pokeMoves = (movesByPokemon.get(row.id) ?? []).map((mv) =>
        mapSupabaseMove(mv, row.level, abilities, refData.movesById)
      );

      const types =
        Array.isArray(row.type) && row.type.length > 0
          ? row.type.map(normalizePokemonType).slice(0, 2)
          : spRef?.type && spRef.type.length > 0
            ? spRef.type.map(normalizePokemonType).slice(0, 2)
            : (['Normal'] as PokemonType[]);

      const mappedStabBase = normalizeStabBase(row.stab_base);
      const mappedStabBonus =
        typeof row.stab_bonus === 'number' && row.stab_bonus !== 0
          ? row.stab_bonus
          : undefined;

      return {
        id: `poke5e-${row.id}`,
        kind: 'pokemon',
        name: row.nickname || spRef?.name || row.species || 'Pokémon',
        species: spRef?.name || row.species || 'Unknown',
        level: Math.max(1, Math.min(20, Number(row.level ?? 1))),
        sr: spRef?.sr !== undefined ? String(spRef.sr) : '1',
        types,
        nature: row.nature
          ? row.nature.charAt(0).toUpperCase() + row.nature.slice(1)
          : 'Hardy',
        ability: String(abilityName),
        abilityDescription: abilityEntry?.description || '',
        hpCurrent: Number(row.hp_cur ?? 20),
        hpMax: Number(row.hp_max ?? 20),
        tempHp: 0,
        ac: Number(row.ac ?? 12),
        speed: Number(row.speed_walking ?? 30),
        hitDice: `${Math.max(1, Number(row.level ?? 1))}${row.hit_dice_size || 'd8'}`,
        ...(mappedStabBase ? { stabBase: mappedStabBase } : {}),
        ...(mappedStabBonus !== undefined ? { stabBonus: mappedStabBonus } : {}),
        abilities,
        savingThrows: {
          str: Boolean(row.save_str),
          dex: Boolean(row.save_dex),
          con: Boolean(row.save_con),
          int: Boolean(row.save_int),
          wis: Boolean(row.save_wis),
          cha: Boolean(row.save_cha),
        },
        skills: mapSupabaseSkills(row),
        moves: pokeMoves,
        heldItem: row.held_item || heldByPokemon.get(row.id) || '',
        statusCondition: row.status || 'Healthy',
        notes: row.notes || '',
      };
    });

    return {
      success: true,
      tier: 'link-fetch',
      message: `Imported "${trainer.name}" and ${pokemon.length} Pokémon directly from poke5e.app.`,
      warnings,
      workspace: { trainer, pokemon },
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Network error';
    return {
      success: false,
      tier: 'link-fetch',
      message: `Could not fetch trainer "${parsed.readKey}" from poke5e.app (${detail}).`,
      warnings: [
        'Verify your internet connection and ensure the link includes a valid ?id=... parameter.',
      ],
    };
  }
}

/**
 * Extracts Trainer IDs and Read/Access Keys from a `.poke5e` backup file.
 */
export function extractPoke5eKeys(rawJson: unknown): Poke5eFileEntry[] {
  const entries: Poke5eFileEntry[] = [];
  if (!rawJson || typeof rawJson !== 'object') return entries;

  const obj = rawJson as Record<string, unknown>;
  const candidates = Array.isArray(rawJson)
    ? rawJson
    : Array.isArray(obj.trainers)
      ? obj.trainers
      : obj.trainer
        ? [obj.trainer]
        : [obj];

  for (const item of candidates) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const readKey =
      typeof rec.readKey === 'string'
        ? rec.readKey
        : typeof rec.read_key === 'string'
          ? rec.read_key
          : undefined;
    const accessKey =
      typeof rec.accessKey === 'string'
        ? rec.accessKey
        : typeof rec.access_key === 'string'
          ? rec.access_key
          : typeof rec.writeKey === 'string'
            ? rec.writeKey
            : undefined;
    const trainerId =
      typeof rec.id === 'string'
        ? rec.id
        : typeof rec.trainerId === 'string'
          ? rec.trainerId
          : undefined;

    if (readKey || accessKey || trainerId) {
      entries.push({
        id: trainerId,
        trainerId,
        readKey,
        accessKey,
        name: typeof rec.name === 'string' ? rec.name : undefined,
      });
    }
  }
  return entries;
}

/**
 * Attempts to convert any full JSON exported from either this sheet or poke5e.app.
 */
export function normalizeJsonToWorkspace(rawJson: unknown): PartyWorkspace | null {
  if (!rawJson || typeof rawJson !== 'object') return null;
  const obj = rawJson as Record<string, unknown>;

  if (
    obj.trainer &&
    typeof obj.trainer === 'object' &&
    Array.isArray(obj.pokemon)
  ) {
    const t = obj.trainer as Record<string, unknown>;
    const hpObj = t.hp as Record<string, unknown> | undefined;
    const hpMax = Number(t.hpMax ?? hpObj?.max ?? 20);
    const hpCurrent = Number(t.hpCurrent ?? hpObj?.current ?? hpMax);

    const trainer: TrainerSheet = {
      id: 'trainer',
      kind: 'trainer',
      name: String(t.name || 'Imported Trainer'),
      level: Math.max(1, Math.min(20, Number(t.level ?? 1))),
      trainerClass: String(t.trainerClass || 'Pokémon Trainer'),
      origin: String(t.origin || ''),
      hpCurrent,
      hpMax,
      tempHp: Number(t.tempHp ?? 0),
      ac: Number(t.ac ?? 12),
      speed: Number(t.speed ?? 30),
      hitDice: String(t.hitDice || `${Math.max(1, Number(t.level ?? 1))}d8`),
      abilities: parseAttributes(
        (t.abilities ?? t.attributes) as Record<string, unknown> | undefined
      ),
      savingThrows: parseSaves(t.savingThrows ?? t.saves),
      skills: parseSkills(t.skills ?? t.proficientSkills),
      pokeballs: {
        pokeBall: Number((t.pokeballs as Record<string, unknown> | undefined)?.pokeBall ?? 5),
        greatBall: Number((t.pokeballs as Record<string, unknown> | undefined)?.greatBall ?? 0),
        ultraBall: Number((t.pokeballs as Record<string, unknown> | undefined)?.ultraBall ?? 0),
        other: String((t.pokeballs as Record<string, unknown> | undefined)?.other ?? ''),
      },
      items: normalizeTrainerItems(t as Partial<TrainerSheet>),
      money: Number(t.money ?? 0),
      badges: Number(t.badges ?? 0),
      trainerPaths: String(t.trainerPaths || ''),
      notes: String(t.notes || ''),
      poke5eMeta:
        t.poke5eMeta && typeof t.poke5eMeta === 'object'
          ? (t.poke5eMeta as TrainerSheet['poke5eMeta'])
          : undefined,
    };

    const pokemon = obj.pokemon
      .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === 'object'))
      .slice(0, 6)
      .map(parsePokemon);

    return { trainer, pokemon };
  }

  const trainerCandidate = Array.isArray(obj.trainers)
    ? (obj.trainers[0] as Record<string, unknown> | undefined)
    : obj;

  if (!trainerCandidate || typeof trainerCandidate !== 'object') return null;

  const hasFullStats =
    Boolean(trainerCandidate.attributes) ||
    Boolean(trainerCandidate.abilities) ||
    Array.isArray(trainerCandidate.pokemon) ||
    Array.isArray(trainerCandidate.party) ||
    trainerCandidate.hp !== undefined;

  if (!hasFullStats) return null;

  const hpObj = trainerCandidate.hp as Record<string, unknown> | undefined;
  const hpMax = Number(trainerCandidate.hpMax ?? hpObj?.max ?? 20);
  const hpCurrent = Number(trainerCandidate.hpCurrent ?? hpObj?.current ?? hpMax);

  const inventory = trainerCandidate.inventory as Record<string, unknown> | undefined;
  const partyList = Array.isArray(trainerCandidate.pokemon)
    ? trainerCandidate.pokemon
    : Array.isArray(trainerCandidate.party)
      ? trainerCandidate.party
      : [];

  const trainer: TrainerSheet = {
    id: 'trainer',
    kind: 'trainer',
    name: String(trainerCandidate.name || 'Imported Trainer'),
    level: Math.max(1, Math.min(20, Number(trainerCandidate.level ?? 1))),
    trainerClass: String(
      trainerCandidate.trainerClass ||
        trainerCandidate.class ||
        'Pokémon Trainer'
    ),
    origin: String(trainerCandidate.origin || trainerCandidate.homeRegion || ''),
    hpCurrent: Number.isFinite(hpCurrent) ? hpCurrent : 20,
    hpMax: Number.isFinite(hpMax) ? hpMax : 20,
    tempHp: Number(trainerCandidate.tempHp ?? 0),
    ac: Number(trainerCandidate.ac ?? 12),
    speed: Number(trainerCandidate.speed ?? 30),
    hitDice: String(
      trainerCandidate.hitDice || `${Math.max(1, Number(trainerCandidate.level ?? 1))}d8`
    ),
    abilities: parseAttributes(
      (trainerCandidate.abilities ?? trainerCandidate.attributes) as
        | Record<string, unknown>
        | undefined
    ),
    savingThrows: parseSaves(trainerCandidate.savingThrows ?? trainerCandidate.saves),
    skills: parseSkills(
      trainerCandidate.skills ??
        trainerCandidate.proficientSkills ??
        trainerCandidate.proficiencies
    ),
    pokeballs: {
      pokeBall: Number(inventory?.pokeBalls ?? 5),
      greatBall: Number(inventory?.greatBalls ?? 0),
      ultraBall: Number(inventory?.ultraBalls ?? 0),
      other: '',
    },
    items: normalizeTrainerItems({
      items: Array.isArray(inventory?.items)
        ? (inventory.items as TrainerItem[])
        : undefined,
      pokeballs: {
        pokeBall: Number(inventory?.pokeBalls ?? 5),
        greatBall: Number(inventory?.greatBalls ?? 0),
        ultraBall: Number(inventory?.ultraBalls ?? 0),
        other: '',
      },
    }),
    money: Number(trainerCandidate.money ?? inventory?.money ?? 0),
    badges: Number(trainerCandidate.badges ?? 0),
    trainerPaths: Array.isArray(trainerCandidate.specializations)
      ? trainerCandidate.specializations.join(', ')
      : String(trainerCandidate.trainerPaths || ''),
    notes: String(trainerCandidate.biography || trainerCandidate.notes || ''),
    poke5eMeta:
      trainerCandidate.id || trainerCandidate.readKey
        ? {
            trainerId: String(trainerCandidate.id || ''),
            readKey:
              typeof trainerCandidate.readKey === 'string'
                ? trainerCandidate.readKey
                : undefined,
            accessKey:
              typeof trainerCandidate.accessKey === 'string'
                ? trainerCandidate.accessKey
                : typeof trainerCandidate.writeKey === 'string'
                  ? trainerCandidate.writeKey
                  : undefined,
            importedAt: new Date().toISOString(),
          }
        : undefined,
  };

  const pokemon = partyList
    .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === 'object'))
    .slice(0, 6)
    .map(parsePokemon);

  return { trainer, pokemon };
}

/**
 * Tier A: Import from a `.poke5e` backup file.
 * Extracts readKeys and fetches full Trainer + Pokémon data from poke5e.app.
 */
export async function importFromPoke5eFile(
  fileText: string
): Promise<Poke5eImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    return {
      success: false,
      tier: 'auto-fetch',
      message:
        'Could not parse file as JSON. Make sure you selected a valid .poke5e or .json backup file.',
      warnings: [],
    };
  }

  const directWorkspace = normalizeJsonToWorkspace(parsed);
  if (directWorkspace) {
    return {
      success: true,
      tier: 'json-parse',
      message: `Imported "${directWorkspace.trainer.name}" and ${directWorkspace.pokemon.length} Pokémon from backup file.`,
      warnings: [],
      workspace: directWorkspace,
    };
  }

  const keys = extractPoke5eKeys(parsed);
  if (keys.length === 0) {
    return {
      success: false,
      tier: 'auto-fetch',
      message:
        'No trainer records or poke5e.app access keys were found inside this file.',
      warnings: [],
    };
  }

  const first = keys[0];
  const lookupKey = first.readKey || first.id || first.trainerId;

  if (lookupKey) {
    const lookupTarget = first.accessKey
      ? `https://poke5e.app/trainers?id=${encodeURIComponent(lookupKey)}&access_key=${encodeURIComponent(first.accessKey)}`
      : lookupKey;
    const linkResult = await importFromPoke5eLink(lookupTarget);
    if (linkResult.success) {
      return {
        ...linkResult,
        extractedKeys: keys,
      };
    }
  }

  return {
    success: false,
    tier: 'auto-fetch',
    message: `Extracted ${keys.length} Trainer key(s) from your .poke5e file, but could not fetch remote data automatically.`,
    warnings: [
      'Your Trainer ID / Read Key has been extracted below. You can try pasting the poke5e.app link or using JSON / Quick Map.',
    ],
    extractedKeys: keys,
  };
}

export async function pullTrainerBagFromPoke5e(readKey: string): Promise<{
  trainerId: string;
  readKey: string;
  money?: number;
  items: TrainerItem[];
  pokeballs: TrainerSheet['pokeballs'];
  syncedAt: string;
}> {
  const [trainerRow, inventoryRows, refData] = await Promise.all([
    callPoke5eRpc<SupabaseTrainerRow | null>(
      'get_trainer',
      { _read_key: readKey },
      true
    ),
    callPoke5eRpc<SupabaseInventoryRow[]>('get_inventory_items', {
      _read_key: readKey,
    }),
    getPoke5eReferenceData(),
  ]);

  if (!trainerRow || !trainerRow.id) {
    throw new Error('Trainer not found on poke5e.app for this Read Key.');
  }

  const mappedBag = mapSupabaseInventoryRowsToBag(
    inventoryRows ?? [],
    refData.itemsById
  );

  return {
    trainerId: trainerRow.id,
    readKey: trainerRow.read_key || readKey,
    money: typeof trainerRow.money === 'number' ? trainerRow.money : undefined,
    items: mappedBag.items,
    pokeballs: mappedBag.pokeballs,
    syncedAt: new Date().toISOString(),
  };
}

export async function verifyPoke5eWriteKey(
  trainerId: string,
  writeKey: string
): Promise<boolean> {
  const count = await callPoke5eRpc<number>(
    'verify_write_key',
    {
      _id: trainerId,
      _write_key: writeKey,
    },
    true
  );
  return Number(count) > 0;
}

export async function addInventoryItemToPoke5e(
  writeKey: string,
  item: TrainerItem,
  rank: number
): Promise<{ poke5eId: number; poke5eItemId: string | null }> {
  let resolvedItemId = item.poke5eItemId;
  if (resolvedItemId === undefined) {
    const matched = await findPoke5eCatalogItem(item.name);
    resolvedItemId = matched ? matched.id : null;
  }

  const isStandard = Boolean(resolvedItemId);
  const newId = await callPoke5eRpc<number>(
    'add_inventory_item',
    {
      _write_key: writeKey,
      _item_id: isStandard ? resolvedItemId : null,
      _quantity: Math.max(0, Math.floor(item.quantity || 0)),
      _custom_name: isStandard ? null : item.name.trim(),
      _description: isStandard ? null : item.description?.trim() || null,
      _rank: Math.max(0, Math.floor(rank)),
    },
    true
  );

  const numericId = Number(newId);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw new Error('Invalid write key or permission denied on poke5e.app.');
  }

  return {
    poke5eId: numericId,
    poke5eItemId: resolvedItemId ?? null,
  };
}

export async function updateInventoryItemInPoke5e(
  writeKey: string,
  item: TrainerItem,
  rank: number
): Promise<boolean> {
  if (typeof item.poke5eId !== 'number') return false;
  const isStandard = Boolean(item.poke5eItemId);
  const affected = await callPoke5eRpc<number>(
    'update_inventory_item',
    {
      _write_key: writeKey,
      _id: item.poke5eId,
      _item_id: isStandard ? item.poke5eItemId : null,
      _quantity: Math.max(0, Math.floor(item.quantity || 0)),
      _custom_name: isStandard ? null : item.name.trim(),
      _description: isStandard ? null : item.description?.trim() || null,
      _rank: Math.max(0, Math.floor(rank)),
    },
    true
  );

  if (Number(affected) <= 0) {
    throw new Error('Could not update item on poke5e.app (check access key or item ID).');
  }
  return true;
}

export async function removeInventoryItemFromPoke5e(
  writeKey: string,
  poke5eId: number
): Promise<boolean> {
  const affected = await callPoke5eRpc<number>(
    'remove_inventory_item',
    {
      _write_key: writeKey,
      _id: poke5eId,
    },
    true
  );
  return Number(affected) > 0;
}

/**
 * Parses plain-text statblocks copied from poke5e.app or Markdown/PDF sheets.
 */
export function parseQuickTextPokemon(text: string): PokemonSheet {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const nameLine = lines[0] || 'Imported Pokémon';
  const levelMatch = text.match(/level\s*[:#]?\s*(\d+)/i) || text.match(/\bLv\.?\s*(\d+)/i);
  const hpMatch = text.match(/\bHP\s*[:#]?\s*(\d+)(?:\s*\/\s*(\d+))?/i);
  const acMatch = text.match(/\bAC\s*[:#]?\s*(\d+)/i);
  const speedMatch = text.match(/\bSpeed\s*[:#]?\s*(\d+)/i);
  const srMatch = text.match(/\bSR\s*[:#]?\s*([0-9./]+)/i);
  const natureMatch = text.match(/\bNature\s*[:#]?\s*([A-Za-z]+)/i);
  const abilityMatch = text.match(/\bAbility\s*[:#]?\s*([^\n·|]+)/i);

  const detectedTypes: PokemonType[] = [];
  for (const t of POKEMON_TYPES) {
    if (new RegExp(`\\b${t}\\b`, 'i').test(text)) {
      detectedTypes.push(t);
    }
  }

  const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  for (const key of ABILITY_KEYS) {
    const m = text.match(new RegExp(`\\b${key.toUpperCase()}\\s*[:\\s]+(\\d{1,2})`, 'i'));
    if (m) {
      abilities[key] = parseInt(m[1], 10);
    }
  }

  const level = levelMatch ? Math.max(1, Math.min(20, parseInt(levelMatch[1], 10))) : 3;
  const hpCurrent = hpMatch ? parseInt(hpMatch[1], 10) : 30;
  const hpMax = hpMatch && hpMatch[2] ? parseInt(hpMatch[2], 10) : hpCurrent;

  const moves: Move[] = [];
  for (const line of lines) {
    const mvMatch = line.match(/^(?:[-*•]\s*)?([A-Za-z0-9\s'-]{2,28})\s*[:(]\s*([^)]+)\)?$/);
    if (mvMatch && /\d+d\d+/i.test(mvMatch[2])) {
      const diceMatch = mvMatch[2].match(/(\d+d\d+)/i);
      const typeFound = POKEMON_TYPES.find((t) =>
        new RegExp(`\\b${t}\\b`, 'i').test(mvMatch[2])
      );
      const powerFound = ABILITY_KEYS.find((k) =>
        new RegExp(`\\b${k}\\b`, 'i').test(mvMatch[2])
      );
      moves.push({
        id: createId('mv'),
        name: mvMatch[1].trim(),
        type: typeFound ?? detectedTypes[0] ?? 'Normal',
        ppCurrent: 15,
        ppMax: 15,
        movePower: powerFound ?? 'str',
        damageDice: diceMatch ? diceMatch[1] : '1d6',
        isAttack: true,
        stabEligible: true,
        range: 'Melee (5 ft)',
        castingTime: '1 Action',
        description: '',
      });
    }
  }

  const skills = createEmptySkills();
  for (const skill of ALL_SKILLS) {
    if (new RegExp(`\\b${skill}\\b`, 'i').test(text)) {
      skills[skill as SkillName] = 'proficient';
    }
  }

  return {
    id: createId('poke'),
    kind: 'pokemon',
    name: nameLine.slice(0, 32),
    species: nameLine.slice(0, 32),
    level,
    sr: srMatch ? srMatch[1] : '1',
    types: detectedTypes.length > 0 ? detectedTypes.slice(0, 2) : ['Normal'],
    nature: natureMatch ? natureMatch[1] : 'Hardy',
    ability: abilityMatch ? abilityMatch[1].trim() : 'None',
    abilityDescription: '',
    hpCurrent,
    hpMax,
    tempHp: 0,
    ac: acMatch ? parseInt(acMatch[1], 10) : 13,
    speed: speedMatch ? parseInt(speedMatch[1], 10) : 30,
    hitDice: `${level}d8`,
    abilities,
    savingThrows: createEmptySaves(),
    skills,
    moves,
    heldItem: '',
    statusCondition: 'Healthy',
    notes: 'Imported via quick statblock parser.',
  };
}
