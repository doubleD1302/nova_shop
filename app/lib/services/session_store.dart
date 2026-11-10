import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Lưu token trong kho bảo mật hệ điều hành, chuyển phiên cũ một lần.
class SessionStore {
  static const _storage = FlutterSecureStorage();
  static Future<void> _pending = Future<void>.value();
  static const accessKey = 'novashop_jwt_token';
  static const refreshKey = 'novashop_refresh_token';
  static const legacyCredentialsKey = 'novashop_saved_credentials';
  static const disabledSessionKey = 'novashop_session_disabled';

  // Migration, writes and logout deletes must retain invocation order.
  Future<T> _serial<T>(Future<T> Function() action) {
    final result = _pending.then((_) => action());
    _pending = result.then<void>((_) {}, onError: (Object _, StackTrace _) {});
    return result;
  }

  Future<String?> read(String key) => _serial(() async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(disabledSessionKey) == true) return null;
    final stored = await _storage.read(key: key);
    if (stored != null && stored.isNotEmpty) {
      await prefs.remove(key);
      return stored;
    }
    final old = prefs.getString(key);
    if (old == null || old.isEmpty) return null;
    await _storage.write(key: key, value: old);
    await prefs.remove(key);
    return old;
  });

  Future<void> write(String key, String value) => _serial(() async {
    await _storage.write(key: key, value: value);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(key);
  });

  Future<void> delete(String key) => _serial(() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(key);
    await _storage.delete(key: key);
  });

  Future<void> removeLegacyCredentials() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(legacyCredentialsKey);
  }
}
