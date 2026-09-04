import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../config.dart';
import '../models/models.dart';

// Mirrors web App.tsx socket events: join_room, heartbeat, send_message,
// connect_request, typing, engagement, reaction_toggle.
class SocketService extends ChangeNotifier {
  io.Socket? _s;
  ContextRoom? stationRoom;
  ContextRoom? trainRoom;
  Map<String, dynamic>? context;
  final Map<String, List<Map<String, String>>> typing = {};

  bool get connected => _s?.connected ?? false;

  void connect({required void Function() onUpdate, required void Function(String) onToast}) {
    _s?.dispose();
    _s = io.io(
      AppConfig.apiBaseUrl,
      io.OptionBuilder().setTransports(['websocket']).enableAutoConnect().build(),
    );
    final s = _s!;
    s.onConnect((_) => onUpdate());
    s.on('room_updated', (data) {
      try {
        final room = ContextRoom.fromJson((data as Map).cast<String, dynamic>());
        if (room.type == 'station') {
          stationRoom = room;
        } else {
          trainRoom = room;
        }
        onUpdate();
      } catch (_) {}
    });
    s.on('new_message', (data) {
      try {
        final m = RoomMessage.fromJson((data as Map).cast<String, dynamic>());
        void add(ContextRoom? r) => r?.messages.add(m);
        add(stationRoom);
        add(trainRoom);
        onUpdate();
      } catch (_) {}
    });
    s.on('connection_result', (d) {
      try {
        onToast('${(d as Map)['message']}');
      } catch (_) {}
    });
    s.on('connection_accepted', (d) {
      try {
        onToast('${(d as Map)['message']}');
      } catch (_) {}
    });
    s.on('user_typing', (d) {
      final m = (d as Map).cast<String, dynamic>();
      final roomId = '${m['roomId']}';
      typing.putIfAbsent(roomId, () => []);
      if (!typing[roomId]!.any((e) => e['userId'] == '${m['userId']}')) {
        typing[roomId]!.add({'userId': '${m['userId']}', 'pseudonym': '${m['pseudonym']}'});
        onUpdate();
      }
    });
    s.on('user_stop_typing', (d) {
      final m = (d as Map).cast<String, dynamic>();
      final roomId = '${m['roomId']}';
      typing[roomId]?.removeWhere((e) => e['userId'] == '${m['userId']}');
      onUpdate();
    });
  }

  void joinRoom(String roomId, UserProfile u) => _s?.emit('join_room', {'roomId': roomId, 'user': u.toJson()});
  void heartbeat(String userId, String roomId) => _s?.emit('heartbeat', {'userId': userId, 'roomId': roomId});
  void sendMessage(String roomId, UserProfile u, String content) =>
      _s?.emit('send_message', {'roomId': roomId, 'user': u.toJson(), 'content': content});
  void connectRequest(UserProfile from, String toUserId, String line, String station) => _s?.emit('connect_request', {
        'fromUser': from.toJson(),
        'toUserId': toUserId,
        'contextLine': line,
        'contextStation': station,
      });

  @override
  void dispose() {
    _s?.dispose();
    super.dispose();
  }
}
