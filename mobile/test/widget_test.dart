import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:coride/main.dart';
import 'package:coride/services/socket_service.dart';
import 'package:coride/ads/ads_service.dart';
import 'package:coride/billing/billing_service.dart';

void main() {
  testWidgets('CoRide app boots', (WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
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
}
