import { Crosshair, Flame, Minus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AbilityKey, Move, PokemonSheet, PokemonType } from '../types/pokemon5e';
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

interface MovesPanelProps {
  pokemon: PokemonSheet;
  onRollAttack: (move: Move) => void;
  onRollDamage: (move: Move, isCriticalDamage?: boolean) => void;
  onAdjustPp: (moveId: string, delta: number) => void;
  onAddMove: (move: Omit<Move, 'id'>) => void;
  onRemoveMove: (moveId: string) => void;
}

export function MovesPanel({
  pokemon,
  onRollAttack,
  onRollDamage,
  onAdjustPp,
  onAddMove,
  onRemoveMove,
}: MovesPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<PokemonType>(pokemon.types[0] ?? 'Normal');
  const [movePower, setMovePower] = useState<AbilityKey>('str');
  const [damageDice, setDamageDice] = useState('1d8');
  const [ppMax, setPpMax] = useState(15);
  const [isAttack, setIsAttack] = useState(true);
  const [saveAbility, setSaveAbility] = useState<AbilityKey>('dex');
  const [stabEligible, setStabEligible] = useState(true);
  const [range, setRange] = useState('Melee (5 ft)');
  const [castingTime, setCastingTime] = useState('1 Action');
  const [description, setDescription] = useState('');

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
      isAttack,
      saveAbility: isAttack ? undefined : saveAbility,
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
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-xs font-bold text-slate-200 uppercase">
            Battle Moves ({pokemon.moves.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Attack: Power + Prof · Damage: Power + STAB when type matches
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          className="gba-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#D62839] hover:bg-[#E63946] cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
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
                onChange={(e) => setMovePower(e.target.value as AbilityKey)}
                className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
              >
                {ABILITY_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {ABILITY_LABELS[k].short} ({ABILITY_LABELS[k].full})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Damage Dice</label>
              <input
                type="text"
                value={damageDice}
                onChange={(e) => setDamageDice(e.target.value)}
                placeholder="2d8 or empty"
                className="gba-well w-full px-2.5 py-1.5 text-xs font-mono text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
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
                value={isAttack ? 'attack' : 'save'}
                onChange={(e) => setIsAttack(e.target.value === 'attack')}
                className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
              >
                <option value="attack">Attack Roll</option>
                <option value="save">Saving Throw DC</option>
              </select>
            </div>

            {!isAttack ? (
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
            ) : (
              <label className="inline-flex items-center gap-2 text-xs text-slate-200 pb-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stabEligible}
                  onChange={(e) => setStabEligible(e.target.checked)}
                  className="border-[#090D12] bg-[#10161D] text-[#E63946]"
                />
                <span>Allow STAB</span>
              </label>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Move rules, status effects, range..."
              className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
            />
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

            return (
              <div
                key={move.id}
                className="gba-panel p-3.5 flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 font-mono text-[10px] font-bold uppercase border-2 border-[#090D12] ${typeStyle.bg} ${typeStyle.text}`}
                      >
                        {move.type}
                      </span>
                      <h4 className="font-display text-xs sm:text-sm font-bold text-white">
                        {move.name}
                      </h4>
                      <span className="text-xs text-slate-300">
                        · {ABILITY_LABELS[move.movePower].short} · {move.castingTime} · {move.range}
                        {isStab ? ' · STAB' : ''}
                      </span>
                    </div>

                    {move.description && (
                      <p className="text-sm text-slate-300 mt-1.5 leading-snug">
                        {move.description}
                      </p>
                    )}
                  </div>

                  {/* GBA Pixel PP Counter + Delete */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="gba-well flex items-center gap-1 px-2 py-1">
                      <span className="font-mono text-[10px] font-bold text-[#F6C445] mr-1">
                        PP
                      </span>
                      <button
                        type="button"
                        aria-label={`Spend 1 PP for ${move.name}`}
                        onClick={() => onAdjustPp(move.id, -1)}
                        className="w-5 h-5 inline-flex items-center justify-center hover:bg-[#263342] text-slate-200 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span
                        className={`font-mono text-[11px] font-bold px-1 ${
                          move.ppCurrent === 0 ? 'text-[#F04848]' : 'text-white'
                        }`}
                      >
                        {move.ppCurrent}/{move.ppMax}
                      </span>
                      <button
                        type="button"
                        aria-label={`Restore 1 PP for ${move.name}`}
                        onClick={() => onAdjustPp(move.id, 1)}
                        className="w-5 h-5 inline-flex items-center justify-center hover:bg-[#263342] text-slate-200 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      type="button"
                      aria-label={`Delete ${move.name}`}
                      onClick={() => onRemoveMove(move.id)}
                      className="gba-btn p-1.5 bg-[#131A22] hover:bg-[#4A1922] text-slate-400 hover:text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Battle Command Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t-2 border-[#090D12]">
                  {move.isAttack ? (
                    <button
                      type="button"
                      onClick={() => onRollAttack(move)}
                      className="gba-btn flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 py-2 sm:py-1.5 text-xs font-semibold text-white bg-[#273545] hover:bg-[#324357] cursor-pointer whitespace-nowrap"
                    >
                      <Crosshair className="w-3.5 h-3.5 text-[#F6C445]" />
                      <span>Attack</span>
                      <span className="font-mono text-[11px] text-[#F6C445]">
                        {formatSignedModifier(atkBonus)}
                      </span>
                    </button>
                  ) : (
                    <div className="gba-well flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 py-2 sm:py-1.5 text-xs font-medium text-slate-200 whitespace-nowrap">
                      <span>
                        Target {ABILITY_LABELS[move.saveAbility ?? 'dex'].short} Save
                      </span>
                      <span className="font-mono text-[11px] font-bold text-[#F6C445]">
                        DC {saveDc}
                      </span>
                    </div>
                  )}

                  {move.damageDice && (
                    <>
                      <button
                        type="button"
                        onClick={() => onRollDamage(move, false)}
                        className="gba-btn flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 py-2 sm:py-1.5 text-xs font-semibold text-white bg-[#C82838] hover:bg-[#E03546] cursor-pointer whitespace-nowrap"
                      >
                        <Flame className="w-3.5 h-3.5" />
                        <span>Damage</span>
                        <span className="font-mono text-[11px]">
                          {move.damageDice}
                          {dmgInfo.totalBonus !== 0
                            ? ` ${formatSignedModifier(dmgInfo.totalBonus)}`
                            : ''}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onRollDamage(move, true)}
                        title="Roll Critical Hit Damage (2× damage dice)"
                        className="gba-btn inline-flex items-center justify-center gap-1 px-2.5 py-2 sm:py-1.5 text-xs font-bold text-[#090D12] bg-[#F6C445] hover:bg-[#FBD160] cursor-pointer whitespace-nowrap"
                      >
                        <span>Crit 2×</span>
                      </button>
                    </>
                  )}

                  {!move.isAttack && !move.damageDice && (
                    <button
                      type="button"
                      onClick={() => onAdjustPp(move.id, -1)}
                      className="gba-btn flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium text-slate-100 bg-[#273545] hover:bg-[#324357] cursor-pointer whitespace-nowrap"
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
