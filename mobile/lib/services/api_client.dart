import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';
import '../models/models.dart';

class ApiClient {
  static String get base => AppConfig.apiBaseUrl;

  static Future<Map<String, String>> _headers(String? userId) async {
    return {
      'Content-Type': 'application/json',
      if (userId != null) 'x-user-id': userId,
    };
  }

  static Future<UserProfile> randomProfile() async {
    final r = await http.get(Uri.parse('$base/api/auth/random-profile'));
    if (r.statusCode != 200) throw Exception('auth failed: ${r.statusCode}');
    final j = jsonDecode(r.body) as Map<String, dynamic>;
    return UserProfile.fromJson(j['profile'] as Map<String, dynamic>);
  }

  static Future<UserProfile?> restoreProfile(String userId) async {
    final r = await http.get(Uri.parse('$base/api/auth/restore/$userId'));
    if (r.statusCode != 200) return null;
    final j = jsonDecode(r.body) as Map<String, dynamic>;
    return UserProfile.fromJson(j['profile'] as Map<String, dynamic>);
  }

  static Future<({ContextRoom room, Map<String, dynamic> context})> detect({
    required String userId,
    double? lat,
    double? lng,
    String? cellTowerId,
    required String movementState,
    double? speedKmh,
    List<Map<String, dynamic>>? routeHistory,
    bool userConfirmed = false,
  }) async {
    final r = await http.post(
      Uri.parse('$base/api/context/detect'),
      headers: await _headers(userId),
      body: jsonEncode({
        'userId': userId,
        if (lat != null) 'lat': lat,
        if (lng != null) 'lng': lng,
        if (cellTowerId != null) 'cellTowerId': cellTowerId,
        'movementState': movementState,
        if (speedKmh != null) 'speedKmh': speedKmh,
        if (routeHistory != null) 'routeHistory': routeHistory,
        'userConfirmed': userConfirmed,
      }),
    );
    if (r.statusCode != 200) throw Exception('detect failed: ${r.statusCode}');
    final j = jsonDecode(r.body) as Map<String, dynamic>;
    return (
      room: ContextRoom.fromJson(j['room'] as Map<String, dynamic>),
      context: (j['context'] as Map<String, dynamic>),
    );
  }

  static Future<List<RankedTraveler>> rank(String roomId, String viewerId) async {
    final r = await http.get(Uri.parse('$base/api/rank/${Uri.encodeComponent(roomId)}?viewerId=$viewerId'));
    if (r.statusCode != 200) return [];
    final j = jsonDecode(r.body) as Map<String, dynamic>;
    return ((j['ranked'] as List?) ?? []).map((e) => RankedTraveler.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> track(String event, String? userId, [Map<String, dynamic>? payload]) async {
    try {
      await http.post(
        Uri.parse('$base/api/analytics/event'),
        headers: await _headers(userId),
        body: jsonEncode({'event': event, 'userId': userId, 'payload': payload ?? {}}),
      );
    } catch (_) {}
  }

  static Future<void> saveLocalProfile(UserProfile p) async {
    final sp = await SharedPreferences.getInstance();
    await sp.setString('coride_profile', jsonEncode(p.toJson()));
  }

  static Future<UserProfile?> loadLocalProfile() async {
    final sp = await SharedPreferences.getInstance();
    final raw = sp.getString('coride_profile');
    if (raw == null) return null;
    try {
      return UserProfile.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }
}
