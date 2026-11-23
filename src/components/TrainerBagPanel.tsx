import {
  AlertCircle,
  Backpack,
  Check,
  Coins,
  Edit3,
  HeartPulse,
  KeyRound,
  Link2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useCharacterStore } from '../store/useCharacterStore';
import { TrainerItem, TrainerItemCategory, TrainerSheet } from '../types/pokemon5e';
import { Poke5eItemRef, getPoke5eCatalogItems } from '../utils/poke5eImporter';
import {
  TRAINER_ITEM_CATEGORIES,
  TRAINER_ITEM_PRESETS,
  mapPoke5eItemTypeToCategory,
  normalizeTrainerItems,
} from '../utils/pokemon5eRules';
import { PokeballIcon } from './PokemonAccessories';

interface TrainerBagPanelProps {
  trainer: TrainerSheet;
  isSheetEditing: boolean;
  onUpdateTrainer: (patch: Partial<TrainerSheet>) => void;
  onAddItem: (item: Omit<TrainerItem, 'id'>) => void;
  onUpdateItem: (itemId: string, patch: Partial<TrainerItem>) => void;
  onAdjustQty: (itemId: string, delta: number) => void;
  onRemoveItem: (itemId: string) => void;
  onOpenImport?: () => void;
}

const CATEGORY_LABEL_MAP: Record<TrainerItemCategory, string> = {
  pokeballs: 'Poké Balls',
  medicine: 'Medicine',
  held: 'Held Items',
  key: 'Key Items',
  gear: 'Gear',
};

function CategoryIcon({
  category,
  itemName,
}: {
  category: TrainerItemCategory;
  itemName: string;
}) {
  if (category === 'pokeballs') {
    const lower = itemName.toLowerCase();
    const variant = lower.includes('ultra')
      ? 'ultra'
      : lower.includes('great')
        ? 'great'
        : 'poke';
    return <PokeballIcon variant={variant} className="w-4 h-4 shrink-0" />;
  }
  if (category === 'medicine') {
    return <HeartPulse className="w-4 h-4 text-[#38D46A] shrink-0" />;
  }
  if (category === 'held') {
    return <Sparkles className="w-4 h-4 text-[#F6C445] shrink-0" />;
  }
  if (category === 'key') {
    return <KeyRound className="w-4 h-4 text-[#38BDF8] shrink-0" />;
  }
  return <Backpack className="w-4 h-4 text-slate-300 shrink-0" />;
}

