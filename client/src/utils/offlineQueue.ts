/**
 * CoRide Offline Outbound Queue
 *
 * Implements durable local queuing for underground subway tunnels where RF
 * signal is completely occluded. When a user sends a message while offline or
 * while the socket is disconnected, messages are buffered locally with status: 'queued'.
 *
 * When network or socket reconnects, the queue is drained and flushed sequentially
 * in chronological order, transitioning messages from 'queued' -> 'sent'.
 */

export interface QueuedMessage {
  id: string;
  type: 'room' | 'direct';
  targetId: string; // roomId for room chat, receiverId for direct DM
  senderId: string;
  content: string;
  timestamp: number;
  retryCount: number;
}

const STORAGE_KEY = 'coride_offline_queue';

export function getQueuedMessages(): QueuedMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveQueuedMessages(queue: QueuedMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[offlineQueue] save failed', err);
  }
}

export function enqueueMessage(msg: Omit<QueuedMessage, 'retryCount'>): QueuedMessage {
  const queue = getQueuedMessages();
  const fullMsg: QueuedMessage = { ...msg, retryCount: 0 };
  queue.push(fullMsg);
  saveQueuedMessages(queue);
  return fullMsg;
}

export function removeQueuedMessage(id: string): void {
  const queue = getQueuedMessages();
  const filtered = queue.filter(m => m.id !== id);
  saveQueuedMessages(filtered);
}

/**
 * Flush all queued messages via provided send callbacks.
 */
export async function flushOfflineQueue(
  sendRoomMsg: (roomId: string, content: string) => Promise<boolean> | void,
  sendDirectMsg: (receiverId: string, content: string) => Promise<boolean> | void
): Promise<number> {
  const queue = getQueuedMessages();
  if (queue.length === 0) return 0;

  let flushedCount = 0;
  const remaining: QueuedMessage[] = [];

  for (const msg of queue) {
    try {
      if (msg.type === 'room') {
        await sendRoomMsg(msg.targetId, msg.content);
      } else {
        await sendDirectMsg(msg.targetId, msg.content);
      }
      flushedCount++;
    } catch (err) {
      console.warn('[offlineQueue] failed to flush message', msg.id, err);
      msg.retryCount += 1;
      if (msg.retryCount < 5) {
        remaining.push(msg);
      }
    }
  }

  saveQueuedMessages(remaining);
  return flushedCount;
}
