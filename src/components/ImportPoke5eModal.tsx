import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  FolderOpen,
  History,
  Info,
  Link2,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { selectActiveCharacter, useCharacterStore } from '../store/useCharacterStore';
import {
  Poke5eFileEntry,
  Poke5eImportResult,
  SavedTrainerProfile,
} from '../types/pokemon5e';
import {
  importFromPoke5eFile,
  importFromPoke5eLink,
  normalizeJsonToWorkspace,
  parseQuickTextPokemon,
} from '../utils/poke5eImporter';

interface ImportPoke5eModalProps {
  onClose: () => void;
}

type ImportTab = 'history' | 'link' | 'file' | 'paste-json' | 'quick-map';

export function ImportPoke5eModal({ onClose }: ImportPoke5eModalProps) {
  const party = useCharacterStore((s) => s.party);
  const activeChar = useCharacterStore(selectActiveCharacter);
  const importHistory = useCharacterStore((s) => s.importHistory);
  const replaceParty = useCharacterStore((s) => s.replaceParty);
  const updatePartyFromImport = useCharacterStore((s) => s.updatePartyFromImport);
  const loadSavedTrainer = useCharacterStore((s) => s.loadSavedTrainer);
  const removeSavedTrainer = useCharacterStore((s) => s.removeSavedTrainer);
  const addPokemon = useCharacterStore((s) => s.addPokemon);
  const updatePokemon = useCharacterStore((s) => s.updatePokemon);
  const updateTrainer = useCharacterStore((s) => s.updateTrainer);

  const linkedMeta = party.trainer.poke5eMeta;
  const linkedKey = linkedMeta?.readKey || linkedMeta?.trainerId || '';
  const linkedFullUrl = linkedKey
    ? linkedMeta?.accessKey
      ? `https://poke5e.app/trainers?id=${linkedKey}&access_key=${linkedMeta.accessKey}`
      : `https://poke5e.app/trainers?id=${linkedKey}`
    : '';

  const [tab, setTab] = useState<ImportTab>(
    importHistory.length > 0 ? 'history' : 'link'
  );
  const [linkInput, setLinkInput] = useState(linkedFullUrl);
  const [status, setStatus] = useState<Poke5eImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingProfileId, setUpdatingProfileId] = useState<string | null>(null);
  const [updateModeForFile, setUpdateModeForFile] = useState(Boolean(linkedKey));
  const [extractedKeys, setExtractedKeys] = useState<Poke5eFileEntry[]>([]);

  const [jsonText, setJsonText] = useState('');
  const [statblockText, setStatblockText] = useState(
    `Pikachu\nLevel 5 · SR 2 · Electric · Jolly\nAbility: Static\nHP 38/38 · AC 15 · Speed 35\nSTR 10 DEX 18 CON 12 INT 10 WIS 12 CHA 14\nSkills: Acrobatics, Perception, Stealth\n- Thunderbolt (Electric, 2d8, DEX)\n- Quick Attack (Normal, 1d6, DEX)`
  );
  const [trainerNameInput, setTrainerNameInput] = useState('');

  const runLinkFetch = async (rawTarget: string, mode: 'replace' | 'update') => {
    if (!rawTarget.trim()) return;
    setIsLoading(true);
    setStatus(null);

    try {
      const result = await importFromPoke5eLink(rawTarget);
      if (result.success && result.workspace) {
        if (mode === 'update') {
          updatePartyFromImport(result.workspace, 'link');
          setStatus({
            ...result,
            message: `Updated "${result.workspace.trainer.name}" (${result.workspace.pokemon.length} Pokémon) dari poke5e.app.`,
          });
        } else {
          replaceParty(result.workspace, 'link');
          setStatus(result);
        }
      } else {
        setStatus(result);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    await runLinkFetch(linkInput, 'replace');
  };

  const handleLoadSavedProfile = (profile: SavedTrainerProfile) => {
    loadSavedTrainer(profile.id);
    if (profile.readKey || profile.trainerId) {
      setLinkInput(
        `https://poke5e.app/trainers?id=${profile.readKey || profile.trainerId}`
      );
    }
    setStatus({
      success: true,
      tier: 'json-parse',
      message: `Loaded "${profile.trainerName}" (${profile.pokemonCount} Pokémon) dari history tersimpan.`,
      warnings: [],
    });
  };

  const handleUpdateSavedProfile = async (profile: SavedTrainerProfile) => {
    const key = profile.readKey || profile.trainerId;
    if (!key) {
      handleLoadSavedProfile(profile);
      return;
    }

    setUpdatingProfileId(profile.id);
    setIsLoading(true);
    setStatus(null);
    try {
      // Load that saved profile first so updatePartyFromImport preserves its local badges/notes/accessKey
      loadSavedTrainer(profile.id);
      const fetchTarget =
        profile.accessKey && key
          ? `https://poke5e.app/trainers?id=${encodeURIComponent(key)}&access_key=${encodeURIComponent(profile.accessKey)}`
          : key;
      const result = await importFromPoke5eLink(fetchTarget);
      if (result.success && result.workspace) {
        updatePartyFromImport(result.workspace, 'link');
        setLinkInput(
          profile.accessKey
            ? `https://poke5e.app/trainers?id=${key}&access_key=${profile.accessKey}`
            : `https://poke5e.app/trainers?id=${key}`
        );
        setStatus({
          ...result,
          message: `Updated "${result.workspace.trainer.name}" (${result.workspace.pokemon.length} Pokémon) langsung dari poke5e.app.`,
        });
      } else {
        setStatus(result);
      }
    } finally {
      setUpdatingProfileId(null);
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setStatus(null);

    try {
      const content = await file.text();
      const result = await importFromPoke5eFile(content);

      if (result.extractedKeys) {
        setExtractedKeys(result.extractedKeys);
        if (result.extractedKeys[0]?.name) {
          setTrainerNameInput(result.extractedKeys[0].name);
        }
      }

      if (result.success && result.workspace) {
        if (updateModeForFile) {
          updatePartyFromImport(result.workspace, 'file');
          setStatus({
            ...result,
            message: `Updated "${result.workspace.trainer.name}" (${result.workspace.pokemon.length} Pokémon) dari file backup.`,
          });
        } else {
          replaceParty(result.workspace, 'file');
          setStatus(result);
        }
      } else {
        setStatus(result);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasteJson = (mode: 'replace' | 'update') => {
    setStatus(null);
    try {
      const parsed = JSON.parse(jsonText);
      const workspace = normalizeJsonToWorkspace(parsed);
      if (!workspace) {
        setStatus({
          success: false,
          tier: 'json-parse',
          message:
            'JSON valid, tetapi tidak berisi atribut Trainer atau data party Pokémon.',
          warnings: [
            'Jika Anda memiliki URL poke5e.app, gunakan tab Link poke5e untuk mengambil data langsung.',
          ],
        });
        return;
      }

      if (mode === 'update') {
        updatePartyFromImport(workspace, 'json');
      } else {
        replaceParty(workspace, 'json');
      }

      setStatus({
        success: true,
        tier: 'json-parse',
        message:
          mode === 'update'
            ? `Updated "${workspace.trainer.name}" dengan ${workspace.pokemon.length} Pokémon dari JSON.`
            : `Imported "${workspace.trainer.name}" dengan ${workspace.pokemon.length} Pokémon.`,
        warnings: [],
        workspace,
      });
    } catch {
      setStatus({
        success: false,
        tier: 'json-parse',
        message:
          'Format JSON tidak valid. Pastikan Anda menempelkan JSON lengkap dari poke5e.app atau export sheet ini.',
        warnings: [],
      });
    }
  };

  const handleQuickMapPokemon = (mode: 'add' | 'update-active') => {
    const mon = parseQuickTextPokemon(statblockText);

    if (trainerNameInput.trim() || extractedKeys[0]) {
      updateTrainer({
        name: trainerNameInput.trim() || undefined,
        poke5eMeta: extractedKeys[0]
          ? {
              trainerId: extractedKeys[0].trainerId || extractedKeys[0].id || '',
              readKey: extractedKeys[0].readKey,
              accessKey: extractedKeys[0].accessKey,
              importedAt: new Date().toISOString(),
            }
          : undefined,
      });
    }

    if (mode === 'update-active' && activeChar.kind === 'pokemon') {
      updatePokemon(activeChar.id, {
        ...mon,
        id: activeChar.id,
        notes: mon.notes || activeChar.notes,
      });
      setStatus({
        success: true,
        tier: 'manual-map',
        message: `Updated "${activeChar.name}" dengan statblock terbaru (${mon.types.join('/')}, Lv ${mon.level}).`,
        warnings: [],
      });
      return;
    }

    const added = addPokemon(mon);
    setStatus({
      success: added,
      tier: 'manual-map',
      message: added
        ? `Added "${mon.name}" (${mon.types.join('/')}, Lv ${mon.level}) to your party.`
        : 'Party sudah penuh (maksimal 6 Pokémon). Gunakan tombol Update untuk menimpa Pokémon aktif atau hapus salah satu.',
      warnings: [],
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="gba-panel w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#9E1E2A] border-b-2 border-[#090D12] flex items-center justify-between">
          <div>
            <h2
              id="import-modal-title"
              className="font-display text-sm font-bold text-white uppercase"
            >
              Import &amp; Update Sheet (poke5e.app)
            </h2>
            <p className="text-xs text-rose-100/85 mt-0.5">
              History Trainer tersimpan, Link poke5e, file .poke5e, JSON, atau statblock
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Import Modal"
            className="gba-btn p-1.5 bg-[#1E2833] hover:bg-[#2A3746] text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Linked Trainer Quick Update Banner */}
        {linkedKey ? (
          <div className="px-5 py-3 bg-[#152822] border-b-2 border-[#090D12] flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="min-w-0">
              <div className="font-semibold text-[#38D46A]">
                Aktif Terhubung · {party.trainer.name} (Lv.{party.trainer.level})
              </div>
              <div className="font-mono text-[11px] text-slate-300 truncate">
                ID: {linkedKey}
                {linkedMeta?.accessKey ? ' · Write Sync Aktif' : ' · Read-Only'}
                {linkedMeta?.importedAt &&
                  ` · Sync terakhir ${new Date(linkedMeta.importedAt).toLocaleString([], {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`}
              </div>
            </div>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void runLinkFetch(linkedFullUrl || linkedKey, 'update')}
              className="gba-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#267347] hover:bg-[#2E8A56] disabled:opacity-50 cursor-pointer shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isLoading && !updatingProfileId ? 'animate-spin' : ''
                }`}
              />
              <span>
                {isLoading && !updatingProfileId ? 'Updating...' : 'Update Sheet'}
              </span>
            </button>
          </div>
        ) : (
          <div className="px-5 py-3 bg-[#131A22] border-b-2 border-[#090D12] flex items-start gap-2.5 text-xs text-slate-200">
            <Info className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Setiap Trainer yang diimpor otomatis tersimpan di{' '}
              <strong>History Trainer</strong> agar di sesi berikutnya Anda cukup klik{' '}
              <strong>Load</strong> atau <strong>Update</strong> tanpa perlu import ulang.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="px-5 py-2 bg-[#17202A] border-b-2 border-[#090D12] flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              {
                id: 'history',
                label: `History (${importHistory.length})`,
              },
              { id: 'link', label: 'Link poke5e' },
              { id: 'file', label: 'File .poke5e' },
              { id: 'paste-json', label: 'Paste JSON' },
              { id: 'quick-map', label: 'Statblock' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setStatus(null);
              }}
              className={`gba-btn px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                tab === t.id
                  ? 'bg-[#D62839] text-white'
                  : 'bg-[#131A22] text-slate-300 hover:text-white'
              }`}
            >
              {t.id === 'history' && <History className="w-3.5 h-3.5 text-[#F6C445]" />}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {tab === 'history' && (
            <div className="space-y-3">
              {importHistory.length === 0 ? (
                <div className="gba-well p-6 text-center space-y-2">
                  <History className="w-7 h-7 text-[#F6C445] mx-auto" />
                  <p className="font-display text-xs font-bold text-white uppercase">
                    Belum Ada Trainer Tersimpan
                  </p>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    Import Trainer satu kali lewat tab <strong>Link poke5e</strong>,{' '}
                    <strong>File .poke5e</strong>, atau <strong>Paste JSON</strong>.
                    Setelah itu Trainer akan otomatis tersimpan di sini agar sesi berikutnya
                    tinggal tekan <strong>Update</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab('link')}
                    className="gba-btn mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#D62839] hover:bg-[#E63946] cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Import via Link poke5e</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-300">
                    Pilih Trainer dari sesi sebelumnya untuk langsung dimuat atau tekan{' '}
                    <strong className="text-[#38D46A]">Update</strong> untuk mengambil versi
                    terbaru dari <code className="font-mono text-[#F6C445]">poke5e.app</code>:
                  </p>

                  {importHistory.map((profile) => {
                    const isCurrentlyLoaded =
                      Boolean(
                        linkedKey &&
                          (profile.readKey === linkedKey || profile.trainerId === linkedKey)
                      ) ||
                      (!linkedKey &&
                        profile.trainerName === party.trainer.name &&
                        profile.pokemonCount === party.pokemon.length);
                    const hasRemoteLink = Boolean(profile.readKey || profile.trainerId);
                    const isUpdatingThis = updatingProfileId === profile.id;
                    const syncTime = new Date(profile.lastImportedAt).toLocaleString([], {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={profile.id}
                        className={`p-3 border-2 border-[#090D12] flex flex-wrap items-center justify-between gap-3 ${
                          isCurrentlyLoaded
                            ? 'bg-[#21332C] shadow-[inset_2px_2px_0_#38D46A,inset_-2px_-2px_0_#101A16]'
                            : 'gba-well'
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display text-xs font-bold text-white">
                              {profile.trainerName}
                            </span>
                            <span className="font-mono text-[10px] text-[#F6C445]">
                              Lv.{profile.trainerLevel}
                            </span>
                            {isCurrentlyLoaded && (
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-[#38D46A] text-[#090D12]">
                                AKTIF
                              </span>
                            )}
                            <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[#1A232E] border border-[#090D12] text-slate-300 uppercase">
                              {profile.source}
                            </span>
                          </div>

                          <div className="text-xs text-slate-300 truncate">
                            {profile.trainerClass} · {profile.pokemonCount} Pokémon
                            {profile.pokemonSummary ? ` (${profile.pokemonSummary})` : ''}
                          </div>

                          <div className="font-mono text-[10px] text-slate-400 truncate">
                            {hasRemoteLink
                              ? `ID: ${profile.readKey || profile.trainerId} · `
                              : ''}
                            Disimpan {syncTime}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleLoadSavedProfile(profile)}
                            disabled={isLoading}
                            title="Muat sheet tersimpan ini secara instan"
                            className="gba-btn inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-100 bg-[#263547] hover:bg-[#32445A] disabled:opacity-50 cursor-pointer"
                          >
                            <FolderOpen className="w-3.5 h-3.5 text-[#F6C445]" />
                            <span>Load</span>
                          </button>

                          {hasRemoteLink && (
                            <button
                              type="button"
                              onClick={() => void handleUpdateSavedProfile(profile)}
                              disabled={isLoading}
                              title="Tarik data terbaru Trainer ini dari poke5e.app"
                              className="gba-btn inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-[#267347] hover:bg-[#2E8A56] disabled:opacity-50 cursor-pointer"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${
                                  isUpdatingThis ? 'animate-spin' : ''
                                }`}
                              />
                              <span>{isUpdatingThis ? 'Sync...' : 'Update'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => removeSavedTrainer(profile.id)}
                            disabled={isLoading}
                            title="Hapus dari history tersimpan"
                            aria-label={`Remove ${profile.trainerName} from saved history`}
                            className="gba-btn p-1.5 bg-[#131A22] hover:bg-[#4A1922] text-slate-400 hover:text-rose-300 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'link' && (
            <form onSubmit={handleLinkImport} className="space-y-4">
              <div>
                <label
                  htmlFor="poke5e-link-input"
                  className="block text-xs font-medium text-slate-200 mb-1.5"
                >
                  Link Trainer poke5e.app atau Trainer ID
                </label>
                <div className="relative">
                  <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="poke5e-link-input"
                    type="text"
                    required
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    placeholder="https://poke5e.app/trainers?id=...&access_key=..."
                    className="gba-well w-full pl-9 pr-3 py-2 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none"
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={isLoading || !linkInput.trim()}
                    onClick={() => void runLinkFetch(linkInput, 'update')}
                    className="gba-btn inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#267347] hover:bg-[#2E8A56] disabled:opacity-50 cursor-pointer"
                    title="Perbarui sheet saat ini dari poke5e.app tanpa mereset catatan lokal & badge"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        isLoading && !updatingProfileId ? 'animate-spin' : ''
                      }`}
                    />
                    <span>
                      {isLoading && !updatingProfileId ? 'Mengupdate...' : 'Update Sheet'}
                    </span>
                  </button>

                  <button
                    type="submit"
                    disabled={isLoading || !linkInput.trim()}
                    className="gba-btn inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#D62839] hover:bg-[#E63946] disabled:opacity-50 cursor-pointer"
                  >
                    {isLoading && !updatingProfileId ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Mengambil data...</span>
                      </>
                    ) : (
                      <span>Import Baru</span>
                    )}
                  </button>
                </div>

                <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                  Sertakan parameter <code className="font-mono text-[#F6C445]">&amp;access_key=...</code>{' '}
                  dari URL edit poke5e.app jika ingin perubahan <strong>Trainer Bag</strong>{' '}
                  otomatis tersimpan balik ke poke5e.app (2-arah).
                </p>
              </div>
            </form>
          )}

          {tab === 'file' && (
            <div className="space-y-4">
              <label className="gba-well inline-flex items-center gap-2 px-3 py-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateModeForFile}
                  onChange={(e) => setUpdateModeForFile(e.target.checked)}
                  className="accent-[#38D46A]"
                />
                <span>
                  <strong>Mode Update Sheet</strong> (pertahankan badge, catatan lokal, dan
                  tab aktif)
                </span>
              </label>

              <label className="gba-well flex flex-col items-center justify-center gap-2 p-8 cursor-pointer hover:bg-[#161F29] transition-colors">
                <FileUp className="w-7 h-7 text-[#F6C445]" />
                <span className="text-sm font-medium text-white">
                  {isLoading
                    ? 'Membaca file backup...'
                    : updateModeForFile
                      ? 'Pilih file .poke5e / .json untuk Update'
                      : 'Pilih file .poke5e / .json untuk Import'}
                </span>
                <span className="text-xs text-slate-400">
                  Mengekstrak key Trainer dan menyimpan ke History Trainer Anda
                </span>
                <input
                  type="file"
                  accept=".poke5e,.json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {extractedKeys.length > 0 && (
                <div className="gba-well p-3.5 space-y-2">
                  <div className="text-xs font-semibold text-white">
                    Extracted poke5e.app Keys ({extractedKeys.length})
                  </div>
                  <div className="space-y-1.5">
                    {extractedKeys.map((entry, idx) => (
                      <div
                        key={idx}
                        className="text-xs font-mono text-slate-200 bg-[#18212B] px-2.5 py-1.5 border border-[#090D12] flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="flex flex-wrap gap-3">
                          {entry.name && <span>Name: {entry.name}</span>}
                          {entry.trainerId && <span>ID: {entry.trainerId}</span>}
                          {entry.readKey && <span>ReadKey: {entry.readKey}</span>}
                        </div>
                        {(entry.readKey || entry.trainerId) && (
                          <button
                            type="button"
                            onClick={() => {
                              const k = entry.readKey || entry.trainerId || '';
                              setLinkInput(k);
                              setTab('link');
                              void runLinkFetch(k, updateModeForFile ? 'update' : 'replace');
                            }}
                            className="text-xs font-sans font-semibold text-[#F6C445] hover:text-amber-200 cursor-pointer"
                          >
                            {updateModeForFile ? 'Update via Link →' : 'Fetch via Link →'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'paste-json' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Tempel JSON Trainer lengkap hasil export dari sheet ini atau dari poke5e.app.
              </p>
              <textarea
                rows={8}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='{ "trainer": { "name": "Red", ... }, "pokemon": [ ... ] }'
                className="gba-well w-full p-3 text-xs font-mono text-white focus:outline-none"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handlePasteJson('update')}
                  className="gba-btn inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#267347] hover:bg-[#2E8A56] cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Update dari JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePasteJson('replace')}
                  className="gba-btn px-4 py-2 text-xs font-semibold text-white bg-[#D62839] hover:bg-[#E63946] cursor-pointer"
                >
                  Import JSON Baru
                </button>
              </div>
            </div>
          )}

          {tab === 'quick-map' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Trainer Name (optional update)
                  </label>
                  <input
                    type="text"
                    value={trainerNameInput}
                    onChange={(e) => setTrainerNameInput(e.target.value)}
                    placeholder="Keep current trainer or enter name"
                    className="gba-well w-full px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Paste Pokémon Text / Statblock
                </label>
                <textarea
                  rows={8}
                  value={statblockText}
                  onChange={(e) => setStatblockText(e.target.value)}
                  className="gba-well w-full p-3 text-xs font-mono text-white focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                {activeChar.kind === 'pokemon' && (
                  <button
                    type="button"
                    onClick={() => handleQuickMapPokemon('update-active')}
                    className="gba-btn inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#267347] hover:bg-[#2E8A56] cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Update {activeChar.name}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleQuickMapPokemon('add')}
                  className="gba-btn px-4 py-2 text-xs font-semibold text-white bg-[#D62839] hover:bg-[#E63946] cursor-pointer"
                >
                  Parse &amp; Add Pokémon
                </button>
              </div>
            </div>
          )}

          {status && (
            <div
              className={`p-3.5 border-2 border-[#090D12] flex items-start gap-2.5 text-xs ${
                status.success
                  ? 'bg-[#1A4D34] text-emerald-100'
                  : 'bg-[#5A3A15] text-amber-100'
              }`}
            >
              {status.success ? (
                <CheckCircle2 className="w-4 h-4 text-[#38D46A] shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-[#F6C445] shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-semibold">{status.message}</p>
                {status.warnings.map((w, i) => (
                  <p key={i} className="text-slate-200">
                    {w}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t-2 border-[#090D12] bg-[#17202A] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="gba-btn px-4 py-1.5 text-xs font-semibold text-slate-100 bg-[#263547] hover:bg-[#32445A] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
