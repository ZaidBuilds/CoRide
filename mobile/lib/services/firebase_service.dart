import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:firebase_storage/firebase_storage.dart';
import '../models/models.dart';

/// Centralized Firebase Service for CoRide
/// - Authentication: Anonymous & token management
/// - Cloud Firestore: Profiles, rooms, messages, connections
/// - Realtime Database: Ephemeral commuter presence & live heartbeats
/// - Cloud Storage: Avatars & voice note media
class FirebaseService extends ChangeNotifier {
  bool get _isFirebaseReady => Firebase.apps.isNotEmpty;
  FirebaseAuth get _auth => FirebaseAuth.instance;
  FirebaseFirestore get _firestore => FirebaseFirestore.instance;
  FirebaseDatabase get _rtdb => FirebaseDatabase.instance;
  FirebaseStorage get _storage => FirebaseStorage.instance;

  User? _currentUser;
  bool _initialized = false;
  DatabaseReference? _currentPresenceRef;

  User? get currentUser => _currentUser;
  bool get isInitialized => _initialized;
  String? get currentUid => _currentUser?.uid;

  /// Initialize Firebase authentication and state listeners
  Future<void> init() async {
    if (!_isFirebaseReady) return;
    try {
      // Enable Firestore offline disk cache persistence for deep metro tunnels
      try {
        _firestore.settings = const Settings(
          persistenceEnabled: true,
          cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED,
        );
      } catch (_) {}

      // Ensure anonymous sign-in so user always has valid UID
      if (_auth.currentUser == null) {
        final credential = await _auth.signInAnonymously();
        _currentUser = credential.user;
      } else {
        _currentUser = _auth.currentUser;
      }

      _auth.authStateChanges().listen((user) {
        _currentUser = user;
        notifyListeners();
      });

      _initialized = true;
      notifyListeners();
    } catch (e) {
      debugPrint('[FirebaseService] init error: $e');
    }
  }

  // ---------------------------------------------------------------------------
  // Cloud Firestore: User Profiles
  // ---------------------------------------------------------------------------

