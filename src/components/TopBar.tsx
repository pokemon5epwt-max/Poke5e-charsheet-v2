import OBR from '@owlbear-rodeo/sdk';
import {
  Check,
  Download,
  FileUp,
  History,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useCharacterStore } from '../store/useCharacterStore';
import { setObrPopoverSize } from '../utils/obrBridge';
import { importFromPoke5eLink } from '../utils/poke5eImporter';
import { PokedexLens } from './PokemonAccessories';

interface TopBarProps {
  onOpenImport: () => void;
  onExportJson: () => void;
  onToggleMobileLog: () => void;
  unreadLogCount: number;
}

export function TopBar({
  onOpenImport,
  onExportJson,
  onToggleMobileLog,
  unreadLogCount,
}: TopBarProps) {
  const obrState = useCharacterStore((s) => s.obrState);
  const party = useCharacterStore((s) => s.party);
  const importHistory = useCharacterStore((s) => s.importHistory);
  const loadSavedTrainer = useCharacterStore((s) => s.loadSavedTrainer);
  const updatePartyFromImport = useCharacterStore((s) => s.updatePartyFromImport);
  const resetToStarterParty = useCharacterStore((s) => s.resetToStarterParty);
  const [isExpandedObr, setIsExpandedObr] = useState(false);
  const [isUpdatingSheet, setIsUpdatingSheet] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMobileMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMobileMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showMobileMenu]);

  const activeLinkedKey =
    party.trainer.poke5eMeta?.readKey || party.trainer.poke5eMeta?.trainerId || '';
  const fallbackSaved = !activeLinkedKey
    ? importHistory.find((item) => Boolean(item.readKey || item.trainerId))
    : undefined;
  const linkedKey =
    activeLinkedKey || fallbackSaved?.readKey || fallbackSaved?.trainerId || '';
  const targetTrainerName =
    activeLinkedKey ? party.trainer.name : fallbackSaved?.trainerName || party.trainer.name;

  const handleQuickUpdateSheet = async () => {
    if (!linkedKey || isUpdatingSheet) return;
    setIsUpdatingSheet(true);
    setJustUpdated(false);
    try {
      if (fallbackSaved) {
        loadSavedTrainer(fallbackSaved.id);
      }
      const result = await importFromPoke5eLink(linkedKey);
      if (result.success && result.workspace) {
        updatePartyFromImport(result.workspace, 'link');
        setJustUpdated(true);
        setTimeout(() => setJustUpdated(false), 2500);
        if (OBR.isAvailable && OBR.isReady) {
          void OBR.notification
            .show(
              `Sheet "${result.workspace.trainer.name}" (${result.workspace.pokemon.length} Pokémon) updated from poke5e.app`,
              'SUCCESS'
            )
            .catch(() => {});
        }
      } else {
        if (OBR.isAvailable && OBR.isReady) {
          void OBR.notification
            .show(result.message || 'Gagal update dari poke5e.app', 'ERROR')
            .catch(() => {});
        }
        onOpenImport();
      }
    } finally {
      setIsUpdatingSheet(false);
    }
  };

  const handleToggleObrSize = () => {
    const next = !isExpandedObr;
    setIsExpandedObr(next);
    void setObrPopoverSize(next ? 980 : 540, next ? 700 : 640);
  };

  return (
    <header className="h-12 border-b-2 border-[#090D12] bg-[#9E1E2A] shadow-[inset_0_2px_0_#D84A57,inset_0_-2px_0_#6B111A] px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2 shrink-0 relative z-30">
      <div className="flex items-center gap-2 min-w-0">
        <PokedexLens className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
        <span className="font-display text-sm sm:text-base font-bold tracking-tight text-white drop-shadow-[1px_1px_0_#090D12] whitespace-nowrap shrink-0">
          Pokémon 5e
        </span>
        {obrState.isAvailable && (
          <span className="hidden sm:inline text-xs font-medium text-rose-100/90 truncate max-w-[140px]">
            · {obrState.playerName}
          </span>
        )}
      </div>

      <nav className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenImport}
          className="gba-btn inline-flex items-center gap-1.5 px-2.5 sm:px-3 min-h-[36px] text-xs font-semibold text-slate-100 bg-[#1E2833] hover:bg-[#2A3746] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <FileUp className="w-3.5 h-3.5 text-[#F6C445]" />
          <span>Import</span>
        </button>

        {linkedKey && (
          <button
            type="button"
            disabled={isUpdatingSheet}
            onClick={() => void handleQuickUpdateSheet()}
            title={`Update sheet "${targetTrainerName}" dari poke5e.app`}
            className="gba-btn inline-flex items-center gap-1.5 px-2.5 sm:px-3 min-h-[36px] text-xs font-semibold text-white bg-[#267347] hover:bg-[#2E8A56] disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {justUpdated ? (
              <Check className="w-3.5 h-3.5 text-[#F6C445]" />
            ) : (
              <RefreshCw
                className={`w-3.5 h-3.5 ${isUpdatingSheet ? 'animate-spin' : ''}`}
              />
            )}
            <span>
              {isUpdatingSheet ? 'Sync...' : justUpdated ? 'Updated' : 'Update'}
            </span>
          </button>
        )}

        {/* Desktop & Tablet Actions */}
        <button
          type="button"
          onClick={onExportJson}
          title="Export Party JSON"
          className="gba-btn hidden md:inline-flex items-center gap-1.5 px-3 min-h-[36px] text-xs font-semibold text-slate-100 bg-[#1E2833] hover:bg-[#2A3746] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>

        <button
          type="button"
          onClick={resetToStarterParty}
          title="Load sample Trainer & Pokémon party"
          className="gba-btn hidden md:inline-flex items-center gap-1.5 px-3 min-h-[36px] text-xs font-semibold text-slate-200 bg-[#1E2833] hover:bg-[#2A3746] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Sample</span>
        </button>

        {obrState.isAvailable && (
          <button
            type="button"
            onClick={handleToggleObrSize}
            title={isExpandedObr ? 'Shrink to Medium Popover (540×640)' : 'Expand Popover'}
            className="gba-btn hidden md:inline-flex items-center justify-center w-9 h-9 text-slate-100 bg-[#1E2833] hover:bg-[#2A3746] shrink-0 cursor-pointer"
          >
            {isExpandedObr ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Log shortcut for tablet/OBR popover (md..lg) */}
        <button
          type="button"
          onClick={onToggleMobileLog}
          className="gba-btn hidden md:inline-flex xl:hidden items-center gap-1.5 px-3 min-h-[36px] text-xs font-semibold text-[#090D12] bg-[#F6C445] hover:bg-[#FBD160] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <History className="w-3.5 h-3.5" />
          <span>Log</span>
          {unreadLogCount > 0 && (
            <span className="font-mono text-xs font-bold">({unreadLogCount})</span>
          )}
        </button>

        {/* Compact Overflow Menu for Mobile (< md) */}
        <div className="relative md:hidden" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMobileMenu((prev) => !prev)}
            aria-expanded={showMobileMenu}
            aria-label="More actions"
            className="gba-btn inline-flex items-center justify-center w-9 h-9 text-slate-100 bg-[#1E2833] hover:bg-[#2A3746] shrink-0 cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMobileMenu && (
            <div className="gba-panel absolute right-0 top-full mt-1.5 w-48 p-1.5 space-y-1.5 z-50 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  onExportJson();
                  setShowMobileMenu(false);
                }}
                className="gba-btn w-full flex items-center gap-2.5 px-3 min-h-[44px] text-xs font-semibold text-slate-100 bg-[#141C24] hover:bg-[#24313F] cursor-pointer text-left"
              >
                <Download className="w-4 h-4 text-[#38BDF8] shrink-0" />
                <span>Export JSON</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  resetToStarterParty();
                  setShowMobileMenu(false);
                }}
                className="gba-btn w-full flex items-center gap-2.5 px-3 min-h-[44px] text-xs font-semibold text-slate-100 bg-[#141C24] hover:bg-[#24313F] cursor-pointer text-left"
              >
                <RotateCcw className="w-4 h-4 text-[#F6C445] shrink-0" />
                <span>Load Sample Party</span>
              </button>

              {obrState.isAvailable && (
                <button
                  type="button"
                  onClick={() => {
                    handleToggleObrSize();
                    setShowMobileMenu(false);
                  }}
                  className="gba-btn w-full flex items-center gap-2.5 px-3 min-h-[44px] text-xs font-semibold text-slate-100 bg-[#141C24] hover:bg-[#24313F] cursor-pointer text-left"
                >
                  {isExpandedObr ? (
                    <Minimize2 className="w-4 h-4 text-slate-300 shrink-0" />
                  ) : (
                    <Maximize2 className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                  <span>{isExpandedObr ? 'Shrink Popover' : 'Expand Popover'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
