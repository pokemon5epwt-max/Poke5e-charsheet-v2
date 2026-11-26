import OBR from '@owlbear-rodeo/sdk';
import {
  InitiativeEntry,
  InitiativeSyncState,
  ObrState,
  RollEntry,
} from '../types/pokemon5e';
import { getRollCategoryLabel } from './pokemon5eRules';

const ROLL_CHANNEL = 'com.pokemon5e.character-sheet/rolls';
const DICE_PLUS_CHANNEL = 'dice-plus/roll-request';
const ROOM_ROLLS_METADATA_KEY = 'com.pokemon5e.character-sheet/shared-rolls';
const ROOM_INITIATIVE_METADATA_KEY = 'com.pokemon5e.character-sheet/initiative-state';
export const HUD_POPOVER_ID = 'com.pokemon5e.character-sheet/initiative-hud';

export interface ObrBridgeCallbacks {
  onObrStateChange: (state: ObrState) => void;
  onRemoteRoll: (roll: RollEntry) => void;
  onSyncRoomRolls: (rolls: RollEntry[]) => void;
  onSyncInitiative: (state: InitiativeSyncState) => void;
}

export interface ObrBridgeOptions {
  skipActionResize?: boolean;
}

export function computeFloatingHudWidth(
  combatantCount: number,
  isCollapsed: boolean
): number {
  if (isCollapsed) return 96;
  const visibleSlots = Math.max(1, Math.min(8, combatantCount || 1));
  return Math.min(720, Math.max(300, 96 + visibleSlots * 74));
}

export async function openFloatingInitiativeHud(
  combatantCount = 1
): Promise<boolean> {
  if (!OBR.isAvailable || !OBR.isReady) return false;
  try {
    await OBR.popover.open({
      id: HUD_POPOVER_ID,
      url: '/?view=hud',
      width: computeFloatingHudWidth(combatantCount, false),
      height: 152,
      anchorReference: 'POSITION',
      anchorPosition: { left: 460, top: 18 },
      anchorOrigin: { horizontal: 'LEFT', vertical: 'TOP' },
      transformOrigin: { horizontal: 'LEFT', vertical: 'TOP' },
      hidePaper: true,
      disableClickAway: true,
      marginThreshold: 8,
    });
    return true;
  } catch {
    return false;
  }
}

export async function closeFloatingInitiativeHud(): Promise<void> {
  if (!OBR.isAvailable || !OBR.isReady) return;
  try {
    await OBR.popover.close(HUD_POPOVER_ID);
  } catch {
    // Ignore close errors
  }
}

export async function resizeFloatingInitiativeHud(
  width: number,
  height: number
): Promise<void> {
  if (!OBR.isAvailable || !OBR.isReady) return;
  try {
    await Promise.all([
      OBR.popover.setWidth(HUD_POPOVER_ID, Math.round(width)),
      OBR.popover.setHeight(HUD_POPOVER_ID, Math.round(height)),
    ]);
  } catch {
    // Ignore resize errors
  }
}

function extractRoomRolls(metadata: Record<string, unknown>, localPlayerId: string): RollEntry[] {
  const raw = metadata[ROOM_ROLLS_METADATA_KEY];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is RollEntry =>
        Boolean(item && typeof item === 'object' && typeof (item as RollEntry).id === 'string')
    )
    .filter((item) => item.visibility === 'visible')
    .map((item) => ({
      ...item,
      source: item.ownerId === localPlayerId ? ('local' as const) : ('obr-remote' as const),
    }));
}

