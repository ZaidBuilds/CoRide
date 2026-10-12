import 'package:flutter/foundation.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import '../config.dart';

// RevenueCat wrapper. Server must validate entitlements via Play Developer API
// webhook before granting premium features — never trust client alone.
class BillingService extends ChangeNotifier {
  bool premium = false;

  Future<void> init() async {
    if (AppConfig.revenueCatApiKey.isEmpty) return; // stubs until key is set
    await Purchases.configure(PurchasesConfiguration(AppConfig.revenueCatApiKey));
    await refresh();
  }

  Future<void> refresh() async {
    if (AppConfig.revenueCatApiKey.isEmpty) return;
    try {
      final info = await Purchases.getCustomerInfo();
      premium = info.entitlements.active.containsKey(AppConfig.entitlementPremium);
      notifyListeners();
    } catch (_) {}
  }

  Future<bool> purchaseRemoveAds() async {
    try {
      final products = await Purchases.getProducts([AppConfig.productRemoveAds]);
      if (products.isNotEmpty) {
        await Purchases.purchaseStoreProduct(products.first);
        await refresh();
        return premium;
      }
      return false;
    } catch (_) {
      return false;
    }
  }
}
