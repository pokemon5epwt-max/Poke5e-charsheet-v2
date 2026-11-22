export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export type PokemonType =
  | 'Normal'
  | 'Fire'
  | 'Water'
  | 'Electric'
  | 'Grass'
  | 'Ice'
  | 'Fighting'
  | 'Poison'
  | 'Ground'
  | 'Flying'
  | 'Psychic'
  | 'Bug'
  | 'Rock'
  | 'Ghost'
  | 'Dragon'
  | 'Dark'
  | 'Steel'
  | 'Fairy';

export type SkillName =
  | 'Acrobatics'
  | 'Animal Handling'
  | 'Arcana'
  | 'Athletics'
  | 'Deception'
  | 'History'
  | 'Insight'
  | 'Intimidation'
  | 'Investigation'
  | 'Medicine'
  | 'Nature'
  | 'Perception'
  | 'Performance'
  | 'Persuasion'
  | 'Religion'
  | 'Sleight of Hand'
  | 'Stealth'
  | 'Survival';

export type SkillProficiencyLevel = 'none' | 'proficient' | 'expertise';

export type AbilityScores = Record<AbilityKey, number>;

export type SavingThrowProficiencies = Record<AbilityKey, boolean>;

export type SkillProficiencies = Record<SkillName, SkillProficiencyLevel>;

export interface Move {
  id: string;
  name: string;
  type: PokemonType;
  ppCurrent: number;
  ppMax: number;
  /** Primary ability used for Attack Roll and Damage Modifier (Move Power) */
  movePower: AbilityKey;
  /** Dice expression such as "1d8", "2d6", "1d10", or "" for non-damaging moves */
  damageDice: string;
  /** Whether the move makes an attack roll (d20 + Move Power mod + Proficiency) */
  isAttack: boolean;
  /** Optional Save DC ability if the move forces a saving throw instead of attack roll */
  saveAbility?: AbilityKey;
  /** Whether STAB bonus applies to damage when move type matches Pokémon type */
  stabEligible: boolean;
  range: string;
  castingTime: string;
  description: string;
}

export interface PokemonSheet {
  id: string;
  kind: 'pokemon';
  name: string;
  species: string;
  level: number;
  sr: string;
  types: PokemonType[];
  nature: string;
  ability: string;
  abilityDescription: string;
  hpCurrent: number;
  hpMax: number;
  tempHp: number;
  ac: number;
  speed: number;
  hitDice: string;
  /** Optional custom STAB override; if undefined, computed from Pokémon 5e level table */
  stabOverride?: number;
  /** Optional custom Proficiency override; if undefined, computed from 5e level table */
  proficiencyOverride?: number;
  abilities: AbilityScores;
  savingThrows: SavingThrowProficiencies;
  skills: SkillProficiencies;
  moves: Move[];
  heldItem: string;
  statusCondition: string;
  notes: string;
}

export type TrainerItemCategory =
  | 'pokeballs'
  | 'medicine'
  | 'held'
  | 'key'
  | 'gear';

export interface TrainerItem {
  id: string;
  name: string;
  category: TrainerItemCategory;
  quantity: number;
  description?: string;
  /** Remote row id in poke5e.app private.inventory_items */
  poke5eId?: number;
  /** Standard catalog item_id in poke5e.app (null if custom item) */
  poke5eItemId?: string | null;
  /** Remote sort order rank in poke5e.app */
  poke5eRank?: number;
}

export interface TrainerSheet {
  id: 'trainer';
  kind: 'trainer';
  name: string;
  level: number;
  trainerClass: string;
  origin: string;
  hpCurrent: number;
  hpMax: number;
  tempHp: number;
  ac: number;
  speed: number;
  hitDice: string;
  proficiencyOverride?: number;
  abilities: AbilityScores;
  savingThrows: SavingThrowProficiencies;
  skills: SkillProficiencies;
  pokeballs: {
    pokeBall: number;
    greatBall: number;
    ultraBall: number;
    other: string;
  };
  items?: TrainerItem[];
  money: number;
  badges: number;
  trainerPaths: string;
  notes: string;
  poke5eMeta?: {
    trainerId: string;
    readKey?: string;
    accessKey?: string;
    importedAt: string;
    bagSyncedAt?: string;
  };
}

export type ActiveCharacter = TrainerSheet | PokemonSheet;

export interface PartyWorkspace {
  trainer: TrainerSheet;
  pokemon: PokemonSheet[];
}

export type RollMode = 'normal' | 'advantage' | 'disadvantage';

export type RollVisibility = 'visible' | 'hidden';

export type DiceIntegrationMode = 'internal' | 'obr-dice-plus';

export type RollCategory =
  | 'ability'
  | 'save'
  | 'skill'
  | 'attack'
  | 'damage'
  | 'initiative'
  | 'custom';

export interface DieChip {
  sides: number;
  value: number;
  kept: boolean;
  exploded?: boolean;
  rerolled?: boolean;
  originalValue?: number;
}

export interface RollEntry {
  id: string;
  timestamp: string;
  rollerName: string;
  ownerId: string;
  characterId: string;
  characterName: string;
  label: string;
  category: RollCategory;
  rollMode: RollMode;
  visibility: RollVisibility;
  formula: string;
  diceRolls: number[];
  dieChips?: DieChip[];
  selectedDie?: number;
  total: number;
  breakdown: string;
  isCrit: boolean;
  isFumble: boolean;
  moveType?: PokemonType;
  dexMod?: number;
  source: 'local' | 'obr-remote';
}

export interface InitiativeEntry {
  id: string;
  characterId: string;
  characterName: string;
  playerName: string;
  ownerId: string;
  initiative: number;
  dexMod: number;
  breakdown: string;
  visibility: RollVisibility;
  hpText?: string;
  ac?: number;
  isNpc?: boolean;
  updatedAt: string;
}

export interface InitiativeSyncState {
  entries: InitiativeEntry[];
  turnIndex: number;
  round: number;
  updatedAt: string;
}

export interface ObrState {
  isAvailable: boolean;
  isReady: boolean;
  playerId: string;
  playerName: string;
  role: 'GM' | 'PLAYER';
  partyCount: number;
}

export interface Poke5eFileEntry {
  id?: string;
  trainerId?: string;
  readKey?: string;
  accessKey?: string;
  name?: string;
}

export interface Poke5eImportResult {
  success: boolean;
  tier: 'link-fetch' | 'auto-fetch' | 'json-parse' | 'manual-map';
  message: string;
  warnings: string[];
  workspace?: PartyWorkspace;
  extractedKeys?: Poke5eFileEntry[];
}

export interface SavedTrainerProfile {
  id: string;
  trainerName: string;
  trainerLevel: number;
  trainerClass: string;
  pokemonCount: number;
  pokemonSummary: string;
  source: 'link' | 'file' | 'json';
  readKey?: string;
  accessKey?: string;
  trainerId?: string;
  lastImportedAt: string;
  workspace: PartyWorkspace;
}
