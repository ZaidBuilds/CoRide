import type { ContextRoom } from '../types';

/**
 * Presence-room id (`station:line:direction`) for a live context room, in the
 * format the server's Redis presence and RoomScreen expect. Undefined when the
 * context lacks a station, line or direction.
 */
export function presenceRoomId(room: ContextRoom | null | undefined): string | undefined {
  if (!room?.stationId || !room.lineId || !room.direction) return undefined;
  const slug = (s: string, max: number) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, max);
  const id = `${slug(room.stationId, 40)}:${slug(room.lineId, 30)}:${slug(room.direction, 40)}`;
  return /^[a-z0-9_]{1,40}:[a-z0-9_]{1,30}:[a-z0-9_]{1,40}$/.test(id) ? id : undefined;
}
