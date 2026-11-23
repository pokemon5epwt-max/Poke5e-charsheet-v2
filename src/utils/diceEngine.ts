import {
  DieChip,
  PokemonType,
  RollCategory,
  RollEntry,
  RollMode,
  RollVisibility,
} from '../types/pokemon5e';
import { createId, formatSignedModifier } from './pokemon5eRules';

export interface RollRequest {
  characterId: string;
  characterName: string;
  label: string;
  category: RollCategory;
  rollMode: RollMode;
  visibility: RollVisibility;
  rollerName: string;
  ownerId: string;
  /** Dice expression for damage or custom rolls (e.g. "2d8", "4d6kh3 + 2", "2d6!r1") */
  diceExpression?: string;
  /** Flat modifier applied to roll */
  modifier?: number;
  /** Optional itemized breakdown parts e.g. ["DEX(+4)", "Prof(+3)"] */
  modifierParts?: string[];
  moveType?: PokemonType;
  /** Double dice count on damage roll for 5e Critical Hits */
  isCriticalDamage?: boolean;
}

/**
 * Cryptographically uniform die roll in [1, sides] using rejection sampling
 * to eliminate modulo bias (WitchDice / WebCrypto standard).
 */
function rollSingleDie(sides: number): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const maxUnbiased = Math.floor(0x100000000 / sides) * sides;
    const arr = new Uint32Array(1);
    let rand = 0;
    do {
      crypto.getRandomValues(arr);
      rand = arr[0];
    } while (rand >= maxUnbiased);
    return (rand % sides) + 1;
  }
  return Math.floor(Math.random() * sides) + 1;
}

export type KeepDropMode = 'kh' | 'kl' | 'dh' | 'dl';
export type ComparisonOp = '<=' | '>=' | '=';

export interface RerollRule {
  once: boolean;
  op: ComparisonOp;
  target: number;
}

export interface ExplodeRule {
  op: ComparisonOp;
  target: number;
}

export interface ParsedDiceTerm {
  sign: 1 | -1;
  count: number;
  sides: number;
  multiplier: number;
  reroll?: RerollRule;
  explode?: ExplodeRule;
  keepDrop?: {
    mode: KeepDropMode;
    amount: number;
  };
  modifierText: string;
}

export interface ParsedDiceExpression {
  isValid: boolean;
  terms: ParsedDiceTerm[];
  flatBonus: number;
  inlineRollMode?: RollMode;
  error?: string;
}

function matchesCondition(value: number, op: ComparisonOp, target: number): boolean {
  if (op === '<=') return value <= target;
  if (op === '>=') return value >= target;
  return value === target;
}

function parseDiceModifiers(
  tail: string,
  count: number,
  sides: number
): {
  valid: boolean;
  reroll?: RerollRule;
  explode?: ExplodeRule;
  keepDrop?: ParsedDiceTerm['keepDrop'];
  multiplier: number;
  error?: string;
} {
  let cursor = 0;
  let reroll: RerollRule | undefined;
  let explode: ExplodeRule | undefined;
  let keepDrop: ParsedDiceTerm['keepDrop'];
  let multiplier = 1;

  const modRegex =
    /(ro|r)(<=|>=|=)?(\d+)?|!(<=|>=|=)?(\d+)?|(kh|kl|dh|dl|k|d)(\d+)|\*(\d+)/y;

  while (cursor < tail.length) {
    modRegex.lastIndex = cursor;
    const match = modRegex.exec(tail);
    if (!match) {
      return {
        valid: false,
        multiplier: 1,
        error: `Unsupported modifier "${tail.slice(cursor)}"`,
      };
    }

    if (match[1]) {
      // Reroll: r / ro
      const once = match[1] === 'ro';
      const op: ComparisonOp = (match[2] as ComparisonOp) || (match[3] ? '<=' : '=');
      const target = match[3] ? parseInt(match[3], 10) : 1;
      if (target >= sides && !once) {
        return {
          valid: false,
          multiplier: 1,
          error: `Reroll target (${target}) cannot equal or exceed d${sides}`,
        };
      }
      reroll = { once, op, target: Math.max(1, Math.min(sides, target)) };
    } else if (match[0].startsWith('!')) {
      // Explode: !
      const op: ComparisonOp = (match[4] as ComparisonOp) || (match[5] ? '>=' : '=');
      const target = match[5] ? parseInt(match[5], 10) : sides;
      if (target <= 1 && op === '>=') {
        return {
          valid: false,
          multiplier: 1,
          error: `Explode threshold (>=${target}) would loop infinitely`,
        };
      }
      explode = { op, target: Math.max(2, Math.min(sides, target)) };
    } else if (match[6] && match[7]) {
      // Keep / Drop: kh, k, kl, dh, dl, d
      const rawMode = match[6];
      const normalizedMode: KeepDropMode =
        rawMode === 'k' ? 'kh' : rawMode === 'd' ? 'dl' : (rawMode as KeepDropMode);
      const amount = Math.max(1, Math.min(count, parseInt(match[7], 10)));
      keepDrop = { mode: normalizedMode, amount };
    } else if (match[8]) {
      multiplier = Math.max(1, Math.min(20, parseInt(match[8], 10)));
    }

    cursor = modRegex.lastIndex;
  }

  return { valid: true, reroll, explode, keepDrop, multiplier };
}

