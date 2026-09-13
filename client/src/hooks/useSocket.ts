import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const API = 'http://localhost:4000';

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
  const [socket] = useState<Socket>(() =>
    io(API, {
      auth: { token: token ?? undefined },
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

  // Re-apply identity when it resolves or changes; (.auth is re-read by
  // socket.io on every connect attempt, so a stale auth can't linger.)
  useEffect(() => {
    socket.auth = token ? { token } : {};
    if (token) {
      authBlockedRef.current = false;
      socket.connect();
    }
  }, [socket, token]);

  const attemptReconnect = useCallback(() => {
    authBlockedRef.current = false;
    setStatus('connecting');
    socket.connect();
  }, [socket]);

  return { socket, status, connected: status === 'connected', attemptReconnect };
}