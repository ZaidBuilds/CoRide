import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_analytics/firebase_analytics.dart';

/// Monitoring service for CoRide:
/// - Firebase Crashlytics for real-time crash triage & non-fatal exception reporting
/// - Firebase Analytics for commuter engagement & Delhi Metro transit telemetry
class MonitoringService {
  FirebaseCrashlytics? get _crashlytics =>
      Firebase.apps.isNotEmpty ? FirebaseCrashlytics.instance : null;
  FirebaseAnalytics? get _analytics =>
      Firebase.apps.isNotEmpty ? FirebaseAnalytics.instance : null;

  NavigatorObserver? get analyticsObserver =>
      _analytics != null ? FirebaseAnalyticsObserver(analytics: _analytics!) : null;

  /// Initialize global crash hooks and analytics configuration
  Future<void> init() async {
    if (Firebase.apps.isEmpty) return;
    try {
      // Toggle Crashlytics collection (always on in production)
      await _crashlytics?.setCrashlyticsCollectionEnabled(!kDebugMode);

      // Catch Flutter framework errors
      FlutterError.onError = (FlutterErrorDetails details) {
        if (!kDebugMode) {
          _crashlytics?.recordFlutterFatalError(details);
        } else {
          FlutterError.dumpErrorToConsole(details);
        }
      };

      // Catch async errors outside widget tree
      PlatformDispatcher.instance.onError = (error, stack) {
        if (!kDebugMode) {
          _crashlytics?.recordError(error, stack, fatal: true);
        }
        return true;
      };

      debugPrint('[MonitoringService] Initialized Crashlytics & Analytics');
    } catch (e) {
      debugPrint('[MonitoringService] init error: $e');
    }
  }

  // ---------------------------------------------------------------------------
  // Crashlytics Helpers
  // ---------------------------------------------------------------------------

  /// Associate error reports with a specific commuter ID
  Future<void> setUserId(String userId) async {
    try {
      await _crashlytics?.setUserIdentifier(userId);
      await _analytics?.setUserId(id: userId);
    } catch (_) {}
  }

  /// Attach key-value debugging metadata to crash logs
  Future<void> setCustomKey(String key, Object value) async {
    try {
      await _crashlytics?.setCustomKey(key, value);
    } catch (_) {}
  }

  /// Record non-fatal exception (e.g. Socket disconnect or API timeout)
  Future<void> recordError(
    dynamic exception,
    StackTrace? stack, {
    dynamic reason,
    bool fatal = false,
  }) async {
    try {
      await _crashlytics?.recordError(exception, stack, reason: reason, fatal: fatal);
    } catch (_) {}
  }

  // ---------------------------------------------------------------------------
  // Firebase Analytics Commuter Events
  // ---------------------------------------------------------------------------

  Future<void> logScreenView(String screenName) async {
    try {
      await _analytics?.logScreenView(screenName: screenName);
    } catch (_) {}
  }

  Future<void> logCommuteDetected({
    required String stationName,
    required String lineName,
    required String movementState,
  }) async {
    try {
      await _analytics?.logEvent(
        name: 'commute_detected',
        parameters: {
          'station_name': stationName,
          'line_name': lineName,
          'movement_state': movementState,
        },
      );
    } catch (_) {}
  }

  Future<void> logRoomJoined({
    required String roomId,
    required String roomType,
  }) async {
    try {
      await _analytics?.logEvent(
        name: 'room_joined',
        parameters: {
          'room_id': roomId,
          'room_type': roomType,
        },
      );
    } catch (_) {}
  }

  Future<void> logMessageSent({
    required String roomId,
    required bool isDirectChat,
  }) async {
    try {
      await _analytics?.logEvent(
        name: 'message_sent',
        parameters: {
          'room_id': roomId,
          'chat_type': isDirectChat ? 'direct' : 'room',
        },
      );
    } catch (_) {}
  }

  Future<void> logConnectionRequested(String targetUserId) async {
    try {
      await _analytics?.logEvent(
        name: 'connection_requested',
        parameters: {
          'target_user_id': targetUserId,
        },
      );
    } catch (_) {}
  }

  Future<void> logAccountUpgraded(String provider) async {
    try {
      await _analytics?.logEvent(
        name: 'account_upgraded',
        parameters: {
          'provider': provider,
        },
      );
    } catch (_) {}
  }
}