function extractRoomInitiative(metadata: Record<string, unknown>): InitiativeSyncState | null {
  const raw = metadata[ROOM_INITIATIVE_METADATA_KEY];
  if (!raw || typeof raw !== 'object') return null;

  const candidate = raw as Partial<InitiativeSyncState>;
  if (!Array.isArray(candidate.entries) || typeof candidate.updatedAt !== 'string') {
    return null;
  }

  const visibleEntries = candidate.entries.filter(
    (item): item is InitiativeEntry =>
      Boolean(
        item &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          typeof item.characterName === 'string' &&
          typeof item.initiative === 'number' &&
          item.visibility === 'visible'
      )
  );

  const rawRound = typeof candidate.round === 'number' && Number.isFinite(candidate.round)
    ? candidate.round
    : 1;
  const round = Math.max(1, Math.floor(rawRound));

  const rawTurnIndex =
    typeof candidate.turnIndex === 'number' && Number.isFinite(candidate.turnIndex)
      ? Math.floor(candidate.turnIndex)
      : 0;
  const turnIndex =
    visibleEntries.length > 0
      ? Math.max(0, Math.min(rawTurnIndex, visibleEntries.length - 1))
      : 0;

  return {
    entries: visibleEntries,
    turnIndex,
    round,
    updatedAt: candidate.updatedAt,
  };
}

export function initObrBridge(
  callbacks: ObrBridgeCallbacks,
  options?: ObrBridgeOptions
): () => void {
  if (!OBR.isAvailable) {
    callbacks.onObrStateChange({
      isAvailable: false,
      isReady: false,
      playerId: 'local-player',
      playerName: 'Local Trainer',
      role: 'GM',
      partyCount: 1,
    });
    return () => {};
  }

  let unsubPlayer: (() => void) | undefined;
  let unsubParty: (() => void) | undefined;
  let unsubBroadcast: (() => void) | undefined;
  let unsubRoomMeta: (() => void) | undefined;

  let currentState: ObrState = {
    isAvailable: true,
    isReady: false,
    playerId: 'obr-player',
    playerName: 'Player',
    role: 'PLAYER',
    partyCount: 1,
  };

  const syncPlayerAndRoom = async () => {
    try {
      const [id, name, role, party, roomMeta] = await Promise.all([
        OBR.player.getId(),
        OBR.player.getName(),
        OBR.player.getRole(),
        OBR.party.getPlayers(),
        OBR.room.getMetadata().catch(() => ({} as Record<string, unknown>)),
      ]);
      currentState = {
        isAvailable: true,
        isReady: true,
        playerId: id,
        playerName: name,
        role,
        partyCount: party.length + 1,
      };
      callbacks.onObrStateChange(currentState);
      const roomRolls = extractRoomRolls(roomMeta, id);
      if (roomRolls.length > 0) {
        callbacks.onSyncRoomRolls(roomRolls);
      }
      const roomInitiative = extractRoomInitiative(roomMeta);
      if (roomInitiative) {
        callbacks.onSyncInitiative(roomInitiative);
      }
    } catch {
      // Ignore transient OBR readiness issues
    }
  };

  OBR.onReady(() => {
    void syncPlayerAndRoom();
    if (!options?.skipActionResize) {
      void OBR.action.setWidth(540);
      void OBR.action.setHeight(640);
      void OBR.action.setBadgeText(undefined).catch(() => {});
    }

    unsubPlayer = OBR.player.onChange((player) => {
      currentState = {
        ...currentState,
        isReady: true,
        playerId: player.id,
        playerName: player.name,
        role: player.role,
      };
      callbacks.onObrStateChange(currentState);
    });

    unsubParty = OBR.party.onChange((players) => {
      currentState = {
        ...currentState,
        partyCount: players.length + 1,
      };
      callbacks.onObrStateChange(currentState);
    });

    unsubRoomMeta = OBR.room.onMetadataChange((metadata) => {
      const roomRolls = extractRoomRolls(metadata, currentState.playerId);
      if (roomRolls.length > 0) {
        callbacks.onSyncRoomRolls(roomRolls);
      }
      const roomInitiative = extractRoomInitiative(metadata);
      if (roomInitiative) {
        callbacks.onSyncInitiative(roomInitiative);
      }
    });

    unsubBroadcast = OBR.broadcast.onMessage(ROLL_CHANNEL, (event) => {
      const payload = event.data as RollEntry | undefined;
      if (!payload || typeof payload !== 'object' || !payload.id) {
        return;
      }

      // Enforce hidden roll privacy:
      // Hidden rolls are only visible to the GM and the rolling player.
      if (
        payload.visibility === 'hidden' &&
        currentState.role !== 'GM' &&
        payload.ownerId !== currentState.playerId
      ) {
        return;
      }

      callbacks.onRemoteRoll({
        ...payload,
        source: 'obr-remote',
      });
    });
  });

  return () => {
    unsubPlayer?.();
    unsubParty?.();
    unsubRoomMeta?.();
    unsubBroadcast?.();
  };
}

