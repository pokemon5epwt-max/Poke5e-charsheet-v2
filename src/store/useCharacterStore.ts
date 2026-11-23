import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  ActiveCharacter,
  DiceIntegrationMode,
  InitiativeEntry,
  InitiativeSyncState,
  Move,
  ObrState,
  PartyWorkspace,
  PokemonSheet,
  RollEntry,
  RollMode,
  RollVisibility,
  SavedTrainerProfile,
  TrainerItem,
  TrainerSheet,
} from '../types/pokemon5e';
import { executeRoll, RollRequest } from '../utils/diceEngine';
import { broadcastRollToObr, syncInitiativeToObr } from '../utils/obrBridge';
import {
  addInventoryItemToPoke5e,
  findPoke5eCatalogItem,
  parsePoke5eAccessKey,
  pullTrainerBagFromPoke5e,
  removeInventoryItemFromPoke5e,
  updateInventoryItemInPoke5e,
  verifyPoke5eWriteKey,
} from '../utils/poke5eImporter';
import {
  createEmptySaves,
  createEmptySkills,
  createId,
  createStarterParty,
  normalizeTrainerItems,
  syncPokeballsFromItems,
} from '../utils/pokemon5eRules';
import {
  loadInitiativeSnapshot,
  resilientZustandStorage,
  saveInitiativeSnapshot,
} from '../utils/safeStorage';

const initialInitSnapshot = loadInitiativeSnapshot();

const pendingItemSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();

function sortInitiativeEntries(entries: InitiativeEntry[]): InitiativeEntry[] {
  return [...entries].sort((a, b) => {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative;
    if (b.dexMod !== a.dexMod) return b.dexMod - a.dexMod;
    return a.characterName.localeCompare(b.characterName);
  });
}

function getNextTurnIndexAfterReorder(
  prevList: InitiativeEntry[],
  prevIndex: number,
  nextList: InitiativeEntry[]
): number {
  if (nextList.length === 0) return 0;
  const currentActiveId = prevList[prevIndex]?.id;
  if (currentActiveId) {
    const relocated = nextList.findIndex((item) => item.id === currentActiveId);
    if (relocated >= 0) return relocated;
  }
  return Math.max(0, Math.min(prevIndex, nextList.length - 1));
}

function upsertInitiativeFromRoll(
  state: {
    party: PartyWorkspace;
    initiativeList: InitiativeEntry[];
    initiativeTurnIndex: number;
  },
  roll: RollEntry
): { initiativeList: InitiativeEntry[]; initiativeTurnIndex: number } | null {
  if (roll.category !== 'initiative') return null;

  const entryId = `${roll.ownerId || 'local-player'}::${roll.characterId || roll.characterName}`;
  const dexMod =
    typeof roll.dexMod === 'number'
      ? roll.dexMod
      : typeof roll.selectedDie === 'number'
        ? roll.total - roll.selectedDie
        : 0;

  let hpText: string | undefined;
  let ac: number | undefined;
  if (roll.source === 'local') {
    const matched =
      roll.characterId === 'trainer'
        ? state.party.trainer
        : state.party.pokemon.find((p) => p.id === roll.characterId);
    if (matched) {
      hpText = `${matched.hpCurrent}/${matched.hpMax}`;
      ac = matched.ac;
    }
  } else {
    const existing = state.initiativeList.find((e) => e.id === entryId);
    hpText = existing?.hpText;
    ac = existing?.ac;
  }

  const nextEntry: InitiativeEntry = {
    id: entryId,
    characterId: roll.characterId,
    characterName: roll.characterName,
    playerName: roll.rollerName || 'Player',
    ownerId: roll.ownerId || 'local-player',
    initiative: roll.total,
    dexMod,
    breakdown: roll.breakdown,
    visibility: roll.visibility,
    hpText,
    ac,
    isNpc: false,
    updatedAt: roll.timestamp,
  };

  const withoutExisting = state.initiativeList.filter((e) => e.id !== entryId);
  const sorted = sortInitiativeEntries([...withoutExisting, nextEntry]);
  const nextIndex = getNextTurnIndexAfterReorder(
    state.initiativeList,
    state.initiativeTurnIndex,
    sorted
  );

  return {
    initiativeList: sorted,
    initiativeTurnIndex: nextIndex,
  };
}

function isRemoteInitiativeEquivalent(
  state: {
    initiativeList: InitiativeEntry[];
    initiativeTurnIndex: number;
    initiativeRound: number;
  },
  remote: InitiativeSyncState
): boolean {
  if (state.initiativeRound !== remote.round) return false;
  const visibleLocal = state.initiativeList.filter((e) => e.visibility === 'visible');
  if (visibleLocal.length !== remote.entries.length) return false;

  const localActiveId = state.initiativeList[state.initiativeTurnIndex]?.id;
  const remoteActiveId = remote.entries[remote.turnIndex]?.id;
  if (localActiveId && remoteActiveId && localActiveId !== remoteActiveId) {
    return false;
  }

  for (let i = 0; i < visibleLocal.length; i += 1) {
    const a = visibleLocal[i];
    const b = remote.entries[i];
    if (
      a.id !== b.id ||
      a.initiative !== b.initiative ||
      a.characterName !== b.characterName ||
      a.updatedAt !== b.updatedAt
    ) {
      return false;
    }
  }
  return true;
}

function upsertSavedTrainerProfile(
  history: SavedTrainerProfile[],
  workspace: PartyWorkspace,
  source: 'link' | 'file' | 'json'
): SavedTrainerProfile[] {
  const trainer: TrainerSheet = {
    ...workspace.trainer,
    id: 'trainer',
    kind: 'trainer',
  };
  const pokemon = workspace.pokemon.slice(0, 6);
  const readKey = trainer.poke5eMeta?.readKey?.trim() || undefined;
  const trainerId = trainer.poke5eMeta?.trainerId?.trim() || undefined;
  const id =
    readKey ||
    trainerId ||
    `local:${(trainer.name || 'trainer').trim().toLowerCase()}`;

  const profile: SavedTrainerProfile = {
    id,
    trainerName: trainer.name || 'Imported Trainer',
    trainerLevel: trainer.level,
    trainerClass: trainer.trainerClass || 'Pokémon Trainer',
    pokemonCount: pokemon.length,
    pokemonSummary: pokemon.map((p) => p.name).join(', '),
    source,
    readKey,
    accessKey: trainer.poke5eMeta?.accessKey,
    trainerId,
    lastImportedAt: new Date().toISOString(),
    workspace: { trainer, pokemon },
  };

  const remaining = history.filter(
    (item) =>
      item.id !== id &&
      !(readKey && item.readKey === readKey) &&
      !(trainerId && item.trainerId === trainerId)
  );
  return [profile, ...remaining].slice(0, 12);
}

