/**
 * Context-room presence: per-room tiers, ghost sweep after backgrounding,
 * silent re-join on resume, and multi-socket disconnects.
 *
 *   npm test
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { RoomManager as RoomManagerT } from './roomManager';
import type { PresenceManager as PresenceManagerT } from './presenceManager';
import type { UserProfile } from '../types';

let rm: RoomManagerT;
let pm: PresenceManagerT;
let TTL = 0;

before(() => {
  // Point persistence at a throwaway dir before the singletons load.
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'coride-presence-'));
  process.env.REAL_DATA = 'true'; // no seeded demo riders
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  rm = require('./roomManager').RoomManager.getInstance();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const presenceMod = require('./presenceManager');
  pm = presenceMod.PresenceManager.getInstance();
  TTL = presenceMod.MEMBER_TTL_MS;
});

function user(id: string): UserProfile {
  return { id, username: `@${id}`, pseudonym: id, avatarId: 'av_1', avatarBg: '#000', interestTags: [], collegeOrTag: '', activity: 'STILL', joinedAt: 0, karmaScore: 0 } as unknown as UserProfile;
}

function makeRooms(suffix: string) {
  const base = {
    id: 'x', station: `karol_bagh_t${suffix}`, stationName: 'Karol Bagh', line: 'blue', lineName: 'Blue Line', lineColor: '#00f',
    direction: 'Towards Dwarka Sector 21', confidence: 0.9, rawScore: 130, trainId: `train_blue_rev_${suffix}`,
    breakdown: { stationMatch: 30, routeMatch: 20, movementMatch: 10, scheduleMatch: 10, userConfirm: 0 }, reason: ''
  };
  const station = rm.getOrCreateFromContext({ ...base, context: 'station' } as any);
  const train = rm.getOrCreateFromContext({ ...base, context: 'train' } as any);
  return { station, train };
}

test('presence is per room: heartbeating one room does not steal the other', () => {
  const { station, train } = makeRooms('1');
  const u = user('usr_p1');
  rm.joinRoom(station.id, u, 'sock_p1');
  rm.joinRoom(train.id, u, 'sock_p1');
  pm.heartbeat(u.id, train.id, 'sock_p1');
  assert.equal(pm.countForContext(station.id).total, 1);
  assert.equal(pm.countForContext(train.id).total, 1);
});

test('a backgrounded member (no heartbeat past the TTL) is swept; a heartbeat puts them back quietly', () => {
  const { station } = makeRooms('2');
  const u = user('usr_p2');
  const t0 = Date.now();
  rm.joinRoom(station.id, u, 'sock_p2');
  const msgs = rm.getRoom(station.id)!.messages.length;

  assert.deepEqual(rm.sweepGhosts(t0 + TTL - 1000).includes(station.id), false, 'still fresh');
  assert.ok(rm.getRoom(station.id)!.userIds.has(u.id));

  assert.ok(rm.sweepGhosts(t0 + TTL + 1000).includes(station.id));
  assert.equal(rm.getRoom(station.id)!.userIds.has(u.id), false, 'ghost removed');
  assert.equal(pm.countForContext(station.id).total, 0);

  const readded = rm.touchMember(station.id, u, 'sock_p2');
  assert.equal(readded, true);
  assert.ok(rm.getRoom(station.id)!.userIds.has(u.id));
  assert.equal(rm.getRoom(station.id)!.messages.length, msgs, 'no duplicate join message');
});

test('regular heartbeats keep a visible member present indefinitely', () => {
  const { station } = makeRooms('3');
  const u = user('usr_p3');
  const t0 = Date.now();
  rm.joinRoom(station.id, u, 'sock_p3');
  for (let i = 1; i <= 10; i++) {
    const t = t0 + i * 25_000;
    rm.touchMember(station.id, u, 'sock_p3', t);
    rm.sweepGhosts(t + 1);
  }
  assert.ok(rm.getRoom(station.id)!.userIds.has(u.id));
});

test('closing one of two sockets does not remove the user from their rooms', () => {
  const { station } = makeRooms('4');
  const u = user('usr_p4');
  rm.joinRoom(station.id, u, 'sock_p4a');
  rm.joinRoom(station.id, u, 'sock_p4b');
  const first = rm.disconnectSocket('sock_p4a');
  assert.deepEqual(first.roomIds, []);
  assert.ok(rm.getRoom(station.id)!.userIds.has(u.id));
  const last = rm.disconnectSocket('sock_p4b');
  assert.deepEqual(last.roomIds, [station.id]);
  assert.equal(rm.getRoom(station.id)!.userIds.has(u.id), false);
});

test('leaving a room clears presence for that room only', () => {
  const { station, train } = makeRooms('5');
  const u = user('usr_p5');
  rm.joinRoom(station.id, u, 'sock_p5');
  rm.joinRoom(train.id, u, 'sock_p5');
  rm.leaveRoom(station.id, u.id);
  assert.equal(pm.countForContext(station.id).total, 0);
  assert.equal(pm.countForContext(train.id).total, 1);
  assert.equal(pm.getTier(u.id), 'active');
});
