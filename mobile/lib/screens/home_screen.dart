import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import '../ads/ads_service.dart';
import '../services/socket_service.dart';

// Figma 01: On Ride card + Around You Now + Quick Actions + Active Rooms.
class HomeScreen extends StatelessWidget {
  final String? lineName;
  final String? stationName;
  final VoidCallback onViewAll;
  final void Function(String action) onQuick;
  const HomeScreen({super.key, this.lineName, this.stationName, required this.onViewAll, required this.onQuick});

  @override
  Widget build(BuildContext context) {
    final sock = context.watch<SocketService>();
    final ads = context.watch<AdsService>();
    final room = sock.trainRoom ?? sock.stationRoom;
    final users = room?.users ?? [];
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      children: [
        const Text('CoRide', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
        Text('Good Morning 👋  ${lineName ?? room?.lineName ?? 'Blue Line'} • ${stationName ?? room?.stationName ?? 'Rajiv Chowk'}',
            style: const TextStyle(color: Colors.grey)),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: const CircleAvatar(backgroundColor: Color(0xFF7B5DFF), child: Icon(Icons.train, color: Colors.white)),
            title: const Text('On Ride', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text('${room?.lineName ?? 'Blue Line'} • ${room?.stationName ?? 'Rajiv Chowk'} → Noida'),
            trailing: TextButton(onPressed: onViewAll, child: const Text('Change')),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const Text('Around You Now', style: TextStyle(fontWeight: FontWeight.w800)),
                const Spacer(),
                TextButton(onPressed: onViewAll, child: const Text('View all')),
              ]),
              Text('${room?.userCount ?? users.length} people nearby', style: const TextStyle(color: Colors.grey)),
              const SizedBox(height: 8),
              SizedBox(
                height: 96,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: users.take(8).length,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (_, i) {
                    final u = users[i];
                    return Column(children: [
                      CircleAvatar(radius: 26, backgroundColor: const Color(0xFF7B5DFF), child: Text(u.pseudonym.isEmpty ? '?' : u.pseudonym[0])),
                      const SizedBox(height: 4),
                      SizedBox(width: 64, child: Text(u.pseudonym.split('_').first, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: const TextStyle(fontSize: 11))),
                    ]);
                  },
                ),
              ),
            ]),
          ),
        ),
        const SizedBox(height: 12),
        const Text('Quick Actions', style: TextStyle(fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          childAspectRatio: 2.4,
          children: [
            _quick(context, Icons.chat_bubble, 'Chat Room', () => onQuick('chat')),
            _quick(context, Icons.videogame_asset, 'Play Quiz', () => onQuick('quiz')),
            _quick(context, Icons.bolt, 'Ice Breaker', () => onQuick('icebreaker')),
            _quick(context, Icons.edit, 'Add Post', () => onQuick('post')),
          ],
        ),
        if (ads.ready && ads.banner != null) ...[
          const SizedBox(height: 12),
          SizedBox(height: 50, child: AdWidget(ad: ads.banner!)),
        ],
      ],
    );
  }

  Widget _quick(BuildContext c, IconData icon, String label, VoidCallback onTap) {
    return Card(child: InkWell(onTap: onTap, child: Row(children: [const SizedBox(width: 12), Icon(icon, color: const Color(0xFF7B5DFF)), const SizedBox(width: 8), Text(label, style: const TextStyle(fontWeight: FontWeight.w700))])));
  }
}
