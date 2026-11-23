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
import { loadActiveTab, saveActiveTab } from './utils/safeStorage';

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

  const [activeTab, setActiveTab] = useState<'sheet' | 'initiative' | 'history'>(() =>
    loadActiveTab()
  );
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
    saveActiveTab(tab);
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
    <div className="h-[100dvh] w-full bg-[#141A21] text-[#EDF2F7] flex flex-col overflow-hidden">
      <TopBar
        onOpenImport={() => setShowImportModal(true)}
        onExportJson={handleExportJson}
        onToggleMobileLog={handleOpenHistoryFromTopBar}
        unreadLogCount={unreadCount}
      />

      {/* Tablet / OBR Popover / Desktop Mode Switcher (hidden on mobile; mobile uses Bottom Tab Bar) */}
      <div className="hidden md:flex bg-[#18212B] border-b-2 border-[#090D12] px-4 lg:px-6 items-center justify-between gap-2 shrink-0">
        <div
          className="flex items-center gap-1.5 py-1.5 overflow-x-auto min-w-0"
          role="tablist"
          aria-label="Workspace View"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sheet'}
            onClick={() => handleSelectTab('sheet')}
            className={`gba-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'sheet'
                ? 'bg-[#283747] text-white'
                : 'bg-[#131A22] text-slate-300 hover:text-white'
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
            className={`gba-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'initiative'
                ? 'bg-[#283747] text-[#F6C445]'
                : 'bg-[#131A22] text-slate-300 hover:text-white'
            }`}
          >
            {activeTab === 'initiative' ? (
              <PixelCursor className="w-2.5 h-2.5 text-[#F6C445]" />
            ) : (
              <ListOrdered className="w-3.5 h-3.5" />
            )}
            <span>Initiative</span>
            <span className="font-mono tabular-nums text-xs text-slate-300">
              ({initiativeList.length})
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            onClick={() => handleSelectTab('history')}
            className={`gba-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[#283747] text-[#38D46A]'
                : 'bg-[#131A22] text-slate-300 hover:text-white'
            }`}
          >
            {activeTab === 'history' ? (
              <PixelCursor className="w-2.5 h-2.5 text-[#38D46A]" />
            ) : (
              <History className="w-3.5 h-3.5" />
            )}
            <span>History</span>
            <span className="font-mono tabular-nums text-xs text-slate-300">
              ({rollLog.length})
            </span>
            {unreadCount > 0 && (
              <span className="font-mono tabular-nums text-[11px] font-bold bg-[#F6C445] text-[#090D12] px-1.5 leading-tight rounded-sm">
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
          className="gba-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-[#131A22] hover:bg-[#232F3E] text-[#F6C445] max-w-[240px] cursor-pointer shrink-0"
        >
          <span className="font-mono tabular-nums font-bold text-[#090D12] bg-[#F6C445] px-1.5 py-0.5 leading-none rounded-sm">
            R{initiativeRound}
          </span>
          {currentTurn ? (
            <span className="truncate font-medium text-slate-100">
              ▶ {currentTurn.characterName}
            </span>
          ) : (
            <span className="text-slate-300 font-medium">Round {initiativeRound}</span>
          )}
        </button>
      </div>

      {/* Dismissible Latest Roll Banner (< xl) */}
      {latestRoll &&
        activeTab !== 'history' &&
        dismissedRollId !== latestRoll.id && (
          <div
            className={`xl:hidden px-3 py-1.5 border-b-2 border-[#090D12] flex items-center justify-between gap-2 text-xs shrink-0 ${
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
                <span className="text-[#F6C445] font-medium">
                  {getRollCategoryLabel(latestRoll.category)}
                </span>
                <span className="hidden sm:inline">: {latestRoll.label}</span>
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
              className="p-1 text-slate-400 hover:text-white shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

      {/* Main Layout: Left Party Sidebar + Center Sheet/Initiative/History + Right Docked Log */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">
        <PartySidebar
          onOpenAddPokemon={() => setShowAddPokemonModal(true)}
          showMobileStrip={activeTab === 'sheet'}
        />

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

      {/* Thumb-Zone Mobile Bottom Tab Navigation (< md) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden shrink-0 border-t-2 border-[#090D12] bg-[#131A22] grid grid-cols-3 h-14 pb-[env(safe-area-inset-bottom)] z-30"
      >
        <button
          type="button"
          onClick={() => handleSelectTab('sheet')}
          className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'sheet'
              ? 'bg-[#1E2833] text-white border-t-2 border-t-[#E63946] -mt-[2px]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ScrollText
            className={`w-4 h-4 ${
              activeTab === 'sheet' ? 'text-[#E63946]' : 'text-slate-400'
            }`}
          />
          <span>Sheet</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('initiative')}
          className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-xs font-semibold transition-colors cursor-pointer relative ${
            activeTab === 'initiative'
              ? 'bg-[#1E2833] text-[#F6C445] border-t-2 border-t-[#F6C445] -mt-[2px]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-1">
            <ListOrdered
              className={`w-4 h-4 ${
                activeTab === 'initiative' ? 'text-[#F6C445]' : 'text-slate-400'
              }`}
            />
            <span className="font-mono tabular-nums text-[11px] font-bold px-1 rounded-sm bg-[#263342] text-[#F6C445]">
              R{initiativeRound}
            </span>
          </div>
          <span>
            Init{' '}
            <span className="font-mono tabular-nums text-[11px] opacity-80">
              ({initiativeList.length})
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('history')}
          className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-xs font-semibold transition-colors cursor-pointer relative ${
            activeTab === 'history'
              ? 'bg-[#1E2833] text-[#38D46A] border-t-2 border-t-[#38D46A] -mt-[2px]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-1">
            <History
              className={`w-4 h-4 ${
                activeTab === 'history' ? 'text-[#38D46A]' : 'text-slate-400'
              }`}
            />
            {unreadCount > 0 && (
              <span className="font-mono tabular-nums text-[10px] font-bold bg-[#F6C445] text-[#090D12] px-1 rounded-sm leading-tight">
                +{unreadCount}
              </span>
            )}
          </div>
          <span>
            History{' '}
            <span className="font-mono tabular-nums text-[11px] opacity-80">
              ({rollLog.length})
            </span>
          </span>
        </button>
      </nav>

      {showImportModal && (
        <ImportPoke5eModal onClose={() => setShowImportModal(false)} />
      )}

      {showAddPokemonModal && (
        <AddPokemonModal onClose={() => setShowAddPokemonModal(false)} />
      )}
    </div>
  );
}

