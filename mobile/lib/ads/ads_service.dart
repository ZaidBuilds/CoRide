import 'package:flutter/foundation.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import '../config.dart';

// v1 policy: banner on list screens, interstitial capped 1/3min (e.g. after game),
// rewarded for extra trivia life. UMP consent must gate all requests.
class AdsService extends ChangeNotifier {
  bool _ready = false;
  bool get ready => _ready;
  DateTime? _lastInterstitial;
  BannerAd? banner;

  Future<void> init({required Future<bool> Function() canRequestAds}) async {
    await MobileAds.instance.initialize();
    if (!await canRequestAds()) return;
    _ready = true;
    banner = BannerAd(
      adUnitId: AppConfig.bannerAdUnitId,
      size: AdSize.banner,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdFailedToLoad: (ad, _) => ad.dispose(),
      ),
    )..load();
    notifyListeners();
  }

  bool get interstitialCapped =>
      _lastInterstitial != null && DateTime.now().difference(_lastInterstitial!) < const Duration(minutes: 3);

  Future<void> showInterstitial() async {
    if (!_ready || interstitialCapped) return;
    await InterstitialAd.load(
      adUnitId: AppConfig.interstitialAdUnitId,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (a) => a.show(),
        onAdFailedToLoad: (_) {},
      ),
    );
    _lastInterstitial = DateTime.now();
  }

  @override
  void dispose() {
    banner?.dispose();
    super.dispose();
  }
}
