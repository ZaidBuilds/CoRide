import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'theme.dart';
import 'models/models.dart';
import 'services/api_client.dart';
import 'services/socket_service.dart';
import 'services/firebase_service.dart';
import 'services/auth_service.dart';
import 'services/monitoring_service.dart';
import 'services/app_check_service.dart';
import 'services/notification_service.dart';
import 'ads/ads_service.dart';
import 'billing/billing_service.dart';
import 'screens/home_screen.dart';
import 'screens/people_screen.dart';
import 'screens/chat_screen.dart';
import 'screens/connect_screen.dart';
import 'screens/profile_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final monitoring = MonitoringService();
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    await monitoring.init();
    await AppCheckService().init();
  } catch (e) {
    debugPrint('[Firebase] initializeApp note: $e');
  }
  runApp(
    MultiProvider(
      providers: [
        Provider<MonitoringService>.value(value: monitoring),
        ChangeNotifierProvider(create: (_) => AuthService()..ensureAuthenticated()),
        ChangeNotifierProvider(create: (_) => NotificationService()..init()),
        ChangeNotifierProvider(create: (_) => FirebaseService()..init()),
        ChangeNotifierProvider(create: (_) => SocketService()),
        ChangeNotifierProvider(create: (_) => AdsService()),
        ChangeNotifierProvider(create: (_) => BillingService()),
      ],
      child: const CoRideApp(),
    ),
  );
}

class CoRideApp extends StatefulWidget {
  const CoRideApp({super.key});
  @override
  State<CoRideApp> createState() => _CoRideAppState();
}

class _CoRideAppState extends State<CoRideApp> {
  UserProfile? me;
  int tab = 0;
  Timer? _hb;
  String? error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _boot());
  }

  Future<void> _boot() async {
    if (!mounted) return;
    final sock = context.read<SocketService>();
    final ads = context.read<AdsService>();
    final billing = context.read<BillingService>();

    sock.connect(
      onUpdate: () {
        if (mounted) setState(() {});
      },
      onToast: (m) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
        }
      },
    );
    // init ads (UMP gate inside AdsService caller) + billing stubs
    await ads.init(canRequestAds: () async => true);
    await billing.init();

    UserProfile? p = await ApiClient.loadLocalProfile();
    if (p != null) {
      final restored = await ApiClient.restoreProfile(p.id);
      if (restored != null) p = restored;
    } else {
      try {
        p = await ApiClient.randomProfile();
      } catch (e) {
        if (mounted) {
          setState(() => error = 'Backend unreachable. Start server :4000 or set API_BASE_URL. ($e)');
        }
        return;
      }
    }
    final profile = p;
    if (mounted) {
      setState(() => me = profile);
    }
    await ApiClient.saveLocalProfile(profile);
    if (mounted) {
      context.read<FirebaseService>().syncUserProfile(profile);
      context.read<MonitoringService>().setUserId(profile.id);
      context.read<NotificationService>().syncTokenToUser(profile.id);
    }
    await ApiClient.track('session_start', profile.id, {});
    await _detectAndJoin();
    _hb = Timer.periodic(const Duration(seconds: 25), (_) {
      final s = sock.stationRoom;
      final t = sock.trainRoom;
      if (s != null) sock.heartbeat(profile.id, s.id);
      if (t != null) sock.heartbeat(profile.id, t.id);
    });
  }

  Future<void> _detectAndJoin() async {
    final sock = context.read<SocketService>();
    final p = me;
    if (p == null) return;
    Position? pos;
    try {
      final perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.always || perm == LocationPermission.whileInUse) {
        pos = await Geolocator.getCurrentPosition();
      }
    } catch (_) {}
    try {
      final station = await ApiClient.detect(
        userId: p.id,
        lat: pos?.latitude,
        lng: pos?.longitude,
        cellTowerId: pos == null ? 'TOWER_DMRC_RC_CP' : null,
        movementState: 'WALKING',
        speedKmh: 3,
      );
      final train = await ApiClient.detect(
        userId: p.id,
        lat: pos?.latitude,
        lng: pos?.longitude,
        cellTowerId: pos == null ? 'TOWER_DMRC_RC_CP' : null,
        movementState: 'IN_VEHICLE',
        speedKmh: 42,
      );
      setState(() => context.read<SocketService>().context = train.context);
      sock.joinRoom(station.room.id, p);
      sock.joinRoom(train.room.id, p);
      if (mounted) {
        final fb = context.read<FirebaseService>();
        fb.joinRoomPresence(
          roomId: station.room.id,
          userId: p.id,
          lat: pos?.latitude,
          lng: pos?.longitude,
        );
      }
      await ApiClient.track('context_detected', p.id, {'station': train.context['stationName']});
    } catch (e) {
      setState(() => error = 'Detect failed: $e');
    }
  }

  @override
  void dispose() {
    _hb?.cancel();
    try {
      context.read<FirebaseService>().leaveRoomPresence();
    } catch (_) {}
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CoRide',
      theme: corideTheme(),
      navigatorObservers: [
        if (context.read<MonitoringService>().analyticsObserver != null)
          context.read<MonitoringService>().analyticsObserver!,
      ],
      home: Scaffold(
        body: SafeArea(child: _body()),
        bottomNavigationBar: NavigationBar(
          selectedIndex: tab,
          onDestinationSelected: (i) => setState(() => tab = i),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.home), label: 'Home'),
            NavigationDestination(icon: Icon(Icons.people), label: 'People'),
            NavigationDestination(icon: Icon(Icons.qr_code), label: 'Scan'),
            NavigationDestination(icon: Icon(Icons.chat_bubble), label: 'Chats'),
            NavigationDestination(icon: Icon(Icons.person), label: 'Profile'),
          ],
        ),
      ),
    );
  }

  Widget _body() {
    if (error != null) {
      return Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(error!, textAlign: TextAlign.center)));
    }
    if (me == null) {
      return const Center(child: CircularProgressIndicator());
    }
    final sock = context.watch<SocketService>();
    final room = sock.trainRoom ?? sock.stationRoom;
    switch (tab) {
      case 0:
        return HomeScreen(
          lineName: room?.lineName,
          stationName: room?.stationName,
          onViewAll: () => setState(() => tab = 1),
          onQuick: (a) {
            if (a == 'chat') return;
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$a coming to this room soon')));
          },
        );
      case 1:
        return PeopleScreen(me: me!, onProfile: (_) {});
      case 2:
        return const Center(child: Text('Scan / Discover — point at a station QR (v2)'));
      case 3:
        return ChatScreen(me: me!);
      case 4:
        return ProfileScreen(me: me!, onEdit: () {});
      default:
        return ConnectScreen(me: me!);
    }
  }
}
