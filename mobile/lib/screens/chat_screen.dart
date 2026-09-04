import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../services/socket_service.dart';

// Figma 04: pinned banner + bubbles + typing + input. Room chat only.
class ChatScreen extends StatefulWidget {
  final UserProfile me;
  const ChatScreen({super.key, required this.me});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _ctl = TextEditingController();

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sock = context.watch<SocketService>();
    final room = sock.trainRoom ?? sock.stationRoom;
    final msgs = room?.messages ?? [];
    final typing = sock.typing[room?.id] ?? const [];

    return Column(children: [
      Container(
        margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: const Color(0xFF7B5DFF).withOpacity(0.12), borderRadius: BorderRadius.circular(14)),
        child: const Text('📌 Room pinned — Be respectful. No abuse, spam, or personal info.', style: TextStyle(fontSize: 12)),
      ),
      Expanded(
        child: ListView.builder(
          padding: const EdgeInsets.all(12),
          itemCount: msgs.length,
          itemBuilder: (_, i) {
            final m = msgs[i];
            if (m.isSystem) {
              return Center(child: Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Text(m.content, style: const TextStyle(color: Colors.grey, fontSize: 11), textAlign: TextAlign.center)));
            }
            final isMe = m.senderId == widget.me.id;
            return Align(
              alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
              child: Container(
                margin: const EdgeInsets.symmetric(vertical: 3),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                decoration: BoxDecoration(
                  color: isMe ? const Color(0xFF7B5DFF) : const Color(0xFF1A1A26),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  if (!isMe) Text(m.senderPseudonym, style: const TextStyle(fontSize: 10, color: Colors.grey)),
                  Text(m.content, style: const TextStyle(color: Colors.white)),
                ]),
              ),
            );
          },
        ),
      ),
      if (typing.isNotEmpty)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          child: Align(alignment: Alignment.centerLeft, child: Text('${typing.map((e) => e['pseudonym']).join(', ')} typing…', style: const TextStyle(color: Colors.grey, fontSize: 12, fontStyle: FontStyle.italic))),
        ),
      SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
          child: Row(children: [
            Expanded(
              child: TextField(
                controller: _ctl,
                decoration: const InputDecoration(hintText: 'Type a message…'),
                onChanged: (_) {},
                onSubmitted: (_) => _send(sock, room),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(onPressed: () => _send(sock, room), child: const Icon(Icons.send)),
          ]),
        ),
      ),
    ]);
  }

  void _send(SocketService sock, ContextRoom? room) {
    final text = _ctl.text.trim();
    if (text.isEmpty || room == null) return;
    sock.sendMessage(room.id, widget.me, text);
    _ctl.clear();
  }
}
