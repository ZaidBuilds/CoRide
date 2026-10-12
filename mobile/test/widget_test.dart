import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:coride/main.dart';
import 'package:coride/models/models.dart';
import 'package:coride/screens/profile_screen.dart';
import 'package:coride/services/socket_service.dart';
import 'package:coride/services/firebase_service.dart';
import 'package:coride/services/auth_service.dart';
import 'package:coride/services/monitoring_service.dart';
import 'package:coride/services/notification_service.dart';
import 'package:coride/ads/ads_service.dart';
import 'package:coride/billing/billing_service.dart';

void main() {
  testWidgets('CoRide app boots', (WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          Provider<MonitoringService>.value(value: MonitoringService()),
          ChangeNotifierProvider(create: (_) => AuthService()),
          ChangeNotifierProvider(create: (_) => NotificationService()),
          ChangeNotifierProvider(create: (_) => FirebaseService()),
          ChangeNotifierProvider(create: (_) => SocketService()),
          ChangeNotifierProvider(create: (_) => AdsService()),
          ChangeNotifierProvider(create: (_) => BillingService()),
        ],
        child: const CoRideApp(),
      ),
    );
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('CoRide'), findsNothing); // home loads after async boot
  });

  testWidgets('AuthService initializes in safe guest fallback', (WidgetTester tester) async {
    final auth = AuthService();
    expect(auth.isAuthenticated, isFalse);
    expect(auth.isAnonymous, isTrue);
    expect(auth.isGoogleLinked, isFalse);
  });

  testWidgets('ProfileScreen renders commuter details and Account & Security card', (WidgetTester tester) async {
    final testProfile = UserProfile(
      id: 'test_rider_1',
      username: 'delhi_rider',
      pseudonym: 'Metro Explorer',
      avatarId: 'av_1',
      avatarBg: '#7B5DFF',
      interestTags: ['Tech', 'Music', 'Design'],
      bio: 'Daily Blue Line commuter from Noida to CP',
      activity: 'TRAIN_MOVING',
      joinedAt: 1700000000000,
      karmaScore: 250,
      trustTier: 'verified',
      trustBadge: 'Top Commuter',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: MultiProvider(
          providers: [
            ChangeNotifierProvider(create: (_) => AuthService()),
          ],
          child: Scaffold(
            body: ProfileScreen(
              me: testProfile,
              onEdit: () {},
            ),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Metro Explorer'), findsOneWidget);
    expect(find.text('Account & Security'), findsOneWidget);
    expect(find.text('Guest Pass'), findsOneWidget);
    expect(find.text('Upgrade with Google'), findsOneWidget);
    expect(find.text('Daily Blue Line commuter from Noida to CP'), findsOneWidget);
    expect(find.text('250'), findsOneWidget);
  });
}
