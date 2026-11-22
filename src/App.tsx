import { History, ListOrdered, ScrollText, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AddPokemonModal } from './components/AddPokemonModal';
import { CharacterSheet } from './components/CharacterSheet';
import { ImportPoke5eModal } from './components/ImportPoke5eModal';
import { InitiativeTable } from './components/InitiativeTable';
import { PartySidebar } from './components/PartySidebar';
import { PixelCursor } from './components/PokemonAccessories';
import { RollLogPanel } from './components/RollLogPanel';
import { TopBar } from './components/TopBar';
import { useCharacterStore } from './store/useCharacterStore';
import { initObrBridge } from './utils/obrBridge';
import { getRollCategoryLabel } from './utils/pokemon5eRules';

export default function App() {
  const party = useCharacterStore((s) => s.party);
  const rollLog = useCharacterStore((s) => s.rollLog);
  const initiativeList = useCharacterStore((s) => s.initiativeList);
  const initiativeTurnIndex = useCharacterStore((s) => s.initiativeTurnIndex);
  const initiativeRound = useCharacterStore((s) => s.initiativeRound);
  const setObrState = useCharacterStore((s) => s.setObrState);
  const appendRemoteRoll = useCharacterStore((s) => s.appendRemoteRoll);
  const mergeRoomRolls = useCharacterStore((s) => s.mergeRoomRolls);
  const syncRemoteInitiative = useCharacterStore((s) => s.syncRemoteInitiative);

  const [activeTab, setActiveTab] = useState<'sheet' | 'initiative' | 'history'>('sheet');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddPokemonModal, setShowAddPokemonModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dismissedRollId, setDismissedRollId] = useState<string | null>(null);

  const latestRollId = rollLog[0]?.id;
  const prevLatestIdRef = useRef<string | undefined>(latestRollId);

  // Initialize Owlbear Rodeo SDK bridge (broadcast + persistent room metadata)
  useEffect(() => {
    const cleanup = initObrBridge({
      onObrStateChange: setObrState,
      onRemoteRoll: appendRemoteRoll,
      onSyncRoomRolls: mergeRoomRolls,
      onSyncInitiative: syncRemoteInitiative,
    });
    return cleanup;
  }, [setObrState, appendRemoteRoll, mergeRoomRolls, syncRemoteInitiative]);

  // Track unread rolls when History tab is not currently open on < xl viewports
  useEffect(() => {
    if (
      latestRollId &&
      latestRollId !== prevLatestIdRef.current &&
      activeTab !== 'history'
    ) {
      setUnreadCount((c) => c + 1);
    }
    prevLatestIdRef.current = latestRollId;
  }, [latestRollId, activeTab]);

  const handleSelectTab = (tab: 'sheet' | 'initiative' | 'history') => {
    setActiveTab(tab);
    if (tab === 'history') {
      setUnreadCount(0);
    }
  };

  const handleOpenHistoryFromTopBar = () => {
    handleSelectTab(activeTab === 'history' ? 'sheet' : 'history');
  };

  const handleExportJson = () => {
    const payload = JSON.stringify(party, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (party.trainer.name || 'trainer')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    a.href = url;
    a.download = `pokemon5e-${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const latestRoll = rollLog[0];
  const currentTurn = initiativeList[initiativeTurnIndex];

  return (
    <div className="h-screen w-full bg-[#141A21] text-[#EDF2F7] flex flex-col overflow-hidden">
      <TopBar
        onOpenImport={() => setShowImportModal(true)}
        onExportJson={handleExportJson}
        onToggleMobileLog={handleOpenHistoryFromTopBar}
        unreadLogCount={unreadCount}
      />

      {/* GBA PokéNav Mode Switcher: Sheet | Initiative | History (< xl) */}
      <div className="bg-[#18212B] border-b-2 border-[#090D12] px-2.5 sm:px-4 lg:px-6 flex items-center justify-between gap-2 shrink-0">
        <div
          className="flex items-center gap-1 py-1 overflow-x-auto min-w-0"
          role="tablist"
          aria-label="Workspace View"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sheet'}
            onClick={() => handleSelectTab('sheet')}
            className={`gba-btn inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'sheet'
                ? 'bg-[#283747] text-white'
                : 'bg-[#131A22] text-slate-400 hover:text-slate-100'
            }`}
          >
            {activeTab === 'sheet' ? (
              <PixelCursor className="w-2.5 h-2.5 text-[#E63946]" />
            ) : (
              <ScrollText className="w-3.5 h-3.5" />
            )}
            <span>Sheet</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'initiative'}
            onClick={() => handleSelectTab('initiative')}
            className={`gba-btn inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'initiative'
                ? 'bg-[#283747] text-[#F6C445]'
                : 'bg-[#131A22] text-slate-400 hover:text-slate-100'
            }`}
          >
            {activeTab === 'initiative' ? (
              <PixelCursor className="w-2.5 h-2.5 text-[#F6C445]" />
            ) : (
              <ListOrdered className="w-3.5 h-3.5" />
            )}
            <span>Init</span>
            <span className="hidden sm:inline">iative</span>
            <span className="font-mono tabular-nums text-[10px] text-slate-300">
              ({initiativeList.length})
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            onClick={() => handleSelectTab('history')}
            className={`gba-btn inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[#283747] text-[#38D46A]'
                : 'bg-[#131A22] text-slate-400 hover:text-slate-100'
            }`}
          >
            {activeTab === 'history' ? (
              <PixelCursor className="w-2.5 h-2.5 text-[#38D46A]" />
            ) : (
              <History className="w-3.5 h-3.5" />
            )}
            <span>History</span>
            <span className="font-mono tabular-nums text-[10px] text-slate-300">
              ({rollLog.length})
            </span>
            {unreadCount > 0 && (
              <span className="font-mono tabular-nums text-[10px] font-bold bg-[#F6C445] text-[#090D12] px-1 leading-tight">
                +{unreadCount}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleSelectTab('initiative')}
          title={
            currentTurn
              ? `Round ${initiativeRound} · Active Turn: ${currentTurn.characterName}`
              : `Round ${initiativeRound} · Open Initiative Tracker`
          }
          className="gba-btn inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-[#131A22] hover:bg-[#232F3E] text-[#F6C445] max-w-[110px] sm:max-w-[230px] cursor-pointer shrink-0"
        >
          <span className="font-mono tabular-nums font-bold text-[#090D12] bg-[#F6C445] px-1 leading-tight">
            R{initiativeRound}
          </span>
          {currentTurn ? (
            <span className="truncate text-slate-100">▶ {currentTurn.characterName}</span>
          ) : (
            <span className="hidden sm:inline text-slate-300">
              Round {initiativeRound}
            </span>
          )}
        </button>
      </div>

      {/* Dismissible GBA Battle Dialogue Latest Roll Banner (< xl) */}
      {latestRoll &&
        activeTab !== 'history' &&
        dismissedRollId !== latestRoll.id && (
          <div
            className={`xl:hidden px-2.5 sm:px-3.5 py-1 border-b-2 border-[#090D12] flex items-center justify-between gap-2 text-xs ${
              latestRoll.visibility === 'hidden' ? 'bg-[#2A1D3D]' : 'bg-[#1C2530]'
            }`}
          >
            <button
              type="button"
              onClick={() => handleSelectTab('history')}
              className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left cursor-pointer"
            >
              <span className="truncate text-slate-200">
                {latestRoll.visibility === 'hidden' ? '[GM] ' : ''}
                <strong className="text-white">{latestRoll.characterName}</strong> —{' '}
                <span className="text-[#F6C445]">
                  {getRollCategoryLabel(latestRoll.category)}
                </span>
                : {latestRoll.label}
              </span>
              <span
                className={`font-mono font-bold shrink-0 text-xs ${
                  latestRoll.isCrit
                    ? 'text-[#38D46A]'
                    : latestRoll.isFumble
                      ? 'text-[#F04848]'
                      : 'text-[#F6C445]'
                }`}
              >
                {latestRoll.total}
                {latestRoll.isCrit ? ' CRIT' : latestRoll.isFumble ? ' NAT1' : ''}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setDismissedRollId(latestRoll.id)}
              aria-label="Dismiss roll notification"
              className="p-0.5 text-slate-400 hover:text-white shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

      {/* Main Layout: Left Party Sidebar + Center Sheet/Initiative/History + Right Docked Log */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">
        <PartySidebar onOpenAddPokemon={() => setShowAddPokemonModal(true)} />

        {activeTab === 'sheet' && (
          <CharacterSheet onOpenImport={() => setShowImportModal(true)} />
        )}
        {activeTab === 'initiative' && <InitiativeTable />}
        {activeTab === 'history' && <RollLogPanel isFullWidth />}

        {/* Desktop Docked Roll Log (hidden when dedicated full History tab is open) */}
        {activeTab !== 'history' && (
          <div className="hidden xl:flex h-full">
            <RollLogPanel onExpandTab={() => handleSelectTab('history')} />
          </div>
        )}
      </div>

      {showImportModal && (
        <ImportPoke5eModal onClose={() => setShowImportModal(false)} />
      )}

      {showAddPokemonModal && (
        <AddPokemonModal onClose={() => setShowAddPokemonModal(false)} />
      )}
    </div>
  );
}
