import 'package:flutter/material.dart';
import '../models/models.dart';

// Figma 05: Received / Sent / Friends tabs + Safe Connections + How it works.
class ConnectScreen extends StatelessWidget {
  final UserProfile me;
  const ConnectScreen({super.key, required this.me});

  @override
  Widget build(BuildContext context) {
    void toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
    return DefaultTabController(
      length: 3,
      child: Column(children: [
        const SizedBox(height: 8),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 12),
          child: TabBar(tabs: [Tab(text: 'Received'), Tab(text: 'Sent'), Tab(text: 'Friends')]),
        ),
        Expanded(
          child: TabBarView(children: [
            _empty('No new requests — ride again to get discovered.'),
            _empty('No sent requests — tap + on a traveler.'),
            _empty('No Metro Friends yet — accept a request.'),
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
        child: Padding(padding: const EdgeInsets.all(24), child: Text(msg, style: const TextStyle(color: Colors.grey), textAlign: TextAlign.center)),
      );
}
