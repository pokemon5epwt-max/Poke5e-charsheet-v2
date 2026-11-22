import { Check, Dices, Edit3, Eye, EyeOff, Heart, RotateCcw, Shield, Zap } from 'lucide-react';
import { useState } from 'react';
import { selectActiveCharacter, useCharacterStore } from '../store/useCharacterStore';
import {
  AbilityKey,
  Move,
  PokemonSheet,
  PokemonType,
  SkillName,
  SkillProficiencyLevel,
} from '../types/pokemon5e';
import {
  ABILITY_LABELS,
  POKEMON_TYPES,
  SKILL_ABILITY_MAP,
  TYPE_STYLES,
  formatSignedModifier,
  getAbilityModifier,
  getMoveAttackBonus,
  getMoveDamageBonus,
  getProficiencyBonus,
  getSavingThrowModifier,
  getSkillModifier,
  getStabValue,
  hasMoveStab,
} from '../utils/pokemon5eRules';
import { AbilityGrid } from './AbilityGrid';
import { MovesPanel } from './MovesPanel';
import {
  LeagueBadgeIcon,
  PokeballBackdrop,
} from './PokemonAccessories';
import { SkillsPanel } from './SkillsPanel';
import { TrainerBagPanel } from './TrainerBagPanel';

interface CharacterSheetProps {
  onOpenImport?: () => void;
}

