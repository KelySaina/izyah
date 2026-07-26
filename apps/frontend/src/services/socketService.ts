import { io, type Socket } from 'socket.io-client';
import { getToken } from './session';

/**
 * Thin, framework-agnostic wrapper around the Socket.IO client. Stores/components
 * subscribe through `on()` and drive rooms with `joinEvent()` / `leaveEvent()`.
 * Keeping this isolated means a future native transport swap touches one file.
 */
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;

// Events the app currently considers itself "in". Socket.IO reconnects the
// transport automatically after a drop, but it never replays prior emits —
// without this, a dropped-then-restored connection would silently leave the
// server-side presence room, freezing online-count/live-RSVP updates with no
// visible sign anything went wrong.
const joinedEvents = new Set<string>();

export function connectSocket(): Socket {
  if (socket?.connected) return socket;
  if (socket) {
    socket.connect();
    return socket;
  }
  const token = getToken();
  socket = io(SOCKET_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token },
    autoConnect: true,
  });
  // Fires on the initial connect AND every reconnect — re-join every room
  // this client is supposed to be in.
  socket.on('connect', () => {
    for (const eventId of joinedEvents) socket!.emit('presence:join', eventId);
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}

export function getSocket(): Socket | null {
  return socket;
}

// ---- Chat / presence helpers -----------------------------------------------
export function joinEvent(eventId: string): void {
  joinedEvents.add(eventId);
  const s = connectSocket();
  // Already connected: join now. Not yet connected: the 'connect' handler
  // above will join for us once it's up — emitting here too would double-join
  // (socket.io buffers emits made before a connection completes) and inflate
  // the server's presence count for this one connection.
  if (s.connected) s.emit('presence:join', eventId);
}
export function leaveEvent(eventId: string): void {
  joinedEvents.delete(eventId);
  socket?.emit('presence:leave', eventId);
}
export function sendTyping(eventId: string, isTyping: boolean): void {
  socket?.emit('chat:typing', { eventId, isTyping });
}
export function sendMessage(eventId: string, content: string): void {
  connectSocket().emit('chat:message', { eventId, content });
}

/** Subscribe to a server event. Returns an unsubscribe function. */
export function on<T = unknown>(event: string, handler: (payload: T) => void): () => void {
  const s = connectSocket();
  s.on(event, handler as (...args: unknown[]) => void);
  return () => s.off(event, handler as (...args: unknown[]) => void);
}