  /// Upsert user profile to Firestore `/users/{userId}`
  Future<void> syncUserProfile(UserProfile profile) async {
    try {
      await _firestore.collection('users').doc(profile.id).set({
        'id': profile.id,
        'username': profile.username,
        'pseudonym': profile.pseudonym,
        'avatarId': profile.avatarId,
        'avatarBg': profile.avatarBg,
        'bio': ?profile.bio,
        'interestTags': profile.interestTags,
        'collegeOrTag': ?profile.collegeOrTag,
        'languages': ?profile.languages,
        'vibeTagline': ?profile.vibeTagline,
        'activity': profile.activity,
        'joinedAt': profile.joinedAt,
        'karmaScore': profile.karmaScore,
        'presenceTier': ?profile.presenceTier,
        'trustTier': ?profile.trustTier,
        'trustBadge': ?profile.trustBadge,
        'firebaseUid': currentUid,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    } catch (e) {
      debugPrint('[FirebaseService] syncUserProfile error: $e');
    }
  }

  /// Real-time stream of user profile
  Stream<UserProfile?> streamProfile(String userId) {
    return _firestore.collection('users').doc(userId).snapshots().map((doc) {
      if (!doc.exists || doc.data() == null) return null;
      final data = doc.data()!;
      return UserProfile.fromJson(data);
    });
  }

  // ---------------------------------------------------------------------------
  // Cloud Firestore: Chat Rooms & Messages
  // ---------------------------------------------------------------------------

  /// Real-time stream of messages for a metro station or train room (bounded to 50 for performance)
  Stream<List<RoomMessage>> streamRoomMessages(String roomId) {
    if (!_isFirebaseReady) return const Stream.empty();
    return _firestore
        .collection('rooms')
        .doc(roomId)
        .collection('messages')
        .orderBy('timestamp', descending: false)
        .limitToLast(50)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) {
        final data = doc.data();
        return RoomMessage(
          id: doc.id,
          roomId: roomId,
          senderId: data['senderId'] ?? '',
          senderPseudonym: data['senderPseudonym'] ?? data['senderUsername'] ?? 'Traveler',
          content: data['content'] ?? '',
          timestamp: (data['timestamp'] as num?)?.toInt() ?? DateTime.now().millisecondsSinceEpoch,
          isSystem: data['isSystem'] == true,
        );
      }).toList();
    });
  }

  /// Post a new message to a metro room
  Future<void> sendRoomMessage({
    required String roomId,
    required String content,
    required UserProfile sender,
  }) async {
    if (!_isFirebaseReady) return;
    try {
      final docRef = _firestore.collection('rooms').doc(roomId).collection('messages').doc();
      await docRef.set({
        'roomId': roomId,
        'senderId': sender.id,
        'senderPseudonym': sender.pseudonym,
        'senderAvatarId': sender.avatarId,
        'content': content.trim(),
        'timestamp': DateTime.now().millisecondsSinceEpoch,
        'serverTimestamp': FieldValue.serverTimestamp(),
        'karmaScore': sender.karmaScore,
        'isSystem': false,
      });
    } catch (e) {
      debugPrint('[FirebaseService] sendRoomMessage error: $e');
      rethrow;
    }
  }

  // ---------------------------------------------------------------------------
  // Cloud Firestore: Commuter Connection Requests & Friends
  // ---------------------------------------------------------------------------

  /// Send a connection request to another commuter
  Future<void> sendConnectionRequest({
    required String fromUserId,
    required String fromUserName,
    required String toUserId,
    required String metroLine,
  }) async {
    if (!_isFirebaseReady) return;
    try {
      final docRef = _firestore.collection('connection_requests').doc();
      await docRef.set({
        'id': docRef.id,
        'fromUserId': fromUserId,
        'fromUserName': fromUserName,
        'toUserId': toUserId,
        'metroLine': metroLine,
        'status': 'PENDING',
        'timestamp': DateTime.now().millisecondsSinceEpoch,
        'createdAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      debugPrint('[FirebaseService] sendConnectionRequest error: $e');
    }
  }

  /// Stream incoming connection requests for a user
  Stream<List<Map<String, dynamic>>> streamReceivedRequests(String userId) {
    if (!_isFirebaseReady) return const Stream.empty();
    return _firestore
        .collection('connection_requests')
        .where('toUserId', isEqualTo: userId)
        .where('status', isEqualTo: 'PENDING')
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) => {'id': doc.id, ...doc.data()}).toList();
    });
  }

  /// Stream outgoing connection requests from a user
  Stream<List<Map<String, dynamic>>> streamSentRequests(String userId) {
    if (!_isFirebaseReady) return const Stream.empty();
    return _firestore
        .collection('connection_requests')
        .where('fromUserId', isEqualTo: userId)
        .where('status', isEqualTo: 'PENDING')
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) => {'id': doc.id, ...doc.data()}).toList();
    });
  }

  /// Respond to a connection request (ACCEPT or IGNORE)
  Future<void> respondToConnectionRequest(String requestId, bool accept) async {
    if (!_isFirebaseReady) return;
    try {
      await _firestore.collection('connection_requests').doc(requestId).update({
        'status': accept ? 'ACCEPTED' : 'IGNORED',
        'respondedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      debugPrint('[FirebaseService] respondToConnectionRequest error: $e');
    }
  }

  /// Stream accepted friends
  Stream<List<Map<String, dynamic>>> streamFriends(String userId) {
    if (!_isFirebaseReady) return const Stream.empty();
    return _firestore
        .collection('connection_requests')
        .where('status', isEqualTo: 'ACCEPTED')
        .snapshots()
        .map((snapshot) {
      return snapshot.docs
          .map((doc) => {'id': doc.id, ...doc.data()})
          .where((data) => data['fromUserId'] == userId || data['toUserId'] == userId)
          .toList();
    });
  }

  // ---------------------------------------------------------------------------
  // Realtime Database: Ephemeral Live Commuter Presence
  // ---------------------------------------------------------------------------

  /// Track live commuter presence in a specific station/train room with auto-cleanup on disconnect
  Future<void> joinRoomPresence({
    required String roomId,
    required String userId,
    double? lat,
    double? lng,
  }) async {
    try {
      // Clear previous presence if moving to a different room
      await leaveRoomPresence();

      final ref = _rtdb.ref('presence/$roomId/$userId');
      _currentPresenceRef = ref;

      await ref.set({
        'userId': userId,
        'online': true,
        'lastSeen': ServerValue.timestamp,
        'lat': ?lat,
        'lng': ?lng,
      });

      // Configure onDisconnect auto-removal
      await ref.onDisconnect().remove();
    } catch (e) {
      debugPrint('[FirebaseService] joinRoomPresence error: $e');
    }
  }

  /// Remove user presence when switching rooms or exiting app
  Future<void> leaveRoomPresence() async {
    try {
      if (_currentPresenceRef != null) {
        await _currentPresenceRef!.remove();
        _currentPresenceRef = null;
      }
    } catch (e) {
      debugPrint('[FirebaseService] leaveRoomPresence error: $e');
    }
  }

  /// Stream list of currently online rider user IDs in a room
  Stream<List<String>> streamRoomPresence(String roomId) {
    return _rtdb.ref('presence/$roomId').onValue.map((event) {
      final data = event.snapshot.value;
      if (data == null || data is! Map) return <String>[];
      return data.keys.map((k) => k.toString()).toList();
    });
  }

  // ---------------------------------------------------------------------------
  // Cloud Storage: Media (Avatars & Voice Notes)
  // ---------------------------------------------------------------------------

  /// Upload custom commuter avatar image to Cloud Storage
  Future<String?> uploadAvatar({
    required String userId,
    required Uint8List bytes,
    String contentType = 'image/jpeg',
  }) async {
    try {
      final ref = _storage.ref('avatars/$userId/avatar_${DateTime.now().millisecondsSinceEpoch}.jpg');
      final metadata = SettableMetadata(contentType: contentType);
      final uploadTask = await ref.putData(bytes, metadata);
      return await uploadTask.ref.getDownloadURL();
    } catch (e) {
      debugPrint('[FirebaseService] uploadAvatar error: $e');
      return null;
    }
  }

  /// Upload persistent voice/audio note to Cloud Storage
  Future<String?> uploadAudioNote({
    required String roomId,
    required String userId,
    required Uint8List bytes,
    String contentType = 'audio/m4a',
  }) async {
    try {
      final ref = _storage.ref('audio/$roomId/${DateTime.now().millisecondsSinceEpoch}_$userId.m4a');
      final metadata = SettableMetadata(contentType: contentType);
      final uploadTask = await ref.putData(bytes, metadata);
      return await uploadTask.ref.getDownloadURL();
    } catch (e) {
      debugPrint('[FirebaseService] uploadAudioNote error: $e');
      return null;
    }
  }
}