interface CharacterStoreState {
  party: PartyWorkspace;
  activeCharacterId: 'trainer' | string;
  rollMode: RollMode;
  rollVisibility: RollVisibility;
  diceIntegrationMode: DiceIntegrationMode;
  rollLog: RollEntry[];
  rollLogClearedAt?: string;
  obrState: ObrState;

  // Initiative Tracker
  initiativeList: InitiativeEntry[];
  initiativeTurnIndex: number;
  initiativeRound: number;
  initiativeUpdatedAt?: string;

  // Selection & Controls
  setActiveCharacter: (id: 'trainer' | string) => void;
  setRollMode: (mode: RollMode) => void;
  setRollVisibility: (vis: RollVisibility) => void;
  setDiceIntegrationMode: (mode: DiceIntegrationMode) => void;
  setObrState: (obrState: ObrState) => void;

  // Trainer CRUD & poke5e.app Bag Sync
  bagSyncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  bagSyncMessage: string | null;
  updateTrainer: (patch: Partial<TrainerSheet>) => void;
  resetTrainerToBlank: () => void;
  addTrainerItem: (item: Omit<TrainerItem, 'id'>) => void;
  updateTrainerItem: (itemId: string, patch: Partial<TrainerItem>) => void;
  adjustTrainerItemQty: (itemId: string, delta: number) => void;
  removeTrainerItem: (itemId: string) => void;
  pullBagFromPoke5e: () => Promise<boolean>;
  pushUnsyncedItemsToPoke5e: () => Promise<number>;
  connectPoke5eAccessKey: (rawInput: string) => Promise<{ ok: boolean; message: string }>;
  disconnectPoke5eAccessKey: () => void;

  // Pokémon CRUD (up to 6)
  addPokemon: (pokemon: Omit<PokemonSheet, 'id' | 'kind'> & { id?: string }) => boolean;
  updatePokemon: (id: string, patch: Partial<PokemonSheet>) => void;
  removePokemon: (id: string) => void;
  adjustHp: (characterId: 'trainer' | string, delta: number) => void;

  // Move CRUD
  addMove: (pokemonId: string, move: Omit<Move, 'id'>) => void;
  updateMove: (pokemonId: string, moveId: string, patch: Partial<Move>) => void;
  removeMove: (pokemonId: string, moveId: string) => void;
  adjustMovePp: (pokemonId: string, moveId: string, delta: number) => void;

  // Rest & Utility
  importHistory: SavedTrainerProfile[];
  longRestParty: () => void;
  replaceParty: (
    workspace: PartyWorkspace,
    source?: 'link' | 'file' | 'json'
  ) => void;
  updatePartyFromImport: (
    workspace: PartyWorkspace,
    source?: 'link' | 'file' | 'json'
  ) => void;
  loadSavedTrainer: (profileId: string) => void;
  removeSavedTrainer: (profileId: string) => void;
  resetToStarterParty: () => void;

  // Rolling
  performRoll: (
    req: Omit<RollRequest, 'rollMode' | 'visibility' | 'rollerName' | 'ownerId'>
  ) => RollEntry;
  appendRemoteRoll: (roll: RollEntry) => void;
  mergeRoomRolls: (rolls: RollEntry[]) => void;
  clearRollLog: () => void;

  // Initiative Actions
  addManualInitiative: (input: {
    name: string;
    initiative: number;
    dexMod?: number;
    ac?: number;
    hpText?: string;
  }) => void;
  updateInitiativeScore: (id: string, initiative: number) => void;
  removeInitiativeEntry: (id: string) => void;
  setInitiativeTurnIndex: (index: number) => void;
  nextInitiativeTurn: () => void;
  prevInitiativeTurn: () => void;
  setInitiativeRound: (round: number) => void;
  resetInitiativeRound: () => void;
  clearInitiative: () => void;
  syncRemoteInitiative: (remote: InitiativeSyncState) => void;
}