export function parseDiceExpression(expr: string): ParsedDiceExpression {
  let working = expr.trim().toLowerCase();
  if (!working) {
    return { isValid: false, terms: [], flatBonus: 0, error: 'Empty dice formula' };
  }

  // WitchDice-style shorthand mode keywords at end/anywhere in formula
  let inlineRollMode: RollMode | undefined;
  if (/\b(adv|advantage)\b/.test(working)) {
    inlineRollMode = 'advantage';
    working = working.replace(/\b(adv|advantage)\b/g, '');
  } else if (/\b(dis|disadv|disadvantage)\b/.test(working)) {
    inlineRollMode = 'disadvantage';
    working = working.replace(/\b(dis|disadv|disadvantage)\b/g, '');
  }

  const cleaned = working.replace(/\s+/g, '');
  if (!cleaned) {
    return { isValid: false, terms: [], flatBonus: 0, error: 'Empty dice formula' };
  }

  // Tokenize signed terms without splitting comparison operators <=, >=
  const rawTokens = cleaned.match(/[+-]?[^+-]+/g);
  if (!rawTokens || rawTokens.join('') !== cleaned) {
    return { isValid: false, terms: [], flatBonus: 0, error: 'Invalid dice syntax' };
  }

  const terms: ParsedDiceTerm[] = [];
  let flatBonus = 0;

  for (const token of rawTokens) {
    const sign: 1 | -1 = token.startsWith('-') ? -1 : 1;
    const body = token.replace(/^[+-]/, '');
    if (!body) {
      return { isValid: false, terms: [], flatBonus: 0, error: 'Trailing operator' };
    }

    const diceMatch = body.match(/^(\d*)d(\d+|%)(.*)$/);
    if (diceMatch) {
      const count = Math.min(50, Math.max(1, parseInt(diceMatch[1] || '1', 10)));
      const sides =
        diceMatch[2] === '%' ? 100 : Math.min(1000, Math.max(2, parseInt(diceMatch[2], 10)));
      const modifierText = diceMatch[3] || '';
      const parsedMods = parseDiceModifiers(modifierText, count, sides);
      if (!parsedMods.valid) {
        return {
          isValid: false,
          terms: [],
          flatBonus: 0,
          error: parsedMods.error,
        };
      }
      terms.push({
        sign,
        count,
        sides,
        multiplier: parsedMods.multiplier,
        reroll: parsedMods.reroll,
        explode: parsedMods.explode,
        keepDrop: parsedMods.keepDrop,
        modifierText,
      });
    } else if (/^\d+$/.test(body)) {
      flatBonus += sign * parseInt(body, 10);
    } else {
      return {
        isValid: false,
        terms: [],
        flatBonus: 0,
        error: `Unrecognized term "${body}"`,
      };
    }
  }

  return { isValid: true, terms, flatBonus, inlineRollMode };
}

