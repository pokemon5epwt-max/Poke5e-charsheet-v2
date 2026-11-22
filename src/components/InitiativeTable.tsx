import {
  ChevronLeft,
  ChevronRight,
  Dices,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { selectActiveCharacter, useCharacterStore } from '../store/useCharacterStore';
import { InitiativeEntry } from '../types/pokemon5e';
import { formatSignedModifier, getAbilityModifier } from '../utils/pokemon5eRules';
import { PixelCursor, PokeballIcon } from './PokemonAccessories';

export function InitiativeTable() {
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
    addManualInitiative({
      name: trimmed,
      initiative: Number.isNaN(parsedInit) ? 10 : parsedInit,
      ac: parsedAc !== undefined && !Number.isNaN(parsedAc) ? parsedAc : undefined,
      hpText: npcHp.trim() || undefined,
    });
    setNpcName('');
    setNpcAc('');
    setNpcHp('');
    setShowAddForm(false);
  };

  const resolveLiveVitals = (
    entry: InitiativeEntry
  ): { hpText?: string; ac?: number } => {
    const isLocalOwner =
      !entry.isNpc &&
      (entry.ownerId === obrState.playerId || entry.ownerId === 'local-player');

    if (isLocalOwner) {
      if (entry.characterId === 'trainer') {
        return {
          hpText: `${party.trainer.hpCurrent}/${party.trainer.hpMax}`,
          ac: party.trainer.ac,
        };
      }
      const mon = party.pokemon.find((p) => p.id === entry.characterId);
      if (mon) {
        return {
          hpText: `${mon.hpCurrent}/${mon.hpMax}`,
          ac: mon.ac,
        };
      }
    }
    return { hpText: entry.hpText, ac: entry.ac };
  };

  const activeTurnEntry = initiativeList[initiativeTurnIndex];
  const formattedRound = String(initiativeRound).padStart(2, '0');

  return (
    <main className="flex-1 overflow-y-auto p-3.5 sm:p-4 lg:p-6 space-y-4 gba-canvas-bg">
      {/* Header, Round Tracker & Turn Controls */}
      <section className="gba-panel p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h1 className="font-display text-sm sm:text-base font-bold text-white uppercase">
              Initiative &amp; Round Tracker
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Urutan giliran &amp; round otomatis tersinkronisasi untuk DM dan seluruh player.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleRollActiveInitiative}
              className="gba-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-[#263547] hover:bg-[#32445A] cursor-pointer"
              title={`Roll Initiative for ${activeChar.name}`}
            >
              <Dices className="w-3.5 h-3.5 text-[#F6C445]" />
              <span className="max-w-[105px] truncate">{activeChar.name}</span>
              <span className="font-mono text-[11px] text-[#F6C445]">
                {formatSignedModifier(activeDexMod)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddForm((prev) => !prev)}
              className={`gba-btn inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold cursor-pointer ${
                showAddForm
                  ? 'bg-[#D62839] text-white'
                  : 'bg-[#131A22] hover:bg-[#232F3E] text-slate-100'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>NPC</span>
            </button>

            {initiativeList.length > 0 && (
              <button
                type="button"
                onClick={clearInitiative}
                title="Clear Initiative Table"
                className="gba-btn inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-300 hover:text-rose-300 bg-[#131A22] hover:bg-[#4A1922] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Dedicated Round & Active Turn HUD */}
        <div className="gba-well p-2.5 flex flex-wrap items-center justify-between gap-2.5">
          {/* Round Counter Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-[#1A232E] border-2 border-[#090D12] px-2.5 py-1">
              <span className="font-display text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Round
              </span>
              <span
                className="font-mono tabular-nums text-sm sm:text-base font-bold text-[#090D12] bg-[#F6C445] border-2 border-[#090D12] px-2 py-0.5 leading-none"
                aria-live="polite"
              >
                {formattedRound}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setInitiativeRound(initiativeRound - 1)}
                disabled={initiativeRound <= 1}
                title="Decrease Round"
                aria-label="Decrease Round"
                className="gba-btn inline-flex items-center justify-center w-7 h-7 bg-[#131A22] hover:bg-[#232F3E] disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setInitiativeRound(initiativeRound + 1)}
                title="Increase Round"
                aria-label="Increase Round"
                className="gba-btn inline-flex items-center justify-center w-7 h-7 bg-[#131A22] hover:bg-[#232F3E] text-slate-200 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={resetInitiativeRound}
                disabled={initiativeRound === 1 && initiativeTurnIndex === 0}
                title="Reset to Round 1, Turn 1"
                className="gba-btn inline-flex items-center gap-1 px-2 h-7 text-[11px] font-mono text-slate-300 hover:text-white bg-[#131A22] hover:bg-[#232F3E] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>R1</span>
              </button>
            </div>
          </div>

          {/* Active Turn Status & Turn Stepper */}
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {activeTurnEntry ? (
              <div className="text-xs text-right mr-1">
                <div className="font-mono tabular-nums text-[10px] text-slate-400">
                  Turn {initiativeTurnIndex + 1}/{initiativeList.length}
                </div>
                <div className="font-display text-xs font-bold text-[#F6C445] truncate max-w-[165px]">
                  ▶ {activeTurnEntry.characterName}
                </div>
              </div>
            ) : (
              <span className="text-xs text-slate-400">
                Belum ada combatant di arena
              </span>
            )}

            {initiativeList.length > 0 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevInitiativeTurn}
                  title="Previous Turn"
                  aria-label="Previous Turn"
                  className="gba-btn inline-flex items-center justify-center p-1.5 text-slate-200 bg-[#131A22] hover:bg-[#232F3E] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={nextInitiativeTurn}
                  className="gba-btn inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#090D12] bg-[#F6C445] hover:bg-[#FBD160] cursor-pointer"
                >
                  <span>Next Turn</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Add NPC / Wild Pokémon Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddNpc}
            className="pt-3 border-t-2 border-[#090D12] grid grid-cols-12 gap-2 items-end"
          >
            <div className="col-span-12 sm:col-span-5">
              <label className="block text-xs text-slate-300 mb-1">
                NPC / Wild Pokémon
              </label>
              <input
                type="text"
                required
                value={npcName}
                onChange={(e) => setNpcName(e.target.value)}
                placeholder="e.g. Wild Scyther"
                className="gba-well w-full px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div className="col-span-5 sm:col-span-2">
              <label className="block text-xs text-slate-300 mb-1">Init</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={npcInit}
                  onChange={(e) => setNpcInit(e.target.value)}
                  className="gba-well w-full px-2 py-1.5 text-xs font-mono tabular-nums text-white text-right"
                />
                <button
                  type="button"
                  onClick={handleRollNpcRandom}
                  title="Roll 1d20"
                  className="gba-btn p-1.5 bg-[#131A22] hover:bg-[#232F3E] text-[#F6C445] cursor-pointer shrink-0"
                >
                  <Dices className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="col-span-3 sm:col-span-2">
              <label className="block text-xs text-slate-300 mb-1">AC</label>
              <input
                type="number"
                value={npcAc}
                onChange={(e) => setNpcAc(e.target.value)}
                placeholder="14"
                className="gba-well w-full px-2 py-1.5 text-xs font-mono tabular-nums text-white text-right"
              />
            </div>

            <div className="col-span-4 sm:col-span-3 flex items-end gap-1.5">
              <div className="flex-1">
                <label className="block text-xs text-slate-300 mb-1">HP</label>
                <input
                  type="text"
                  value={npcHp}
                  onChange={(e) => setNpcHp(e.target.value)}
                  placeholder="45/45"
                  className="gba-well w-full px-2 py-1.5 text-xs font-mono tabular-nums text-white text-right"
                />
              </div>
              <button
                type="submit"
                className="gba-btn px-3 py-1.5 text-xs font-semibold text-white bg-[#D62839] hover:bg-[#E63946] cursor-pointer shrink-0"
              >
                Add
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Initiative Table */}
      {initiativeList.length === 0 ? (
        <section className="gba-panel p-8 text-center flex flex-col items-center justify-center space-y-3">
          <PokeballIcon variant="great" className="w-10 h-10" />
          <div className="space-y-1 max-w-sm">
            <h2 className="font-display text-xs sm:text-sm font-bold text-white uppercase">
              Belum ada roll Initiative
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Setiap player yang menekan tombol Initiative pada Trainer atau Pokémon
              akan otomatis masuk dan diurutkan dari skor tertinggi ke terendah.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleRollActiveInitiative}
              className="gba-btn inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#D62839] hover:bg-[#E63946] cursor-pointer"
            >
              <Dices className="w-3.5 h-3.5" />
              <span>
                Roll {activeChar.name} ({formatSignedModifier(activeDexMod)})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="gba-btn inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-100 bg-[#263547] hover:bg-[#32445A] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah NPC / Wild Pokémon</span>
            </button>
          </div>
        </section>
      ) : (
        <section className="gba-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-[#090D12] bg-[#11171E] font-display text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  <th className="py-2.5 pl-3 pr-2 w-10 text-center">Turn</th>
                  <th className="py-2.5 px-2">Player &amp; Combatant</th>
                  <th className="py-2.5 px-2 text-right whitespace-nowrap">AC / HP</th>
                  <th className="py-2.5 px-2 text-right whitespace-nowrap">Init</th>
                  <th className="py-2.5 pl-1 pr-3 w-8 text-right">
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
                          className={`gba-btn inline-flex items-center justify-center w-6 h-6 text-[11px] font-mono tabular-nums cursor-pointer ${
                            isTurn
                              ? 'bg-[#F6C445] text-[#090D12] font-bold'
                              : 'bg-[#131A22] text-slate-300 hover:text-white'
                          }`}
                        >
                          {isTurn ? (
                            <PixelCursor className="w-2.5 h-2.5 text-[#090D12]" />
                          ) : (
                            idx + 1
                          )}
                        </button>
                      </td>

                      {/* Combatant & Player */}
                      <td className="py-2.5 px-2 align-middle min-w-[140px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {entry.visibility === 'hidden' && (
                            <Lock
                              className="w-3 h-3 text-[#C084FC] shrink-0"
                              aria-label="Hidden GM Roll"
                            />
                          )}
                          <span
                            className={`font-display text-xs font-bold truncate ${
                              isTurn ? 'text-[#F6C445]' : 'text-white'
                            }`}
                          >
                            {entry.characterName}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 truncate mt-0.5">
                          <span>{entry.playerName}</span>
                          <span className="text-slate-400"> · {entry.breakdown}</span>
                        </div>
                      </td>

                      {/* AC / HP */}
                      <td className="py-2.5 px-2 text-right align-middle font-mono tabular-nums text-[11px] text-slate-200 whitespace-nowrap">
                        {vitals.hpText || vitals.ac !== undefined ? (
                          <div className="inline-flex flex-col items-end leading-tight">
                            {vitals.hpText && (
                              <span className="text-[#38D46A]">{vitals.hpText} HP</span>
                            )}
                            {vitals.ac !== undefined && (
                              <span className="text-[10px] text-slate-300">
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
                            className="gba-btn w-5 h-5 bg-[#11171E] hover:bg-[#232F3E] text-slate-200 text-xs leading-none cursor-pointer"
                          >
                            -
                          </button>
                          <span
                            className={`w-7 text-center font-mono tabular-nums text-xs font-bold ${
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
                            className="gba-btn w-5 h-5 bg-[#11171E] hover:bg-[#232F3E] text-slate-200 text-xs leading-none cursor-pointer"
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
                          className="p-1 text-slate-400 hover:text-[#F04848] cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
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
