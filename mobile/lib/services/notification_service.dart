import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'package:cloud_firestore/cloud_firestore.dart';

/// Top-level background message handler required by Firebase Messaging
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('[FCM Background] Received message: ${message.messageId} - ${message.notification?.title}');
}

/// Firebase Cloud Messaging (FCM) Notification Service for CoRide:
/// - Arrival alerts
/// - Station announcements
/// - Direct chat messages
/// - Metro Line broadcast topics
class NotificationService extends ChangeNotifier {
  bool get _isFirebaseReady => Firebase.apps.isNotEmpty;
  FirebaseMessaging get _fcm => FirebaseMessaging.instance;
  String? _token;
  String? _currentUserId;
  bool _permissionGranted = false;

  String? get fcmToken => _token;
  bool get permissionGranted => _permissionGranted;

  Future<void> init({Function(RemoteMessage)? onMessageReceived}) async {
    if (!_isFirebaseReady) return;
    try {
      // 1. Request OS permission
      final settings = await _fcm.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );

      _permissionGranted = settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional;

      if (_permissionGranted) {
        // 2. Retrieve FCM registration token
        _token = await _fcm.getToken();
        debugPrint('[NotificationService] FCM Token: $_token');

        // Listen for token updates
        _fcm.onTokenRefresh.listen((newToken) {
          _token = newToken;
          if (_currentUserId != null) {
            syncTokenToUser(_currentUserId!);
          }
          notifyListeners();
        });

        // 3. Foreground message listener
        FirebaseMessaging.onMessage.listen((message) {
          debugPrint('[FCM Foreground] Message: ${message.notification?.title}');
          if (onMessageReceived != null) {
            onMessageReceived(message);
          }
        });

        // 4. Notification tap when app was opened from background
        FirebaseMessaging.onMessageOpenedApp.listen((message) {
          debugPrint('[FCM Tap] App opened from notification: ${message.data}');
        });
      }

      notifyListeners();
    } catch (e) {
      debugPrint('[NotificationService] init error: $e');
    }
  }

  /// Subscribe to broadcast alerts for a specific Delhi Metro line (e.g. Blue Line disruptions)
  Future<void> subscribeToMetroLine(String lineId) async {
    try {
      final topic = 'dmrc_${lineId.toLowerCase().replaceAll(RegExp(r'[^a-z0-9_]'), '_')}';
      await _fcm.subscribeToTopic(topic);
      debugPrint('[NotificationService] Subscribed to topic: $topic');
    } catch (e) {
      debugPrint('[NotificationService] subscribeToMetroLine error: $e');
    }
  }

  /// Unsubscribe from broadcast alerts
  Future<void> unsubscribeFromMetroLine(String lineId) async {
    try {
      final topic = 'dmrc_${lineId.toLowerCase().replaceAll(RegExp(r'[^a-z0-9_]'), '_')}';
      await _fcm.unsubscribeFromTopic(topic);
    } catch (_) {}
  }

  /// Persist the device FCM token to the user document in Cloud Firestore
  Future<void> syncTokenToUser(String userId) async {
    _currentUserId = userId;
    if (!_isFirebaseReady || _token == null) return;
    try {
      await FirebaseFirestore.instance.collection('users').doc(userId).set({
        'fcmToken': _token,
        'fcmUpdatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
      debugPrint('[NotificationService] Synced FCM token to user $userId');
    } catch (e) {
      debugPrint('[NotificationService] syncTokenToUser error: $e');
    }
  }
}
