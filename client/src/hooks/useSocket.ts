import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { API } from '../config';


/**
 * Connection lifecycle for the socket. States:
 *   connecting   — handshake in flight
 *   connected    — live; events flow both ways
 *   reconnecting — socket.io backoff between attempts (bounded exponential)
 *   auth_error   — server rejected identity (Unknown traveler); no retry storm
 *   offline      — server ended the session (io server disconnect)
 *
 * `connected` is the single source of truth callers use to decide between
 * socket flow and the REST polling fallback.
 */
export type SocketStatus = 'connecting' | 'connected' | 'reconnecting' | 'auth_error' | 'offline';

export function useSocket(token: string | null): {
  socket: Socket;
  status: SocketStatus;
  connected: boolean;
  attemptReconnect: () => void;
} {
  // Created once; io() hooks socket.io's built-in reconnect/backoff (bounded
  // so a dead server can't spin the CPU). token can arrive later (profile
  // loads after mount) — the signed token is attached on every (re)connect
  // and verified server-side.
  // autoConnect only with a token: a socket that handshakes anonymously first
  // stays anonymous (connect() is a no-op once connected), and the server
  // rejects identity-bearing events from it.
  const [socket] = useState<Socket>(() =>
    io(API, {
      auth: token ? { token } : {},
      autoConnect: !!token,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      randomizationFactor: 0.5,
      timeout: 8000
    })
  );

  const [status, setStatus] = useState<SocketStatus>('connecting');
  const authBlockedRef = useRef(false);

  useEffect(() => {
    setStatus(socket.connected ? 'connected' : 'connecting');

    const onConnect = () => {
      authBlockedRef.current = false;
      setStatus('connected');
    };
    const onDisconnect = (reason: string) => {
      // auth_blocked sockets are parked on purpose — not a transient failure.
      if (authBlockedRef.current) return;
      setStatus(reason === 'io server disconnect' ? 'offline' : 'reconnecting');
    };
    const onConnectError = (err: Error) => {
      if (/unknown traveler/i.test(err?.message || '')) {
        authBlockedRef.current = true;
        setStatus('auth_error');
        socket.disconnect();
        return;
      }
      setStatus('reconnecting');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, [socket]);

  // Re-apply identity when it resolves or changes. .auth is only sent during
  // the handshake, so a live socket must reconnect to present a new token.
  useEffect(() => {
    const prev = (socket.auth as { token?: string } | undefined)?.token;
    socket.auth = token ? { token } : {};
    if (!token) {
      // Signed out / account deleted: don't keep an identity-less socket open.
      if (socket.connected || socket.active) socket.disconnect();
      return;
    }
    authBlockedRef.current = false;
    if (socket.connected && prev !== token) {
      socket.disconnect();
      socket.connect();
    } else if (!socket.connected) {
      socket.connect();
    }
  }, [socket, token]);

  const attemptReconnect = useCallback(() => {
    if (!(socket.auth as { token?: string } | undefined)?.token) return;
    authBlockedRef.current = false;
    setStatus('connecting');
    socket.connect();
  }, [socket]);

  return { socket, status, connected: status === 'connected', attemptReconnect };
}