import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Maximize2,
  Pin,
  PinOff,
  RotateCcw,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  canControlInitiativeEntry,
  useCharacterStore,
} from '../store/useCharacterStore';
import { InitiativeEntry } from '../types/pokemon5e';
import {
  closeFloatingInitiativeHud,
  computeFloatingHudWidth,
  resizeFloatingInitiativeHud,
} from '../utils/obrBridge';
import { parseHpText, resolveCharacterAvatarUrl } from '../utils/pokemon5eRules';
import { CharacterAvatar } from './CharacterAvatar';

interface InitiativeHudStripProps {
  variant: 'docked' | 'floating';
  onOpenFullInitiative?: () => void;
  isFloatingHudOpen?: boolean;
  onToggleFloatingHud?: () => void;
}

function getBarColor(pct: number): string {
  if (pct > 50) return 'bg-[#38D46A]';
  if (pct > 20) return 'bg-[#F8B828]';
  return 'bg-[#F04848]';
}

export function InitiativeHudStrip({
  variant,
  onOpenFullInitiative,
  isFloatingHudOpen = false,
  onToggleFloatingHud,
}: InitiativeHudStripProps) {
  const initiativeList = useCharacterStore((s) => s.initiativeList);
  const initiativeTurnIndex = useCharacterStore((s) => s.initiativeTurnIndex);
  const initiativeRound = useCharacterStore((s) => s.initiativeRound);
  const obrState = useCharacterStore((s) => s.obrState);
  const party = useCharacterStore((s) => s.party);

  const setInitiativeTurnIndex = useCharacterStore((s) => s.setInitiativeTurnIndex);
  const endCurrentTurn = useCharacterStore((s) => s.endCurrentTurn);
  const toggleEntryDone = useCharacterStore((s) => s.toggleEntryDone);
  const resetInitiativeRound = useCharacterStore((s) => s.resetInitiativeRound);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredEntryId, setHoveredEntryId] = useState<string | null>(null);

  const isFloating = variant === 'floating';
  const count = initiativeList.length;
  const activeEntry = initiativeList[initiativeTurnIndex];
  const canEndTurn = canControlInitiativeEntry(activeEntry, obrState);
  const isGm = obrState.role === 'GM';
  const formattedRound = String(initiativeRound).padStart(2, '0');

  useEffect(() => {
    if (!isFloating) return;
    const targetWidth = computeFloatingHudWidth(count, isCollapsed);
    const targetHeight = isCollapsed ? 128 : 152;
    void resizeFloatingInitiativeHud(targetWidth, targetHeight);
  }, [isFloating, count, isCollapsed]);

  const resolveEntryVisuals = (
    entry: InitiativeEntry
  ): {
    avatarUrl?: string;
    hpPct: number;
    hasKnownHp: boolean;
    hpText?: string;
    ac?: number;
    isPokemon: boolean;
  } => {
    const isLocalOwner =
      !entry.isNpc &&
      (entry.ownerId === obrState.playerId ||
        entry.ownerId === 'local-player' ||
        !entry.ownerId);

    if (isLocalOwner) {
      if (entry.characterId === 'trainer') {
        const pct =
          party.trainer.hpMax > 0
            ? Math.max(0, Math.min(100, (party.trainer.hpCurrent / party.trainer.hpMax) * 100))
            : 100;
        return {
          avatarUrl: resolveCharacterAvatarUrl(party.trainer) || entry.avatarUrl,
          hpPct: pct,
          hasKnownHp: true,
          hpText: `${party.trainer.hpCurrent}/${party.trainer.hpMax}`,
          ac: party.trainer.ac,
          isPokemon: false,
        };
      }
      const mon = party.pokemon.find((p) => p.id === entry.characterId);
      if (mon) {
        const pct =
          mon.hpMax > 0
            ? Math.max(0, Math.min(100, (mon.hpCurrent / mon.hpMax) * 100))
            : 100;
        return {
          avatarUrl: resolveCharacterAvatarUrl(mon) || entry.avatarUrl,
          hpPct: pct,
          hasKnownHp: true,
          hpText: `${mon.hpCurrent}/${mon.hpMax}`,
          ac: mon.ac,
          isPokemon: true,
        };
      }
    }

    const cur =
      typeof entry.hpCurrent === 'number'
        ? entry.hpCurrent
        : parseHpText(entry.hpText).hpCurrent;
    const max =
      typeof entry.hpMax === 'number'
        ? entry.hpMax
        : parseHpText(entry.hpText).hpMax;

    const hasKnownHp =
      typeof cur === 'number' && typeof max === 'number' && max > 0;
    const hpPct = hasKnownHp ? Math.max(0, Math.min(100, (cur! / max!) * 100)) : 100;

    return {
      avatarUrl: entry.avatarUrl,
      hpPct,
      hasKnownHp,
      hpText: entry.hpText,
      ac: entry.ac,
      isPokemon: entry.characterId !== 'trainer',
    };
  };

  const inspectedEntry =
    (hoveredEntryId && initiativeList.find((e) => e.id === hoveredEntryId)) ||
    activeEntry;

  /* ------------------------------------------------------------------ */
  /* FLOATING OBR OVERLAY VARIANT (?view=hud)                           */
  /* ------------------------------------------------------------------ */
  if (isFloating) {
    return (
      <div className="w-full h-full flex flex-col justify-start p-1.5 select-none bg-transparent">
        <div className="flex items-start gap-2">
          {/* Left Collapse & Round Column (matching OBR reference screenshot) */}
          <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
            <button
              type="button"
              onClick={() => setIsCollapsed((v) => !v)}
              title={isCollapsed ? 'Tampilkan Initiative HUD' : 'Sembunyikan Initiative HUD'}
              aria-label={isCollapsed ? 'Expand Initiative HUD' : 'Collapse Initiative HUD'}
              className="w-7 h-[64px] bg-[#8D4925] hover:bg-[#A6582E] border-2 border-[#090D12] text-white flex items-center justify-center shadow-[0_3px_8px_rgba(0,0,0,0.65)] cursor-pointer transition-colors"
              style={{ transform: 'skewX(-10deg)' }}
            >
              <span style={{ transform: 'skewX(10deg)' }}>
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </span>
            </button>

            <div
              title={`Round ${initiativeRound}`}
              className="w-7 h-7 bg-[#8D4925] border-2 border-[#090D12] text-white font-mono text-[10px] font-bold flex items-center justify-center shadow-[0_3px_8px_rgba(0,0,0,0.65)] relative"
            >
              <span>R{formattedRound}</span>
              {count > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#F6C445] border border-[#090D12]" />
              )}
            </div>
          </div>

          {/* Slanted Portrait Cards Strip */}
          {!isCollapsed && (
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              {count === 0 ? (
                <div className="inline-flex items-center gap-2 px-3 py-2 bg-[#141A21]/92 border-2 border-[#090D12] rounded-sm text-xs text-slate-200 shadow-lg w-fit">
                  <span className="font-mono text-[#F6C445] font-bold">R{formattedRound}</span>
                  <span>Belum ada combatant. Roll Initiative di sheet.</span>
                  <button
                    type="button"
                    onClick={() => void closeFloatingInitiativeHud()}
                    aria-label="Close Floating HUD"
                    className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 overflow-x-auto px-2 py-0.5">
                    {initiativeList.map((entry, idx) => {
                      const isTurn = idx === initiativeTurnIndex;
                      const isDone = Boolean(entry.hasActed);
                      const canControlEntry = canControlInitiativeEntry(entry, obrState);
                      const visuals = resolveEntryVisuals(entry);
                      const isFainted = visuals.hasKnownHp && visuals.hpPct <= 0;

                      return (
                        <div
                          key={entry.id}
                          onMouseEnter={() => setHoveredEntryId(entry.id)}
                          onMouseLeave={() => setHoveredEntryId(null)}
                          onClick={() => {
                            if (isGm) {
                              setInitiativeTurnIndex(idx);
                            } else if (canControlEntry) {
                              toggleEntryDone(entry.id);
                            }
                          }}
                          title={`${entry.characterName} (${entry.playerName}) · Init ${entry.initiative}${visuals.hpText ? ` · HP ${visuals.hpText}` : ''}${visuals.ac !== undefined ? ` · AC ${visuals.ac}` : ''}${isDone ? ' · DONE' : ''}`}
                          className={`hud-slanted relative shrink-0 w-[62px] h-[82px] overflow-hidden border-[3px] shadow-[0_4px_10px_rgba(0,0,0,0.75)] transition-transform ${
                            isTurn
                              ? 'border-[#F6C445] ring-1 ring-[#E63946] -translate-y-0.5'
                              : isDone
                                ? 'border-[#5B4433]'
                                : 'border-[#8D4925]'
                          } ${isGm || canControlEntry ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          {/* Un-skewed Portrait Layer */}
                          <div
                            className={`hud-unskew w-[132%] h-[112%] -ml-[16%] -mt-[4%] relative ${
                              isDone && !isTurn ? 'brightness-75 saturate-75' : ''
                            }`}
                          >
                            <CharacterAvatar
                              src={visuals.avatarUrl}
                              name={entry.characterName}
                              isPokemon={visuals.isPokemon}
                              isFainted={isFainted}
                              accentHex={isTurn ? '#F6C445' : '#8D4925'}
                              className="w-full h-full"
                              fallbackTextClassName="text-sm"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
                          </div>

                          {/* Active Turn Red Corner Triangle */}
                          {isTurn && (
                            <span
                              aria-hidden="true"
                              className="absolute top-0 right-0 w-0 h-0 border-t-[15px] border-l-[15px] border-t-[#E63946] border-l-transparent pointer-events-none z-20"
                            />
                          )}

                          {/* DONE Pill Overlay */}
                          {isDone && (
                            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                              <span className="hud-unskew inline-block px-1.5 py-[1px] bg-[#0B1016]/90 text-white font-mono text-[9px] font-bold tracking-wider leading-tight border border-white/15">
                                DONE
                              </span>
                            </div>
                          )}

                          {/* Green Rank / Initiative Chip */}
                          <div className="absolute bottom-[10px] left-1 z-10 pointer-events-none">
                            <span className="hud-unskew inline-flex items-center gap-0.5 px-1 py-[1px] bg-[#2D7A3E] border border-[#090D12] text-white font-mono tabular-nums text-[9px] font-bold leading-none shadow-sm">
                              <span>▲</span>
                              <span>{entry.initiative}</span>
                            </span>
                          </div>

                          {/* Bottom HP + Accent Double Bar */}
                          <div className="absolute bottom-0 inset-x-0 z-10 bg-[#090D12] p-[1px] space-y-[1px]">
                            <div className="h-[4px] bg-[#161E27] w-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-150 ${
                                  visuals.hasKnownHp
                                    ? getBarColor(visuals.hpPct)
                                    : 'bg-[#38D46A]/80'
                                }`}
                                style={{ width: `${visuals.hpPct}%` }}
                              />
                            </div>
                            <div className="h-[2.5px] bg-[#161E27] w-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  isTurn ? 'bg-[#F6C445]' : 'bg-[#38BDF8]'
                                }`}
                                style={{ width: isDone ? '45%' : '100%' }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Floating End Turn & Active Nameplate Pill */}
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#141A21]/92 border-2 border-[#090D12] rounded-sm shadow-[0_4px_12px_rgba(0,0,0,0.7)] w-fit max-w-full">
                    {inspectedEntry && (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-[11px] font-bold text-[#F6C445] shrink-0">
                          ▶
                        </span>
                        <span className="font-display text-xs font-bold text-white truncate max-w-[140px]">
                          {inspectedEntry.characterName}
                        </span>
                        <span className="font-mono tabular-nums text-[10px] text-slate-300 shrink-0">
                          ({inspectedEntry.initiative})
                        </span>
                      </div>
                    )}

                    <div className="h-3.5 w-[1px] bg-slate-600/60 shrink-0" />

                    {canEndTurn ? (
                      <button
                        type="button"
                        onClick={endCurrentTurn}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#D62839] hover:bg-[#E63946] border border-[#090D12] text-white text-[11px] font-bold whitespace-nowrap cursor-pointer rounded-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>End Turn</span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-300 whitespace-nowrap">
                        <Clock className="w-3 h-3 text-[#F6C445]" />
                        <span>Menunggu {activeEntry?.playerName || 'Player'}</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => void closeFloatingInitiativeHud()}
                      title="Tutup Floating HUD"
                      aria-label="Close Floating HUD"
                      className="p-0.5 text-slate-400 hover:text-white cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* DOCKED RIGHT SIDEBAR VARIANT (inside App.tsx right column)        */
  /* ------------------------------------------------------------------ */
  return (
    <section className="border-b-2 border-[#090D12] bg-[#141C25] shrink-0">
      {/* Header Bar */}
      <div className="px-3.5 py-2 border-b-2 border-[#090D12] bg-[#17202A] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setIsCollapsed((v) => !v)}
            aria-label={isCollapsed ? 'Expand Initiative HUD' : 'Collapse Initiative HUD'}
            className="gba-btn w-6 h-6 inline-flex items-center justify-center bg-[#8D4925] hover:bg-[#A6582E] text-white cursor-pointer shrink-0"
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
          <span className="font-mono tabular-nums text-[11px] font-bold px-1.5 py-0.5 bg-[#F6C445] text-[#090D12] border border-[#090D12] leading-none shrink-0">
            R{formattedRound}
          </span>
          <h2 className="font-display text-xs font-bold text-white uppercase truncate">
            Initiative ({count})
          </h2>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {obrState.isAvailable && onToggleFloatingHud && (
            <button
              type="button"
              onClick={onToggleFloatingHud}
              title={
                isFloatingHudOpen
                  ? 'Tutup Floating HUD di map OBR'
                  : 'Buka Floating HUD di atas map OBR'
              }
              className={`gba-btn inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                isFloatingHudOpen
                  ? 'bg-[#267347] text-white'
                  : 'bg-[#131A22] hover:bg-[#232F3E] text-[#38BDF8]'
              }`}
            >
              {isFloatingHudOpen ? (
                <PinOff className="w-3 h-3" />
              ) : (
                <Pin className="w-3 h-3" />
              )}
              <span>{isFloatingHudOpen ? 'HUD On' : 'Float'}</span>
            </button>
          )}
          {onOpenFullInitiative && (
            <button
              type="button"
              onClick={onOpenFullInitiative}
              title="Buka Tab Initiative Penuh"
              className="gba-btn inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-[#F6C445] bg-[#131A22] hover:bg-[#232F3E] cursor-pointer"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Tab</span>
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-2.5 space-y-2.5">
          {count === 0 ? (
            <div className="gba-well p-3 text-center space-y-1.5">
              <p className="text-xs text-slate-300">
                Belum ada portrait initiative di arena.
              </p>
              {onOpenFullInitiative && (
                <button
                  type="button"
                  onClick={onOpenFullInitiative}
                  className="gba-btn inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#F6C445] bg-[#131A22] hover:bg-[#232F3E] cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Roll / Tambah NPC</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Horizontal Slanted Portrait Strip */}
              <div className="flex items-center gap-1.5 overflow-x-auto px-2 py-1">
                {initiativeList.map((entry, idx) => {
                  const isTurn = idx === initiativeTurnIndex;
                  const isDone = Boolean(entry.hasActed);
                  const canControlEntry = canControlInitiativeEntry(entry, obrState);
                  const visuals = resolveEntryVisuals(entry);
                  const isFainted = visuals.hasKnownHp && visuals.hpPct <= 0;

                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onMouseEnter={() => setHoveredEntryId(entry.id)}
                      onMouseLeave={() => setHoveredEntryId(null)}
                      onClick={() => {
                        if (isGm) {
                          setInitiativeTurnIndex(idx);
                        } else if (canControlEntry) {
                          toggleEntryDone(entry.id);
                        }
                      }}
                      title={`${entry.characterName} (${entry.playerName}) · Init ${entry.initiative}${visuals.hpText ? ` · HP ${visuals.hpText}` : ''}${visuals.ac !== undefined ? ` · AC ${visuals.ac}` : ''}${isGm ? ' (Klik untuk pilih giliran)' : ''}`}
                      className={`hud-slanted relative shrink-0 w-[56px] h-[74px] overflow-hidden border-[3px] text-left transition-transform ${
                        isTurn
                          ? 'border-[#F6C445] ring-1 ring-[#E63946] -translate-y-0.5 shadow-[0_3px_10px_rgba(246,196,69,0.28)]'
                          : isDone
                            ? 'border-[#5B4433]'
                            : 'border-[#8D4925]'
                      } ${isGm || canControlEntry ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <div
                        className={`hud-unskew w-[132%] h-[112%] -ml-[16%] -mt-[4%] relative ${
                          isDone && !isTurn ? 'brightness-75 saturate-75' : ''
                        }`}
                      >
                        <CharacterAvatar
                          src={visuals.avatarUrl}
                          name={entry.characterName}
                          isPokemon={visuals.isPokemon}
                          isFainted={isFainted}
                          accentHex={isTurn ? '#F6C445' : '#8D4925'}
                          className="w-full h-full"
                          fallbackTextClassName="text-xs"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
                      </div>

                      {isTurn && (
                        <span
                          aria-hidden="true"
                          className="absolute top-0 right-0 w-0 h-0 border-t-[13px] border-l-[13px] border-t-[#E63946] border-l-transparent pointer-events-none z-20"
                        />
                      )}

                      {isDone && (
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                          <span className="hud-unskew inline-block px-1.5 py-[1px] bg-[#0B1016]/90 text-white font-mono text-[8px] font-bold tracking-wider leading-tight border border-white/15">
                            DONE
                          </span>
                        </div>
                      )}

                      <div className="absolute bottom-[9px] left-1 z-10 pointer-events-none">
                        <span className="hud-unskew inline-flex items-center gap-0.5 px-1 py-[1px] bg-[#2D7A3E] border border-[#090D12] text-white font-mono tabular-nums text-[9px] font-bold leading-none">
                          <span>▲</span>
                          <span>{entry.initiative}</span>
                        </span>
                      </div>

                      <div className="absolute bottom-0 inset-x-0 z-10 bg-[#090D12] p-[1px] space-y-[1px]">
                        <div className="h-[3.5px] bg-[#161E27] w-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-150 ${
                              visuals.hasKnownHp
                                ? getBarColor(visuals.hpPct)
                                : 'bg-[#38D46A]/80'
                            }`}
                            style={{ width: `${visuals.hpPct}%` }}
                          />
                        </div>
                        <div className="h-[2px] bg-[#161E27] w-full overflow-hidden">
                          <div
                            className={`h-full ${
                              isTurn ? 'bg-[#F6C445]' : 'bg-[#38BDF8]'
                            }`}
                            style={{ width: isDone ? '45%' : '100%' }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active Combatant Caption + End Turn Action */}
              <div className="gba-well px-2.5 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  {inspectedEntry ? (
                    <>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-[11px] font-bold text-[#F6C445] shrink-0">
                          ▶
                        </span>
                        <span className="font-display text-xs font-bold text-white truncate">
                          {inspectedEntry.characterName}
                        </span>
                        {inspectedEntry.hasActed && (
                          <span className="font-mono text-[9px] font-bold px-1 bg-[#232F3E] text-slate-300 border border-[#090D12]">
                            DONE
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {inspectedEntry.playerName} · Init {inspectedEntry.initiative}
                        {(() => {
                          const v = resolveEntryVisuals(inspectedEntry);
                          return v.hpText ? ` · ${v.hpText} HP` : '';
                        })()}
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {canEndTurn ? (
                    <button
                      type="button"
                      onClick={endCurrentTurn}
                      title="Tandai DONE dan lanjut ke giliran berikutnya"
                      className="gba-btn inline-flex items-center gap-1 px-2.5 min-h-[32px] bg-[#D62839] hover:bg-[#E63946] text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>End Turn</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#131A22] border border-[#090D12] text-[11px] text-slate-300 whitespace-nowrap">
                      <Clock className="w-3 h-3 text-[#F6C445]" />
                      <span>Wait</span>
                    </span>
                  )}

                  {isGm && (
                    <button
                      type="button"
                      onClick={resetInitiativeRound}
                      title="Reset Round & Clear DONE"
                      aria-label="Reset Round & Clear DONE"
                      className="gba-btn w-8 h-8 inline-flex items-center justify-center bg-[#131A22] hover:bg-[#232F3E] text-slate-300 hover:text-white cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