export const useCharacterStore = create<CharacterStoreState>()(
  persist(
    (set, get) => ({
      party: createStarterParty(),
      activeCharacterId: 'trainer',
      rollMode: 'normal',
      rollVisibility: 'visible',
      diceIntegrationMode: 'internal',
      rollLog: [],
      rollLogClearedAt: undefined,
      initiativeList: initialInitSnapshot?.entries ?? [],
      initiativeTurnIndex: initialInitSnapshot?.turnIndex ?? 0,
      initiativeRound: initialInitSnapshot?.round ?? 1,
      initiativeUpdatedAt: initialInitSnapshot?.updatedAt,
      importHistory: [],
      bagSyncStatus: 'idle',
      bagSyncMessage: null,
      obrState: {
        isAvailable: false,
        isReady: false,
        playerId: 'local-player',
        playerName: 'Local Trainer',
        role: 'GM',
        partyCount: 1,
      },

      setActiveCharacter: (id) => set({ activeCharacterId: id }),
      setRollMode: (rollMode) => set({ rollMode }),
      setRollVisibility: (rollVisibility) => set({ rollVisibility }),
      setDiceIntegrationMode: (diceIntegrationMode) => set({ diceIntegrationMode }),
      setObrState: (obrState) => set({ obrState }),

      updateTrainer: (patch) =>
        set((state) => ({
          party: {
            ...state.party,
            trainer: {
              ...state.party.trainer,
              ...patch,
              id: 'trainer',
              kind: 'trainer',
            },
          },
        })),

      resetTrainerToBlank: () =>
        set((state) => ({
          activeCharacterId: 'trainer',
          party: {
            ...state.party,
            trainer: {
              id: 'trainer',
              kind: 'trainer',
              name: 'New Trainer',
              level: 1,
              trainerClass: 'Pokémon Trainer',
              origin: '',
              hpCurrent: 20,
              hpMax: 20,
              tempHp: 0,
              ac: 12,
              speed: 30,
              hitDice: '1d8',
              abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
              savingThrows: createEmptySaves(),
              skills: createEmptySkills(),
              pokeballs: { pokeBall: 5, greatBall: 0, ultraBall: 0, other: '' },
              items: [
                {
                  id: 'item-pokeball',
                  name: 'Poké Ball',
                  category: 'pokeballs',
                  quantity: 5,
                  description: 'Standard capture ball (+0 catch modifier).',
                },
                {
                  id: 'item-potion',
                  name: 'Potion',
                  category: 'medicine',
                  quantity: 1,
                  description: 'Restores 2d4 + 2 HP to a Pokémon.',
                },
              ],
              money: 500,
              badges: 0,
              trainerPaths: '',
              notes: '',
            },
          },
        })),

      addTrainerItem: (item) => {
        const newId = createId('item');
        const createdItem: TrainerItem = {
          ...item,
          id: newId,
          name: item.name.trim(),
          quantity: Math.max(0, Math.floor(item.quantity || 0)),
          description: item.description?.trim() || undefined,
        };

        let rankIndex = 0;
        set((state) => {
          const currentItems = normalizeTrainerItems(state.party.trainer);
          rankIndex = currentItems.length;
          const nextItems: TrainerItem[] = [...currentItems, createdItem];
          return {
            party: {
              ...state.party,
              trainer: {
                ...state.party.trainer,
                items: nextItems,
                pokeballs: syncPokeballsFromItems(
                  nextItems,
                  state.party.trainer.pokeballs
                ),
              },
            },
          };
        });

        const accessKey = get().party.trainer.poke5eMeta?.accessKey;
        if (accessKey) {
          set({ bagSyncStatus: 'syncing', bagSyncMessage: null });
          void addInventoryItemToPoke5e(accessKey, createdItem, rankIndex)
            .then(({ poke5eId, poke5eItemId }) => {
              const nowIso = new Date().toISOString();
              set((state) => {
                const items = normalizeTrainerItems(state.party.trainer).map((it) =>
                  it.id === newId
                    ? { ...it, poke5eId, poke5eItemId, poke5eRank: rankIndex }
                    : it
                );
                return {
                  bagSyncStatus: 'synced',
                  bagSyncMessage: null,
                  party: {
                    ...state.party,
                    trainer: {
                      ...state.party.trainer,
                      items,
                      poke5eMeta: state.party.trainer.poke5eMeta
                        ? { ...state.party.trainer.poke5eMeta, bagSyncedAt: nowIso }
                        : undefined,
                    },
                  },
                };
              });
            })
            .catch((err) => {
              set({
                bagSyncStatus: 'error',
                bagSyncMessage:
                  err instanceof Error
                    ? err.message
                    : 'Gagal menyimpan item ke poke5e.app.',
              });
            });
        }
      },

      updateTrainerItem: (itemId, patch) => {
        const prevTrainer = get().party.trainer;
        const prevItem = normalizeTrainerItems(prevTrainer).find((it) => it.id === itemId);

        let resolvedCatalogId = prevItem?.poke5eItemId;
        const nameChanged =
          patch.name !== undefined &&
          prevItem &&
          patch.name.trim().toLowerCase() !== prevItem.name.trim().toLowerCase();
        const descChanged =
          patch.description !== undefined &&
          prevItem &&
          (patch.description.trim() || undefined) !== prevItem.description;

        if (nameChanged || descChanged) {
          // Customizing name/notes switches away from fixed standard item_id so edits persist remotely
          resolvedCatalogId = null;
        }

        set((state) => {
          const currentItems = normalizeTrainerItems(state.party.trainer);
          const nextItems = currentItems.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  ...patch,
                  id: itemId,
                  poke5eItemId:
                    patch.poke5eItemId !== undefined
                      ? patch.poke5eItemId
                      : resolvedCatalogId,
                  quantity:
                    patch.quantity !== undefined
                      ? Math.max(0, Math.floor(patch.quantity || 0))
                      : it.quantity,
                }
              : it
          );
          return {
            party: {
              ...state.party,
              trainer: {
                ...state.party.trainer,
                items: nextItems,
                pokeballs: syncPokeballsFromItems(
                  nextItems,
                  state.party.trainer.pokeballs
                ),
              },
            },
          };
        });

        const accessKey = get().party.trainer.poke5eMeta?.accessKey;
        if (accessKey) {
          const items = normalizeTrainerItems(get().party.trainer);
          const idx = items.findIndex((it) => it.id === itemId);
          const target = items[idx];
          if (!target) return;

          set({ bagSyncStatus: 'syncing', bagSyncMessage: null });
          void (async () => {
            if (nameChanged && !descChanged) {
              const matched = await findPoke5eCatalogItem(target.name);
              if (matched) {
                target.poke5eItemId = matched.id;
              }
            }
            if (typeof target.poke5eId === 'number') {
              await updateInventoryItemInPoke5e(accessKey, target, idx);
            } else {
              const { poke5eId, poke5eItemId } = await addInventoryItemToPoke5e(
                accessKey,
                target,
                idx
              );
              set((state) => ({
                party: {
                  ...state.party,
                  trainer: {
                    ...state.party.trainer,
                    items: normalizeTrainerItems(state.party.trainer).map((it) =>
                      it.id === itemId ? { ...it, poke5eId, poke5eItemId } : it
                    ),
                  },
                },
              }));
            }
            const nowIso = new Date().toISOString();
            set((state) => ({
              bagSyncStatus: 'synced',
              bagSyncMessage: null,
              party: {
                ...state.party,
                trainer: {
                  ...state.party.trainer,
                  poke5eMeta: state.party.trainer.poke5eMeta
                    ? { ...state.party.trainer.poke5eMeta, bagSyncedAt: nowIso }
                    : undefined,
                },
              },
            }));
          })().catch((err) => {
            set({
              bagSyncStatus: 'error',
              bagSyncMessage:
                err instanceof Error
                  ? err.message
                  : 'Gagal memperbarui item di poke5e.app.',
            });
          });
        }
      },

      adjustTrainerItemQty: (itemId, delta) => {
        set((state) => {
          const currentItems = normalizeTrainerItems(state.party.trainer);
          const nextItems = currentItems.map((it) =>
            it.id === itemId
              ? { ...it, quantity: Math.max(0, it.quantity + delta) }
              : it
          );
          return {
            party: {
              ...state.party,
              trainer: {
                ...state.party.trainer,
                items: nextItems,
                pokeballs: syncPokeballsFromItems(
                  nextItems,
                  state.party.trainer.pokeballs
                ),
              },
            },
          };
        });

        const accessKey = get().party.trainer.poke5eMeta?.accessKey;
        if (!accessKey) return;

        const existingTimer = pendingItemSyncTimers.get(itemId);
        if (existingTimer) clearTimeout(existingTimer);

        set({ bagSyncStatus: 'syncing', bagSyncMessage: null });
        const timer = setTimeout(() => {
          pendingItemSyncTimers.delete(itemId);
          const currentState = get();
          const currentAccessKey = currentState.party.trainer.poke5eMeta?.accessKey;
          if (!currentAccessKey) return;

          const items = normalizeTrainerItems(currentState.party.trainer);
          const idx = items.findIndex((it) => it.id === itemId);
          const latestItem = items[idx];
          if (!latestItem) return;

          void (async () => {
            if (typeof latestItem.poke5eId === 'number') {
              await updateInventoryItemInPoke5e(currentAccessKey, latestItem, idx);
            } else {
              const { poke5eId, poke5eItemId } = await addInventoryItemToPoke5e(
                currentAccessKey,
                latestItem,
                idx
              );
              set((state) => ({
                party: {
                  ...state.party,
                  trainer: {
                    ...state.party.trainer,
                    items: normalizeTrainerItems(state.party.trainer).map((it) =>
                      it.id === itemId ? { ...it, poke5eId, poke5eItemId } : it
                    ),
                  },
                },
              }));
            }
            const nowIso = new Date().toISOString();
            set((state) => ({
              bagSyncStatus: 'synced',
              bagSyncMessage: null,
              party: {
                ...state.party,
                trainer: {
                  ...state.party.trainer,
                  poke5eMeta: state.party.trainer.poke5eMeta
                    ? { ...state.party.trainer.poke5eMeta, bagSyncedAt: nowIso }
                    : undefined,
                },
              },
            }));
          })().catch((err) => {
            set({
              bagSyncStatus: 'error',
              bagSyncMessage:
                err instanceof Error
                  ? err.message
                  : 'Gagal sync jumlah item ke poke5e.app.',
            });
          });
        }, 350);

        pendingItemSyncTimers.set(itemId, timer);
      },

      removeTrainerItem: (itemId) => {
        const pendingTimer = pendingItemSyncTimers.get(itemId);
        if (pendingTimer) {
          clearTimeout(pendingTimer);
          pendingItemSyncTimers.delete(itemId);
        }

        const prevTrainer = get().party.trainer;
        const targetItem = normalizeTrainerItems(prevTrainer).find((it) => it.id === itemId);
        const accessKey = prevTrainer.poke5eMeta?.accessKey;

        set((state) => {
          const currentItems = normalizeTrainerItems(state.party.trainer);
          const nextItems = currentItems.filter((it) => it.id !== itemId);
          return {
            party: {
              ...state.party,
              trainer: {
                ...state.party.trainer,
                items: nextItems,
                pokeballs: syncPokeballsFromItems(
                  nextItems,
                  state.party.trainer.pokeballs
                ),
              },
            },
          };
        });

        if (accessKey && typeof targetItem?.poke5eId === 'number') {
          set({ bagSyncStatus: 'syncing', bagSyncMessage: null });
          void removeInventoryItemFromPoke5e(accessKey, targetItem.poke5eId)
            .then(() => {
              const nowIso = new Date().toISOString();
              set((state) => ({
                bagSyncStatus: 'synced',
                bagSyncMessage: null,
                party: {
                  ...state.party,
                  trainer: {
                    ...state.party.trainer,
                    poke5eMeta: state.party.trainer.poke5eMeta
                      ? { ...state.party.trainer.poke5eMeta, bagSyncedAt: nowIso }
                      : undefined,
                  },
                },
              }));
            })
            .catch((err) => {
              set({
                bagSyncStatus: 'error',
                bagSyncMessage:
                  err instanceof Error
                    ? err.message
                    : 'Gagal menghapus item di poke5e.app.',
              });
            });
        }
      },

      pullBagFromPoke5e: async () => {
        const meta = get().party.trainer.poke5eMeta;
        const readKey = meta?.readKey;
        if (!readKey) {
          set({
            bagSyncStatus: 'error',
            bagSyncMessage: 'Trainer belum terhubung dengan link poke5e.app.',
          });
          return false;
        }

        set({ bagSyncStatus: 'syncing', bagSyncMessage: null });
        try {
          const pulled = await pullTrainerBagFromPoke5e(readKey);
          set((state) => {
            const nextTrainer: TrainerSheet = {
              ...state.party.trainer,
              items: pulled.items,
              pokeballs: pulled.pokeballs,
              money: pulled.money ?? state.party.trainer.money,
              poke5eMeta: {
                trainerId: pulled.trainerId,
                readKey: pulled.readKey,
                accessKey: state.party.trainer.poke5eMeta?.accessKey,
                importedAt:
                  state.party.trainer.poke5eMeta?.importedAt || pulled.syncedAt,
                bagSyncedAt: pulled.syncedAt,
              },
            };
            const nextWorkspace: PartyWorkspace = {
              trainer: nextTrainer,
              pokemon: state.party.pokemon,
            };
            return {
              bagSyncStatus: 'synced',
              bagSyncMessage: `Bag tersinkron (${pulled.items.length} item)`,
              party: nextWorkspace,
              importHistory: state.party.trainer.poke5eMeta
                ? upsertSavedTrainerProfile(state.importHistory, nextWorkspace, 'link')
                : state.importHistory,
            };
          });
          return true;
        } catch (err) {
          set({
            bagSyncStatus: 'error',
            bagSyncMessage:
              err instanceof Error
                ? err.message
                : 'Gagal mengambil Trainer Bag dari poke5e.app.',
          });
          return false;
        }
      },

      pushUnsyncedItemsToPoke5e: async () => {
        const trainer = get().party.trainer;
        const accessKey = trainer.poke5eMeta?.accessKey;
        if (!accessKey) return 0;

        const currentItems = normalizeTrainerItems(trainer);
        const unsynced = currentItems
          .map((item, idx) => ({ item, idx }))
          .filter(({ item }) => typeof item.poke5eId !== 'number');

        if (unsynced.length === 0) return 0;

        set({ bagSyncStatus: 'syncing', bagSyncMessage: null });
        let pushedCount = 0;
        try {
          const results = new Map<
            string,
            { poke5eId: number; poke5eItemId: string | null; rank: number }
          >();
          for (const { item, idx } of unsynced) {
            const res = await addInventoryItemToPoke5e(accessKey, item, idx);
            results.set(item.id, { ...res, rank: idx });
            pushedCount += 1;
          }

          const nowIso = new Date().toISOString();
          set((state) => {
            const updatedItems = normalizeTrainerItems(state.party.trainer).map((it) => {
              const res = results.get(it.id);
              return res
                ? {
                    ...it,
                    poke5eId: res.poke5eId,
                    poke5eItemId: res.poke5eItemId,
                    poke5eRank: res.rank,
                  }
                : it;
            });
            return {
              bagSyncStatus: 'synced',
              bagSyncMessage: `${pushedCount} item lokal dikirim ke poke5e.app`,
              party: {
                ...state.party,
                trainer: {
                  ...state.party.trainer,
                  items: updatedItems,
                  poke5eMeta: state.party.trainer.poke5eMeta
                    ? { ...state.party.trainer.poke5eMeta, bagSyncedAt: nowIso }
                    : undefined,
                },
              },
            };
          });
          return pushedCount;
        } catch (err) {
          set({
            bagSyncStatus: 'error',
            bagSyncMessage:
              err instanceof Error
                ? err.message
                : 'Gagal mengirim item lokal ke poke5e.app.',
          });
          return pushedCount;
        }
      },

      connectPoke5eAccessKey: async (rawInput) => {
        const parsedKey = parsePoke5eAccessKey(rawInput);
        if (!parsedKey) {
          return {
            ok: false,
            message:
              'Format Access Key tidak valid. Tempel link poke5e.app (?id=...&access_key=...) atau key aksesnya.',
          };
        }

        const meta = get().party.trainer.poke5eMeta;
        if (!meta?.trainerId) {
          return {
            ok: false,
            message: 'Import Trainer dari poke5e.app terlebih dahulu.',
          };
        }

        set({ bagSyncStatus: 'syncing', bagSyncMessage: null });
        try {
          const valid = await verifyPoke5eWriteKey(meta.trainerId, parsedKey);
          if (!valid) {
            set({
              bagSyncStatus: 'error',
              bagSyncMessage: 'Access Key tidak cocok untuk Trainer ini.',
            });
            return {
              ok: false,
              message: 'Access Key tidak cocok untuk Trainer ini di poke5e.app.',
            };
          }

          set((state) => {
            const nextTrainer: TrainerSheet = {
              ...state.party.trainer,
              poke5eMeta: state.party.trainer.poke5eMeta
                ? { ...state.party.trainer.poke5eMeta, accessKey: parsedKey }
                : undefined,
            };
            const nextWorkspace: PartyWorkspace = {
              trainer: nextTrainer,
              pokemon: state.party.pokemon,
            };
            return {
              bagSyncStatus: 'synced',
              bagSyncMessage: 'Write Sync 2-arah aktif',
              party: nextWorkspace,
              importHistory: upsertSavedTrainerProfile(
                state.importHistory,
                nextWorkspace,
                'link'
              ),
            };
          });

          return {
            ok: true,
            message: 'Write Sync aktif! Perubahan Bag otomatis tersimpan ke poke5e.app.',
          };
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : 'Gagal memverifikasi Access Key ke poke5e.app.';
          set({ bagSyncStatus: 'error', bagSyncMessage: message });
          return { ok: false, message };
        }
      },

      disconnectPoke5eAccessKey: () =>
        set((state) => {
          const nextTrainer: TrainerSheet = {
            ...state.party.trainer,
            poke5eMeta: state.party.trainer.poke5eMeta
              ? { ...state.party.trainer.poke5eMeta, accessKey: undefined }
              : undefined,
          };
          const nextWorkspace: PartyWorkspace = {
            trainer: nextTrainer,
            pokemon: state.party.pokemon,
          };
          return {
            bagSyncStatus: 'idle',
            bagSyncMessage: null,
            party: nextWorkspace,
            importHistory: state.party.trainer.poke5eMeta
              ? upsertSavedTrainerProfile(state.importHistory, nextWorkspace, 'link')
              : state.importHistory,
          };
        }),

      addPokemon: (pokemonInput) => {
        const current = get().party.pokemon;
        if (current.length >= 6) return false;
        const newId = pokemonInput.id || createId('poke');
        const created: PokemonSheet = {
          ...pokemonInput,
          id: newId,
          kind: 'pokemon',
        };
        set((state) => ({
          activeCharacterId: newId,
          party: {
            ...state.party,
            pokemon: [...state.party.pokemon, created],
          },
        }));
        return true;
      },

      updatePokemon: (id, patch) =>
        set((state) => ({
          party: {
            ...state.party,
            pokemon: state.party.pokemon.map((p) =>
              p.id === id ? { ...p, ...patch, id, kind: 'pokemon' } : p
            ),
          },
        })),

      removePokemon: (id) =>
        set((state) => {
          const remaining = state.party.pokemon.filter((p) => p.id !== id);
          const nextActive =
            state.activeCharacterId === id ? 'trainer' : state.activeCharacterId;
          return {
            activeCharacterId: nextActive,
            party: {
              ...state.party,
              pokemon: remaining,
            },
          };
        }),

      adjustHp: (characterId, delta) =>
        set((state) => {
          if (characterId === 'trainer') {
            const t = state.party.trainer;
            const nextHp = Math.max(0, Math.min(t.hpMax, t.hpCurrent + delta));
            return {
              party: {
                ...state.party,
                trainer: { ...t, hpCurrent: nextHp },
              },
            };
          }
          return {
            party: {
              ...state.party,
              pokemon: state.party.pokemon.map((p) =>
                p.id === characterId
                  ? {
                      ...p,
                      hpCurrent: Math.max(0, Math.min(p.hpMax, p.hpCurrent + delta)),
                    }
                  : p
              ),
            },
          };
        }),

      addMove: (pokemonId, move) =>
        set((state) => ({
          party: {
            ...state.party,
            pokemon: state.party.pokemon.map((p) =>
              p.id === pokemonId
                ? { ...p, moves: [...p.moves, { ...move, id: createId('mv') }] }
                : p
            ),
          },
        })),

      updateMove: (pokemonId, moveId, patch) =>
        set((state) => ({
          party: {
            ...state.party,
            pokemon: state.party.pokemon.map((p) =>
              p.id === pokemonId
                ? {
                    ...p,
                    moves: p.moves.map((m) =>
                      m.id === moveId ? { ...m, ...patch, id: moveId } : m
                    ),
                  }
                : p
            ),
          },
        })),

      removeMove: (pokemonId, moveId) =>
        set((state) => ({
          party: {
            ...state.party,
            pokemon: state.party.pokemon.map((p) =>
              p.id === pokemonId
                ? { ...p, moves: p.moves.filter((m) => m.id !== moveId) }
                : p
            ),
          },
        })),

      adjustMovePp: (pokemonId, moveId, delta) =>
        set((state) => ({
          party: {
            ...state.party,
            pokemon: state.party.pokemon.map((p) =>
              p.id === pokemonId
                ? {
                    ...p,
                    moves: p.moves.map((m) =>
                      m.id === moveId
                        ? {
                            ...m,
                            ppCurrent: Math.max(0, Math.min(m.ppMax, m.ppCurrent + delta)),
                          }
                        : m
                    ),
                  }
                : p
            ),
          },
        })),

      longRestParty: () =>
        set((state) => ({
          party: {
            trainer: {
              ...state.party.trainer,
              hpCurrent: state.party.trainer.hpMax,
              tempHp: 0,
            },
            pokemon: state.party.pokemon.map((p) => ({
              ...p,
              hpCurrent: p.hpMax,
              tempHp: 0,
              statusCondition: 'Healthy',
              moves: p.moves.map((m) => ({ ...m, ppCurrent: m.ppMax })),
            })),
          },
        })),

      replaceParty: (workspace, source = 'json') =>
        set((state) => {
          const cleanWorkspace: PartyWorkspace = {
            trainer: { ...workspace.trainer, id: 'trainer', kind: 'trainer' },
            pokemon: workspace.pokemon.slice(0, 6),
          };
          return {
            party: cleanWorkspace,
            activeCharacterId: 'trainer',
            importHistory: upsertSavedTrainerProfile(
              state.importHistory,
              cleanWorkspace,
              source
            ),
          };
        }),

      updatePartyFromImport: (workspace, source = 'link') =>
        set((state) => {
          const prevTrainer = state.party.trainer;
          const nextTrainer: TrainerSheet = {
            ...workspace.trainer,
            id: 'trainer',
            kind: 'trainer',
            badges:
              workspace.trainer.badges > 0
                ? workspace.trainer.badges
                : prevTrainer.badges,
            tempHp:
              workspace.trainer.tempHp > 0
                ? workspace.trainer.tempHp
                : prevTrainer.tempHp,
            proficiencyOverride:
              workspace.trainer.proficiencyOverride ?? prevTrainer.proficiencyOverride,
            notes: workspace.trainer.notes.trim()
              ? workspace.trainer.notes
              : prevTrainer.notes,
            poke5eMeta: workspace.trainer.poke5eMeta
              ? {
                  ...prevTrainer.poke5eMeta,
                  ...workspace.trainer.poke5eMeta,
                  accessKey:
                    workspace.trainer.poke5eMeta.accessKey ??
                    prevTrainer.poke5eMeta?.accessKey,
                  bagSyncedAt:
                    workspace.trainer.poke5eMeta.bagSyncedAt ??
                    prevTrainer.poke5eMeta?.bagSyncedAt,
                }
              : prevTrainer.poke5eMeta,
          };

          const nextPokemon: PokemonSheet[] = workspace.pokemon
            .slice(0, 6)
            .map((incoming) => {
              const existing =
                state.party.pokemon.find((p) => p.id === incoming.id) ??
                state.party.pokemon.find(
                  (p) =>
                    p.species.toLowerCase() === incoming.species.toLowerCase() &&
                    p.name.toLowerCase() === incoming.name.toLowerCase()
                );

              if (!existing) return incoming;
              return {
                ...incoming,
                tempHp: incoming.tempHp > 0 ? incoming.tempHp : existing.tempHp,
                stabBase: incoming.stabBase ?? existing.stabBase,
                stabBonus: incoming.stabBonus ?? existing.stabBonus,
                stabOverride: incoming.stabOverride ?? existing.stabOverride,
                proficiencyOverride:
                  incoming.proficiencyOverride ?? existing.proficiencyOverride,
                notes: incoming.notes.trim() ? incoming.notes : existing.notes,
              };
            });

          const stillHasActive =
            state.activeCharacterId === 'trainer' ||
            nextPokemon.some((p) => p.id === state.activeCharacterId);

          const mergedWorkspace: PartyWorkspace = {
            trainer: nextTrainer,
            pokemon: nextPokemon,
          };

          return {
            party: mergedWorkspace,
            activeCharacterId: stillHasActive ? state.activeCharacterId : 'trainer',
            importHistory: upsertSavedTrainerProfile(
              state.importHistory,
              mergedWorkspace,
              source
            ),
          };
        }),

      loadSavedTrainer: (profileId) =>
        set((state) => {
          const found = state.importHistory.find((item) => item.id === profileId);
          if (!found) return state;
          return {
            party: {
              trainer: { ...found.workspace.trainer, id: 'trainer', kind: 'trainer' },
              pokemon: found.workspace.pokemon.slice(0, 6),
            },
            activeCharacterId: 'trainer',
          };
        }),

      removeSavedTrainer: (profileId) =>
        set((state) => ({
          importHistory: state.importHistory.filter((item) => item.id !== profileId),
        })),

      resetToStarterParty: () =>
        set({
          party: createStarterParty(),
          activeCharacterId: 'trainer',
        }),

      performRoll: (req) => {
        const { rollMode, rollVisibility, obrState, diceIntegrationMode } = get();
        const entry = executeRoll({
          ...req,
          rollMode,
          visibility: rollVisibility,
          rollerName: obrState.playerName || 'Local Trainer',
          ownerId: obrState.playerId || 'local-player',
        });

        const now = new Date().toISOString();
        set((state) => {
          const initiativePatch = upsertInitiativeFromRoll(state, entry);
          return {
            rollLog: [entry, ...state.rollLog].slice(0, 120),
            ...(initiativePatch ?? {}),
            ...(initiativePatch ? { initiativeUpdatedAt: now } : {}),
          };
        });

        if (entry.category === 'initiative' && entry.visibility === 'visible') {
          const current = get();
          void syncInitiativeToObr({
            entries: current.initiativeList,
            turnIndex: current.initiativeTurnIndex,
            round: current.initiativeRound,
            updatedAt: current.initiativeUpdatedAt || now,
          });
        }

        void broadcastRollToObr(entry, diceIntegrationMode === 'obr-dice-plus');
        return entry;
      },

      appendRemoteRoll: (roll) =>
        set((state) => {
          if (state.rollLog.some((r) => r.id === roll.id)) return state;
          if (
            roll.visibility === 'hidden' &&
            state.obrState.role !== 'GM' &&
            roll.ownerId !== state.obrState.playerId
          ) {
            return state;
          }
          const initiativePatch = upsertInitiativeFromRoll(state, roll);
          return {
            rollLog: [roll, ...state.rollLog].slice(0, 120),
            ...(initiativePatch ?? {}),
            ...(initiativePatch
              ? { initiativeUpdatedAt: roll.timestamp || new Date().toISOString() }
              : {}),
          };
        }),

      mergeRoomRolls: (incomingRolls) =>
        set((state) => {
          if (incomingRolls.length === 0) return state;
          const existingIds = new Set(state.rollLog.map((r) => r.id));
          const clearedMs = state.rollLogClearedAt
            ? Date.parse(state.rollLogClearedAt)
            : 0;

          const unseen = incomingRolls.filter((r) => {
            if (existingIds.has(r.id)) return false;
            if (r.visibility !== 'visible') return false;
            if (clearedMs > 0 && Date.parse(r.timestamp) <= clearedMs) return false;
            return true;
          });

          if (unseen.length === 0) return state;

          const combinedLog = [...unseen, ...state.rollLog]
            .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
            .slice(0, 120);

          let nextInitState = {
            party: state.party,
            initiativeList: state.initiativeList,
            initiativeTurnIndex: state.initiativeTurnIndex,
          };

          const localInitUpdatedMs = state.initiativeUpdatedAt
            ? Date.parse(state.initiativeUpdatedAt)
            : 0;

          // Apply unseen initiative rolls chronologically only if newer than local initiative state
          const sortedAsc = [...unseen].sort(
            (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)
          );
          let latestAppliedRollTime = state.initiativeUpdatedAt;
          for (const roll of sortedAsc) {
            const rollMs = Date.parse(roll.timestamp);
            if (localInitUpdatedMs > 0 && !Number.isNaN(rollMs) && rollMs <= localInitUpdatedMs) {
              continue;
            }
            const patch = upsertInitiativeFromRoll(nextInitState, roll);
            if (patch) {
              nextInitState = {
                ...nextInitState,
                ...patch,
              };
              latestAppliedRollTime = roll.timestamp;
            }
          }

          return {
            rollLog: combinedLog,
            initiativeList: nextInitState.initiativeList,
            initiativeTurnIndex: nextInitState.initiativeTurnIndex,
            initiativeUpdatedAt: latestAppliedRollTime,
          };
        }),

      clearRollLog: () =>
        set({
          rollLog: [],
          rollLogClearedAt: new Date().toISOString(),
        }),

      addManualInitiative: ({ name, initiative, dexMod = 0, ac, hpText }) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const now = new Date().toISOString();
        set((state) => {
          const id = createId('npc-init');
          const entry: InitiativeEntry = {
            id,
            characterId: id,
            characterName: trimmed,
            playerName: state.obrState.role === 'GM' ? 'GM / NPC' : state.obrState.playerName,
            ownerId: state.obrState.playerId || 'local-player',
            initiative,
            dexMod,
            breakdown: 'Manual entry',
            visibility: 'visible',
            ac,
            hpText: hpText?.trim() || undefined,
            isNpc: true,
            updatedAt: now,
          };
          const sorted = sortInitiativeEntries([...state.initiativeList, entry]);
          const nextIndex = getNextTurnIndexAfterReorder(
            state.initiativeList,
            state.initiativeTurnIndex,
            sorted
          );
          return {
            initiativeList: sorted,
            initiativeTurnIndex: nextIndex,
            initiativeUpdatedAt: now,
          };
        });
        const current = get();
        void syncInitiativeToObr({
          entries: current.initiativeList,
          turnIndex: current.initiativeTurnIndex,
          round: current.initiativeRound,
          updatedAt: current.initiativeUpdatedAt || now,
        });
      },

      updateInitiativeScore: (id, initiative) => {
        const now = new Date().toISOString();
        set((state) => {
          const updated = state.initiativeList.map((entry) =>
            entry.id === id
              ? { ...entry, initiative, updatedAt: now }
              : entry
          );
          const sorted = sortInitiativeEntries(updated);
          const nextIndex = getNextTurnIndexAfterReorder(
            state.initiativeList,
            state.initiativeTurnIndex,
            sorted
          );
          return {
            initiativeList: sorted,
            initiativeTurnIndex: nextIndex,
            initiativeUpdatedAt: now,
          };
        });
        const current = get();
        void syncInitiativeToObr({
          entries: current.initiativeList,
          turnIndex: current.initiativeTurnIndex,
          round: current.initiativeRound,
          updatedAt: current.initiativeUpdatedAt || now,
        });
      },

      removeInitiativeEntry: (id) => {
        const now = new Date().toISOString();
        set((state) => {
          const filtered = state.initiativeList.filter((entry) => entry.id !== id);
          const nextIndex = getNextTurnIndexAfterReorder(
            state.initiativeList,
            state.initiativeTurnIndex,
            filtered
          );
          return {
            initiativeList: filtered,
            initiativeTurnIndex: nextIndex,
            initiativeRound: filtered.length === 0 ? 1 : state.initiativeRound,
            initiativeUpdatedAt: now,
          };
        });
        const current = get();
        void syncInitiativeToObr({
          entries: current.initiativeList,
          turnIndex: current.initiativeTurnIndex,
          round: current.initiativeRound,
          updatedAt: current.initiativeUpdatedAt || now,
        });
      },

      setInitiativeTurnIndex: (index) => {
        const now = new Date().toISOString();
        set((state) => {
          if (state.initiativeList.length === 0) {
            return { initiativeTurnIndex: 0, initiativeUpdatedAt: now };
          }
          const clamped = Math.max(0, Math.min(index, state.initiativeList.length - 1));
          return { initiativeTurnIndex: clamped, initiativeUpdatedAt: now };
        });
        const current = get();
        void syncInitiativeToObr({
          entries: current.initiativeList,
          turnIndex: current.initiativeTurnIndex,
          round: current.initiativeRound,
          updatedAt: current.initiativeUpdatedAt || now,
        });
      },

      nextInitiativeTurn: () => {
        const now = new Date().toISOString();
        set((state) => {
          const count = state.initiativeList.length;
          if (count === 0) return state;
          if (state.initiativeTurnIndex + 1 >= count) {
            return {
              initiativeTurnIndex: 0,
              initiativeRound: state.initiativeRound + 1,
              initiativeUpdatedAt: now,
            };
          }
          return {
            initiativeTurnIndex: state.initiativeTurnIndex + 1,
            initiativeUpdatedAt: now,
          };
        });
        const current = get();
        if (current.initiativeList.length > 0) {
          void syncInitiativeToObr({
            entries: current.initiativeList,
            turnIndex: current.initiativeTurnIndex,
            round: current.initiativeRound,
            updatedAt: current.initiativeUpdatedAt || now,
          });
        }
      },

      prevInitiativeTurn: () => {
        const now = new Date().toISOString();
        set((state) => {
          const count = state.initiativeList.length;
          if (count === 0) return state;
          if (state.initiativeTurnIndex === 0) {
            if (state.initiativeRound > 1) {
              return {
                initiativeTurnIndex: count - 1,
                initiativeRound: state.initiativeRound - 1,
                initiativeUpdatedAt: now,
              };
            }
            return state;
          }
          return {
            initiativeTurnIndex: state.initiativeTurnIndex - 1,
            initiativeUpdatedAt: now,
          };
        });
        const current = get();
        if (current.initiativeList.length > 0) {
          void syncInitiativeToObr({
            entries: current.initiativeList,
            turnIndex: current.initiativeTurnIndex,
            round: current.initiativeRound,
            updatedAt: current.initiativeUpdatedAt || now,
          });
        }
      },

      setInitiativeRound: (round) => {
        const clamped = Math.max(1, Math.floor(round));
        const now = new Date().toISOString();
        set({
          initiativeRound: clamped,
          initiativeUpdatedAt: now,
        });
        const current = get();
        void syncInitiativeToObr({
          entries: current.initiativeList,
          turnIndex: current.initiativeTurnIndex,
          round: current.initiativeRound,
          updatedAt: current.initiativeUpdatedAt || now,
        });
      },

      resetInitiativeRound: () => {
        const now = new Date().toISOString();
        set({
          initiativeRound: 1,
          initiativeTurnIndex: 0,
          initiativeUpdatedAt: now,
        });
        const current = get();
        void syncInitiativeToObr({
          entries: current.initiativeList,
          turnIndex: current.initiativeTurnIndex,
          round: current.initiativeRound,
          updatedAt: current.initiativeUpdatedAt || now,
        });
      },

      clearInitiative: () => {
        const now = new Date().toISOString();
        set({
          initiativeList: [],
          initiativeTurnIndex: 0,
          initiativeRound: 1,
          initiativeUpdatedAt: now,
        });
        void syncInitiativeToObr({
          entries: [],
          turnIndex: 0,
          round: 1,
          updatedAt: now,
        });
      },

      syncRemoteInitiative: (remote) =>
        set((state) => {
          if (state.initiativeUpdatedAt && remote.updatedAt === state.initiativeUpdatedAt) {
            return state;
          }

          const localMs = state.initiativeUpdatedAt
            ? Date.parse(state.initiativeUpdatedAt)
            : 0;
          const remoteMs = remote.updatedAt ? Date.parse(remote.updatedAt) : 0;

          // Never let older/stale OBR room metadata overwrite newer local initiative
          if (
            localMs > 0 &&
            (!Number.isFinite(remoteMs) || remoteMs === 0 || localMs > remoteMs)
          ) {
            return state;
          }

          if (isRemoteInitiativeEquivalent(state, remote)) {
            return state;
          }

          const localHidden = state.initiativeList.filter((e) => e.visibility === 'hidden');
          const merged = sortInitiativeEntries([...remote.entries, ...localHidden]);
          const remoteActiveId = remote.entries[remote.turnIndex]?.id;

          let nextTurnIndex = 0;
          if (merged.length > 0) {
            if (remoteActiveId) {
              const idx = merged.findIndex((item) => item.id === remoteActiveId);
              nextTurnIndex = idx >= 0 ? idx : Math.min(remote.turnIndex, merged.length - 1);
            } else {
              nextTurnIndex = Math.max(0, Math.min(remote.turnIndex, merged.length - 1));
            }
          }

          return {
            initiativeList: merged,
            initiativeTurnIndex: nextTurnIndex,
            initiativeRound: Math.max(1, Math.floor(remote.round)),
            initiativeUpdatedAt: remote.updatedAt,
          };
        }),
    }),
    {
      name: 'pokemon5e-obr-sheet-v1',
      storage: createJSONStorage(() => resilientZustandStorage),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState || {}) as Partial<CharacterStoreState>;
        const mergedParty = persisted.party
          ? {
              ...persisted.party,
              trainer: {
                ...persisted.party.trainer,
                items: normalizeTrainerItems(persisted.party.trainer),
              },
            }
          : currentState.party;

        const snapshot = loadInitiativeSnapshot();
        const persistedInitList = Array.isArray(persisted.initiativeList)
          ? persisted.initiativeList
          : [];
        const persistedMs = persisted.initiativeUpdatedAt
          ? Date.parse(persisted.initiativeUpdatedAt)
          : 0;
        const snapshotMs = snapshot?.updatedAt ? Date.parse(snapshot.updatedAt) : 0;

        const useSnapshot =
          Boolean(snapshot) &&
          ((persistedInitList.length === 0 && (snapshot?.entries.length ?? 0) > 0) ||
            (Number.isFinite(snapshotMs) && snapshotMs > persistedMs));

        const resolvedInitList = useSnapshot
          ? snapshot!.entries
          : persistedInitList;
        const resolvedRound = useSnapshot
          ? snapshot!.round
          : Math.max(1, Math.floor(persisted.initiativeRound ?? currentState.initiativeRound ?? 1));
        const rawTurn = useSnapshot
          ? snapshot!.turnIndex
          : (persisted.initiativeTurnIndex ?? currentState.initiativeTurnIndex ?? 0);
        const resolvedTurn =
          resolvedInitList.length > 0
            ? Math.max(0, Math.min(rawTurn, resolvedInitList.length - 1))
            : 0;
        const resolvedUpdatedAt = useSnapshot
          ? snapshot!.updatedAt
          : persisted.initiativeUpdatedAt;

        return {
          ...currentState,
          ...persisted,
          party: mergedParty,
          initiativeList: resolvedInitList,
          initiativeTurnIndex: resolvedTurn,
          initiativeRound: resolvedRound,
          initiativeUpdatedAt: resolvedUpdatedAt,
        };
      },
      partialize: (state) => ({
        party: state.party,
        activeCharacterId: state.activeCharacterId,
        rollMode: state.rollMode,
        rollVisibility: state.rollVisibility,
        diceIntegrationMode: state.diceIntegrationMode,
        rollLog: state.rollLog.slice(0, 60),
        rollLogClearedAt: state.rollLogClearedAt,
        initiativeList: state.initiativeList,
        initiativeTurnIndex: state.initiativeTurnIndex,
        initiativeRound: state.initiativeRound,
        initiativeUpdatedAt: state.initiativeUpdatedAt,
        importHistory: state.importHistory.slice(0, 8),
      }),
    }
  )
);

// Mirror every initiative update to the dedicated lightweight snapshot so refreshes always preserve combat state
useCharacterStore.subscribe((state, prevState) => {
  if (
    state.initiativeList !== prevState.initiativeList ||
    state.initiativeTurnIndex !== prevState.initiativeTurnIndex ||
    state.initiativeRound !== prevState.initiativeRound ||
    state.initiativeUpdatedAt !== prevState.initiativeUpdatedAt
  ) {
    saveInitiativeSnapshot({
      entries: state.initiativeList,
      turnIndex: state.initiativeTurnIndex,
      round: state.initiativeRound,
      updatedAt: state.initiativeUpdatedAt,
    });
  }
});

export function selectActiveCharacter(state: CharacterStoreState): ActiveCharacter {
  if (state.activeCharacterId === 'trainer') {
    return state.party.trainer;
  }
  return (
    state.party.pokemon.find((p) => p.id === state.activeCharacterId) ??
    state.party.trainer
  );
}
