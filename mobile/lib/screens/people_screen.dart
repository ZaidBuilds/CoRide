import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/socket_service.dart';

// Figma 02: header count + All/Nearby/Friends filter + traveler cards + tag pills.
class PeopleScreen extends StatefulWidget {
  final UserProfile me;
  final void Function(UserProfile) onProfile;
  const PeopleScreen({super.key, required this.me, required this.onProfile});

  @override
  State<PeopleScreen> createState() => _PeopleScreenState();
}

class _PeopleScreenState extends State<PeopleScreen> {
  String filter = 'all';
  List<RankedTraveler> ranked = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final sock = context.read<SocketService>();
    final room = sock.trainRoom ?? sock.stationRoom;
    if (room == null) return;
    final r = await ApiClient.rank(room.id, widget.me.id);
    if (mounted) setState(() => ranked = r);
  }

  @override
  Widget build(BuildContext context) {
    final sock = context.watch<SocketService>();
    final room = sock.trainRoom ?? sock.stationRoom;
    final users = room?.users ?? [];
    List<UserProfile> list = users.where((u) => u.id != widget.me.id).toList();
    if (filter == 'nearby') {
      list = list.where((u) => u.presenceTier == 'nearby' || u.presenceTier == 'active').toList();
    }
    final rankMap = {for (final r in ranked) r.profile.id: r};
    // smart order when available
    if (ranked.isNotEmpty) {
      list.sort((a, b) => (rankMap[b.id]?.score ?? -1).compareTo(rankMap[a.id]?.score ?? -1));
    }

    return Column(children: [
      Card(
        margin: const EdgeInsets.fromLTRB(12, 12, 12, 8),
        child: ListTile(
          leading: const CircleAvatar(backgroundColor: Color(0xFF7B5DFF), child: Icon(Icons.train, color: Colors.white)),
          title: Text('${room?.userCount ?? list.length} travelers online', style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text('Next: Mandi House • ${room?.lineName ?? ''}'),
        ),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'all', label: Text('All')),
            ButtonSegment(value: 'nearby', label: Text('Nearby')),
            ButtonSegment(value: 'friends', label: Text('Friends')),
          ],
          selected: {filter},
          onSelectionChanged: (s) => setState(() => filter = s.first),
        ),
      ),
      Expanded(
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: list.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final u = list[i];
              final r = rankMap[u.id];
              return Card(
                child: ListTile(
                  onTap: () => widget.onProfile(u),
                  leading: CircleAvatar(backgroundColor: const Color(0xFF7B5DFF), child: Text(u.pseudonym.isEmpty ? '?' : u.pseudonym[0])),
                  title: Row(children: [
                    Expanded(child: Text(u.pseudonym, style: const TextStyle(fontWeight: FontWeight.w700))),
                    if (u.presenceTier == 'nearby')
                      const Chip(label: Text('Nearby', style: TextStyle(fontSize: 10)), visualDensity: VisualDensity.compact),
                    if (u.presenceTier == 'active')
                      const Chip(label: Text('Same Train', style: TextStyle(fontSize: 10)), visualDensity: VisualDensity.compact),
                  ]),
                  subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(u.interestTags.take(3).join(' • '), style: const TextStyle(color: Colors.grey, fontSize: 12)),
                    if (r != null && r.mutualCount > 0)
                      Text('✨ ${r.mutualCount} shared: ${r.mutualTags.take(2).join(', ')}',
                          style: const TextStyle(color: Color(0xFFB79CFF), fontSize: 11, fontWeight: FontWeight.w700)),
                    Wrap(
                      spacing: 4,
                      children: u.interestTags.take(2).map((t) => Chip(label: Text(t, style: const TextStyle(fontSize: 10)), visualDensity: VisualDensity.compact)).toList(),
                    ),
                  ]),
                  trailing: IconButton(
                    icon: const Icon(Icons.person_add, color: Color(0xFF7B5DFF)),
                    onPressed: () {
                      sock.connectRequest(widget.me, u.id, room?.lineName ?? '', room?.stationName ?? '');
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Request sent')));
                    },
                  ),
                ),
              );
            },
          ),
        ),
      ),
    ]);
  }
}
