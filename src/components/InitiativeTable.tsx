import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dices,
  Lock,
  Minus,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import {
  canControlInitiativeEntry,
  selectActiveCharacter,
  useCharacterStore,
} from '../store/useCharacterStore';
import { InitiativeEntry } from '../types/pokemon5e';
import {
  formatSignedModifier,
  getAbilityModifier,
  getPoke5eSpeciesArtworkUrl,
  resolveCharacterAvatarUrl,
} from '../utils/pokemon5eRules';
import { CharacterAvatar } from './CharacterAvatar';
import { PixelCursor, PokeballIcon } from './PokemonAccessories';

interface InitiativeTableProps {
  isFloatingHudOpen?: boolean;
  onToggleFloatingHud?: () => void;
}

export function InitiativeTable({
  isFloatingHudOpen = false,
  onToggleFloatingHud,
}: InitiativeTableProps) {
  const activeChar = useCharacterStore(selectActiveCharacter);
  const party = useCharacterStore((s) => s.party);
  const obrState = useCharacterStore((s) => s.obrState);
  const initiativeList = useCharacterStore((s) => s.initiativeList);
  const initiativeTurnIndex = useCharacterStore((s) => s.initiativeTurnIndex);
  const initiativeRound = useCharacterStore((s) => s.initiativeRound);

  const performRoll = useCharacterStore((s) => s.performRoll);
  const addManualInitiative = useCharacterStore((s) => s.addManualInitiative);
  const updateInitiativeScore = useCharacterStore((s) => s.updateInitiativeScore);
  const removeInitiativeEntry = useCharacterStore((s) => s.removeInitiativeEntry);
  const setInitiativeTurnIndex = useCharacterStore((s) => s.setInitiativeTurnIndex);
  const endCurrentTurn = useCharacterStore((s) => s.endCurrentTurn);
  const toggleEntryDone = useCharacterStore((s) => s.toggleEntryDone);
  const nextInitiativeTurn = useCharacterStore((s) => s.nextInitiativeTurn);
  const prevInitiativeTurn = useCharacterStore((s) => s.prevInitiativeTurn);
  const setInitiativeRound = useCharacterStore((s) => s.setInitiativeRound);
  const resetInitiativeRound = useCharacterStore((s) => s.resetInitiativeRound);
  const clearInitiative = useCharacterStore((s) => s.clearInitiative);

  const [showAddForm, setShowAddForm] = useState(false);
  const [npcName, setNpcName] = useState('');
  const [npcInit, setNpcInit] = useState('12');
  const [npcAc, setNpcAc] = useState('');
  const [npcHp, setNpcHp] = useState('');
  const [npcAvatarUrl, setNpcAvatarUrl] = useState('');

  const activeDexMod = getAbilityModifier(activeChar.abilities.dex);

  const handleRollActiveInitiative = () => {
    performRoll({
      characterId: activeChar.id,
      characterName: activeChar.name,
      label: 'Initiative',
      category: 'initiative',
      modifier: activeDexMod,
      modifierParts: [`DEX(${formatSignedModifier(activeDexMod)})`],
    });
  };

  const handleRollNpcRandom = () => {
    const roll = Math.floor(Math.random() * 20) + 1;
    setNpcInit(String(roll));
  };

  const handleAddNpc = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = npcName.trim();
    if (!trimmed) return;
    const parsedInit = parseInt(npcInit, 10);
    const parsedAc = npcAc.trim() ? parseInt(npcAc, 10) : undefined;
    const autoSpeciesUrl = getPoke5eSpeciesArtworkUrl(
      trimmed.replace(/^(wild|alpha|boss)\s+/i, '')
    );
    addManualInitiative({
      name: trimmed,
      initiative: Number.isNaN(parsedInit) ? 10 : parsedInit,
      ac: parsedAc !== undefined && !Number.isNaN(parsedAc) ? parsedAc : undefined,
      hpText: npcHp.trim() || undefined,
      avatarUrl: npcAvatarUrl.trim() || autoSpeciesUrl,
    });
    setNpcName('');
    setNpcAc('');
    setNpcHp('');
    setNpcAvatarUrl('');
    setShowAddForm(false);
  };

  const resolveLiveVitals = (
    entry: InitiativeEntry
  ): { hpText?: string; ac?: number; avatarUrl?: string; isPokemon: boolean } => {
    const isLocalOwner =
      !entry.isNpc &&
      (entry.ownerId === obrState.playerId ||
        entry.ownerId === 'local-player' ||
        !entry.ownerId);

    if (isLocalOwner) {
      if (entry.characterId === 'trainer') {
        return {
          hpText: `${party.trainer.hpCurrent}/${party.trainer.hpMax}`,
          ac: party.trainer.ac,
          avatarUrl: resolveCharacterAvatarUrl(party.trainer) || entry.avatarUrl,
          isPokemon: false,
        };
      }
      const mon = party.pokemon.find((p) => p.id === entry.characterId);
      if (mon) {
        return {
          hpText: `${mon.hpCurrent}/${mon.hpMax}`,
          ac: mon.ac,
          avatarUrl: resolveCharacterAvatarUrl(mon) || entry.avatarUrl,
          isPokemon: true,
        };
      }
    }
    return {
      hpText: entry.hpText,
      ac: entry.ac,
      avatarUrl: entry.avatarUrl,
      isPokemon: entry.characterId !== 'trainer',
    };
  };

  const activeTurnEntry = initiativeList[initiativeTurnIndex];
  const canEndActiveTurn = canControlInitiativeEntry(activeTurnEntry, obrState);
  const formattedRound = String(initiativeRound).padStart(2, '0');

  return (
    <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-3.5 sm:space-y-4 gba-canvas-bg">
      {/* Header, Round Tracker & Turn Controls */}
      <section className="gba-panel p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h1 className="font-display text-base sm:text-lg font-bold text-white tracking-tight">
              Initiative &amp; Round Tracker
            </h1>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              Urutan giliran &amp; round tersimpan otomatis dan tersinkronisasi untuk DM &amp; player.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRollActiveInitiative}
              className="gba-btn flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] sm:min-h-[36px] text-xs font-semibold text-white bg-[#263547] hover:bg-[#32445A] cursor-pointer whitespace-nowrap"
              title={`Roll Initiative for ${activeChar.name}`}
            >
              <Dices className="w-4 h-4 text-[#F6C445] shrink-0" />
              <span className="max-w-[130px] truncate">{activeChar.name}</span>
              <span className="font-mono text-xs text-[#F6C445]">
                {formatSignedModifier(activeDexMod)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddForm((prev) => !prev)}
              className={`gba-btn inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] sm:min-h-[36px] text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                showAddForm
                  ? 'bg-[#D62839] text-white'
                  : 'bg-[#131A22] hover:bg-[#232F3E] text-slate-100'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>NPC</span>
            </button>

            {obrState.isAvailable && onToggleFloatingHud && (
              <button
                type="button"
                onClick={onToggleFloatingHud}
                title={
                  isFloatingHudOpen
                    ? 'Tutup Floating HUD di map OBR'
                    : 'Tampilkan Floating Portrait HUD di atas map OBR'
                }
                className={`gba-btn inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] sm:min-h-[36px] text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                  isFloatingHudOpen
                    ? 'bg-[#267347] text-white'
                    : 'bg-[#131A22] hover:bg-[#232F3E] text-[#38BDF8]'
                }`}
              >
                {isFloatingHudOpen ? (
                  <PinOff className="w-4 h-4" />
                ) : (
                  <Pin className="w-4 h-4" />
                )}
                <span>{isFloatingHudOpen ? 'HUD On' : 'Float HUD'}</span>
              </button>
            )}

            {initiativeList.length > 0 && (
              <button
                type="button"
                onClick={clearInitiative}
                title="Clear Initiative Table"
                aria-label="Clear Initiative Table"
                className="gba-btn inline-flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 text-xs font-medium text-slate-300 hover:text-rose-300 bg-[#131A22] hover:bg-[#4A1922] cursor-pointer shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Dedicated Round & Active Turn HUD */}
        <div className="gba-well p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Round Counter Controls */}
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center gap-2 bg-[#1A232E] border-2 border-[#090D12] px-2.5 py-1">
              <span className="font-display text-xs font-bold uppercase tracking-wider text-slate-300">
                Round
              </span>
              <span
                className="font-mono tabular-nums text-base font-bold text-[#090D12] bg-[#F6C445] border-2 border-[#090D12] px-2 py-0.5 leading-none"
                aria-live="polite"
              >
                {formattedRound}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setInitiativeRound(initiativeRound - 1)}
                disabled={initiativeRound <= 1}
                title="Decrease Round"
                aria-label="Decrease Round"
                className="gba-btn inline-flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 bg-[#131A22] hover:bg-[#232F3E] disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setInitiativeRound(initiativeRound + 1)}
                title="Increase Round"
                aria-label="Increase Round"
                className="gba-btn inline-flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 bg-[#131A22] hover:bg-[#232F3E] text-slate-200 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={resetInitiativeRound}
                disabled={initiativeRound === 1 && initiativeTurnIndex === 0}
                title="Reset to Round 1, Turn 1"
                className="gba-btn inline-flex items-center gap-1 px-2.5 h-9 sm:h-8 text-xs font-mono font-semibold text-slate-200 hover:text-white bg-[#131A22] hover:bg-[#232F3E] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>R1</span>
              </button>
            </div>
          </div>

          {/* Active Turn Status & Turn Stepper */}
          <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#090D12]">
            {activeTurnEntry ? (
              <div className="text-left sm:text-right min-w-0">
                <div className="font-mono tabular-nums text-[11px] text-slate-400">
                  Turn {initiativeTurnIndex + 1} / {initiativeList.length}
                </div>
                <div className="font-display text-sm font-bold text-[#F6C445] truncate max-w-[180px]">
                  ▶ {activeTurnEntry.characterName}
                </div>
              </div>
            ) : (
              <span className="text-xs text-slate-400">
                Belum ada combatant di arena
              </span>
            )}

            {initiativeList.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {canEndActiveTurn ? (
                  <button
                    type="button"
                    onClick={endCurrentTurn}
                    title="Tandai giliran aktif DONE & lanjut ke combatant berikutnya"
                    className="gba-btn inline-flex items-center gap-1 px-3 h-9 sm:h-8 text-xs font-bold text-white bg-[#D62839] hover:bg-[#E63946] cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>End Turn</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 h-9 sm:h-8 text-[11px] font-medium text-slate-300 bg-[#131A22] border border-[#090D12] whitespace-nowrap">
                    <Clock className="w-3.5 h-3.5 text-[#F6C445]" />
                    <span>Menunggu {activeTurnEntry?.playerName || 'Player'}</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={prevInitiativeTurn}
                  title="Previous Turn"
                  aria-label="Previous Turn"
                  className="gba-btn inline-flex items-center justify-center w-10 h-9 sm:w-9 sm:h-8 text-slate-200 bg-[#131A22] hover:bg-[#232F3E] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={nextInitiativeTurn}
                  className="gba-btn inline-flex items-center gap-1 px-3 h-9 sm:h-8 text-xs font-bold text-[#090D12] bg-[#F6C445] hover:bg-[#FBD160] cursor-pointer whitespace-nowrap"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Add NPC / Wild Pokémon Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddNpc}
            className="pt-3 border-t-2 border-[#090D12] grid grid-cols-12 gap-2.5 items-end"
          >
            <div className="col-span-12 sm:col-span-5">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                NPC / Wild Pokémon
              </label>
              <input
                type="text"
                required
                value={npcName}
                onChange={(e) => setNpcName(e.target.value)}
                placeholder="e.g. Wild Scyther"
                className="gba-well w-full px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div className="col-span-6 sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">Init</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={npcInit}
                  onChange={(e) => setNpcInit(e.target.value)}
                  className="gba-well w-full px-2.5 py-2 text-xs font-mono tabular-nums text-white text-right"
                />
                <button
                  type="button"
                  onClick={handleRollNpcRandom}
                  title="Roll 1d20"
                  aria-label="Roll 1d20 for NPC Initiative"
                  className="gba-btn w-9 h-9 inline-flex items-center justify-center bg-[#131A22] hover:bg-[#232F3E] text-[#F6C445] cursor-pointer shrink-0"
                >
                  <Dices className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="col-span-6 sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">AC</label>
              <input
                type="number"
                value={npcAc}
                onChange={(e) => setNpcAc(e.target.value)}
                placeholder="14"
                className="gba-well w-full px-2.5 py-2 text-xs font-mono tabular-nums text-white text-right"
              />
            </div>

            <div className="col-span-12 sm:col-span-3 flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-300 mb-1">HP</label>
                <input
                  type="text"
                  value={npcHp}
                  onChange={(e) => setNpcHp(e.target.value)}
                  placeholder="45/45"
                  className="gba-well w-full px-2.5 py-2 text-xs font-mono tabular-nums text-white text-right"
                />
              </div>
              <button
                type="submit"
                className="gba-btn px-4 min-h-[38px] text-xs font-semibold text-white bg-[#D62839] hover:bg-[#E63946] cursor-pointer shrink-0"
              >
                Add
              </button>
            </div>

            <div className="col-span-12">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Avatar URL (opsional — otomatis pakai sprite poke5e.app jika nama Pokémon valid)
              </label>
              <input
                type="url"
                value={npcAvatarUrl}
                onChange={(e) => setNpcAvatarUrl(e.target.value)}
                placeholder="https://poke5e.app/assets/pokemon/scyther/main.png"
                className="gba-well w-full px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </form>
        )}
      </section>

      {/* Initiative List: Mobile Cards (< sm) + Desktop Table (sm+) */}
      {initiativeList.length === 0 ? (
        <section className="gba-panel p-6 sm:p-8 text-center flex flex-col items-center justify-center space-y-3">
          <PokeballIcon variant="great" className="w-10 h-10" />
          <div className="space-y-1.5 max-w-sm">
            <h2 className="font-display text-sm sm:text-base font-bold text-white">
              Belum ada roll Initiative
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Setiap player yang menekan tombol Initiative pada Trainer atau Pokémon
              akan otomatis masuk dan diurutkan dari skor tertinggi ke terendah.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleRollActiveInitiative}
              className="gba-btn w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#D62839] hover:bg-[#E63946] cursor-pointer"
            >
              <Dices className="w-4 h-4" />
              <span>
                Roll {activeChar.name} ({formatSignedModifier(activeDexMod)})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="gba-btn w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-100 bg-[#263547] hover:bg-[#32445A] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah NPC / Wild Pokémon</span>
            </button>
          </div>
        </section>
      ) : (
        <section className="gba-panel overflow-hidden">
          {/* Mobile Card View (< 640px) - Zero horizontal overflow */}
          <div className="sm:hidden divide-y-2 divide-[#090D12]">
            {initiativeList.map((entry, idx) => {
              const isTurn = idx === initiativeTurnIndex;
              const vitals = resolveLiveVitals(entry);

              return (
                <div
                  key={entry.id}
                  className={`p-3 space-y-2.5 transition-colors ${
                    isTurn ? 'bg-[#2C3A28]' : 'bg-[#1E2833]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setInitiativeTurnIndex(idx)}
                        title={isTurn ? 'Active Turn' : 'Set as Active Turn'}
                        aria-label={`Set ${entry.characterName} as active turn`}
                        className={`gba-btn inline-flex items-center justify-center w-10 h-10 text-xs font-mono tabular-nums cursor-pointer shrink-0 ${
                          isTurn
                            ? 'bg-[#F6C445] text-[#090D12] font-bold'
                            : 'bg-[#131A22] text-slate-300 hover:text-white'
                        }`}
                      >
                        {isTurn ? (
                          <PixelCursor className="w-3 h-3 text-[#090D12]" />
                        ) : (
                          idx + 1
                        )}
                      </button>

                      <CharacterAvatar
                        src={vitals.avatarUrl}
                        name={entry.characterName}
                        isPokemon={vitals.isPokemon}
                        accentHex={isTurn ? '#F6C445' : '#38BDF8'}
                        className={`w-10 h-10 border-2 border-[#090D12] rounded-xs shrink-0 ${
                          entry.hasActed && !isTurn ? 'brightness-75 saturate-75' : ''
                        }`}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          {entry.visibility === 'hidden' && (
                            <Lock
                              className="w-3.5 h-3.5 text-[#C084FC] shrink-0"
                              aria-label="Hidden GM Roll"
                            />
                          )}
                          <span
                            className={`font-display text-sm font-bold truncate ${
                              isTurn ? 'text-[#F6C445]' : 'text-white'
                            }`}
                          >
                            {entry.characterName}
                          </span>
                          {entry.hasActed && (
                            <span className="px-1.5 py-0.5 bg-[#10161D] border border-[#090D12] font-mono text-[10px] font-bold text-slate-200">
                              DONE
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-300 truncate mt-0.5">
                          <span>{entry.playerName}</span>
                          <span className="text-slate-400"> · {entry.breakdown}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {canControlInitiativeEntry(entry, obrState) && (
                        <button
                          type="button"
                          onClick={() => toggleEntryDone(entry.id)}
                          title={entry.hasActed ? 'Batalkan DONE' : 'Tandai DONE'}
                          className={`gba-btn px-2 h-9 text-[10px] font-mono font-bold cursor-pointer ${
                            entry.hasActed
                              ? 'bg-[#267347] text-white'
                              : 'bg-[#131A22] text-slate-300 hover:text-white'
                          }`}
                        >
                          DONE
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeInitiativeEntry(entry.id)}
                        aria-label={`Remove ${entry.characterName} from initiative`}
                        className="gba-btn w-9 h-9 inline-flex items-center justify-center bg-[#131A22] text-slate-400 hover:text-[#F04848] cursor-pointer shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#090D12]/80">
                    <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                      {vitals.hpText ? (
                        <span className="px-2 py-0.5 bg-[#131A22] border border-[#090D12] text-[#38D46A] font-semibold">
                          {vitals.hpText} HP
                        </span>
                      ) : null}
                      {vitals.ac !== undefined ? (
                        <span className="px-2 py-0.5 bg-[#131A22] border border-[#090D12] text-slate-200">
                          AC {vitals.ac}
                        </span>
                      ) : null}
                      {!vitals.hpText && vitals.ac === undefined && (
                        <span className="text-slate-500">No vitals</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-mono uppercase text-slate-400 mr-0.5">
                        Init
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateInitiativeScore(entry.id, entry.initiative - 1)
                        }
                        aria-label={`Decrease initiative for ${entry.characterName}`}
                        className="gba-btn w-9 h-9 inline-flex items-center justify-center bg-[#11171E] hover:bg-[#232F3E] text-slate-200 text-sm cursor-pointer"
                      >
                        -
                      </button>
                      <span
                        className={`w-8 text-center font-mono tabular-nums text-sm font-bold ${
                          isTurn ? 'text-[#F6C445]' : 'text-white'
                        }`}
                      >
                        {entry.initiative}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateInitiativeScore(entry.id, entry.initiative + 1)
                        }
                        aria-label={`Increase initiative for ${entry.characterName}`}
                        className="gba-btn w-9 h-9 inline-flex items-center justify-center bg-[#11171E] hover:bg-[#232F3E] text-slate-200 text-sm cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop / Tablet Table View (640px+) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-[#090D12] bg-[#11171E] font-display text-xs font-bold uppercase tracking-wider text-slate-300">
                  <th className="py-2.5 pl-3 pr-2 w-12 text-center">Turn</th>
                  <th className="py-2.5 px-2">Player &amp; Combatant</th>
                  <th className="py-2.5 px-2 text-right whitespace-nowrap">AC / HP</th>
                  <th className="py-2.5 px-2 text-right whitespace-nowrap">Init</th>
                  <th className="py-2.5 pl-1 pr-3 w-10 text-right">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#090D12]">
                {initiativeList.map((entry, idx) => {
                  const isTurn = idx === initiativeTurnIndex;
                  const vitals = resolveLiveVitals(entry);

                  return (
                    <tr
                      key={entry.id}
                      className={`transition-colors ${
                        isTurn
                          ? 'bg-[#2C3A28]'
                          : 'bg-[#1E2833] hover:bg-[#24313F]'
                      }`}
                    >
                      {/* Turn Marker / Rank */}
                      <td className="py-2.5 pl-3 pr-2 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => setInitiativeTurnIndex(idx)}
                          title={isTurn ? 'Active Turn' : 'Set as Active Turn'}
                          className={`gba-btn inline-flex items-center justify-center w-8 h-8 text-xs font-mono tabular-nums cursor-pointer ${
                            isTurn
                              ? 'bg-[#F6C445] text-[#090D12] font-bold'
                              : 'bg-[#131A22] text-slate-300 hover:text-white'
                          }`}
                        >
                          {isTurn ? (
                            <PixelCursor className="w-3 h-3 text-[#090D12]" />
                          ) : (
                            idx + 1
                          )}
                        </button>
                      </td>

                      {/* Combatant & Player with Portrait */}
                      <td className="py-2.5 px-2 align-middle min-w-[160px]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CharacterAvatar
                            src={vitals.avatarUrl}
                            name={entry.characterName}
                            isPokemon={vitals.isPokemon}
                            accentHex={isTurn ? '#F6C445' : '#38BDF8'}
                            className={`w-9 h-9 border-2 border-[#090D12] rounded-xs shrink-0 ${
                              entry.hasActed && !isTurn ? 'brightness-75 saturate-75' : ''
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              {entry.visibility === 'hidden' && (
                                <Lock
                                  className="w-3.5 h-3.5 text-[#C084FC] shrink-0"
                                  aria-label="Hidden GM Roll"
                                />
                              )}
                              <span
                                className={`font-display text-sm font-bold truncate ${
                                  isTurn ? 'text-[#F6C445]' : 'text-white'
                                }`}
                              >
                                {entry.characterName}
                              </span>
                              {canControlInitiativeEntry(entry, obrState) ? (
                                <button
                                  type="button"
                                  onClick={() => toggleEntryDone(entry.id)}
                                  title={entry.hasActed ? 'Batalkan DONE' : 'Tandai DONE'}
                                  className={`px-1.5 py-0.5 font-mono text-[10px] font-bold border border-[#090D12] cursor-pointer ${
                                    entry.hasActed
                                      ? 'bg-[#267347] text-white'
                                      : 'bg-[#11171E] text-slate-400 hover:text-white'
                                  }`}
                                >
                                  DONE
                                </button>
                              ) : entry.hasActed ? (
                                <span className="px-1.5 py-0.5 bg-[#10161D] border border-[#090D12] font-mono text-[10px] font-bold text-slate-200">
                                  DONE
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-slate-300 truncate mt-0.5">
                              <span>{entry.playerName}</span>
                              <span className="text-slate-400"> · {entry.breakdown}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* AC / HP */}
                      <td className="py-2.5 px-2 text-right align-middle font-mono tabular-nums text-xs text-slate-200 whitespace-nowrap">
                        {vitals.hpText || vitals.ac !== undefined ? (
                          <div className="inline-flex flex-col items-end leading-tight">
                            {vitals.hpText && (
                              <span className="text-[#38D46A] font-semibold">
                                {vitals.hpText} HP
                              </span>
                            )}
                            {vitals.ac !== undefined && (
                              <span className="text-[11px] text-slate-300">
                                AC {vitals.ac}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Initiative Score with +/- tie-break adjuster */}
                      <td className="py-2.5 px-2 text-right align-middle whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateInitiativeScore(entry.id, entry.initiative - 1)
                            }
                            aria-label={`Decrease initiative for ${entry.characterName}`}
                            className="gba-btn w-7 h-7 bg-[#11171E] hover:bg-[#232F3E] text-slate-200 text-xs leading-none cursor-pointer"
                          >
                            -
                          </button>
                          <span
                            className={`w-8 text-center font-mono tabular-nums text-sm font-bold ${
                              isTurn ? 'text-[#F6C445]' : 'text-white'
                            }`}
                          >
                            {entry.initiative}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateInitiativeScore(entry.id, entry.initiative + 1)
                            }
                            aria-label={`Increase initiative for ${entry.characterName}`}
                            className="gba-btn w-7 h-7 bg-[#11171E] hover:bg-[#232F3E] text-slate-200 text-xs leading-none cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Remove */}
                      <td className="py-2.5 pl-1 pr-3 text-right align-middle">
                        <button
                          type="button"
                          onClick={() => removeInitiativeEntry(entry.id)}
                          aria-label={`Remove ${entry.characterName} from initiative`}
                          className="p-1.5 text-slate-400 hover:text-[#F04848] cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
