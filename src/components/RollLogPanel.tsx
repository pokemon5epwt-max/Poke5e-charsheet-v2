import {
  ChevronDown,
  ChevronUp,
  Dices,
  Eye,
  EyeOff,
  Filter,
  Lock,
  Maximize2,
  RotateCcw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { selectActiveCharacter, useCharacterStore } from '../store/useCharacterStore';
import { DieChip, RollCategory, RollEntry } from '../types/pokemon5e';
import { parseDiceExpression } from '../utils/diceEngine';
import { TYPE_STYLES, getRollCategoryLabel } from '../utils/pokemon5eRules';
import { PokeballIcon } from './PokemonAccessories';

interface RollLogPanelProps {
  onCloseMobile?: () => void;
  onExpandTab?: () => void;
  isFullWidth?: boolean;
}

const QUICK_DICE = [
  { label: 'd4', expr: '1d4' },
  { label: 'd6', expr: '1d6' },
  { label: 'd8', expr: '1d8' },
  { label: 'd10', expr: '1d10' },
  { label: 'd12', expr: '1d12' },
  { label: 'd20', expr: '1d20' },
  { label: 'd%', expr: '1d100' },
] as const;

const WITCHDICE_PRESETS = [
  { label: '4d6kh3', title: 'Roll 4d6 keep highest 3' },
  { label: '2d6!', title: 'Exploding 2d6' },
  { label: '2d8r1', title: 'Reroll 1s' },
  { label: '1d20 adv', title: 'd20 with Advantage' },
] as const;

const CATEGORY_FILTER_OPTIONS: Array<{ id: 'all' | RollCategory; label: string }> = [
  { id: 'all', label: 'Semua Cek' },
  { id: 'initiative', label: 'Initiative' },
  { id: 'attack', label: 'Attack' },
  { id: 'damage', label: 'Damage' },
  { id: 'skill', label: 'Skill' },
  { id: 'save', label: 'Save' },
  { id: 'ability', label: 'Ability' },
  { id: 'custom', label: 'Custom' },
];

function DieChipsRow({ roll }: { roll: RollEntry }) {
  const chips: DieChip[] = useMemo(() => {
    if (roll.dieChips && roll.dieChips.length > 0) {
      return roll.dieChips;
    }
    if (roll.diceRolls.length === 0) return [];
    const inferredSides =
      roll.category === 'damage' || roll.category === 'custom'
        ? (() => {
            const m = roll.formula.match(/d(\d+)/i);
            return m ? parseInt(m[1], 10) : 6;
          })()
        : 20;
    return roll.diceRolls.map((val, idx) => ({
      sides: inferredSides,
      value: val,
      kept:
        typeof roll.selectedDie === 'number' && roll.diceRolls.length > 1
          ? val === roll.selectedDie &&
            roll.diceRolls.findIndex((x) => x === roll.selectedDie) === idx
          : true,
    }));
  }, [roll]);

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {chips.map((chip, idx) => {
        const isMax = chip.value === chip.sides && chip.kept;
        const isMin = chip.value === 1 && chip.kept;
        return (
          <span
            key={idx}
            title={
              chip.rerolled && chip.originalValue !== undefined
                ? `d${chip.sides}: rerolled from ${chip.originalValue}`
                : `d${chip.sides}${chip.exploded ? ' (exploded)' : ''}${!chip.kept ? ' (dropped)' : ''}`
            }
            className={`inline-flex items-center gap-0.5 px-2 py-1 border-2 border-[#090D12] font-mono text-xs leading-none ${
              !chip.kept
                ? 'bg-[#10161D] text-slate-500 line-through opacity-55'
                : chip.exploded
                  ? 'bg-[#3D2E10] text-[#F6C445] font-bold'
                  : isMax
                    ? 'bg-[#1B4B2E] text-[#38D46A] font-bold'
                    : isMin
                      ? 'bg-[#4A1922] text-[#F04848] font-bold'
                      : 'bg-[#141D26] text-slate-100 font-bold'
            }`}
          >
            <span className="text-[11px] text-slate-400 font-normal">d{chip.sides}:</span>
            <span>{chip.value}</span>
            {chip.exploded && <span className="text-[#F6C445]">!</span>}
            {chip.rerolled && <span className="text-[#38BDF8]">↻</span>}
          </span>
        );
      })}
    </div>
  );
}