export function CharacterSheet({ onOpenImport }: CharacterSheetProps) {
  const activeChar = useCharacterStore(selectActiveCharacter);
  const updateTrainer = useCharacterStore((s) => s.updateTrainer);
  const resetTrainerToBlank = useCharacterStore((s) => s.resetTrainerToBlank);
  const addTrainerItem = useCharacterStore((s) => s.addTrainerItem);
  const updateTrainerItem = useCharacterStore((s) => s.updateTrainerItem);
  const adjustTrainerItemQty = useCharacterStore((s) => s.adjustTrainerItemQty);
  const removeTrainerItem = useCharacterStore((s) => s.removeTrainerItem);
  const updatePokemon = useCharacterStore((s) => s.updatePokemon);
  const adjustHp = useCharacterStore((s) => s.adjustHp);
  const addMove = useCharacterStore((s) => s.addMove);
  const removeMove = useCharacterStore((s) => s.removeMove);
  const adjustMovePp = useCharacterStore((s) => s.adjustMovePp);
  const performRoll = useCharacterStore((s) => s.performRoll);
  const rollMode = useCharacterStore((s) => s.rollMode);
  const rollVisibility = useCharacterStore((s) => s.rollVisibility);
  const setRollMode = useCharacterStore((s) => s.setRollMode);
  const setRollVisibility = useCharacterStore((s) => s.setRollVisibility);

  const [isEditing, setIsEditing] = useState(false);
  const [hpDeltaInput, setHpDeltaInput] = useState('5');

  const isPokemon = activeChar.kind === 'pokemon';
  const profBonus = getProficiencyBonus(activeChar.level, activeChar.proficiencyOverride);
  const stabValue = isPokemon
    ? getStabValue(activeChar.level, activeChar.stabOverride)
    : 0;
  const initBonus = getAbilityModifier(activeChar.abilities.dex);

  const primaryTypeHex = isPokemon
    ? TYPE_STYLES[activeChar.types[0] ?? 'Normal'].hex
    : '#E63946';
  const secondaryTypeHex =
    isPokemon && activeChar.types[1]
      ? TYPE_STYLES[activeChar.types[1]].hex
      : primaryTypeHex;

  const hpPct =
    activeChar.hpMax > 0
      ? Math.max(0, Math.min(100, (activeChar.hpCurrent / activeChar.hpMax) * 100))
      : 0;
  const hpBarColor =
    hpPct > 50 ? 'bg-[#38D46A]' : hpPct > 20 ? 'bg-[#F8B828]' : 'bg-[#F04848]';

  const handleUpdateAbility = (key: AbilityKey, score: number) => {
    const nextAbilities = { ...activeChar.abilities, [key]: score };
    if (isPokemon) {
      updatePokemon(activeChar.id, { abilities: nextAbilities });
    } else {
      updateTrainer({ abilities: nextAbilities });
    }
  };

  const handleToggleSaveProf = (key: AbilityKey) => {
    const nextSaves = {
      ...activeChar.savingThrows,
      [key]: !activeChar.savingThrows[key],
    };
    if (isPokemon) {
      updatePokemon(activeChar.id, { savingThrows: nextSaves });
    } else {
      updateTrainer({ savingThrows: nextSaves });
    }
  };

  const handleCycleSkillProf = (skill: SkillName) => {
    const current = activeChar.skills[skill] ?? 'none';
    const next: SkillProficiencyLevel =
      current === 'none'
        ? 'proficient'
        : current === 'proficient'
          ? 'expertise'
          : 'none';
    const nextSkills = { ...activeChar.skills, [skill]: next };
    if (isPokemon) {
      updatePokemon(activeChar.id, { skills: nextSkills });
    } else {
      updateTrainer({ skills: nextSkills });
    }
  };

  const handleRollAbility = (key: AbilityKey) => {
    const mod = getAbilityModifier(activeChar.abilities[key]);
    performRoll({
      characterId: activeChar.id,
      characterName: activeChar.name,
      label: `${ABILITY_LABELS[key].full} (${ABILITY_LABELS[key].short})`,
      category: 'ability',
      modifier: mod,
      modifierParts: [`${ABILITY_LABELS[key].short}(${formatSignedModifier(mod)})`],
    });
  };

  const handleRollSave = (key: AbilityKey) => {
    const base = getAbilityModifier(activeChar.abilities[key]);
    const isProf = activeChar.savingThrows[key];
    const totalMod = getSavingThrowModifier(
      activeChar.abilities,
      activeChar.savingThrows,
      key,
      profBonus
    );
    const parts = [`${ABILITY_LABELS[key].short}(${formatSignedModifier(base)})`];
    if (isProf) parts.push(`Prof(${formatSignedModifier(profBonus)})`);

    performRoll({
      characterId: activeChar.id,
      characterName: activeChar.name,
      label: `${ABILITY_LABELS[key].full} (${ABILITY_LABELS[key].short})`,
      category: 'save',
      modifier: totalMod,
      modifierParts: parts,
    });
  };

  const handleRollSkill = (skill: SkillName) => {
    const level = activeChar.skills[skill];
    const abilityKey = SKILL_ABILITY_MAP[skill];
    const baseMod = getAbilityModifier(activeChar.abilities[abilityKey]);
    const totalMod = getSkillModifier(
      activeChar.abilities,
      activeChar.skills,
      skill,
      profBonus
    );
    const parts = [`${ABILITY_LABELS[abilityKey].short}(${formatSignedModifier(baseMod)})`];
    if (level === 'proficient') {
      parts.push(`Prof(${formatSignedModifier(profBonus)})`);
    } else if (level === 'expertise') {
      parts.push(`Exp(${formatSignedModifier(profBonus * 2)})`);
    }

    performRoll({
      characterId: activeChar.id,
      characterName: activeChar.name,
      label: `${skill} (${ABILITY_LABELS[abilityKey].short})`,
      category: 'skill',
      modifier: totalMod,
      modifierParts: parts,
    });
  };

  const handleRollInitiative = () => {
    performRoll({
      characterId: activeChar.id,
      characterName: activeChar.name,
      label: 'Initiative (DEX)',
      category: 'initiative',
      modifier: initBonus,
      modifierParts: [`DEX(${formatSignedModifier(initBonus)})`],
    });
  };

  const handleRollMoveAttack = (move: Move) => {
    if (!isPokemon) return;
    const atkBonus = getMoveAttackBonus(activeChar, move);
    const powerMod = getAbilityModifier(activeChar.abilities[move.movePower]);

    if (move.ppCurrent > 0) {
      adjustMovePp(activeChar.id, move.id, -1);
    }

    performRoll({
      characterId: activeChar.id,
      characterName: activeChar.name,
      label: `${move.name} (${move.type})`,
      category: 'attack',
      modifier: atkBonus,
      modifierParts: [
        `${ABILITY_LABELS[move.movePower].short}(${formatSignedModifier(powerMod)})`,
        `Prof(${formatSignedModifier(profBonus)})`,
      ],
      moveType: move.type,
    });
  };

  const handleRollMoveDamage = (move: Move, isCriticalDamage = false) => {
    if (!isPokemon) return;
    const { powerMod, stabBonus, totalBonus } = getMoveDamageBonus(activeChar, move);
    const parts = [
      `${ABILITY_LABELS[move.movePower].short}(${formatSignedModifier(powerMod)})`,
    ];
    if (hasMoveStab(activeChar, move) && stabBonus > 0) {
      parts.push(`STAB(+${stabBonus})`);
    }

    performRoll({
      characterId: activeChar.id,
      characterName: activeChar.name,
      label: `${move.name} (${move.type})`,
      category: 'damage',
      diceExpression: move.damageDice || '1d6',
      modifier: totalBonus,
      modifierParts: parts,
      moveType: move.type,
      isCriticalDamage,
    });
  };

  const applyCustomHpDelta = (sign: 1 | -1) => {
    const val = Math.max(1, parseInt(hpDeltaInput || '1', 10) || 1);
    adjustHp(activeChar.id, sign * val);
  };

  const togglePokemonType = (mon: PokemonSheet, targetType: PokemonType) => {
    if (mon.types.includes(targetType)) {
      if (mon.types.length > 1) {
        updatePokemon(mon.id, { types: mon.types.filter((t) => t !== targetType) });
      }
      return;
    }
    if (mon.types.length >= 2) {
      updatePokemon(mon.id, { types: [mon.types[1], targetType] });
    } else {
      updatePokemon(mon.id, { types: [...mon.types, targetType] });
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-3.5 sm:space-y-4 gba-canvas-bg">
      {/* Compact Roll Mode & Visibility Bar for Mobile & Medium Popover (< xl) */}
      <div className="xl:hidden flex items-center justify-between gap-2 pb-2 border-b-2 border-[#090D12]">
        <div className="gba-well inline-flex items-center gap-0.5 p-0.5">
          {(
            [
              { id: 'disadvantage', label: 'Disadv' },
              { id: 'normal', label: 'Normal' },
              { id: 'advantage', label: 'Adv' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRollMode(opt.id)}
              className={`px-2.5 py-1.5 sm:py-1 text-xs font-medium cursor-pointer transition-colors ${
                rollMode === opt.id
                  ? opt.id === 'advantage'
                    ? 'bg-[#267347] text-white'
                    : opt.id === 'disadvantage'
                      ? 'bg-[#A66316] text-white'
                      : 'bg-[#2A394A] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setRollVisibility(rollVisibility === 'visible' ? 'hidden' : 'visible')
          }
          className={`gba-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:py-1 text-xs font-medium cursor-pointer shrink-0 whitespace-nowrap ${
            rollVisibility === 'hidden'
              ? 'bg-[#5B328A] text-white'
              : 'bg-[#1E2833] text-slate-200 hover:bg-[#273442]'
          }`}
          title="Toggle Visible vs Hidden (GM + Roller only)"
        >
          {rollVisibility === 'hidden' ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span>GM Only</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>All &amp; GM</span>
            </>
          )}
        </button>
      </div>

      {/* GBA Summary Hero Card */}
      <section
        style={{
          backgroundImage: `linear-gradient(125deg, ${primaryTypeHex}2B 0%, ${secondaryTypeHex}14 48%, rgba(30, 40, 51, 0.96) 100%)`,
          boxShadow: `inset 2px 2px 0 ${primaryTypeHex}66, inset -2px -2px 0 #121820`,
        }}
        className="gba-panel relative overflow-hidden p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4"
      >
        <div className="absolute -right-4 -bottom-6 pointer-events-none">
          <PokeballBackdrop colorHex={primaryTypeHex} />
        </div>
        <div className="space-y-1.5 min-w-0 relative z-10">
          {isEditing ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={activeChar.name}
                onChange={(e) =>
                  isPokemon
                    ? updatePokemon(activeChar.id, { name: e.target.value })
                    : updateTrainer({ name: e.target.value })
                }
                className="gba-well font-display text-base sm:text-lg font-bold px-2.5 py-1 text-white w-full sm:w-auto"
                aria-label="Character Name"
              />
              {isPokemon && (
                <input
                  type="text"
                  value={activeChar.species}
                  onChange={(e) =>
                    updatePokemon(activeChar.id, { species: e.target.value })
                  }
                  placeholder="Species"
                  className="gba-well text-sm px-2.5 py-1.5 text-slate-100 w-full sm:w-auto"
                  aria-label="Pokémon Species"
                />
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-base sm:text-xl font-bold tracking-tight text-white drop-shadow-[1px_1px_0_#090D12]">
                {activeChar.name}
              </h1>
              {isPokemon &&
                activeChar.types.map((t) => {
                  const st = TYPE_STYLES[t];
                  return (
                    <span
                      key={t}
                      className={`px-2 py-0.5 font-mono text-[10px] font-bold uppercase border-2 border-[#090D12] ${st.bg} ${st.text}`}
                    >
                      {t}
                    </span>
                  );
                })}
            </div>
          )}

          {isPokemon ? (
            <p className="text-xs sm:text-sm text-slate-200 leading-snug">
              {activeChar.species} · Lv.{activeChar.level} · SR {activeChar.sr} ·{' '}
              {activeChar.nature} Nature · Ability: {activeChar.ability}
              {activeChar.heldItem ? ` · Held: ${activeChar.heldItem}` : ''}
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-slate-200 flex flex-wrap items-center gap-1.5 leading-snug">
              <span>
                {activeChar.trainerClass} · Lv.{activeChar.level}
              </span>
              {activeChar.origin && <span>· {activeChar.origin}</span>}
              <span className="inline-flex items-center gap-1">
                · <LeagueBadgeIcon className="w-3.5 h-3.5" /> {activeChar.badges} Badges
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto shrink-0 relative z-10">
          <button
            type="button"
            onClick={handleRollInitiative}
            className="gba-btn flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-semibold text-[#090D12] bg-[#F6C445] hover:bg-[#FBD160] cursor-pointer whitespace-nowrap"
          >
            <Dices className="w-3.5 h-3.5" />
            <span>Initiative</span>
            <span className="font-mono text-[11px]">
              {formatSignedModifier(initBonus)}
            </span>
          </button>

          {!isPokemon && isEditing && (
            <button
              type="button"
              onClick={resetTrainerToBlank}
              title="Clear Trainer sheet to blank level 1 defaults"
              className="gba-btn inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium text-slate-200 bg-[#1B242E] hover:bg-[#253240] cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Blank</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsEditing((prev) => !prev)}
            className={`gba-btn flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
              isEditing
                ? 'bg-[#267347] hover:bg-[#2E8A56] text-white'
                : 'bg-[#1E2833] hover:bg-[#283544] text-slate-100'
            }`}
          >
            {isEditing ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Done</span>
              </>
            ) : (
              <>
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Sheet</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* Edit Metadata Row */}
      {isEditing && (
        <section className="gba-panel p-4 space-y-4">
          {isPokemon ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Level</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={activeChar.level}
                    onChange={(e) =>
                      updatePokemon(activeChar.id, {
                        level: Math.max(1, Math.min(20, parseInt(e.target.value || '1', 10))),
                      })
                    }
                    className="gba-well w-full px-2.5 py-1.5 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">SR</label>
                  <input
                    type="text"
                    value={activeChar.sr}
                    onChange={(e) => updatePokemon(activeChar.id, { sr: e.target.value })}
                    className="gba-well w-full px-2.5 py-1.5 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Nature</label>
                  <input
                    type="text"
                    value={activeChar.nature}
                    onChange={(e) =>
                      updatePokemon(activeChar.id, { nature: e.target.value })
                    }
                    className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Ability</label>
                  <input
                    type="text"
                    value={activeChar.ability}
                    onChange={(e) =>
                      updatePokemon(activeChar.id, { ability: e.target.value })
                    }
                    className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Held Item</label>
                  <input
                    type="text"
                    value={activeChar.heldItem}
                    onChange={(e) =>
                      updatePokemon(activeChar.id, { heldItem: e.target.value })
                    }
                    className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Status</label>
                  <input
                    type="text"
                    value={activeChar.statusCondition}
                    onChange={(e) =>
                      updatePokemon(activeChar.id, { statusCondition: e.target.value })
                    }
                    className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1.5">
                  Types (select 1 or 2)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {POKEMON_TYPES.map((t) => {
                    const selected = activeChar.types.includes(t);
                    const st = TYPE_STYLES[t];
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => togglePokemonType(activeChar, t)}
                        className={`px-2 py-1 font-mono text-[10px] font-bold uppercase border-2 border-[#090D12] cursor-pointer ${
                          selected
                            ? `${st.bg} ${st.text}`
                            : 'bg-[#10161D] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Ability Description
                </label>
                <input
                  type="text"
                  value={activeChar.abilityDescription}
                  onChange={(e) =>
                    updatePokemon(activeChar.id, { abilityDescription: e.target.value })
                  }
                  className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Level</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={activeChar.level}
                  onChange={(e) =>
                    updateTrainer({
                      level: Math.max(1, Math.min(20, parseInt(e.target.value || '1', 10))),
                    })
                  }
                  className="gba-well w-full px-2.5 py-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Class</label>
                <input
                  type="text"
                  value={activeChar.trainerClass}
                  onChange={(e) => updateTrainer({ trainerClass: e.target.value })}
                  className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Origin</label>
                <input
                  type="text"
                  value={activeChar.origin}
                  onChange={(e) => updateTrainer({ origin: e.target.value })}
                  className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Badges</label>
                <input
                  type="number"
                  min={0}
                  value={activeChar.badges}
                  onChange={(e) =>
                    updateTrainer({ badges: Math.max(0, parseInt(e.target.value || '0', 10)) })
                  }
                  className="gba-well w-full px-2.5 py-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Money (¥)</label>
                <input
                  type="number"
                  min={0}
                  value={activeChar.money}
                  onChange={(e) =>
                    updateTrainer({ money: Math.max(0, parseInt(e.target.value || '0', 10)) })
                  }
                  className="gba-well w-full px-2.5 py-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Paths / Specs</label>
                <input
                  type="text"
                  value={activeChar.trainerPaths}
                  onChange={(e) => updateTrainer({ trainerPaths: e.target.value })}
                  className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* GBA Combat Vitals HUD (3-col balanced on mobile, 4-5 col on md/lg) */}
      <section className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {/* Hit Points with GBA Battle HP Bar */}
        <div className="col-span-3 md:col-span-2 gba-panel p-3 sm:p-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Heart className="w-3.5 h-3.5 text-[#E63946]" />
              Hit Points
            </span>
            {isEditing ? (
              <div className="flex items-center gap-1 text-xs font-mono">
                <input
                  type="number"
                  value={activeChar.hpCurrent}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value || '0', 10));
                    if (isPokemon) updatePokemon(activeChar.id, { hpCurrent: val });
                    else updateTrainer({ hpCurrent: val });
                  }}
                  className="gba-well w-14 px-1.5 py-0.5 text-right text-white"
                />
                <span className="text-slate-400">/</span>
                <input
                  type="number"
                  value={activeChar.hpMax}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value || '1', 10));
                    if (isPokemon) updatePokemon(activeChar.id, { hpMax: val });
                    else updateTrainer({ hpMax: val });
                  }}
                  className="gba-well w-14 px-1.5 py-0.5 text-right text-white"
                />
              </div>
            ) : (
              <span className="font-mono text-base font-bold text-white">
                {activeChar.hpCurrent}{' '}
                <span className="text-xs font-normal text-slate-400">
                  / {activeChar.hpMax}
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] font-bold text-[#F6C445] bg-[#0B1016] border border-[#090D12] px-1 py-0.5 leading-none">
              HP
            </span>
            <div className="flex-1 h-3 bg-[#0B1016] border-2 border-[#090D12] p-[1px]">
              <div
                className={`h-full ${hpBarColor} transition-all duration-150`}
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => applyCustomHpDelta(-1)}
              className="gba-btn flex-1 sm:flex-initial px-3 py-1.5 sm:py-1 text-xs font-semibold text-white bg-[#A62834] hover:bg-[#C2303E] cursor-pointer"
            >
              Damage
            </button>
            <input
              type="number"
              min={1}
              value={hpDeltaInput}
              onChange={(e) => setHpDeltaInput(e.target.value)}
              aria-label="HP Adjustment Amount"
              className="gba-well w-14 px-2 py-1.5 sm:py-1 text-center font-mono text-xs text-white"
            />
            <button
              type="button"
              onClick={() => applyCustomHpDelta(1)}
              className="gba-btn flex-1 sm:flex-initial px-3 py-1.5 sm:py-1 text-xs font-semibold text-white bg-[#1F6A44] hover:bg-[#278254] cursor-pointer"
            >
              Heal
            </button>
          </div>
        </div>

        {/* Armor Class */}
        <div className="col-span-1 gba-panel p-2.5 sm:p-3.5 flex flex-col justify-between">
          <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-slate-300">
            <Shield className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
            <span className="truncate">AC</span>
            <span className="hidden sm:inline">Armor</span>
          </span>
          {isEditing ? (
            <input
              type="number"
              value={activeChar.ac}
              onChange={(e) => {
                const ac = Math.max(1, parseInt(e.target.value || '10', 10));
                if (isPokemon) updatePokemon(activeChar.id, { ac });
                else updateTrainer({ ac });
              }}
              className="gba-well w-full sm:w-20 mt-2 px-2 py-1 font-mono text-base font-bold text-white"
            />
          ) : (
            <span className="font-mono text-lg sm:text-xl font-bold text-white mt-1">
              {activeChar.ac}
            </span>
          )}
        </div>

        {/* Speed */}
        <div className="col-span-1 gba-panel p-2.5 sm:p-3.5 flex flex-col justify-between">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-300">
            Speed
          </span>
          {isEditing ? (
            <input
              type="number"
              value={activeChar.speed}
              onChange={(e) => {
                const speed = Math.max(0, parseInt(e.target.value || '30', 10));
                if (isPokemon) updatePokemon(activeChar.id, { speed });
                else updateTrainer({ speed });
              }}
              className="gba-well w-full sm:w-20 mt-2 px-2 py-1 font-mono text-base font-bold text-white"
            />
          ) : (
            <span className="font-mono text-lg sm:text-xl font-bold text-white mt-1">
              {activeChar.speed}{' '}
              <span className="font-sans text-xs font-normal text-slate-400">ft</span>
            </span>
          )}
        </div>

        {/* Proficiency & STAB */}
        <div className="col-span-1 md:col-span-4 lg:col-span-1 gba-panel p-2.5 sm:p-3.5 flex flex-col justify-between">
          <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-slate-300">
            <Zap className="w-3.5 h-3.5 text-[#F6C445] shrink-0" />
            <span className="truncate">{isPokemon ? 'Prof·STAB' : 'Prof'}</span>
          </span>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2.5 mt-1">
            <span className="font-mono text-lg sm:text-xl font-bold text-white">
              +{profBonus}
            </span>
            {isPokemon && (
              <span className="font-mono text-[11px] sm:text-xs font-bold text-[#F6C445]">
                STAB +{stabValue}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Pokémon Ability Dialogue Callout */}
      {isPokemon && activeChar.abilityDescription && (
        <section className="gba-panel px-4 py-3">
          <div className="font-display text-xs font-bold text-[#F6C445]">
            ABILITY: {activeChar.ability}
          </div>
          <p className="text-sm text-slate-200 mt-1 leading-relaxed">
            {activeChar.abilityDescription}
          </p>
        </section>
      )}

      {/* Ability Scores & Saving Throws */}
      <AbilityGrid
        abilities={activeChar.abilities}
        savingThrows={activeChar.savingThrows}
        profBonus={profBonus}
        isEditing={isEditing}
        onUpdateAbility={handleUpdateAbility}
        onToggleSaveProf={handleToggleSaveProf}
        onRollAbility={handleRollAbility}
        onRollSave={handleRollSave}
      />

      {/* Moves Panel (Pokémon) or Trainer Bag & Inventory (Trainer) */}
      {isPokemon ? (
        <MovesPanel
          pokemon={activeChar}
          onRollAttack={handleRollMoveAttack}
          onRollDamage={handleRollMoveDamage}
          onAdjustPp={(moveId, delta) => adjustMovePp(activeChar.id, moveId, delta)}
          onAddMove={(mv) => addMove(activeChar.id, mv)}
          onRemoveMove={(moveId) => removeMove(activeChar.id, moveId)}
        />
      ) : (
        <TrainerBagPanel
          trainer={activeChar}
          isSheetEditing={isEditing}
          onUpdateTrainer={updateTrainer}
          onAddItem={addTrainerItem}
          onUpdateItem={updateTrainerItem}
          onAdjustQty={adjustTrainerItemQty}
          onRemoveItem={removeTrainerItem}
          onOpenImport={onOpenImport}
        />
      )}

      {/* Skills */}
      <SkillsPanel
        abilities={activeChar.abilities}
        skills={activeChar.skills}
        profBonus={profBonus}
        isEditing={isEditing}
        onCycleSkillProf={handleCycleSkillProf}
        onRollSkill={handleRollSkill}
      />

      {/* Notes */}
      <section className="gba-panel p-3.5 sm:p-4">
        <label className="block font-display text-xs font-bold text-slate-200 mb-2 uppercase">
          {isPokemon ? 'Pokémon Notes & Tactics' : 'Trainer Notes & Tactics'}
        </label>
        <textarea
          rows={3}
          value={activeChar.notes}
          onChange={(e) => {
            if (isPokemon) updatePokemon(activeChar.id, { notes: e.target.value });
            else updateTrainer({ notes: e.target.value });
          }}
          placeholder="Track battle tactics, evolution requirements, trainer paths, or session notes..."
          className="gba-well w-full px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
      </section>
    </main>
  );
}