export function TrainerBagPanel({
  trainer,
  isSheetEditing,
  onUpdateTrainer,
  onAddItem,
  onUpdateItem,
  onAdjustQty,
  onRemoveItem,
  onOpenImport,
}: TrainerBagPanelProps) {
  const bagSyncStatus = useCharacterStore((s) => s.bagSyncStatus);
  const bagSyncMessage = useCharacterStore((s) => s.bagSyncMessage);
  const pullBagFromPoke5e = useCharacterStore((s) => s.pullBagFromPoke5e);
  const pushUnsyncedItemsToPoke5e = useCharacterStore(
    (s) => s.pushUnsyncedItemsToPoke5e
  );
  const connectPoke5eAccessKey = useCharacterStore((s) => s.connectPoke5eAccessKey);
  const disconnectPoke5eAccessKey = useCharacterStore(
    (s) => s.disconnectPoke5eAccessKey
  );

  const items = useMemo(() => normalizeTrainerItems(trainer), [trainer]);

  const [selectedCategory, setSelectedCategory] = useState<'all' | TrainerItemCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMoney, setEditingMoney] = useState(false);
  const [catalogItems, setCatalogItems] = useState<Poke5eItemRef[]>([]);

  // Write-key inline drawer state
  const [showWriteKeyDrawer, setShowWriteKeyDrawer] = useState(false);
  const [writeKeyInput, setWriteKeyInput] = useState('');
  const [writeKeyFeedback, setWriteKeyFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [isVerifyingKey, setIsVerifyingKey] = useState(false);

  // Add item form state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<TrainerItemCategory>('medicine');
  const [newQty, setNewQty] = useState(1);
  const [newDesc, setNewDesc] = useState('');
  const [newCatalogItemId, setNewCatalogItemId] = useState<string | null | undefined>(
    undefined
  );

  // Inline item edit state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<TrainerItemCategory>('gear');
  const [editDesc, setEditDesc] = useState('');

  useEffect(() => {
    if (!showAddForm || catalogItems.length > 0) return;
    let active = true;
    void getPoke5eCatalogItems().then((list) => {
      if (active && list.length > 0) {
        setCatalogItems(list);
      }
    });
    return () => {
      active = false;
    };
  }, [showAddForm, catalogItems.length]);

  const linkedMeta = trainer.poke5eMeta;
  const isLinkedToPoke5e = Boolean(linkedMeta?.readKey);
  const hasWriteSync = Boolean(linkedMeta?.accessKey);
  const isSyncing = bagSyncStatus === 'syncing';

  const unsyncedLocalCount = useMemo(
    () =>
      hasWriteSync
        ? items.filter((item) => typeof item.poke5eId !== 'number').length
        : 0,
    [hasWriteSync, items]
  );

  const catalogSuggestions = useMemo(() => {
    const q = newName.trim().toLowerCase();
    if (!q || catalogItems.length === 0) return [];
    return catalogItems
      .filter(
        (ci) =>
          ci.name.toLowerCase().includes(q) || ci.id.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [newName, catalogItems]);

  const categoryCounts = useMemo(() => {
    const counts: Record<'all' | TrainerItemCategory, number> = {
      all: items.length,
      pokeballs: 0,
      medicine: 0,
      held: 0,
      key: 0,
      gear: 0,
    };
    for (const item of items) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (q) {
        const hay = `${item.name} ${item.description ?? ''} ${CATEGORY_LABEL_MAP[item.category]}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, selectedCategory, searchQuery]);

  const totalUnits = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const handleApplyPreset = (preset: (typeof TRAINER_ITEM_PRESETS)[number]) => {
    const matched = catalogItems.find(
      (ci) => ci.name.toLowerCase() === preset.name.toLowerCase()
    );
    setNewName(preset.name);
    setNewCategory(preset.category);
    setNewDesc(matched?.description?.join(' ') || preset.description);
    setNewCatalogItemId(matched?.id);
    if (newQty < 1) setNewQty(1);
  };

  const handleApplyCatalogItem = (ci: Poke5eItemRef) => {
    setNewName(ci.name);
    setNewCategory(mapPoke5eItemTypeToCategory(ci.type, ci.id || ci.name));
    setNewDesc(ci.description?.join(' ') ?? '');
    setNewCatalogItemId(ci.id);
    if (newQty < 1) setNewQty(1);
  };

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;

    const exactCatalog = catalogItems.find(
      (ci) =>
        ci.id === newCatalogItemId ||
        ci.name.toLowerCase() === trimmed.toLowerCase()
    );
    const matchesCatalogDesc =
      exactCatalog &&
      (!newDesc.trim() ||
        newDesc.trim() === (exactCatalog.description?.join(' ') ?? '').trim());

    onAddItem({
      name: trimmed,
      category: newCategory,
      quantity: Math.max(0, Math.floor(newQty || 0)),
      description: newDesc.trim() || undefined,
      poke5eItemId: matchesCatalogDesc && exactCatalog ? exactCatalog.id : undefined,
    });
    setNewName('');
    setNewQty(1);
    setNewDesc('');
    setNewCatalogItemId(undefined);
    setShowAddForm(false);
  };

  const startEditItem = (item: TrainerItem) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditDesc(item.description ?? '');
  };

  const saveEditItem = (itemId: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    onUpdateItem(itemId, {
      name: trimmed,
      category: editCategory,
      description: editDesc.trim() || undefined,
    });
    setEditingItemId(null);
  };

  const handleSaveWriteKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writeKeyInput.trim() || isVerifyingKey) return;
    setIsVerifyingKey(true);
    setWriteKeyFeedback(null);
    try {
      const res = await connectPoke5eAccessKey(writeKeyInput);
      setWriteKeyFeedback(res);
      if (res.ok) {
        setWriteKeyInput('');
        setShowWriteKeyDrawer(false);
      }
    } finally {
      setIsVerifyingKey(false);
    }
  };

  const lastSyncedTime = linkedMeta?.bagSyncedAt || linkedMeta?.importedAt;
  const formattedSyncTime = lastSyncedTime
    ? new Date(lastSyncedTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <section className="gba-panel p-3.5 sm:p-4 space-y-3">
      {/* Header: Title, Money, Add Item CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-sm font-bold text-slate-100 uppercase tracking-tight">
              Trainer Bag
            </h3>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {items.length} jenis · {totalUnits} total
            </span>
          </div>
          {trainer.trainerPaths && (
            <p className="text-xs text-[#F6C445] mt-0.5 truncate max-w-full">
              {trainer.trainerPaths}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          {isSheetEditing || editingMoney ? (
            <div className="gba-well flex items-center gap-1 px-2.5 py-1.5 min-h-[38px]">
              <Coins className="w-3.5 h-3.5 text-[#F6C445] shrink-0" />
              <span className="font-mono text-xs text-[#F6C445]">¥</span>
              <input
                type="number"
                min={0}
                value={trainer.money}
                onChange={(e) =>
                  onUpdateTrainer({
                    money: Math.max(0, parseInt(e.target.value || '0', 10) || 0),
                  })
                }
                aria-label="Trainer Money"
                className="w-20 bg-transparent font-mono tabular-nums text-xs text-white focus:outline-none text-right"
              />
              {!isSheetEditing && (
                <button
                  type="button"
                  onClick={() => setEditingMoney(false)}
                  aria-label="Done editing money"
                  className="p-1 text-[#38D46A] hover:text-white cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingMoney(true)}
              title="Tap to edit Pokédollars (¥)"
              className="gba-btn inline-flex items-center gap-1.5 px-3 min-h-[38px] bg-[#131A22] hover:bg-[#232F3E] text-xs font-mono tabular-nums font-bold text-[#F6C445] cursor-pointer whitespace-nowrap"
            >
              <Coins className="w-3.5 h-3.5 shrink-0" />
              <span>¥{trainer.money.toLocaleString()}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className={`gba-btn inline-flex items-center gap-1.5 px-3 min-h-[38px] text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
              showAddForm
                ? 'bg-[#283747] text-white'
                : 'bg-[#D62839] hover:bg-[#E63946] text-white'
            }`}
          >
            {showAddForm ? (
              <>
                <X className="w-4 h-4" />
                <span>Close</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Add Item</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* poke5e.app Bag Sync Bar */}
      {isLinkedToPoke5e ? (
        <div className="gba-well px-3 py-2 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span className="font-mono font-semibold text-slate-200">
                poke5e.app
              </span>
              <span aria-hidden="true" className="text-slate-500">
                ·
              </span>
              <span
                className={`font-semibold ${
                  hasWriteSync ? 'text-[#38D46A]' : 'text-[#F6C445]'
                }`}
              >
                {hasWriteSync ? '2-Way Sync' : 'Read-Only'}
              </span>
              {formattedSyncTime && (
                <>
                  <span aria-hidden="true" className="text-slate-500">
                    ·
                  </span>
                  <span className="font-mono tabular-nums text-[11px] text-slate-400">
                    Sync {formattedSyncTime}
                  </span>
                </>
              )}
              {bagSyncStatus === 'error' && bagSyncMessage && (
                <>
                  <span aria-hidden="true" className="text-slate-500">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 text-rose-300 text-[11px]">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{bagSyncMessage}</span>
                  </span>
                </>
              )}
              {bagSyncStatus === 'synced' && bagSyncMessage && (
                <>
                  <span aria-hidden="true" className="text-slate-500">
                    ·
                  </span>
                  <span className="text-emerald-300 text-[11px]">
                    {bagSyncMessage}
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={isSyncing}
                onClick={() => void pullBagFromPoke5e()}
                title="Ambil item & Pokédollars terbaru dari poke5e.app"
                className="gba-btn inline-flex items-center gap-1 px-2.5 min-h-[34px] text-xs font-semibold text-white bg-[#267347] hover:bg-[#2E8A56] disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}
                />
                <span>{isSyncing ? 'Sync...' : 'Sync Bag'}</span>
              </button>

              {unsyncedLocalCount > 0 && (
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => void pushUnsyncedItemsToPoke5e()}
                  title="Kirim item lokal yang belum ada di poke5e.app"
                  className="gba-btn inline-flex items-center gap-1 px-2.5 min-h-[34px] text-xs font-semibold text-white bg-[#1D4E89] hover:bg-[#2563A8] disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Push ({unsyncedLocalCount})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowWriteKeyDrawer((prev) => !prev);
                  setWriteKeyFeedback(null);
                }}
                title={
                  hasWriteSync
                    ? 'Kelola Access Key poke5e.app'
                    : 'Masukkan Access Key poke5e.app agar edit Bag otomatis tersimpan ke poke5e.app'
                }
                className={`gba-btn inline-flex items-center gap-1 px-2.5 min-h-[34px] text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
                  hasWriteSync
                    ? 'bg-[#1A2937] text-[#38D46A] hover:bg-[#243648]'
                    : 'bg-[#1B2530] text-[#F6C445] hover:bg-[#273647]'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{hasWriteSync ? 'Write Key ✓' : 'Write Key'}</span>
              </button>
            </div>
          </div>

          {showWriteKeyDrawer && (
            <div className="pt-2 border-t border-[#090D12] space-y-2">
              {hasWriteSync ? (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-300">
                    Setiap tambah, ubah jumlah, edit, atau hapus item otomatis disinkronkan ke{' '}
                    <span className="font-mono text-[#38D46A]">poke5e.app</span>.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      disconnectPoke5eAccessKey();
                      setShowWriteKeyDrawer(false);
                    }}
                    className="gba-btn px-2.5 py-1 text-xs font-medium text-rose-200 bg-[#4A1922] hover:bg-[#62222E] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Putuskan Write Key
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleSaveWriteKey}
                  className="flex flex-col sm:flex-row sm:items-center gap-2"
                >
                  <input
                    type="text"
                    value={writeKeyInput}
                    onChange={(e) => setWriteKeyInput(e.target.value)}
                    placeholder="Tempel access_key atau URL edit poke5e.app (?id=...&access_key=...)"
                    aria-label="poke5e.app access key"
                    className="gba-well flex-1 px-2.5 py-1.5 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="submit"
                      disabled={isVerifyingKey || !writeKeyInput.trim()}
                      className="gba-btn px-3 py-1.5 text-xs font-semibold text-white bg-[#267347] hover:bg-[#2E8A56] disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      {isVerifyingKey ? 'Verifikasi...' : 'Aktifkan'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowWriteKeyDrawer(false)}
                      className="gba-btn px-2.5 py-1.5 text-xs text-slate-300 bg-[#18212B] hover:bg-[#232F3E] cursor-pointer whitespace-nowrap"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              )}

              {writeKeyFeedback && (
                <p
                  className={`text-xs ${
                    writeKeyFeedback.ok ? 'text-[#38D46A]' : 'text-rose-300'
                  }`}
                >
                  {writeKeyFeedback.message}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        onOpenImport && (
          <div className="gba-well px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-300">
              Ingin item Bag sinkron dengan{' '}
              <span className="font-mono text-[#F6C445]">poke5e.app</span>?
            </span>
            <button
              type="button"
              onClick={onOpenImport}
              className="gba-btn inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-[#1D4E89] hover:bg-[#2563A8] cursor-pointer whitespace-nowrap shrink-0"
            >
              <Link2 className="w-3 h-3" />
              <span>Link poke5e</span>
            </button>
          </div>
        )
      )}

      {/* Collapsible Add Item Drawer with Quick Presets & poke5e Catalog Suggestions */}
      {showAddForm && (
        <form
          onSubmit={handleCreateItem}
          className="gba-well p-3 space-y-3 border-2 border-[#090D12]"
        >
          <div className="space-y-1.5">
            <span className="block text-[11px] font-medium text-slate-300">
              Quick Presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              {TRAINER_ITEM_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="gba-btn px-2 py-1 text-[11px] text-slate-200 bg-[#1B2530] hover:bg-[#2A394A] cursor-pointer whitespace-nowrap"
                >
                  + {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-5">
              <label className="block text-xs text-slate-300 mb-1">Item Name</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setNewCatalogItemId(undefined);
                }}
                placeholder="e.g. Hyper Potion, Rare Candy"
                className="gba-well w-full px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs text-slate-300 mb-1">Pocket</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as TrainerItemCategory)}
                className="gba-well w-full px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                {TRAINER_ITEM_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs text-slate-300 mb-1">Quantity</label>
              <input
                type="number"
                min={0}
                value={newQty}
                onChange={(e) =>
                  setNewQty(Math.max(0, parseInt(e.target.value || '0', 10) || 0))
                }
                className="gba-well w-full px-2.5 py-1.5 text-xs font-mono tabular-nums text-white focus:outline-none"
              />
            </div>
          </div>

          {catalogSuggestions.length > 0 && (
            <div className="space-y-1">
              <span className="block text-[11px] text-slate-400">
                Item resmi poke5e.app:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {catalogSuggestions.map((ci) => (
                  <button
                    key={ci.id}
                    type="button"
                    onClick={() => handleApplyCatalogItem(ci)}
                    className={`gba-btn px-2 py-1 text-[11px] cursor-pointer whitespace-nowrap ${
                      newCatalogItemId === ci.id
                        ? 'bg-[#267347] text-white'
                        : 'bg-[#141C24] text-[#38BDF8] hover:bg-[#223040]'
                    }`}
                  >
                    {ci.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-end gap-2.5">
            <div className="flex-1">
              <label className="block text-xs text-slate-300 mb-1">
                Effect / Notes (optional)
              </label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="e.g. Restores 4d4 + 4 HP, or +2 catch bonus"
                className="gba-well w-full px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="gba-btn px-4 py-2 text-xs font-semibold text-white bg-[#267347] hover:bg-[#2E8A56] cursor-pointer whitespace-nowrap shrink-0"
            >
              Save to Bag
            </button>
          </div>
        </form>
      )}

      {/* Pocket Filter Tabs + Compact Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
          role="tablist"
          aria-label="Bag Pockets"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === 'all'}
            onClick={() => setSelectedCategory('all')}
            className={`gba-btn px-2.5 min-h-[34px] text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#283747] text-white'
                : 'bg-[#131A22] text-slate-400 hover:text-slate-100'
            }`}
          >
            All <span className="font-mono tabular-nums text-[11px]">({categoryCounts.all})</span>
          </button>

          {TRAINER_ITEM_CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.id];
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedCategory(cat.id)}
                className={`gba-btn px-2.5 min-h-[34px] text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#283747] text-[#F6C445]'
                    : 'bg-[#131A22] text-slate-400 hover:text-slate-100'
                }`}
              >
                <span className="sm:hidden">{cat.shortLabel}</span>
                <span className="hidden sm:inline">{cat.label}</span>{' '}
                <span className="font-mono tabular-nums text-[11px]">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-48 shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter bag..."
            aria-label="Filter bag items"
            className="gba-well w-full pl-8 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Item List */}
      {filteredItems.length === 0 ? (
        <div className="gba-well p-5 text-center space-y-2">
          <p className="text-xs text-slate-300">
            {items.length === 0
              ? 'Trainer Bag is empty. Add Poké Balls, Potions, or gear to track them here.'
              : 'No items match this pocket or search filter.'}
          </p>
          {items.length === 0 && !showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="gba-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#D62839] hover:bg-[#E63946] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Item</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredItems.map((item) => {
            const isEditingThis = editingItemId === item.id;

            if (isEditingThis) {
              return (
                <div
                  key={item.id}
                  className="gba-well p-2.5 space-y-2 border border-[#38BDF8]/60"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      aria-label="Edit item name"
                      className="gba-well sm:col-span-5 px-2 py-1 text-xs text-white focus:outline-none"
                    />
                    <select
                      value={editCategory}
                      onChange={(e) =>
                        setEditCategory(e.target.value as TrainerItemCategory)
                      }
                      aria-label="Edit item pocket"
                      className="gba-well sm:col-span-3 px-2 py-1 text-xs text-white focus:outline-none"
                    >
                      {TRAINER_ITEM_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Effect or notes..."
                      aria-label="Edit item description"
                      className="gba-well sm:col-span-4 px-2 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingItemId(null)}
                      className="gba-btn px-2.5 py-1 text-xs text-slate-300 bg-[#18212B] hover:bg-[#232F3E] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEditItem(item.id)}
                      className="gba-btn inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-[#267347] hover:bg-[#2E8A56] cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                className={`gba-well px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-opacity ${
                  item.quantity === 0 ? 'opacity-65' : ''
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="mt-0.5">
                    <CategoryIcon category={item.category} itemName={item.name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-slate-100 leading-snug">
                        {item.name}
                      </span>
                      <span className="text-xs text-slate-400">
                        · {CATEGORY_LABEL_MAP[item.category]}
                      </span>
                      {hasWriteSync && typeof item.poke5eId !== 'number' && (
                        <span className="text-xs text-[#F6C445] font-medium">
                          · Lokal
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-slate-300 leading-relaxed mt-0.5 break-words">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Quantity Stepper & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#090D12]/80 shrink-0">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Decrease ${item.name} quantity`}
                      onClick={() => onAdjustQty(item.id, -1)}
                      disabled={item.quantity <= 0}
                      className="gba-btn w-9 h-9 sm:w-8 sm:h-8 inline-flex items-center justify-center bg-[#1B242E] hover:bg-[#263342] disabled:opacity-40 text-slate-200 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <span
                      className={`font-mono tabular-nums text-sm font-bold w-8 text-center ${
                        item.quantity === 0 ? 'text-slate-500' : 'text-white'
                      }`}
                    >
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      aria-label={`Increase ${item.name} quantity`}
                      onClick={() => onAdjustQty(item.id, 1)}
                      className="gba-btn w-9 h-9 sm:w-8 sm:h-8 inline-flex items-center justify-center bg-[#1B242E] hover:bg-[#263342] text-slate-200 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`Edit ${item.name}`}
                      onClick={() => startEditItem(item)}
                      className="gba-btn w-9 h-9 sm:w-8 sm:h-8 inline-flex items-center justify-center bg-[#141C24] hover:bg-[#253240] text-slate-300 hover:text-slate-100 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => onRemoveItem(item.id)}
                      className="gba-btn w-9 h-9 sm:w-8 sm:h-8 inline-flex items-center justify-center bg-[#141C24] hover:bg-[#4A1922] text-slate-300 hover:text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
