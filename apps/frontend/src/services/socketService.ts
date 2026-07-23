import { io, type Socket } from 'socket.io-client';
import { getToken } from './session';

/**
 * Thin, framework-agnostic wrapper around the Socket.IO client. Stores/components
 * subscribe through `on()` and drive rooms with `joinEvent()` / `leaveEvent()`.
 * Keeping this isolated means a future native transport swap touches one file.
 */
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;

export function connectSocket(): Socket {
  const token = getToken();
  if (socket?.connected) return socket;
  if (socket) socket.connect();
  else {
    socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
      autoConnect: true,
    });
  }
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
  connectSocket().emit('presence:join', eventId);
}
export function leaveEvent(eventId: string): void {
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
