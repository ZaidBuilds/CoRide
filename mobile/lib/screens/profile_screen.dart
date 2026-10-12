import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../services/auth_service.dart';

// Figma 10 + detail: avatar, trust badge, interests, stats, saved commutes entry, and Account & Security.
class ProfileScreen extends StatelessWidget {
  final UserProfile me;
  final VoidCallback onEdit;
  const ProfileScreen({super.key, required this.me, required this.onEdit});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    return ListView(padding: const EdgeInsets.all(12), children: [
      Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            CircleAvatar(
              radius: 30,
              backgroundColor: const Color(0xFF7B5DFF),
              child: Text(
                me.pseudonym.isEmpty ? '?' : me.pseudonym[0],
                style: const TextStyle(fontSize: 22, color: Colors.white),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(me.pseudonym, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                Text('@${me.username.replaceAll('@', '')}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                if (me.trustBadge != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Chip(
                      label: Text(me.trustBadge!, style: const TextStyle(fontSize: 10)),
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
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
            Text(
              me.bio?.isNotEmpty == true ? me.bio! : 'Metro commuter. Say hi on the Blue Line!',
              style: const TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              children: me.interestTags
                  .map((t) => Chip(label: Text(t, style: const TextStyle(fontSize: 11)), visualDensity: VisualDensity.compact))
                  .toList(),
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
      const SizedBox(height: 8),
      // Account & Security Card (Firebase Auth)
      Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Account & Security', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: auth.isAnonymous
                          ? Colors.amber.withValues(alpha: 0.15)
                          : const Color(0xFF00C853).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: auth.isAnonymous ? Colors.amber : const Color(0xFF00C853),
                        width: 0.8,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          auth.isAnonymous ? Icons.shield_outlined : Icons.verified,
                          size: 13,
                          color: auth.isAnonymous ? Colors.amber : const Color(0xFF00C853),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          auth.isAnonymous ? 'Guest Pass' : 'Verified Commuter',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: auth.isAnonymous ? Colors.amber : const Color(0xFF00C853),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              if (auth.isAnonymous) ...[
                const Text(
                  'Your commuter karma and contacts are stored temporarily. Upgrade to Google so you never lose your status across metro journeys.',
                  style: TextStyle(color: Colors.grey, fontSize: 12, height: 1.4),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: auth.isLoading ? null : () => _upgradeWithGoogle(context, auth),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF7B5DFF),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    icon: auth.isLoading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.account_circle, size: 18),
                    label: Text(auth.isLoading ? 'Linking account...' : 'Upgrade with Google'),
                  ),
                ),
              ] else ...[
                Text(
                  'Signed in as ${auth.email ?? auth.displayName ?? 'Permanent Commuter'}',
                  style: const TextStyle(color: Colors.grey, fontSize: 12),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _confirmSignOut(context, auth),
                        icon: const Icon(Icons.logout, size: 16),
                        label: const Text('Sign Out'),
                        style: OutlinedButton.styleFrom(
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _confirmDeleteAccount(context, auth),
                        icon: const Icon(Icons.delete_forever, size: 16, color: Colors.redAccent),
                        label: const Text('Delete', style: TextStyle(color: Colors.redAccent)),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Colors.redAccent, width: 0.8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    ]);
  }

  Widget _stat(String v, String l) => Column(children: [
        Text(v, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        Text(l, style: const TextStyle(color: Colors.grey, fontSize: 11)),
      ]);

  Future<void> _upgradeWithGoogle(BuildContext context, AuthService auth) async {
    final user = await auth.linkGuestWithGoogle();
    if (!context.mounted) return;
    if (user != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Account linked to Google successfully! Your karma is safe.'),
          backgroundColor: Color(0xFF00C853),
        ),
      );
    } else if (auth.errorMessage != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to link account: ${auth.errorMessage}'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  Future<void> _confirmSignOut(BuildContext context, AuthService auth) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out from this device?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign Out', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await auth.signOut();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Signed out successfully.')),
        );
      }
    }
  }

  Future<void> _confirmDeleteAccount(BuildContext context, AuthService auth) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Account'),
        content: const Text(
          'This action is irreversible. All your messages, connections, and karma will be permanently erased.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete Permanently', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      try {
        await auth.deleteAccount();
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Account permanently deleted.')),
          );
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error deleting account: $e'), backgroundColor: Colors.redAccent),
          );
        }
      }
    }
  }
}
