import OBR from '@owlbear-rodeo/sdk';
import { InitiativeSyncState, RollEntry } from './types/pokemon5e';
import { getRollCategoryLabel } from './utils/pokemon5eRules';

const ROLL_CHANNEL = 'com.pokemon5e.character-sheet/rolls';
const ROOM_INITIATIVE_METADATA_KEY = 'com.pokemon5e.character-sheet/initiative-state';

if (OBR.isAvailable) {
  let playerId = 'obr-player';
  let role: 'GM' | 'PLAYER' = 'PLAYER';
  let isActionOpen = false;
  let lastSeenRound = 1;
  let lastSeenInitUpdatedAt = '';

  OBR.onReady(() => {
    void Promise.all([
      OBR.player.getId(),
      OBR.player.getRole(),
      OBR.action.isOpen(),
      OBR.room.getMetadata().catch(() => ({} as Record<string, unknown>)),
    ])
      .then(([id, r, open, meta]) => {
        playerId = id;
        role = r;
        isActionOpen = open;
        if (open) {
          void OBR.action.setBadgeText(undefined);
        }
        const initRaw = meta[ROOM_INITIATIVE_METADATA_KEY] as Partial<InitiativeSyncState> | undefined;
        if (initRaw && typeof initRaw === 'object') {
          if (typeof initRaw.round === 'number') {
            lastSeenRound = Math.max(1, Math.floor(initRaw.round));
          }
          if (typeof initRaw.updatedAt === 'string') {
            lastSeenInitUpdatedAt = initRaw.updatedAt;
          }
        }
      })
      .catch(() => {});

    OBR.player.onChange((player) => {
      playerId = player.id;
      role = player.role;
    });

    OBR.action.onOpenChange((open) => {
      isActionOpen = open;
      if (open) {
        void OBR.action.setBadgeText(undefined);
      }
    });

    OBR.room.onMetadataChange((metadata) => {
      const initRaw = metadata[ROOM_INITIATIVE_METADATA_KEY] as
        | Partial<InitiativeSyncState>
        | undefined;
      if (!initRaw || typeof initRaw !== 'object' || typeof initRaw.round !== 'number') {
        return;
      }

      const nextRound = Math.max(1, Math.floor(initRaw.round));
      const updatedAt = typeof initRaw.updatedAt === 'string' ? initRaw.updatedAt : '';

      if (updatedAt && updatedAt === lastSeenInitUpdatedAt) {
        return;
      }
      lastSeenInitUpdatedAt = updatedAt;

      if (nextRound > lastSeenRound && !isActionOpen) {
        const entries = Array.isArray(initRaw.entries) ? initRaw.entries : [];
        const turnIdx =
          typeof initRaw.turnIndex === 'number'
            ? Math.max(0, Math.min(Math.floor(initRaw.turnIndex), Math.max(0, entries.length - 1)))
            : 0;
        const activeName = entries[turnIdx]?.characterName;
        const msg = activeName
          ? `Round ${nextRound} started · Turn: ${activeName}`
          : `Round ${nextRound} started`;
        void OBR.notification.show(msg, 'INFO');
      }
      lastSeenRound = nextRound;
    });

    OBR.broadcast.onMessage(ROLL_CHANNEL, (event) => {
      const roll = event.data as RollEntry | undefined;
      if (!roll || typeof roll !== 'object' || !roll.id) {
        return;
      }

      // Enforce hidden roll privacy: only GM or the roller sees hidden rolls
      if (
        roll.visibility === 'hidden' &&
        role !== 'GM' &&
        roll.ownerId !== playerId
      ) {
        return;
      }

      const prefix = roll.visibility === 'hidden' ? '[Hidden GM] ' : '';
      const checkType = getRollCategoryLabel(roll.category);
      const who =
        roll.rollerName && roll.rollerName !== roll.characterName
          ? `${roll.rollerName} (${roll.characterName})`
          : roll.characterName;

      void OBR.notification.show(
        `${prefix}${who} · ${checkType}: ${roll.label} → ${roll.total}`,
        roll.isCrit ? 'SUCCESS' : roll.isFumble ? 'ERROR' : 'INFO'
      );

      if (!isActionOpen) {
        const badgeColor = roll.isCrit
          ? '#267347'
          : roll.isFumble
            ? '#D62839'
            : '#D97706';
        void OBR.action.setBadgeBackgroundColor(badgeColor);
        void OBR.action.setBadgeText(String(roll.total));
      }
    });
  });
}
