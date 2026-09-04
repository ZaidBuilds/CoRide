// Ported from client/src/types.ts — keep field names in sync with web + server.
class UserProfile {
  final String id;
  final String username;
  final String pseudonym;
  final String avatarId;
  final String avatarBg;
  final List<String> interestTags;
  final String? collegeOrTag;
  final String? bio;
  final List<String>? languages;
  final String? vibeTagline;
  final String activity;
  final int joinedAt;
  final int karmaScore;
  final String? presenceTier;
  final String? trustTier;
  final String? trustBadge;

  UserProfile({
    required this.id,
    required this.username,
    required this.pseudonym,
    required this.avatarId,
    required this.avatarBg,
    required this.interestTags,
    this.collegeOrTag,
    this.bio,
    this.languages,
    this.vibeTagline,
    required this.activity,
    required this.joinedAt,
    required this.karmaScore,
    this.presenceTier,
    this.trustTier,
    this.trustBadge,
  });

  factory UserProfile.fromJson(Map<String, dynamic> j) => UserProfile(
        id: '${j['id']}',
        username: '${j['username'] ?? ''}',
        pseudonym: '${j['pseudonym'] ?? j['username'] ?? 'traveler'}',
        avatarId: '${j['avatarId'] ?? 'av_1'}',
        avatarBg: '${j['avatarBg'] ?? '#7B5DFF'}',
        interestTags: (j['interestTags'] as List? ?? []).map((e) => '$e').toList(),
        collegeOrTag: j['collegeOrTag']?.toString(),
        bio: j['bio']?.toString(),
        languages: (j['languages'] as List?)?.map((e) => '$e').toList(),
        vibeTagline: (j['vibeTagline'] ?? j['vibe_tagline'])?.toString(),
        activity: '${j['activity'] ?? 'STILL'}',
        joinedAt: (j['joinedAt'] as num?)?.toInt() ?? DateTime.now().millisecondsSinceEpoch,
        karmaScore: (j['karmaScore'] as num?)?.toInt() ?? 100,
        presenceTier: j['presenceTier']?.toString() ?? j['presenceState']?.toString(),
        trustTier: j['trustTier']?.toString(),
        trustBadge: j['trustBadge']?.toString(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'username': username,
        'pseudonym': pseudonym,
        'avatarId': avatarId,
        'avatarBg': avatarBg,
        'interestTags': interestTags,
        if (collegeOrTag != null) 'collegeOrTag': collegeOrTag,
        if (bio != null) 'bio': bio,
        'activity': activity,
        'joinedAt': joinedAt,
        'karmaScore': karmaScore,
      };
}

class RoomMessage {
  final String id;
  final String roomId;
  final String senderId;
  final String senderPseudonym;
  final String content;
  final int timestamp;
  final bool isSystem;
  RoomMessage({required this.id, required this.roomId, required this.senderId, required this.senderPseudonym, required this.content, required this.timestamp, this.isSystem = false});
  factory RoomMessage.fromJson(Map<String, dynamic> j) => RoomMessage(
        id: '${j['id']}',
        roomId: '${j['roomId']}',
        senderId: '${j['senderId']}',
        senderPseudonym: '${j['senderPseudonym'] ?? j['senderUsername'] ?? ''}',
        content: '${j['content'] ?? ''}',
        timestamp: (j['timestamp'] as num?)?.toInt() ?? DateTime.now().millisecondsSinceEpoch,
        isSystem: j['isSystem'] == true,
      );
}

class ContextRoom {
  final String id;
  final String type;
  final String lineName;
  final String lineColor;
  final String stationName;
  final String? direction;
  final List<UserProfile> users;
  final int userCount;
  final List<RoomMessage> messages;
  ContextRoom({required this.id, required this.type, required this.lineName, required this.lineColor, required this.stationName, this.direction, required this.users, required this.userCount, required this.messages});
  factory ContextRoom.fromJson(Map<String, dynamic> j) => ContextRoom(
        id: '${j['id']}',
        type: '${j['type'] ?? 'station'}',
        lineName: '${j['lineName'] ?? ''}',
        lineColor: '${j['lineColor'] ?? '#7B5DFF'}',
        stationName: '${j['stationName'] ?? ''}',
        direction: j['direction']?.toString(),
        users: ((j['users'] as List?) ?? []).map((e) => UserProfile.fromJson(e as Map<String, dynamic>)).toList(),
        userCount: (j['userCount'] as num?)?.toInt() ?? ((j['users'] as List?)?.length ?? 0),
        messages: ((j['messages'] as List?) ?? []).map((e) => RoomMessage.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

class RankedTraveler {
  final UserProfile profile;
  final double score;
  final List<String> mutualTags;
  final int mutualCount;
  final String trustTier;
  final String trustBadge;
  RankedTraveler({required this.profile, required this.score, required this.mutualTags, required this.mutualCount, required this.trustTier, required this.trustBadge});
  factory RankedTraveler.fromJson(Map<String, dynamic> j) => RankedTraveler(
        profile: UserProfile.fromJson(j['profile'] as Map<String, dynamic>),
        score: (j['score'] as num?)?.toDouble() ?? 0,
        mutualTags: ((j['mutualTags'] as List?) ?? []).map((e) => '$e').toList(),
        mutualCount: (j['mutualCount'] as num?)?.toInt() ?? 0,
        trustTier: '${j['trustTier'] ?? ''}',
        trustBadge: '${j['trustBadge'] ?? ''}',
      );
}

// 26-tag taxonomy mirrors INTEREST_TAXONOMY in web types.
const interestTaxonomy = [
  {'id': 'music', 'label': 'Music', 'emoji': '🎵'},
  {'id': 'coding', 'label': 'Coding', 'emoji': '💻'},
  {'id': 'books', 'label': 'Books', 'emoji': '📚'},
  {'id': 'gaming', 'label': 'Gaming', 'emoji': '🎮'},
  {'id': 'cricket', 'label': 'Cricket', 'emoji': '🏏'},
  {'id': 'food', 'label': 'Food', 'emoji': '🍛'},
  {'id': 'travel', 'label': 'Travel', 'emoji': '✈️'},
  {'id': 'photography', 'label': 'Photography', 'emoji': '📸'},
  {'id': 'fitness', 'label': 'Fitness', 'emoji': '💪'},
  {'id': 'movies', 'label': 'Movies', 'emoji': '🎬'},
  {'id': 'anime', 'label': 'Anime', 'emoji': '🌸'},
  {'id': 'memes', 'label': 'Memes', 'emoji': '😂'},
  {'id': 'tech', 'label': 'Tech', 'emoji': '⚡'},
  {'id': 'coffee', 'label': 'Coffee', 'emoji': '☕'},
  {'id': 'chai', 'label': 'Chai', 'emoji': '☕'},
];
