import { Check, Crosshair, Edit3, Flame, Minus, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import {
  AbilityKey,
  DamageModifierType,
  Move,
  PokemonSheet,
  PokemonType,
} from '../types/pokemon5e';
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  POKEMON_TYPES,
  TYPE_STYLES,
  formatSignedModifier,
  getMoveAttackBonus,
  getMoveDamageBonus,
  getMoveSaveDc,
  hasMoveStab,
} from '../utils/pokemon5eRules';

type TargetingMode = 'attack' | 'save' | 'both' | 'auto';

interface MovesPanelProps {
  pokemon: PokemonSheet;
  onRollAttack: (move: Move) => void;
  onRollDamage: (move: Move, isCriticalDamage?: boolean) => void;
  onAdjustPp: (moveId: string, delta: number) => void;
  onAddMove: (move: Omit<Move, 'id'>) => void;
  onUpdateMove: (moveId: string, patch: Partial<Move>) => void;
  onRemoveMove: (moveId: string) => void;
}

const DAMAGE_MODIFIER_OPTIONS: Array<{
  value: DamageModifierType;
  label: string;
  badge: string;
}> = [
  { value: 'move', label: '+ MOVE (Standard)', badge: '+MOVE' },
  { value: 'none', label: 'None (No +MOVE)', badge: 'No +MOVE' },
  { value: 'level', label: '+ User Level', badge: '+Level' },
  { value: 'move+5', label: '+ MOVE + 5', badge: '+MOVE+5' },
  { value: 'move+10', label: '+ MOVE + 10', badge: '+MOVE+10' },
  { value: 'move+stab', label: '+ MOVE + Always STAB', badge: 'Always STAB' },
];

function getTargetingMode(move: Pick<Move, 'isAttack' | 'saveAbility'>): TargetingMode {
  if (move.isAttack && move.saveAbility) return 'both';
  if (move.isAttack) return 'attack';
  if (move.saveAbility) return 'save';
  return 'auto';
}

function getMovePowerShortLabel(power: AbilityKey | 'none'): string {
  return power === 'none' ? 'No MOVE' : ABILITY_LABELS[power].short;
}

function formatDamageButtonLabel(
  damageDice: string,
  totalBonus: number
): string {
  const trimmed = damageDice.trim();
  if (!trimmed) return '';
  const hasDice = /\d*d\d+/i.test(trimmed);
  if (!hasDice) {
    const flatBase = parseInt(trimmed, 10);
    if (!Number.isNaN(flatBase) && /^\d+$/.test(trimmed)) {
      return totalBonus !== 0
        ? `${flatBase} ${formatSignedModifier(totalBonus)}`
        : String(flatBase);
    }
  }
  return totalBonus !== 0
    ? `${trimmed} ${formatSignedModifier(totalBonus)}`
    : trimmed;
}

