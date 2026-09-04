import 'package:flutter/material.dart';
import '../models/models.dart';

// Figma 10 + detail: avatar, trust badge, interests, stats, saved commutes entry.
class ProfileScreen extends StatelessWidget {
  final UserProfile me;
  final VoidCallback onEdit;
  const ProfileScreen({super.key, required this.me, required this.onEdit});

  @override
  Widget build(BuildContext context) {
    return ListView(padding: const EdgeInsets.all(12), children: [
      Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            CircleAvatar(radius: 30, backgroundColor: const Color(0xFF7B5DFF), child: Text(me.pseudonym.isEmpty ? '?' : me.pseudonym[0], style: const TextStyle(fontSize: 22))),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(me.pseudonym, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                Text('@${me.username.replaceAll('@', '')}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                if (me.trustBadge != null) Chip(label: Text(me.trustBadge!, style: const TextStyle(fontSize: 10)), visualDensity: VisualDensity.compact),
              ]),
            ),
            TextButton(onPressed: onEdit, child: const Text('Edit Profile')),
          ]),
        ),
      ),
      const SizedBox(height: 8),
      Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('About Me', style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(me.bio?.isNotEmpty == true ? me.bio! : 'Metro commuter. Say hi on the Blue Line!', style: const TextStyle(color: Colors.grey)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              children: me.interestTags.map((t) => Chip(label: Text(t, style: const TextStyle(fontSize: 11)), visualDensity: VisualDensity.compact)).toList(),
            ),
          ]),
        ),
      ),
      const SizedBox(height: 8),
      Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
            _stat('${me.karmaScore}', 'Karma'),
            _stat('${me.interestTags.length}/5', 'Tags'),
            _stat(me.trustTier ?? 'regular', 'Trust'),
          ]),
        ),
      ),
    ]);
  }

  Widget _stat(String v, String l) => Column(children: [
        Text(v, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        Text(l, style: const TextStyle(color: Colors.grey, fontSize: 11)),
      ]);
}
