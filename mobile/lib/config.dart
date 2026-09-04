// CoRide mobile config — mirrors server/.env + web client API
// Change API_BASE_URL to your hosted backend before Play release.
// Local dev: 10.0.2.2 = host localhost from Android emulator.

class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000',
  );

  // AdMob — replace with your real IDs from AdMob console (both ready per user).
  // Test IDs are used by default so debug builds never serve real ads.
  static const String admobAppIdAndroid = String.fromEnvironment(
    'ADMOB_APP_ID',
    defaultValue: 'ca-app-pub-3940256099942544~3347511713',
  );
  static const String bannerAdUnitId = String.fromEnvironment(
    'BANNER_AD_ID',
    defaultValue: 'ca-app-pub-3940256099942544/6300978111',
  );
  static const String interstitialAdUnitId = String.fromEnvironment(
    'INTERSTITIAL_AD_ID',
    defaultValue: 'ca-app-pub-3940256099942544/1033173712',
  );
  static const String rewardedAdUnitId = String.fromEnvironment(
    'REWARDED_AD_ID',
    defaultValue: 'ca-app-pub-3940256099942544/5224354917',
  );

  // RevenueCat — replace with your public SDK key.
  static const String revenueCatApiKey = String.fromEnvironment(
    'REVENUECAT_KEY',
    defaultValue: '',
  );
  static const String entitlementPremium = 'premium';
  static const String productRemoveAds = 'remove_ads';
}