function evaluateDiceTerm(
  term: ParsedDiceTerm,
  doubleCount = false
): {
  sum: number;
  allRolls: number[];
  chips: DieChip[];
  label: string;
} {
  const effectiveCount = doubleCount ? Math.min(100, term.count * 2) : term.count;
  const chips: DieChip[] = [];

  const rollWithReroll = (): { value: number; rerolled: boolean; originalValue?: number } => {
    const first = rollSingleDie(term.sides);
    if (!term.reroll) {
      return { value: first, rerolled: false };
    }

    let current = first;
    let rerolled = false;
    let tries = 0;
    const maxTries = term.reroll.once ? 1 : 20;

    while (
      tries < maxTries &&
      matchesCondition(current, term.reroll.op, term.reroll.target)
    ) {
      rerolled = true;
      current = rollSingleDie(term.sides);
      tries += 1;
    }

    return {
      value: current,
      rerolled,
      originalValue: rerolled ? first : undefined,
    };
  };

  // 1. Initial dice + rerolls + explosions (WitchDice order of operations)
  for (let i = 0; i < effectiveCount; i++) {
    const initial = rollWithReroll();
    chips.push({
      sides: term.sides,
      value: initial.value,
      kept: true,
      rerolled: initial.rerolled || undefined,
      originalValue: initial.originalValue,
    });

    if (term.explode) {
      let currentVal = initial.value;
      let explosions = 0;
      while (
        explosions < 25 &&
        matchesCondition(currentVal, term.explode.op, term.explode.target)
      ) {
        const extra = rollWithReroll();
        chips.push({
          sides: term.sides,
          value: extra.value,
          kept: true,
          exploded: true,
          rerolled: extra.rerolled || undefined,
          originalValue: extra.originalValue,
        });
        currentVal = extra.value;
        explosions += 1;
      }
    }
  }

  // 2. Keep / Drop filtering across all generated dice in this term
  if (term.keepDrop) {
    const sortedWithIndex = chips
      .map((chip, idx) => ({ val: chip.value, idx }))
      .sort((a, b) => a.val - b.val);

    const { mode, amount } = term.keepDrop;
    const boundedAmount = Math.min(amount, chips.length);
    let keepIndices: Set<number>;

    if (mode === 'kh') {
      keepIndices = new Set(sortedWithIndex.slice(-boundedAmount).map((x) => x.idx));
    } else if (mode === 'kl') {
      keepIndices = new Set(sortedWithIndex.slice(0, boundedAmount).map((x) => x.idx));
    } else if (mode === 'dh') {
      keepIndices = new Set(
        sortedWithIndex.slice(0, Math.max(0, chips.length - boundedAmount)).map((x) => x.idx)
      );
    } else {
      // dl (drop lowest)
      keepIndices = new Set(sortedWithIndex.slice(boundedAmount).map((x) => x.idx));
    }

    chips.forEach((chip, idx) => {
      chip.kept = keepIndices.has(idx);
    });
  }

  const keptValues = chips.filter((c) => c.kept).map((c) => c.value);
  const allRolls = chips.map((c) => c.value);
  const rawSum = keptValues.reduce((acc, v) => acc + v, 0) * term.multiplier;

  const formattedDice = chips
    .map((c) => {
      const base = `${c.value}${c.exploded ? '!' : ''}${c.rerolled ? 'r' : ''}`;
      return c.kept ? base : `~${base}~`;
    })
    .join(', ');

  const multSuffix = term.multiplier > 1 ? `×${term.multiplier}` : '';
  return {
    sum: term.sign * rawSum,
    allRolls,
    chips,
    label: `${effectiveCount}d${term.sides}${term.modifierText}(${formattedDice})${multSuffix}`,
  };
}

function joinSignedSegments(segments: Array<{ sign: 1 | -1; text: string }>): string {
  return segments
    .map((seg, idx) => {
      if (idx === 0) {
        return seg.sign === -1 ? `-${seg.text}` : seg.text;
      }
      return seg.sign === -1 ? `- ${seg.text}` : `+ ${seg.text}`;
    })
    .join(' ');
}

