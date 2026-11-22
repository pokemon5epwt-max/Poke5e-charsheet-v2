import { Minus, Plus, Shield, Sparkles, Trash2, User } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useCharacterStore } from '../store/useCharacterStore';
import { TYPE_STYLES } from '../utils/pokemon5eRules';
import { LeagueBadgeIcon, PixelCursor, PokeballIcon } from './PokemonAccessories';

interface PartySidebarProps {
  onOpenAddPokemon: () => void;
  onSelectCallback?: () => void;
}

function getGbaHpBarColor(hpPct: number): string {
  if (hpPct > 50) return 'bg-[#38D46A]';
  if (hpPct > 20) return 'bg-[#F8B828]';
  return 'bg-[#F04848]';
}

export function PartySidebar({
  onOpenAddPokemon,
  onSelectCallback,
}: PartySidebarProps) {
  const party = useCharacterStore((s) => s.party);
  const activeCharacterId = useCharacterStore((s) => s.activeCharacterId);
  const setActiveCharacter = useCharacterStore((s) => s.setActiveCharacter);
  const adjustHp = useCharacterStore((s) => s.adjustHp);
  const removePokemon = useCharacterStore((s) => s.removePokemon);
  const longRestParty = useCharacterStore((s) => s.longRestParty);
  const beltRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = beltRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [party.pokemon.length]);

  const selectCharacter = (id: 'trainer' | string) => {
    setActiveCharacter(id);
    onSelectCallback?.();
  };

  const trainerHpPct =
    party.trainer.hpMax > 0
      ? Math.max(0, Math.min(100, (party.trainer.hpCurrent / party.trainer.hpMax) * 100))
      : 0;

  return (
    <>
      {/* Compact GBA Party Strip for Mobile & Medium Popover (< lg) */}
      <div className="lg:hidden border-b-2 border-[#090D12] bg-[#17202A] shrink-0 flex items-stretch">
        <div
          ref={beltRef}
          className="flex-1 min-w-0 px-2.5 py-1.5 flex items-center gap-1.5 overflow-x-auto"
        >
          <button
            type="button"
            onClick={() => selectCharacter('trainer')}
            className={`shrink-0 px-2 py-1 border-2 border-[#090D12] text-left cursor-pointer min-w-[96px] max-w-[124px] ${
              activeCharacterId === 'trainer'
                ? 'bg-[#263847] shadow-[inset_2px_2px_0_#E63946,inset_-2px_-2px_0_#15202B]'
                : 'bg-[#1D2733] hover:bg-[#23303E] shadow-[inset_1px_1px_0_#314254]'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white truncate">
                {activeCharacterId === 'trainer' ? (
                  <PixelCursor className="w-2 h-2 text-[#F6C445]" />
                ) : (
                  <User className="w-3 h-3 text-[#E63946] shrink-0" />
                )}
                <span className="truncate">{party.trainer.name}</span>
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <div className="flex-1 h-1.5 bg-[#0B1016] border border-[#090D12]">
                <div
                  className={`h-full ${getGbaHpBarColor(trainerHpPct)}`}
                  style={{ width: `${trainerHpPct}%` }}
                />
              </div>
              <span className="font-mono tabular-nums text-[9px] text-slate-300 shrink-0">
                {party.trainer.hpCurrent}/{party.trainer.hpMax}
              </span>
            </div>
          </button>

          {party.pokemon.map((mon) => {
            const isActive = activeCharacterId === mon.id;
            const hpPct =
              mon.hpMax > 0
                ? Math.max(0, Math.min(100, (mon.hpCurrent / mon.hpMax) * 100))
                : 0;
            const primaryType = mon.types[0] ?? 'Normal';
            const typeStyle = TYPE_STYLES[primaryType];

            return (
              <button
                key={mon.id}
                type="button"
                onClick={() => selectCharacter(mon.id)}
                style={
                  isActive
                    ? {
                        boxShadow: `inset 2px 2px 0 ${typeStyle.hex}99, inset -2px -2px 0 #121820`,
                      }
                    : undefined
                }
                className={`shrink-0 px-2 py-1 border-2 border-[#090D12] text-left cursor-pointer min-w-[96px] max-w-[124px] ${
                  isActive
                    ? 'bg-[#263847]'
                    : 'bg-[#1D2733] hover:bg-[#23303E] shadow-[inset_1px_1px_0_#314254]'
                }`}
              >
                <div className="flex items-center gap-1">
                  <PokeballIcon
                    variant={mon.hpCurrent <= 0 ? 'fainted' : 'poke'}
                    className="w-3 h-3 shrink-0"
                  />
                  <span className="text-[11px] font-semibold text-white truncate">
                    {mon.name}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 bg-[#0B1016] border border-[#090D12]">
                    <div
                      className={`h-full ${getGbaHpBarColor(hpPct)}`}
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>
                  <span className="font-mono tabular-nums text-[9px] text-slate-300 shrink-0">
                    {mon.hpCurrent}/{mon.hpMax}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Pinned Quick Actions (Always Reachable) */}
        <div className="shrink-0 flex items-center gap-1 px-2 py-1.5 border-l-2 border-[#090D12] bg-[#141C24]">
          {party.pokemon.length < 6 && (
            <button
              type="button"
              onClick={onOpenAddPokemon}
              title="Add Pokémon to Party"
              aria-label="Add Pokémon to Party"
              className="gba-btn h-8 px-2 bg-[#1D2733] hover:bg-[#263342] text-xs font-medium text-[#F6C445] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add</span>
            </button>
          )}

          <button
            type="button"
            onClick={longRestParty}
            title="Pokémon Center Rest (Restore Full HP & PP)"
            aria-label="Pokémon Center Rest"
            className="gba-btn h-8 px-2 bg-[#1F4E37] hover:bg-[#266044] text-xs font-medium text-white inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#38D46A]" />
            <span className="hidden sm:inline">Rest</span>
          </button>
        </div>
      </div>

      {/* Full Left GBA 6-Slot Party Menu for Wide Desktop (lg+) */}
      <aside className="hidden lg:flex w-[276px] h-full min-h-0 shrink-0 border-r-2 border-[#090D12] bg-[#17202A] flex-col">
        <div className="p-3.5 flex-1 min-h-0 overflow-y-auto space-y-4">
          {/* Trainer Slot */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-[11px] font-bold text-slate-300 uppercase">
                Trainer Card
              </h2>
              <span className="font-mono text-[11px] text-[#F6C445]">
                LV {party.trainer.level}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => selectCharacter('trainer')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectCharacter('trainer');
                }
              }}
              className={`w-full text-left p-3 border-2 border-[#090D12] cursor-pointer transition-colors ${
                activeCharacterId === 'trainer'
                  ? 'bg-[#263847] shadow-[inset_2px_2px_0_#E63946,inset_-2px_-2px_0_#131C24]'
                  : 'bg-[#1D2733] hover:bg-[#23303E] shadow-[inset_2px_2px_0_#314254,inset_-2px_-2px_0_#121820]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {activeCharacterId === 'trainer' ? (
                      <PixelCursor className="w-2.5 h-2.5 text-[#F6C445]" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-[#E63946] shrink-0" />
                    )}
                    <span className="font-display font-bold text-xs text-white truncate">
                      {party.trainer.name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5 truncate">
                    {party.trainer.trainerClass} · AC {party.trainer.ac}
                  </p>
                </div>
                <span className="font-mono text-[11px] text-white shrink-0">
                  {party.trainer.hpCurrent}/{party.trainer.hpMax}
                </span>
              </div>

              <div className="mt-2.5 flex items-center gap-1.5">
                <span className="font-mono text-[9px] font-bold text-[#F6C445] leading-none">
                  HP
                </span>
                <div className="flex-1 h-2.5 bg-[#0B1016] border border-[#090D12] p-[1px]">
                  <div
                    className={`h-full ${getGbaHpBarColor(trainerHpPct)} transition-all duration-150`}
                    style={{ width: `${trainerHpPct}%` }}
                  />
                </div>
              </div>

              <div
                className="mt-2.5 flex items-center justify-between gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="inline-flex items-center gap-1 text-xs text-slate-300">
                  <LeagueBadgeIcon className="w-3.5 h-3.5" />
                  <span>
                    {party.trainer.badges} Badges · ¥{party.trainer.money.toLocaleString()}
                  </span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Decrease Trainer HP"
                    onClick={() => adjustHp('trainer', -1)}
                    className="gba-btn w-6 h-6 inline-flex items-center justify-center bg-[#121820] hover:bg-[#232F3D] text-slate-200 cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Increase Trainer HP"
                    onClick={() => adjustHp('trainer', 1)}
                    className="gba-btn w-6 h-6 inline-flex items-center justify-center bg-[#121820] hover:bg-[#232F3D] text-slate-200 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Active Pokémon Party (Max 6) */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-[11px] font-bold text-slate-300 uppercase">
                Party ({party.pokemon.length}/6)
              </h2>
              {party.pokemon.length < 6 && (
                <button
                  type="button"
                  onClick={onOpenAddPokemon}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#F6C445] hover:text-amber-200 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              )}
            </div>

            {party.pokemon.length === 0 ? (
              <div className="gba-well p-4 text-center space-y-2">
                <p className="text-xs text-slate-300">No Pokémon in active party.</p>
                <button
                  type="button"
                  onClick={onOpenAddPokemon}
                  className="gba-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#D62839] hover:bg-[#E63946] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Pokémon</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {party.pokemon.map((mon) => {
                  const isActive = activeCharacterId === mon.id;
                  const hpPct =
                    mon.hpMax > 0
                      ? Math.max(0, Math.min(100, (mon.hpCurrent / mon.hpMax) * 100))
                      : 0;
                  const primaryType = mon.types[0] ?? 'Normal';
                  const typeStyle = TYPE_STYLES[primaryType];

                  return (
                    <div
                      key={mon.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectCharacter(mon.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          selectCharacter(mon.id);
                        }
                      }}
                      style={
                        isActive
                          ? {
                              boxShadow: `inset 2px 2px 0 ${typeStyle.hex}, inset -2px -2px 0 #121820`,
                            }
                          : undefined
                      }
                      className={`w-full text-left p-2.5 border-2 border-[#090D12] cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-[#263847]'
                          : 'bg-[#1D2733] hover:bg-[#23303E] shadow-[inset_2px_2px_0_#314254,inset_-2px_-2px_0_#121820]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {isActive && (
                              <PixelCursor className="w-2.5 h-2.5 text-[#F6C445]" />
                            )}
                            <PokeballIcon
                              variant={mon.hpCurrent <= 0 ? 'fainted' : 'poke'}
                              className="w-4 h-4 shrink-0"
                            />
                            <span className="font-display font-bold text-xs text-white truncate">
                              {mon.name}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5 truncate">
                            {mon.species !== mon.name ? `${mon.species} · ` : ''}Lv {mon.level} ·{' '}
                            {mon.types.join('/')}
                          </p>
                        </div>

                        <span className="font-mono text-[11px] text-white shrink-0">
                          {mon.hpCurrent}/{mon.hpMax}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="font-mono text-[9px] font-bold text-[#F6C445] leading-none">
                          HP
                        </span>
                        <div className="flex-1 h-2.5 bg-[#0B1016] border border-[#090D12] p-[1px]">
                          <div
                            className={`h-full ${getGbaHpBarColor(hpPct)} transition-all duration-150`}
                            style={{ width: `${hpPct}%` }}
                          />
                        </div>
                      </div>

                      <div
                        className="mt-2 flex items-center justify-between gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <Shield className="w-3 h-3" />
                          AC {mon.ac} · SR {mon.sr}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Decrease ${mon.name} HP`}
                            onClick={() => adjustHp(mon.id, -1)}
                            className="gba-btn w-6 h-6 inline-flex items-center justify-center bg-[#121820] hover:bg-[#232F3D] text-slate-200 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Increase ${mon.name} HP`}
                            onClick={() => adjustHp(mon.id, 1)}
                            className="gba-btn w-6 h-6 inline-flex items-center justify-center bg-[#121820] hover:bg-[#232F3D] text-slate-200 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${mon.name}`}
                            onClick={() => removePokemon(mon.id)}
                            className="gba-btn w-6 h-6 inline-flex items-center justify-center bg-[#121820] hover:bg-[#4A1922] text-slate-400 hover:text-rose-300 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Party Utility Footer */}
        <div className="p-3 border-t-2 border-[#090D12] bg-[#141C24] flex items-center gap-2">
          <button
            type="button"
            onClick={longRestParty}
            className="gba-btn flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#1F4E37] hover:bg-[#266044] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#38D46A]" />
            <span>Pokémon Center Rest</span>
          </button>
        </div>
      </aside>
    </>
  );
}
