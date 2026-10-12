import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../services/firebase_service.dart';

// Delhi Metro Commuter Connect: Received / Sent / Friends tabs backed by Cloud Firestore
class ConnectScreen extends StatelessWidget {
  final UserProfile me;
  const ConnectScreen({super.key, required this.me});

  @override
  Widget build(BuildContext context) {
    final fb = context.watch<FirebaseService>();
    void toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

    return DefaultTabController(
      length: 3,
      child: Column(children: [
        const SizedBox(height: 8),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 12),
          child: TabBar(tabs: [
            Tab(text: 'Received'),
            Tab(text: 'Sent'),
            Tab(text: 'Friends'),
          ]),
        ),
        Expanded(
          child: TabBarView(children: [
            // 1. Received Tab
            StreamBuilder<List<Map<String, dynamic>>>(
              stream: fb.streamReceivedRequests(me.id),
              builder: (context, snapshot) {
                final list = snapshot.data ?? [];
                if (list.isEmpty) {
                  return _empty('No pending requests — ride the metro to get discovered! 🚇');
                }
                return ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: list.length,
                  itemBuilder: (_, i) {
                    final req = list[i];
                    final name = req['fromUserName'] ?? 'A commuter';
                    final line = req['metroLine'] ?? 'Delhi Metro';
                    return Card(
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: const Color(0xFF7B5DFF),
                          child: Text(name[0].toUpperCase(), style: const TextStyle(color: Colors.white)),
                        ),
                        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text('Riding on $line', style: const TextStyle(fontSize: 12)),
                        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                          IconButton(
                            icon: const Icon(Icons.check_circle, color: Colors.green),
                            tooltip: 'Accept',
                            onPressed: () {
                              fb.respondToConnectionRequest(req['id'], true);
                              toast('Connected with $name!');
                            },
                          ),
                          IconButton(
                            icon: const Icon(Icons.cancel, color: Colors.grey),
                            tooltip: 'Ignore',
                            onPressed: () => fb.respondToConnectionRequest(req['id'], false),
                          ),
                        ]),
                      ),
                    );
                  },
                );
              },
            ),

            // 2. Sent Tab
            StreamBuilder<List<Map<String, dynamic>>>(
              stream: fb.streamSentRequests(me.id),
              builder: (context, snapshot) {
                final list = snapshot.data ?? [];
                if (list.isEmpty) {
                  return _empty('No sent requests — tap Connect on travelers in People tab. 🤝');
                }
                return ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: list.length,
                  itemBuilder: (_, i) {
                    final req = list[i];
                    return Card(
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      child: ListTile(
                        leading: const CircleAvatar(
                          backgroundColor: Color(0xFF2A2A38),
                          child: Icon(Icons.arrow_outward, color: Colors.grey),
                        ),
                        title: Text('Request sent to rider', style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text('Line: ${req['metroLine'] ?? 'Delhi Metro'}', style: const TextStyle(fontSize: 12)),
                        trailing: const Chip(
                          label: Text('Pending', style: TextStyle(fontSize: 11)),
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                    );
                  },
                );
              },
            ),

            // 3. Friends Tab
            StreamBuilder<List<Map<String, dynamic>>>(
              stream: fb.streamFriends(me.id),
              builder: (context, snapshot) {
                final list = snapshot.data ?? [];
                if (list.isEmpty) {
                  return _empty('No Metro Friends yet — accept a connection request to start chatting! ✨');
                }
                return ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: list.length,
                  itemBuilder: (_, i) {
                    final req = list[i];
                    final friendName = req['fromUserId'] == me.id ? 'Commuter Friend' : (req['fromUserName'] ?? 'Friend');
                    return Card(
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      child: ListTile(
                        leading: const CircleAvatar(
                          backgroundColor: Color(0xFF7B5DFF),
                          child: Icon(Icons.person, color: Colors.white),
                        ),
                        title: Text(friendName, style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: const Text('Connected Metro Commuter', style: TextStyle(fontSize: 12)),
                        trailing: const Icon(Icons.chat_bubble_outline, color: Color(0xFF7B5DFF)),
                        onTap: () => toast('Opening direct chat with $friendName…'),
                      ),
                    );
                  },
                );
              },
            ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Card(
            child: ListTile(
              leading: const Icon(Icons.shield, color: Color(0xFF7B5DFF)),
              title: const Text('Safe Connections', style: TextStyle(fontWeight: FontWeight.w700)),
              subtitle: const Text('Report or block if something feels off.'),
              onTap: () => toast('Safety: report/block available on every profile.'),
            ),
          ),
        ),
        const SizedBox(height: 4),
      ]),
    );
  }

  Widget _empty(String msg) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(msg, style: const TextStyle(color: Colors.grey), textAlign: TextAlign.center),
        ),
      );
}
