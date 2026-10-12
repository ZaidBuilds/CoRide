import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_app_check/firebase_app_check.dart';

/// App Check security service for CoRide:
/// - Enforces device integrity via Play Integrity on Android
/// - Configures DebugProvider for local development & testing
class AppCheckService {
  bool get _isFirebaseReady => Firebase.apps.isNotEmpty;
  FirebaseAppCheck get _appCheck => FirebaseAppCheck.instance;

  Future<void> init() async {
    if (!_isFirebaseReady) return;
    try {
      await _appCheck.activate(
        androidProvider: kDebugMode ? AndroidProvider.debug : AndroidProvider.playIntegrity,
        appleProvider: kDebugMode ? AppleProvider.debug : AppleProvider.deviceCheck,
      );
      debugPrint('[AppCheckService] Activated Firebase App Check');
    } catch (e) {
      debugPrint('[AppCheckService] init error: $e');
    }
  }

  /// Get current App Check attestation token
  Future<String?> getToken() async {
    try {
      return await _appCheck.getToken();
    } catch (_) {
      return null;
    }
  }
}