export function executeRoll(req: RollRequest): RollEntry {
  const timestamp = new Date().toISOString();
  const baseMod = req.modifier ?? 0;
  const parts = req.modifierParts ? [...req.modifierParts] : [];

  const parsedCustom =
    req.category === 'custom'
      ? parseDiceExpression((req.diceExpression || '1d20').trim())
      : null;

  const isPlainSingleD20Custom =
    Boolean(parsedCustom?.isValid) &&
    parsedCustom!.terms.length === 1 &&
    parsedCustom!.terms[0].sign === 1 &&
    parsedCustom!.terms[0].count === 1 &&
    parsedCustom!.terms[0].sides === 20 &&
    parsedCustom!.terms[0].multiplier === 1 &&
    !parsedCustom!.terms[0].keepDrop &&
    !parsedCustom!.terms[0].reroll &&
    !parsedCustom!.terms[0].explode;

  const effectiveRollMode: RollMode = parsedCustom?.inlineRollMode ?? req.rollMode;

  // D20 checks (Ability, Save, Skill, Attack, Initiative, or plain 1d20 Custom)
  if ((req.category !== 'damage' && req.category !== 'custom') || isPlainSingleD20Custom) {
    const effectiveMod = isPlainSingleD20Custom
      ? baseMod + parsedCustom!.flatBonus
      : baseMod;

    const d1 = rollSingleDie(20);
    const d2 = effectiveRollMode === 'normal' ? null : rollSingleDie(20);
    const diceRolls = d2 !== null ? [d1, d2] : [d1];
    const selectedDie =
      d2 === null
        ? d1
        : effectiveRollMode === 'advantage'
          ? Math.max(d1, d2)
          : Math.min(d1, d2);

    const dieChips: DieChip[] =
      d2 === null
        ? [{ sides: 20, value: d1, kept: true }]
        : [
            { sides: 20, value: d1, kept: d1 === selectedDie },
            { sides: 20, value: d2, kept: d2 === selectedDie && d1 !== selectedDie ? true : d2 === selectedDie && d1 !== d2 },
          ];

    // Ensure exactly one kept chip when both d20s roll identical values
    if (d2 !== null && d1 === d2) {
      dieChips[0].kept = true;
      dieChips[1].kept = false;
    }

    const total = selectedDie + effectiveMod;
    const isCrit = selectedDie === 20;
    const isFumble = selectedDie === 1;

    const dieText =
      d2 === null
        ? `d20(${d1})`
        : `2d20${effectiveRollMode === 'advantage' ? 'kh1' : 'kl1'}(${d1}, ${d2} → ${selectedDie})`;

    const segments: Array<{ sign: 1 | -1; text: string }> = [
      { sign: 1, text: dieText },
    ];

    if (parts.length > 0) {
      for (const p of parts) {
        segments.push({ sign: 1, text: p });
      }
    } else if (effectiveMod !== 0) {
      segments.push({
        sign: effectiveMod < 0 ? -1 : 1,
        text: String(Math.abs(effectiveMod)),
      });
    }

    const breakdown = `${joinSignedSegments(segments)} = ${total}`;
    const formula = `${
      effectiveRollMode === 'normal'
        ? '1d20'
        : effectiveRollMode === 'advantage'
          ? '2d20kh1'
          : '2d20kl1'
    }${effectiveMod !== 0 ? ` ${formatSignedModifier(effectiveMod)}` : ''}`;

    return {
      id: createId('roll'),
      timestamp,
      rollerName: req.rollerName,
      ownerId: req.ownerId,
      characterId: req.characterId,
      characterName: req.characterName,
      label: req.label,
      category: req.category,
      rollMode: effectiveRollMode,
      visibility: req.visibility,
      formula,
      diceRolls,
      dieChips,
      selectedDie,
      total,
      breakdown,
      isCrit,
      isFumble,
      moveType: req.moveType,
      dexMod: req.category === 'initiative' ? effectiveMod : undefined,
      source: 'local',
    };
  }

  // Damage or WitchDice-syntax Custom expression roll
  const expr = (req.diceExpression || '1d6').trim();
  const parsed = parsedCustom ?? parseDiceExpression(expr);

  if (!parsed.isValid) {
    return {
      id: createId('roll'),
      timestamp,
      rollerName: req.rollerName,
      ownerId: req.ownerId,
      characterId: req.characterId,
      characterName: req.characterName,
      label: req.label,
      category: req.category,
      rollMode: 'normal',
      visibility: req.visibility,
      formula: expr,
      diceRolls: [],
      dieChips: [],
      total: 0,
      breakdown: `Invalid formula (${parsed.error ?? 'check syntax'})`,
      isCrit: false,
      isFumble: false,
      moveType: req.moveType,
      source: 'local',
    };
  }

  const diceRolls: number[] = [];
  const dieChips: DieChip[] = [];
  const segments: Array<{ sign: 1 | -1; text: string }> = [];
  let diceSum = 0;

  for (const term of parsed.terms) {
    const doubleDice = Boolean(req.isCriticalDamage && term.sign === 1);
    const evaluated = evaluateDiceTerm(term, doubleDice);
    diceRolls.push(...evaluated.allRolls);
    dieChips.push(...evaluated.chips);
    diceSum += evaluated.sum;
    segments.push({ sign: term.sign, text: evaluated.label });
  }

  if (parsed.flatBonus !== 0) {
    segments.push({
      sign: parsed.flatBonus < 0 ? -1 : 1,
      text: String(Math.abs(parsed.flatBonus)),
    });
  }

  if (parts.length > 0) {
    for (const p of parts) {
      segments.push({ sign: 1, text: p });
    }
  } else if (baseMod !== 0) {
    segments.push({
      sign: baseMod < 0 ? -1 : 1,
      text: String(Math.abs(baseMod)),
    });
  }

  const combinedMod = baseMod + parsed.flatBonus;
  const rawTotal = diceSum + combinedMod;
  const total = req.category === 'damage' ? Math.max(0, rawTotal) : rawTotal;
  const breakdown = `${joinSignedSegments(segments)} = ${total}`;

  const hasDiceTerms = parsed.terms.length > 0;
  const formulaParts = parsed.terms.map((t, i) => {
    const count = req.isCriticalDamage && t.sign === 1 ? t.count * 2 : t.count;
    const prefix = i === 0 ? (t.sign === -1 ? '-' : '') : t.sign === -1 ? '- ' : '+ ';
    return `${prefix}${count}d${t.sides}${t.modifierText}`;
  });
  if (combinedMod !== 0 || formulaParts.length === 0) {
    if (formulaParts.length === 0) {
      formulaParts.push(String(combinedMod));
    } else {
      formulaParts.push(
        combinedMod < 0 ? `- ${Math.abs(combinedMod)}` : `+ ${combinedMod}`
      );
    }
  }
  const formula = formulaParts.join(' ');

  // Detect nat 20 / nat 1 when a custom roll contains a single kept d20
  const keptD20s = dieChips.filter((c) => c.kept && c.sides === 20);
  const singleKeptD20 = keptD20s.length === 1 ? keptD20s[0].value : undefined;
  const appliedCrit = Boolean(req.isCriticalDamage && hasDiceTerms);

  return {
    id: createId('roll'),
    timestamp,
    rollerName: req.rollerName,
    ownerId: req.ownerId,
    characterId: req.characterId,
    characterName: req.characterName,
    label: appliedCrit ? `${req.label} (CRIT 2×)` : req.label,
    category: req.category,
    rollMode: 'normal',
    visibility: req.visibility,
    formula,
    diceRolls,
    dieChips,
    selectedDie: singleKeptD20,
    total,
    breakdown,
    isCrit: appliedCrit || singleKeptD20 === 20,
    isFumble: singleKeptD20 === 1,
    moveType: req.moveType,
    source: 'local',
  };
}
