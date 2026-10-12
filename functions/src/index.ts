import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

const defaultOptions = {
  memory: '256MiB' as const,
  timeoutSeconds: 15,
  maxInstances: 10,
};

/**
 * 1. Station & Train Room Message Trigger
 * - Validates message length & content
 * - Updates lastActivity timestamp on room
 */
export const onRoomMessageCreated = onDocumentCreated(
  {
    document: 'rooms/{roomId}/messages/{messageId}',
    ...defaultOptions,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const roomId = event.params.roomId;
    const data = snapshot.data();
    const content = (data?.content || '').trim();

    try {
      // Enforce max character limit
      if (content.length > 500) {
        await snapshot.ref.update({
          content: content.substring(0, 500),
          truncated: true,
        });
      }

      // Bump room activity
      await db.collection('rooms').doc(roomId).set(
        {
          lastActivity: admin.firestore.FieldValue.serverTimestamp(),
          lastMessage: content.substring(0, 100),
        },
        { merge: true }
      );
    } catch (err) {
      console.error(`[onRoomMessageCreated] Error updating room ${roomId}:`, err);
    }
  }
);

/**
 * 2. Connection Request Created Trigger
 * - Sends instant FCM Push Notification to the recipient commuter
 */
export const onConnectionRequestCreated = onDocumentCreated(
  {
    document: 'connection_requests/{requestId}',
    ...defaultOptions,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    const toUserId = data?.toUserId;
    const fromUserName = data?.fromUserName || 'A commuter';
    const metroLine = data?.metroLine || 'Delhi Metro';

    if (!toUserId) return;

    try {
      // Fetch recipient's FCM token
      const userDoc = await db.collection('users').doc(toUserId).get();
      const userData = userDoc.data();
      const fcmToken = userData?.fcmToken;

      if (!fcmToken) return;

      const payload: admin.messaging.Message = {
        token: fcmToken,
        notification: {
          title: 'New Commuter Connection Request',
          body: `${fromUserName} wants to connect with you on ${metroLine}!`,
        },
        data: {
          type: 'connection_request',
          requestId: event.params.requestId,
          fromUserId: data?.fromUserId || '',
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'coride_connections',
            icon: 'ic_launcher',
          },
        },
      };

      await messaging.send(payload);
    } catch (err) {
      console.error(`[FCM] Failed to send connection notification to ${toUserId}:`, err);
    }
  }
);

/**
 * 3. Connection Request Updated Trigger
 * - When accepted, notify the original sender that their request was accepted
 */
export const onConnectionRequestUpdated = onDocumentUpdated(
  {
    document: 'connection_requests/{requestId}',
    ...defaultOptions,
  },
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    if (!beforeData || !afterData) return;

    // Only notify if status changed from PENDING to ACCEPTED
    if (beforeData.status !== 'ACCEPTED' && afterData.status === 'ACCEPTED') {
      const fromUserId = afterData.fromUserId;
      if (!fromUserId) return;

      try {
        const senderDoc = await db.collection('users').doc(fromUserId).get();
        const fcmToken = senderDoc.data()?.fcmToken;
        if (!fcmToken) return;

        const recipientDoc = await db.collection('users').doc(afterData.toUserId).get();
        const recipientName = recipientDoc.data()?.pseudonym || 'A commuter';

        const payload: admin.messaging.Message = {
          token: fcmToken,
          notification: {
            title: 'Connection Accepted! 🎉',
            body: `${recipientName} accepted your connection request on Delhi Metro!`,
          },
          data: {
            type: 'connection_accepted',
            requestId: event.params.requestId,
            friendId: afterData.toUserId || '',
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'coride_connections',
              icon: 'ic_launcher',
            },
          },
        };

        await messaging.send(payload);
      } catch (err) {
        console.error(`[FCM] Failed to send connection acceptance notification:`, err);
      }
    }
  }
);

/**
 * 4. Direct Message Trigger
 * - Sends push notification to the receiving participant
 */
export const onDirectMessageCreated = onDocumentCreated(
  {
    document: 'chats/{chatId}/messages/{messageId}',
    ...defaultOptions,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const chatId = event.params.chatId;
    const data = snapshot.data();
    const senderId = data?.senderId;
    const senderName = data?.senderPseudonym || data?.senderName || 'Rider';
    const content = data?.content || '';

    try {
      // Fetch chat document to determine the recipient
      const chatDoc = await db.collection('chats').doc(chatId).get();
      const chatData = chatDoc.data();
      const participants: string[] = chatData?.participantIds || [];

      const recipientId = participants.find((id) => id !== senderId);
      if (!recipientId) return;

      const recipientDoc = await db.collection('users').doc(recipientId).get();
      const recipientToken = recipientDoc.data()?.fcmToken;

      if (!recipientToken) return;

      const message: admin.messaging.Message = {
        token: recipientToken,
        notification: {
          title: `${senderName}`,
          body: content.length > 80 ? `${content.substring(0, 77)}...` : content,
        },
        data: {
          type: 'direct_chat',
          chatId: chatId,
          senderId: senderId || '',
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'coride_direct_chats',
            icon: 'ic_launcher',
          },
        },
      };

      await messaging.send(message);
    } catch (err) {
      console.error(`[FCM] Direct message delivery error to chat ${chatId}:`, err);
    }
  }
);