export function RollLogPanel({
  onCloseMobile,
  onExpandTab,
  isFullWidth = false,
}: RollLogPanelProps) {
  const rollMode = useCharacterStore((s) => s.rollMode);
  const rollVisibility = useCharacterStore((s) => s.rollVisibility);
  const diceIntegrationMode = useCharacterStore((s) => s.diceIntegrationMode);
  const rollLog = useCharacterStore((s) => s.rollLog);
  const obrState = useCharacterStore((s) => s.obrState);
  const activeChar = useCharacterStore(selectActiveCharacter);

  const setRollMode = useCharacterStore((s) => s.setRollMode);
  const setRollVisibility = useCharacterStore((s) => s.setRollVisibility);
  const setDiceIntegrationMode = useCharacterStore((s) => s.setDiceIntegrationMode);
  const performRoll = useCharacterStore((s) => s.performRoll);
  const clearRollLog = useCharacterStore((s) => s.clearRollLog);

  const [customExpr, setCustomExpr] = useState('1d20 + 5');
  const [customLabel, setCustomLabel] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [showControlsInFull, setShowControlsInFull] = useState(true);

  // Full-tab filters so DM & players can inspect all player rolls clearly
  const [selectedPlayer, setSelectedPlayer] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | RollCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const playerFilters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of rollLog) {
      const name = entry.rollerName || 'Player';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  }, [rollLog]);

  const filteredRolls = useMemo(() => {
    if (!isFullWidth) return rollLog;
    const q = searchQuery.trim().toLowerCase();
    return rollLog.filter((roll) => {
      if (selectedPlayer !== 'all' && (roll.rollerName || 'Player') !== selectedPlayer) {
        return false;
      }
      if (selectedCategory !== 'all' && roll.category !== selectedCategory) {
        return false;
      }
      if (q) {
        const hay = `${roll.characterName} ${roll.rollerName} ${roll.label} ${roll.formula} ${roll.breakdown}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [isFullWidth, rollLog, selectedPlayer, selectedCategory, searchQuery]);

  const handleCustomRoll = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customExpr.trim();
    if (!trimmed) return;
    const parsed = parseDiceExpression(trimmed);
    if (!parsed.isValid) {
      setCustomError(
        `Format tidak valid (${parsed.error ?? 'contoh: 1d20 + 5, 4d6kh3, 2d6!, 2d8r1'})`
      );
      return;
    }
    setCustomError(null);
    const reason = customLabel.trim();
    performRoll({
      characterId: activeChar.id,
      characterName: activeChar.name,
      label: reason ? `${reason} (${trimmed})` : trimmed,
      category: 'custom',
      diceExpression: trimmed,
    });
  };

  const handleQuickDieRoll = (expr: string, dieLabel: string) => {
    setCustomError(null);
    const reason = customLabel.trim();
    performRoll({
      characterId: activeChar.id,
      characterName: activeChar.name,
      label: reason ? `${reason} (${dieLabel})` : `Quick Roll ${dieLabel}`,
      category: 'custom',
      diceExpression: expr,
    });
  };

  const handleRerollEntry = (roll: RollEntry) => {
    if (
      roll.category !== 'custom' &&
      roll.category !== 'damage' &&
      typeof roll.selectedDie === 'number'
    ) {
      const mod = roll.total - roll.selectedDie;
      performRoll({
        characterId: roll.characterId,
        characterName: roll.characterName,
        label: roll.label,
        category: roll.category,
        modifier: mod,
        moveType: roll.moveType,
      });
      return;
    }

    const cleanLabel = roll.label.replace(/ \(CRIT 2×\)$/, '');
    performRoll({
      characterId: roll.characterId,
      characterName: roll.characterName,
      label: cleanLabel,
      category: roll.category,
      diceExpression: roll.formula,
      moveType: roll.moveType,
    });
  };

  const renderRollCard = (roll: RollEntry) => {
    const typeStyle = roll.moveType ? TYPE_STYLES[roll.moveType] : null;
    const categoryLabel = getRollCategoryLabel(roll.category);
    const timeStr = new Date(roll.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <div
        key={roll.id}
        className={`p-3 border-2 border-[#090D12] flex flex-col justify-between ${
          roll.visibility === 'hidden'
            ? 'bg-[#2A1D3D] shadow-[inset_2px_2px_0_#6B3FA0,inset_-2px_-2px_0_#140D1E]'
            : 'gba-panel'
        }`}
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {roll.visibility === 'hidden' && (
                  <Lock
                    className="w-3 h-3 text-[#C084FC] shrink-0"
                    aria-label="Hidden GM Roll"
                  />
                )}
                <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 bg-[#11171E] border border-[#090D12] text-[#38BDF8] truncate max-w-[140px]">
                  {roll.rollerName || 'Player'}
                </span>
                <span className="font-display text-xs font-bold text-white truncate">
                  {roll.characterName}
                </span>
                <span className="font-mono text-[11px] text-slate-400 shrink-0">
                  · {timeStr}
                </span>
              </div>

              {/* Explicit Check Purpose & Specific Roll Label */}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {typeStyle && (
                  <span
                    className="w-2.5 h-2.5 border border-[#090D12] shrink-0"
                    style={{ backgroundColor: typeStyle.hex }}
                  />
                )}
                <span className="font-mono text-[11px] font-bold text-[#F6C445] uppercase">
                  [{categoryLabel}]
                </span>
                <span className="text-xs sm:text-sm font-semibold text-slate-100 break-words">
                  {roll.label}
                </span>
                {roll.rollMode !== 'normal' && (
                  <span className="font-mono text-[11px] font-bold text-[#38D46A] uppercase">
                    ({roll.rollMode === 'advantage' ? 'ADV' : 'DIS'})
                  </span>
                )}
              </div>
            </div>

            <div
              className={`font-mono text-lg font-bold px-2.5 py-0.5 border-2 border-[#090D12] shrink-0 ${
                roll.isCrit
                  ? 'text-[#090D12] bg-[#38D46A]'
                  : roll.isFumble
                    ? 'text-white bg-[#D62839]'
                    : 'text-[#F6C445] bg-[#10161D]'
              }`}
            >
              {roll.total}
            </div>
          </div>

          {/* WitchDice-style individual die chips */}
          <DieChipsRow roll={roll} />
        </div>

        <div className="mt-2.5 pt-2 border-t-2 border-[#090D12] flex items-center justify-between gap-2 text-xs font-mono text-slate-300">
          <span className="break-all leading-snug">{roll.breakdown}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {roll.isCrit && <span className="text-[#38D46A] font-bold">CRIT</span>}
            {roll.isFumble && <span className="text-[#F04848] font-bold">NAT1</span>}
            <span className="text-[11px] text-slate-400">
              {roll.visibility === 'hidden' ? 'GM' : 'ALL'}
            </span>
            <button
              type="button"
              onClick={() => handleRerollEntry(roll)}
              title="Re-roll formula ini"
              aria-label={`Re-roll ${roll.label}`}
              className="gba-btn w-7 h-7 inline-flex items-center justify-center bg-[#131A22] hover:bg-[#232F3E] text-slate-300 hover:text-[#F6C445] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ------------------------------------------------------------------ */
  /* DEDICATED FULL-TAB HISTORY WORKSPACE (spacious, scrollable, filtered) */
  /* ------------------------------------------------------------------ */
  if (isFullWidth) {
    return (
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-3.5 sm:space-y-4 gba-canvas-bg">
        {/* Top WitchDice Roller & Controls Panel */}
        <section className="gba-panel p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h1 className="font-display text-base sm:text-lg font-bold text-white tracking-tight">
                History Roll Room ({rollLog.length})
              </h1>
              <span className="font-mono text-[11px] px-2 py-0.5 bg-[#131A22] border border-[#090D12] text-[#F6C445]">
                {obrState.isAvailable
                  ? `Room · ${obrState.partyCount} Player`
                  : 'Local Preview'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowControlsInFull((v) => !v)}
                className="gba-btn inline-flex items-center gap-1.5 px-3 min-h-[36px] text-xs font-medium text-slate-200 bg-[#131A22] hover:bg-[#232F3E] cursor-pointer"
              >
                <Dices className="w-3.5 h-3.5 text-[#F6C445]" />
                <span>Dice Tray</span>
                {showControlsInFull ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {rollLog.length > 0 && (
                <button
                  type="button"
                  onClick={clearRollLog}
                  className="gba-btn inline-flex items-center gap-1.5 px-3 min-h-[36px] text-xs font-medium text-slate-300 hover:text-[#F04848] bg-[#131A22] hover:bg-[#4A1922] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {showControlsInFull && (
            <div className="pt-2.5 border-t-2 border-[#090D12] space-y-3">
              {/* Row 1: Roll Mode + Visibility + Engine */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="gba-well grid grid-cols-3 gap-1 p-1">
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
                      className={`min-h-[34px] text-xs font-semibold cursor-pointer ${
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

                <div className="gba-well grid grid-cols-2 gap-1 p-1">
                  <button
                    type="button"
                    onClick={() => setRollVisibility('visible')}
                    className={`inline-flex items-center justify-center gap-1.5 min-h-[34px] text-xs font-semibold cursor-pointer ${
                      rollVisibility === 'visible'
                        ? 'bg-[#267347] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Player &amp; GM</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRollVisibility('hidden')}
                    className={`inline-flex items-center justify-center gap-1.5 min-h-[34px] text-xs font-semibold cursor-pointer ${
                      rollVisibility === 'hidden'
                        ? 'bg-[#5B328A] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hidden (GM)</span>
                  </button>
                </div>

                <select
                  value={diceIntegrationMode}
                  onChange={(e) =>
                    setDiceIntegrationMode(e.target.value as 'internal' | 'obr-dice-plus')
                  }
                  aria-label="Dice Integration Mode"
                  className="gba-well px-2.5 min-h-[42px] sm:min-h-[34px] text-slate-100 text-xs"
                >
                  <option value="internal">WitchDice Engine + OBR Sync</option>
                  <option value="obr-dice-plus">WitchDice + Dice+ Broadcast</option>
                </select>
              </div>

              {/* Row 2: Quick Die Tray (WitchDice style) + Formula Presets */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="grid grid-cols-7 sm:flex sm:flex-wrap items-center gap-1.5">
                  {QUICK_DICE.map((die) => (
                    <button
                      key={die.label}
                      type="button"
                      onClick={() => handleQuickDieRoll(die.expr, die.label)}
                      className="gba-btn px-2 sm:px-3 min-h-[36px] font-mono text-xs font-bold text-[#F6C445] bg-[#131A22] hover:bg-[#232F3E] cursor-pointer text-center"
                      title={`Roll ${die.expr}`}
                    >
                      {die.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {WITCHDICE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setCustomExpr(preset.label);
                        setCustomError(null);
                      }}
                      title={preset.title}
                      className="px-2.5 py-1 font-mono text-[11px] text-slate-300 hover:text-white bg-[#10161D] border border-[#090D12] cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 3: Custom Formula + Check Reason */}
              <form
                onSubmit={handleCustomRoll}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
              >
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Keterangan cek (misal: Perception / Capture)"
                  aria-label="Roll check description"
                  className="gba-well sm:col-span-5 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                />
                <div className="sm:col-span-7 flex items-center gap-2">
                  <input
                    type="text"
                    value={customExpr}
                    onChange={(e) => {
                      setCustomExpr(e.target.value);
                      if (customError) setCustomError(null);
                    }}
                    placeholder="1d20 + 5, 4d6kh3, 2d6!, 2d8r1, d%"
                    aria-label="Custom dice formula"
                    className="gba-well flex-1 px-3 py-2 text-xs font-mono text-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="gba-btn inline-flex items-center gap-1.5 px-3.5 min-h-[36px] text-xs font-semibold text-white bg-[#D62839] hover:bg-[#E63946] cursor-pointer shrink-0"
                  >
                    <Dices className="w-4 h-4" />
                    <span>Roll</span>
                  </button>
                </div>
              </form>
              {customError && (
                <p className="text-xs text-[#F04848]">{customError}</p>
              )}
            </div>
          )}
        </section>

        {/* Player & Category Filters */}
        <section className="gba-panel p-3 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 justify-between">
            {/* Player Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-300 mr-1">
                <Users className="w-3.5 h-3.5 text-[#38BDF8]" />
                Player:
              </span>
              <button
                type="button"
                onClick={() => setSelectedPlayer('all')}
                className={`gba-btn px-2.5 min-h-[32px] text-xs font-mono cursor-pointer ${
                  selectedPlayer === 'all'
                    ? 'bg-[#F6C445] text-[#090D12] font-bold'
                    : 'bg-[#131A22] text-slate-300 hover:text-white'
                }`}
              >
                Semua ({rollLog.length})
              </button>
              {playerFilters.map((pf) => (
                <button
                  key={pf.name}
                  type="button"
                  onClick={() => setSelectedPlayer(pf.name)}
                  className={`gba-btn px-2.5 min-h-[32px] text-xs font-mono cursor-pointer ${
                    selectedPlayer === pf.name
                      ? 'bg-[#38BDF8] text-[#090D12] font-bold'
                      : 'bg-[#131A22] text-slate-300 hover:text-white'
                  }`}
                >
                  {pf.name} ({pf.count})
                </button>
              ))}
            </div>

            {/* Category + Search */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex items-center shrink-0">
                <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <select
                  value={selectedCategory}
                  onChange={(e) =>
                    setSelectedCategory(e.target.value as 'all' | RollCategory)
                  }
                  aria-label="Filter roll category"
                  className="gba-well pl-7 pr-2.5 py-1.5 text-xs text-slate-100"
                >
                  {CATEGORY_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative flex-1 sm:w-44">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama / cek..."
                  aria-label="Search roll history"
                  className="gba-well w-full pl-8 pr-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Full-Width Roll History Grid */}
        {filteredRolls.length === 0 ? (
          <section className="gba-panel p-8 text-center space-y-2 flex flex-col items-center">
            <PokeballIcon variant="poke" className="w-9 h-9" />
            <p className="font-display text-xs font-bold text-white uppercase">
              {rollLog.length === 0
                ? 'Belum ada History Roll'
                : 'Tidak ada roll yang cocok dengan filter'}
            </p>
            <p className="text-xs text-slate-300 max-w-md">
              {rollLog.length === 0
                ? 'Semua roll dari Anda, player lain, dan GM akan tampil lengkap di sini beserta dadu individual dan keterangan ceknya.'
                : 'Coba ubah filter Player, Kategori, atau kata kunci pencarian.'}
            </p>
          </section>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
            {filteredRolls.map((roll) => renderRollCard(roll))}
          </section>
        )}
      </main>
    );
  }

  /* ------------------------------------------------------------------ */
  /* DOCKED RIGHT SIDEBAR MODE (xl+ when viewing Sheet or Initiative)   */
  /* ------------------------------------------------------------------ */
  return (
    <aside className="w-full xl:w-[340px] border-l-2 border-[#090D12] shrink-0 bg-[#17202A] flex flex-col h-full min-h-0">
      {/* Header & Roll Controls */}
      <div className="p-3.5 border-b-2 border-[#090D12] space-y-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-xs font-bold text-white uppercase truncate">
            Roll Log ({rollLog.length})
          </h2>
          <div className="flex items-center gap-1.5 shrink-0">
            {onExpandTab && (
              <button
                type="button"
                onClick={onExpandTab}
                title="Buka Tab History Penuh"
                className="gba-btn inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-[#F6C445] bg-[#131A22] hover:bg-[#232F3E] cursor-pointer"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Full Tab</span>
              </button>
            )}
            {rollLog.length > 0 && (
              <button
                type="button"
                onClick={clearRollLog}
                className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-[#F04848] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close Roll Log"
                className="xl:hidden p-1 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Advantage / Normal / Disadvantage Segmented Toggle */}
        <div className="gba-well grid grid-cols-3 gap-1 p-1">
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
              className={`py-1 text-xs font-semibold cursor-pointer transition-colors ${
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

        {/* Visible / Hidden Toggle */}
        <div className="gba-well grid grid-cols-2 gap-1 p-1">
          <button
            type="button"
            onClick={() => setRollVisibility('visible')}
            className={`inline-flex items-center justify-center gap-1.5 py-1 text-xs font-semibold cursor-pointer ${
              rollVisibility === 'visible'
                ? 'bg-[#267347] text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Player &amp; GM</span>
          </button>
          <button
            type="button"
            onClick={() => setRollVisibility('hidden')}
            className={`inline-flex items-center justify-center gap-1.5 py-1 text-xs font-semibold cursor-pointer ${
              rollVisibility === 'hidden'
                ? 'bg-[#5B328A] text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Hidden (GM)</span>
          </button>
        </div>

        {/* Compact Quick Die Strip */}
        <div className="flex items-center justify-between gap-1">
          {QUICK_DICE.map((die) => (
            <button
              key={die.label}
              type="button"
              onClick={() => handleQuickDieRoll(die.expr, die.label)}
              className="gba-btn flex-1 min-h-[32px] font-mono text-[11px] font-bold text-[#F6C445] bg-[#131A22] hover:bg-[#232F3E] cursor-pointer"
              title={`Roll ${die.expr}`}
            >
              {die.label}
            </button>
          ))}
        </div>

        {/* Custom Dice Expression + Purpose Label */}
        <form onSubmit={handleCustomRoll} className="space-y-1.5">
          <input
            type="text"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="Untuk cek apa? (misal: Cek Jebakan)"
            aria-label="Roll check description"
            className="gba-well w-full px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none"
          />
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={customExpr}
              onChange={(e) => {
                setCustomExpr(e.target.value);
                if (customError) setCustomError(null);
              }}
              placeholder="1d20+5 / 4d6kh3 / 2d6!"
              aria-label="Custom dice formula"
              className="gba-well flex-1 px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
            />
            <button
              type="submit"
              className="gba-btn inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#D62839] hover:bg-[#E63946] cursor-pointer shrink-0"
            >
              <Dices className="w-3.5 h-3.5" />
              <span>Roll</span>
            </button>
          </div>
          {customError && <p className="text-xs text-[#F04848]">{customError}</p>}
        </form>
      </div>

      {/* Roll Log List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 gba-canvas-bg">
        {rollLog.length === 0 ? (
          <div className="gba-panel p-6 text-center space-y-2 flex flex-col items-center">
            <PokeballIcon variant="poke" className="w-8 h-8" />
            <p className="font-display text-xs font-bold text-white">BELUM ADA HISTORY ROLL</p>
            <p className="text-xs text-slate-300">
              Setiap roll Ability, Save, Skill, Move, atau Initiative akan muncul di sini.
            </p>
          </div>
        ) : (
          rollLog.map((roll) => renderRollCard(roll))
        )}
      </div>

      {/* OBR Context Footer */}
      <div className="px-4 py-2 border-t-2 border-[#090D12] bg-[#131A22] text-xs text-slate-300 flex items-center justify-between">
        <span>
          {obrState.isAvailable
            ? `Owlbear Room (${obrState.partyCount})`
            : 'Browser Preview'}
        </span>
        <span className="font-mono text-[10px] text-[#F6C445]">{obrState.role}</span>
      </div>
    </aside>
  );
}