export async function syncInitiativeToObr(state: InitiativeSyncState): Promise<void> {
  if (!OBR.isAvailable || !OBR.isReady) {
    return;
  }

  // Never leak hidden GM initiative entries into shared room metadata
  const visibleEntries = state.entries.filter((entry) => entry.visibility === 'visible');
  const activeEntryId = state.entries[state.turnIndex]?.id;
  const matchedVisibleIndex = activeEntryId
    ? visibleEntries.findIndex((entry) => entry.id === activeEntryId)
    : -1;
  const visibleTurnIndex =
    visibleEntries.length === 0
      ? 0
      : matchedVisibleIndex >= 0
        ? matchedVisibleIndex
        : Math.max(0, Math.min(state.turnIndex, visibleEntries.length - 1));

  const payload: InitiativeSyncState = {
    entries: visibleEntries,
    turnIndex: visibleTurnIndex,
    round: Math.max(1, Math.floor(state.round)),
    updatedAt: state.updatedAt || new Date().toISOString(),
  };

  try {
    await OBR.room.setMetadata({
      [ROOM_INITIATIVE_METADATA_KEY]: payload,
    });
  } catch {
    // Ignore room metadata write error if disconnected
  }
}

export async function broadcastRollToObr(
  roll: RollEntry,
  syncDicePlus: boolean
): Promise<void> {
  if (!OBR.isAvailable || !OBR.isReady) {
    return;
  }

  const checkType = getRollCategoryLabel(roll.category);
  const who =
    roll.rollerName && roll.rollerName !== roll.characterName
      ? `${roll.rollerName} (${roll.characterName})`
      : roll.characterName;
  const prefix = roll.visibility === 'hidden' ? '[Hidden GM] ' : '';

  try {
    // 1. Real-time broadcast to all other players and GM (triggers background.ts notification)
    await OBR.broadcast.sendMessage(ROLL_CHANNEL, roll, {
      destination: 'REMOTE',
    });

    // 2. Persist visible rolls in Owlbear Room Metadata so late-opening players/GM still get History & Initiative
    if (roll.visibility === 'visible') {
      try {
        const meta = await OBR.room.getMetadata();
        const existing = Array.isArray(meta[ROOM_ROLLS_METADATA_KEY])
          ? (meta[ROOM_ROLLS_METADATA_KEY] as RollEntry[]).filter(
              (r) => r && typeof r === 'object' && r.id && r.id !== roll.id
            )
          : [];
        const updated = [roll, ...existing].slice(0, 60);
        await OBR.room.setMetadata({
          [ROOM_ROLLS_METADATA_KEY]: updated,
        });
      } catch {
        // Ignore room metadata write error if disconnected
      }
    }

    // 3. Optional integration path for Dice+ / OBR Dice listeners
    if (syncDicePlus && roll.visibility === 'visible') {
      await OBR.broadcast.sendMessage(
        DICE_PLUS_CHANNEL,
        {
          notation: roll.formula,
          label: `${who} · ${checkType}: ${roll.label}`,
          senderName: roll.rollerName,
          result: roll.total,
        },
        { destination: 'ALL' }
      );
    }

    // 4. Local confirmation toast for the rolling player
    await OBR.notification.show(
      `${prefix}${who} · ${checkType}: ${roll.label} → ${roll.total}`,
      roll.isCrit ? 'SUCCESS' : roll.isFumble ? 'ERROR' : 'INFO'
    );
  } catch {
    // Graceful fallback if broadcast or notification is unavailable
  }
}

export async function setObrPopoverSize(
  width: number,
  height: number
): Promise<void> {
  if (!OBR.isAvailable || !OBR.isReady) return;
  try {
    await Promise.all([OBR.action.setWidth(width), OBR.action.setHeight(height)]);
  } catch {
    // Ignore if action resize is unsupported
  }
}
