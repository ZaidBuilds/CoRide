import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

/// Authentication service for CoRide supporting:
/// - Guest mode (Anonymous)
/// - Email & Password
/// - Google Sign-In
/// - Guest-to-Permanent Account Linking (preserving rider karma & history)
class AuthService extends ChangeNotifier {
  bool get _isFirebaseReady => Firebase.apps.isNotEmpty;
  FirebaseAuth get _auth => FirebaseAuth.instance;

  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
  );

  User? _currentUser;
  bool _isLoading = false;
  String? _errorMessage;

  User? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _currentUser != null;
  bool get isAnonymous => _currentUser?.isAnonymous ?? true;
  bool get isGoogleLinked =>
      _currentUser?.providerData.any((p) => p.providerId == 'google.com') ?? false;
  bool get isEmailLinked =>
      _currentUser?.providerData.any((p) => p.providerId == 'password') ?? false;
  String? get uid => _currentUser?.uid;
  String? get email => _currentUser?.email;
  String? get displayName => _currentUser?.displayName;
  String? get photoUrl => _currentUser?.photoURL;

  Stream<User?> get authStateChanges =>
      _isFirebaseReady ? _auth.authStateChanges() : const Stream.empty();

  AuthService() {
    if (_isFirebaseReady) {
      _currentUser = _auth.currentUser;
      _auth.authStateChanges().listen((user) {
        _currentUser = user;
        notifyListeners();
      });
    }
  }

  /// Ensure commuter is authenticated (defaults to Guest mode if no active session)
  Future<User?> ensureAuthenticated() async {
    if (!_isFirebaseReady) return null;
    if (_currentUser != null) return _currentUser;
    return await signInAnonymously();
  }

  /// 1. Guest Mode / Anonymous Sign-In
  Future<User?> signInAnonymously() async {
    if (!_isFirebaseReady) return null;
    _setLoading(true);
    try {
      final credential = await _auth.signInAnonymously();
      _currentUser = credential.user;
      _errorMessage = null;
      return _currentUser;
    } on FirebaseAuthException catch (e) {
      _errorMessage = e.message;
      debugPrint('[AuthService] signInAnonymously error: ${e.code} - ${e.message}');
      return null;
    } finally {
      _setLoading(false);
    }
  }

  /// 2. Email & Password Sign-In
  Future<User?> signInWithEmail(String email, String password) async {
    if (!_isFirebaseReady) return null;
    _setLoading(true);
    try {
      final credential = await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      _currentUser = credential.user;
      _errorMessage = null;
      return _currentUser;
    } on FirebaseAuthException catch (e) {
      _errorMessage = e.message;
      debugPrint('[AuthService] signInWithEmail error: ${e.code} - ${e.message}');
      return null;
    } finally {
      _setLoading(false);
    }
  }

  /// 3. Email & Password Registration
  Future<User?> registerWithEmail(String email, String password, {String? displayName}) async {
    if (!_isFirebaseReady) return null;
    _setLoading(true);
    try {
      final credential = await _auth.createUserWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      if (displayName != null && credential.user != null) {
        await credential.user!.updateDisplayName(displayName);
      }
      _currentUser = credential.user;
      _errorMessage = null;
      return _currentUser;
    } on FirebaseAuthException catch (e) {
      _errorMessage = e.message;
      debugPrint('[AuthService] registerWithEmail error: ${e.code} - ${e.message}');
      return null;
    } finally {
      _setLoading(false);
    }
  }

  /// 4. Google Sign-In
  Future<User?> signInWithGoogle() async {
    if (!_isFirebaseReady) return null;
    _setLoading(true);
    try {
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        // User cancelled the sign-in dialog
        return null;
      }

      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
      final OAuthCredential credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      final userCredential = await _auth.signInWithCredential(credential);
      _currentUser = userCredential.user;
      _errorMessage = null;
      return _currentUser;
    } on FirebaseAuthException catch (e) {
      _errorMessage = e.message;
      debugPrint('[AuthService] signInWithGoogle error: ${e.code} - ${e.message}');
      return null;
    } catch (e) {
      _errorMessage = e.toString();
      debugPrint('[AuthService] signInWithGoogle unknown error: $e');
      return null;
    } finally {
      _setLoading(false);
    }
  }

  /// 5. Upgrade Guest Account to Google (Linking credentials)
  Future<User?> linkGuestWithGoogle() async {
    if (!_isFirebaseReady) return null;
    final current = _auth.currentUser;
    if (current == null) return await signInWithGoogle();
    if (!current.isAnonymous) return current;

    _setLoading(true);
    try {
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      if (googleUser == null) return null;

      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
      final OAuthCredential credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      final userCredential = await current.linkWithCredential(credential);
      _currentUser = userCredential.user;
      _errorMessage = null;
      return _currentUser;
    } on FirebaseAuthException catch (e) {
      if (e.code == 'credential-already-in-use') {
        // If the Google account already exists, fall back to direct Google sign-in
        return await signInWithGoogle();
      }
      _errorMessage = e.message;
      debugPrint('[AuthService] linkGuestWithGoogle error: ${e.code} - ${e.message}');
      return null;
    } finally {
      _setLoading(false);
    }
  }

  /// 6. Upgrade Guest Account to Email & Password
  Future<User?> linkGuestWithEmail(String email, String password) async {
    if (!_isFirebaseReady) return null;
    final current = _auth.currentUser;
    if (current == null) return await signInWithEmail(email, password);
    if (!current.isAnonymous) return current;

    _setLoading(true);
    try {
      final credential = EmailAuthProvider.credential(email: email.trim(), password: password);
      final userCredential = await current.linkWithCredential(credential);
      _currentUser = userCredential.user;
      _errorMessage = null;
      return _currentUser;
    } on FirebaseAuthException catch (e) {
      _errorMessage = e.message;
      debugPrint('[AuthService] linkGuestWithEmail error: ${e.code} - ${e.message}');
      return null;
    } finally {
      _setLoading(false);
    }
  }

  /// Sign Out
  Future<void> signOut() async {
    if (!_isFirebaseReady) return;
    _setLoading(true);
    try {
      await _googleSignIn.signOut();
      await _auth.signOut();
      _currentUser = null;
      _errorMessage = null;
    } catch (e) {
      debugPrint('[AuthService] signOut error: $e');
    } finally {
      _setLoading(false);
    }
  }

  /// Delete Account
  Future<void> deleteAccount() async {
    if (!_isFirebaseReady) return;
    final current = _auth.currentUser;
    if (current == null) return;
    _setLoading(true);
    try {
      await current.delete();
      await _googleSignIn.signOut();
      _currentUser = null;
    } catch (e) {
      debugPrint('[AuthService] deleteAccount error: $e');
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  void _setLoading(bool val) {
    _isLoading = val;
    notifyListeners();
  }
}