export function MovesPanel({
  pokemon,
  onRollAttack,
  onRollDamage,
  onAdjustPp,
  onAddMove,
  onUpdateMove,
  onRemoveMove,
}: MovesPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<PokemonType>(pokemon.types[0] ?? 'Normal');
  const [movePower, setMovePower] = useState<AbilityKey | 'none'>('str');
  const [damageDice, setDamageDice] = useState('1d8');
  const [damageModifierType, setDamageModifierType] =
    useState<DamageModifierType>('move');
  const [ppMax, setPpMax] = useState(15);
  const [targeting, setTargeting] = useState<TargetingMode>('attack');
  const [saveAbility, setSaveAbility] = useState<AbilityKey>('dex');
  const [stabEligible, setStabEligible] = useState(true);
  const [range, setRange] = useState('Melee (5 ft)');
  const [castingTime, setCastingTime] = useState('1 Action');
  const [description, setDescription] = useState('');

  // Inline edit state for existing moves
  const [editingMoveId, setEditingMoveId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Move>>({});

  const startEditingMove = (move: Move) => {
    setEditingMoveId(move.id);
    setEditDraft({
      name: move.name,
      type: move.type,
      ppMax: move.ppMax,
      movePower: move.movePower,
      damageDice: move.damageDice,
      damageModifierType: move.damageModifierType ?? 'move',
      isAttack: move.isAttack,
      saveAbility: move.saveAbility,
      stabEligible: move.stabEligible,
      toHitModifier: move.toHitModifier ?? 0,
      damageModifier: move.damageModifier ?? 0,
      saveDcModifier: move.saveDcModifier ?? 0,
      range: move.range,
      castingTime: move.castingTime,
      description: move.description,
    });
  };

  const saveMoveEdit = (move: Move) => {
    const nextPpMax = Math.max(1, Number(editDraft.ppMax ?? move.ppMax) || 1);
    onUpdateMove(move.id, {
      ...editDraft,
      name: (editDraft.name ?? move.name).trim() || move.name,
      damageDice: (editDraft.damageDice ?? '').trim(),
      ppMax: nextPpMax,
      ppCurrent: Math.min(move.ppCurrent, nextPpMax),
      toHitModifier: Number(editDraft.toHitModifier ?? 0) || undefined,
      damageModifier: Number(editDraft.damageModifier ?? 0) || undefined,
      saveDcModifier: Number(editDraft.saveDcModifier ?? 0) || undefined,
    });
    setEditingMoveId(null);
    setEditDraft({});
  };

  const handleCreateMove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddMove({
      name: name.trim(),
      type,
      ppCurrent: ppMax,
      ppMax,
      movePower,
      damageDice: damageDice.trim(),
      damageModifierType,
      isAttack: targeting === 'attack' || targeting === 'both',
      saveAbility:
        targeting === 'save' || targeting === 'both' ? saveAbility : undefined,
      stabEligible,
      range: range.trim() || 'Melee (5 ft)',
      castingTime: castingTime.trim() || '1 Action',
      description: description.trim(),
    });
    setName('');
    setDescription('');
    setShowAddForm(false);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-bold text-slate-100 uppercase tracking-tight">
            Battle Moves ({pokemon.moves.length})
          </h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Attack: MOVE + Prof · Save DC: 8 + MOVE + Prof · Damage: Dice + Rule + STAB (Prof)
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          className="gba-btn inline-flex items-center gap-1.5 px-3 min-h-[38px] text-xs font-semibold text-white bg-[#D62839] hover:bg-[#E63946] cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{showAddForm ? 'Cancel' : 'Add Move'}</span>
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreateMove} className="gba-panel p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Move Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Thunderbolt"
                className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PokemonType)}
                className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
              >
                {POKEMON_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Move Power</label>
              <select
                value={movePower}
                onChange={(e) => setMovePower(e.target.value as AbilityKey | 'none')}
                className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
              >
                {ABILITY_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {ABILITY_LABELS[k].short} ({ABILITY_LABELS[k].full})
                  </option>
                ))}
                <option value="none">None (No MOVE Power)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Damage Dice</label>
              <input
                type="text"
                value={damageDice}
                onChange={(e) => setDamageDice(e.target.value)}
                placeholder="2d8, 16, or empty"
                className="gba-well w-full px-2.5 py-1.5 text-xs font-mono text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Damage Mod</label>
              <select
                value={damageModifierType}
                onChange={(e) =>
                  setDamageModifierType(e.target.value as DamageModifierType)
                }
                className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
              >
                {DAMAGE_MODIFIER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Max PP</label>
              <input
                type="number"
                min={1}
                max={40}
                value={ppMax}
                onChange={(e) => setPpMax(Math.max(1, parseInt(e.target.value || '10', 10)))}
                className="gba-well w-full px-2.5 py-1.5 text-xs font-mono text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Range</label>
              <input
                type="text"
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Targeting</label>
              <select
                value={targeting}
                onChange={(e) => setTargeting(e.target.value as TargetingMode)}
                className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
              >
                <option value="attack">Attack Roll</option>
                <option value="save">Saving Throw DC</option>
                <option value="both">Attack + Save DC</option>
                <option value="auto">Auto-Hit / Utility</option>
              </select>
            </div>

            {(targeting === 'save' || targeting === 'both') && (
              <div>
                <label className="block text-xs text-slate-300 mb-1">Target Save</label>
                <select
                  value={saveAbility}
                  onChange={(e) => setSaveAbility(e.target.value as AbilityKey)}
                  className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
                >
                  {ABILITY_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {ABILITY_LABELS[k].short} Save
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label className="inline-flex items-center gap-2 text-xs text-slate-200 pb-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={stabEligible}
                onChange={(e) => setStabEligible(e.target.checked)}
                className="border-[#090D12] bg-[#10161D] text-[#E63946]"
              />
              <span>Allow STAB</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Move Time</label>
              <input
                type="text"
                value={castingTime}
                onChange={(e) => setCastingTime(e.target.value)}
                placeholder="1 Action"
                className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-300 mb-1">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Move rules, status effects, range..."
                className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              className="gba-btn px-4 py-1.5 text-xs font-semibold text-white bg-[#D62839] hover:bg-[#E63946] cursor-pointer"
            >
              Save Move
            </button>
          </div>
        </form>
      )}

      {pokemon.moves.length === 0 ? (
        <div className="gba-panel p-6 text-center">
          <p className="text-sm text-slate-300">
            No moves learned yet. Add a move to unlock one-click Attack &amp; Damage rolls.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {pokemon.moves.map((move) => {
            const typeStyle = TYPE_STYLES[move.type];
            const atkBonus = getMoveAttackBonus(pokemon, move);
            const saveDc = getMoveSaveDc(pokemon, move);
            const dmgInfo = getMoveDamageBonus(pokemon, move);
            const isStab = hasMoveStab(pokemon, move);
            const isEditingThis = editingMoveId === move.id;
            const modBadge =
              dmgInfo.modType !== 'move'
                ? DAMAGE_MODIFIER_OPTIONS.find((o) => o.value === dmgInfo.modType)?.badge
                : null;
            const hasDiceTerms = /\d*d\d+/i.test(move.damageDice);
            const dmgBtnText = formatDamageButtonLabel(
              move.damageDice,
              dmgInfo.totalBonus
            );

            return (
              <div key={move.id} className="gba-panel p-3.5 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 font-mono text-[11px] font-bold uppercase border-2 border-[#090D12] ${typeStyle.bg} ${typeStyle.text}`}
                      >
                        {move.type}
                      </span>
                      <h4 className="font-display text-sm sm:text-base font-bold text-white leading-tight">
                        {move.name}
                      </h4>
                      <span className="text-xs text-slate-300">
                        · {getMovePowerShortLabel(move.movePower)} · {move.castingTime} ·{' '}
                        {move.range}
                        {isStab ? ' · STAB' : ''}
                        {modBadge ? ` · ${modBadge}` : ''}
                        {move.isHealing ? ' · Healing' : ''}
                      </span>
                    </div>

                    {/* Quick Move Power switcher when move allows multiple stats (e.g. STR / DEX) */}
                    {!isEditingThis &&
                      move.availablePowers &&
                      move.availablePowers.length > 1 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          <span className="text-[11px] text-slate-400 mr-1">
                            Move Power:
                          </span>
                          {move.availablePowers.map((pwr) => (
                            <button
                              key={pwr}
                              type="button"
                              onClick={() => onUpdateMove(move.id, { movePower: pwr })}
                              className={`px-2 py-0.5 font-mono text-[10px] font-bold uppercase border border-[#090D12] cursor-pointer rounded-xs ${
                                move.movePower === pwr
                                  ? 'bg-[#283747] text-[#F6C445] border-[#F6C445]/60'
                                  : 'bg-[#10161D] text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {ABILITY_LABELS[pwr].short}
                            </button>
                          ))}
                        </div>
                      )}

                    {move.description && !isEditingThis && (
                      <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                        {move.description}
                      </p>
                    )}
                  </div>

                  {/* GBA Pixel PP Counter + Edit + Delete */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    <div className="gba-well flex items-center gap-1.5 px-2 py-1">
                      <span className="font-mono text-xs font-bold text-[#F6C445] mr-0.5">
                        PP
                      </span>
                      <button
                        type="button"
                        aria-label={`Spend 1 PP for ${move.name}`}
                        onClick={() => onAdjustPp(move.id, -1)}
                        className="w-7 h-7 inline-flex items-center justify-center bg-[#18212B] hover:bg-[#263342] text-slate-200 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span
                        className={`font-mono tabular-nums text-xs font-bold px-1 min-w-[42px] text-center ${
                          move.ppCurrent === 0 ? 'text-[#F04848]' : 'text-white'
                        }`}
                      >
                        {move.ppCurrent}/{move.ppMax}
                      </span>
                      <button
                        type="button"
                        aria-label={`Restore 1 PP for ${move.name}`}
                        onClick={() => onAdjustPp(move.id, 1)}
                        className="w-7 h-7 inline-flex items-center justify-center bg-[#18212B] hover:bg-[#263342] text-slate-200 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      aria-label={isEditingThis ? `Cancel editing ${move.name}` : `Edit ${move.name}`}
                      onClick={() =>
                        isEditingThis ? setEditingMoveId(null) : startEditingMove(move)
                      }
                      className={`gba-btn w-9 h-9 sm:w-8 sm:h-8 inline-flex items-center justify-center cursor-pointer ${
                        isEditingThis
                          ? 'bg-[#283747] text-[#F6C445]'
                          : 'bg-[#131A22] hover:bg-[#24303D] text-slate-300 hover:text-white'
                      }`}
                    >
                      {isEditingThis ? (
                        <X className="w-4 h-4" />
                      ) : (
                        <Edit3 className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      aria-label={`Delete ${move.name}`}
                      onClick={() => onRemoveMove(move.id)}
                      className="gba-btn w-9 h-9 sm:w-8 sm:h-8 inline-flex items-center justify-center bg-[#131A22] hover:bg-[#4A1922] text-slate-400 hover:text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Inline Move Editor */}
                {isEditingThis && (
                  <div className="gba-well p-3 space-y-3 border border-[#2B3B4E]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Name
                        </label>
                        <input
                          type="text"
                          value={editDraft.name ?? move.name}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, name: e.target.value }))
                          }
                          className="gba-well w-full px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Type
                        </label>
                        <select
                          value={editDraft.type ?? move.type}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              type: e.target.value as PokemonType,
                            }))
                          }
                          className="gba-well w-full px-2 py-1 text-xs text-white"
                        >
                          {POKEMON_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Move Power
                        </label>
                        <select
                          value={editDraft.movePower ?? move.movePower}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              movePower: e.target.value as AbilityKey | 'none',
                            }))
                          }
                          className="gba-well w-full px-2 py-1 text-xs text-white"
                        >
                          {ABILITY_KEYS.map((k) => (
                            <option key={k} value={k}>
                              {ABILITY_LABELS[k].short} ({ABILITY_LABELS[k].full})
                            </option>
                          ))}
                          <option value="none">None (No MOVE Power)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Damage Dice
                        </label>
                        <input
                          type="text"
                          value={editDraft.damageDice ?? move.damageDice}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, damageDice: e.target.value }))
                          }
                          placeholder="2d8, 16, or empty"
                          className="gba-well w-full px-2 py-1 text-xs font-mono text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 items-end">
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Damage Rule
                        </label>
                        <select
                          value={editDraft.damageModifierType ?? 'move'}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              damageModifierType: e.target.value as DamageModifierType,
                            }))
                          }
                          className="gba-well w-full px-2 py-1 text-xs text-white"
                        >
                          {DAMAGE_MODIFIER_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Targeting
                        </label>
                        <select
                          value={getTargetingMode({
                            isAttack: Boolean(editDraft.isAttack),
                            saveAbility: editDraft.saveAbility,
                          })}
                          onChange={(e) => {
                            const mode = e.target.value as TargetingMode;
                            setEditDraft((d) => ({
                              ...d,
                              isAttack: mode === 'attack' || mode === 'both',
                              saveAbility:
                                mode === 'save' || mode === 'both'
                                  ? d.saveAbility || 'dex'
                                  : undefined,
                            }));
                          }}
                          className="gba-well w-full px-2 py-1 text-xs text-white"
                        >
                          <option value="attack">Attack Roll</option>
                          <option value="save">Saving Throw</option>
                          <option value="both">Attack + Save</option>
                          <option value="auto">Auto-Hit / None</option>
                        </select>
                      </div>
                      {(editDraft.saveAbility ||
                        getTargetingMode({
                          isAttack: Boolean(editDraft.isAttack),
                          saveAbility: editDraft.saveAbility,
                        }) === 'save' ||
                        getTargetingMode({
                          isAttack: Boolean(editDraft.isAttack),
                          saveAbility: editDraft.saveAbility,
                        }) === 'both') && (
                        <div>
                          <label className="block text-[11px] text-slate-300 mb-1">
                            Save Stat
                          </label>
                          <select
                            value={editDraft.saveAbility ?? 'dex'}
                            onChange={(e) =>
                              setEditDraft((d) => ({
                                ...d,
                                saveAbility: e.target.value as AbilityKey,
                              }))
                            }
                            className="gba-well w-full px-2 py-1 text-xs text-white"
                          >
                            {ABILITY_KEYS.map((k) => (
                              <option key={k} value={k}>
                                {ABILITY_LABELS[k].short}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          To-Hit Mod
                        </label>
                        <input
                          type="number"
                          value={editDraft.toHitModifier ?? 0}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              toHitModifier: parseInt(e.target.value || '0', 10) || 0,
                            }))
                          }
                          className="gba-well w-full px-2 py-1 text-xs font-mono text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Damage Mod
                        </label>
                        <input
                          type="number"
                          value={editDraft.damageModifier ?? 0}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              damageModifier: parseInt(e.target.value || '0', 10) || 0,
                            }))
                          }
                          className="gba-well w-full px-2 py-1 text-xs font-mono text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Save DC Mod
                        </label>
                        <input
                          type="number"
                          value={editDraft.saveDcModifier ?? 0}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              saveDcModifier: parseInt(e.target.value || '0', 10) || 0,
                            }))
                          }
                          className="gba-well w-full px-2 py-1 text-xs font-mono text-white"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(editDraft.stabEligible)}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              stabEligible: e.target.checked,
                            }))
                          }
                          className="border-[#090D12] bg-[#10161D] text-[#E63946]"
                        />
                        <span>Allow STAB</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => saveMoveEdit(move)}
                        className="gba-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#267347] hover:bg-[#2E8A56] cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Apply Changes</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Battle Command Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t-2 border-[#090D12]">
                  {move.isAttack && (
                    <button
                      type="button"
                      onClick={() => onRollAttack(move)}
                      className="gba-btn flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 min-h-[40px] sm:min-h-[36px] text-xs font-semibold text-white bg-[#273545] hover:bg-[#324357] cursor-pointer whitespace-nowrap"
                    >
                      <Crosshair className="w-3.5 h-3.5 text-[#F6C445]" />
                      <span>Attack</span>
                      <span className="font-mono text-xs text-[#F6C445]">
                        {formatSignedModifier(atkBonus)}
                      </span>
                    </button>
                  )}

                  {move.saveAbility && (
                    <div className="gba-well flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 min-h-[40px] sm:min-h-[36px] text-xs font-medium text-slate-200 whitespace-nowrap">
                      <span>Target {ABILITY_LABELS[move.saveAbility].short} Save</span>
                      <span className="font-mono text-xs font-bold text-[#F6C445]">
                        DC {saveDc}
                      </span>
                    </div>
                  )}

                  {!move.isAttack && !move.saveAbility && move.damageDice && (
                    <div className="gba-well inline-flex items-center justify-center px-3 min-h-[40px] sm:min-h-[36px] text-xs font-medium text-slate-200 whitespace-nowrap">
                      <span>Auto-Hit</span>
                    </div>
                  )}

                  {move.damageDice && (
                    <>
                      <button
                        type="button"
                        onClick={() => onRollDamage(move, false)}
                        className="gba-btn flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 min-h-[40px] sm:min-h-[36px] text-xs font-semibold text-white bg-[#C82838] hover:bg-[#E03546] cursor-pointer whitespace-nowrap"
                      >
                        <Flame className="w-3.5 h-3.5" />
                        <span>{move.isHealing ? 'Heal' : 'Damage'}</span>
                        <span className="font-mono text-xs">{dmgBtnText}</span>
                      </button>

                      {hasDiceTerms && !move.isHealing && (
                        <button
                          type="button"
                          onClick={() => onRollDamage(move, true)}
                          title="Roll Critical Hit Damage (2× damage dice)"
                          className="gba-btn inline-flex items-center justify-center gap-1 px-3 min-h-[40px] sm:min-h-[36px] text-xs font-bold text-[#090D12] bg-[#F6C445] hover:bg-[#FBD160] cursor-pointer whitespace-nowrap"
                        >
                          <span>Crit 2×</span>
                        </button>
                      )}
                    </>
                  )}

                  {!move.isAttack && !move.damageDice && (
                    <button
                      type="button"
                      onClick={() => onAdjustPp(move.id, -1)}
                      className="gba-btn flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] sm:min-h-[36px] text-xs font-medium text-slate-100 bg-[#273545] hover:bg-[#324357] cursor-pointer whitespace-nowrap"
                    >
                      <span>Use Move (-1 PP)</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
