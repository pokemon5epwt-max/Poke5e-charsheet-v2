import { Dices, ShieldCheck } from 'lucide-react';
import { AbilityKey, AbilityScores, SavingThrowProficiencies } from '../types/pokemon5e';
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  formatSignedModifier,
  getAbilityModifier,
  getSavingThrowModifier,
} from '../utils/pokemon5eRules';

interface AbilityGridProps {
  abilities: AbilityScores;
  savingThrows: SavingThrowProficiencies;
  profBonus: number;
  isEditing: boolean;
  onUpdateAbility: (key: AbilityKey, score: number) => void;
  onToggleSaveProf: (key: AbilityKey) => void;
  onRollAbility: (key: AbilityKey) => void;
  onRollSave: (key: AbilityKey) => void;
}

export function AbilityGrid({
  abilities,
  savingThrows,
  profBonus,
  isEditing,
  onUpdateAbility,
  onToggleSaveProf,
  onRollAbility,
  onRollSave,
}: AbilityGridProps) {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2.5">
        <h3 className="font-display text-sm font-bold text-slate-100 uppercase tracking-wide">
          Stats &amp; Saving Throws
        </h3>
        <span className="text-xs text-slate-400">Tap Check or Save to roll</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {ABILITY_KEYS.map((key) => {
          const score = abilities[key];
          const mod = getAbilityModifier(score);
          const saveMod = getSavingThrowModifier(abilities, savingThrows, key, profBonus);
          const isProficientSave = savingThrows[key];
          const label = ABILITY_LABELS[key];

          return (
            <div
              key={key}
              className="gba-panel p-2.5 sm:p-3 flex flex-col justify-between gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-xs font-bold text-[#F6C445]">
                  {label.short}
                </span>
                {isEditing ? (
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={score}
                    onChange={(e) =>
                      onUpdateAbility(
                        key,
                        Math.max(1, Math.min(30, parseInt(e.target.value || '10', 10)))
                      )
                    }
                    className="gba-well w-14 px-2 py-1 text-right font-mono text-xs text-white"
                    aria-label={`${label.full} score`}
                  />
                ) : (
                  <span className="font-mono text-xs font-semibold text-slate-300">
                    ({score})
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => onRollAbility(key)}
                className="gba-btn w-full py-2.5 px-2 bg-[#131A22] hover:bg-[#263444] flex flex-col items-center justify-center gap-0.5 cursor-pointer group"
                title={`Roll ${label.full} Check (${formatSignedModifier(mod)})`}
              >
                <span className="font-mono text-xl font-bold text-white leading-tight">
                  {formatSignedModifier(mod)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 group-hover:text-[#F6C445]">
                  <Dices className="w-3.5 h-3.5" />
                  <span>Check</span>
                </span>
              </button>

              <div className="flex items-center gap-1.5">
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => onToggleSaveProf(key)}
                    title="Toggle Saving Throw Proficiency"
                    className={`gba-btn min-h-[38px] min-w-[38px] flex items-center justify-center text-xs cursor-pointer ${
                      isProficientSave
                        ? 'bg-[#1F6A44] text-white'
                        : 'bg-[#10161D] text-slate-400'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRollSave(key)}
                  className={`gba-btn flex-1 min-h-[38px] sm:min-h-[34px] px-2.5 text-xs font-semibold flex items-center justify-between cursor-pointer ${
                    isProficientSave
                      ? 'bg-[#1A4D34] hover:bg-[#226243] text-emerald-100'
                      : 'bg-[#141B23] hover:bg-[#1E2833] text-slate-200'
                  }`}
                  title={`Roll ${label.full} Saving Throw`}
                >
                  <span>Save</span>
                  <span className="font-mono text-xs font-bold">
                    {formatSignedModifier(saveMod)}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
