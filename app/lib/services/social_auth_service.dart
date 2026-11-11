import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

/// Kết quả lấy Firebase ID Token từ nhà cung cấp mạng xã hội (Google / Facebook).
class SocialAuthTokenResult {
  final bool ok;
  final bool cancelled;
  final String? idToken;
  final String? error;

  const SocialAuthTokenResult({
    required this.ok,
    this.cancelled = false,
    this.idToken,
    this.error,
  });

  factory SocialAuthTokenResult.success(String idToken) =>
      SocialAuthTokenResult(ok: true, idToken: idToken);

  factory SocialAuthTokenResult.cancel([
    String message = 'Bạn đã đóng cửa sổ đăng nhập trước khi hoàn tất.',
  ]) =>
      SocialAuthTokenResult(ok: false, cancelled: true, error: message);

  factory SocialAuthTokenResult.failure(String error) =>
      SocialAuthTokenResult(ok: false, error: error);
}

typedef SocialTokenProvider = Future<SocialAuthTokenResult> Function();

/// Dịch vụ xác thực Google & Facebook qua Firebase Authentication đồng bộ với Website.
///
/// Quy trình xác thực khớp 100% với Website (`src/services/firebase.js`):
/// 1. Mở trình chọn tài khoản Google hoặc SDK/trình duyệt Facebook native trên thiết bị.
/// 2. Trao đổi credential với Firebase Authentication (`novashop-login`) để lấy Firebase ID Token.
/// 3. Trả `idToken` cho `AuthService` gửi lên Backend (`POST /api/v1/auth/google` hoặc `/api/v1/auth/facebook`).
class SocialAuthService {
  static final SocialAuthService _instance = SocialAuthService._internal();
  factory SocialAuthService() => _instance;
  SocialAuthService._internal();

  /// Web OAuth 2.0 Client ID (`client_type: 3`) từ `google-services.json`,
  /// đảm bảo GoogleSignIn trên Android luôn trả về `idToken`.
  static const String webClientId =
      '79946108144-bqu437u2r4vihtr62c5dtndl3va359hi.apps.googleusercontent.com';

  SocialTokenProvider? _googleTestHandler;
  SocialTokenProvider? _facebookTestHandler;
  Future<void> Function()? _signOutTestHandler;

  /// Thiết lập mock handlers phục vụ unit/widget test không cần platform channel.
  @visibleForTesting
  void setTestHandlers({
    SocialTokenProvider? googleHandler,
    SocialTokenProvider? facebookHandler,
    Future<void> Function()? signOutHandler,
  }) {
    _googleTestHandler = googleHandler;
    _facebookTestHandler = facebookHandler;
    _signOutTestHandler = signOutHandler;
  }

  /// Khôi phục handlers mặc định sau khi test.
  @visibleForTesting
  void resetTestHandlers() {
    _googleTestHandler = null;
    _facebookTestHandler = null;
    _signOutTestHandler = null;
  }

  /// Khởi tạo Firebase từ `google-services.json` (an toàn khi chạy test hoặc desktop).
  Future<bool> ensureInitialized() async {
    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp();
      }
      return Firebase.apps.isNotEmpty;
    } catch (e) {
      debugPrint('[SocialAuthService] ensureInitialized skipped: $e');
      return false;
    }
  }

  GoogleSignIn _createGoogleSignIn() => GoogleSignIn(
        scopes: const ['email', 'profile'],
        serverClientId: webClientId,
      );

  /// Đăng nhập Google 1 chạm -> trao đổi credential qua Firebase -> trả về Firebase ID Token.
  Future<SocialAuthTokenResult> authenticateWithGoogle() async {
    if (_googleTestHandler != null) {
      return _googleTestHandler!();
    }

    final initialized = await ensureInitialized();
    if (!initialized) {
      return SocialAuthTokenResult.failure(
        'Không thể khởi tạo Firebase Auth cho đăng nhập Google. Vui lòng kiểm tra cấu hình ứng dụng.',
      );
    }

    try {
      final googleSignIn = _createGoogleSignIn();
      // Xóa phiên chọn tài khoản Google cũ (tương đương prompt: select_account trên Website)
      try {
        await googleSignIn.signOut();
      } catch (_) {}

      final googleUser = await googleSignIn.signIn();
      if (googleUser == null) {
        return SocialAuthTokenResult.cancel();
      }

      final googleAuth = await googleUser.authentication;
      if ((googleAuth.idToken ?? '').isEmpty &&
          (googleAuth.accessToken ?? '').isEmpty) {
        return SocialAuthTokenResult.failure(
          'Không nhận được token xác thực từ tài khoản Google.',
        );
      }

      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );
      final userCredential =
          await FirebaseAuth.instance.signInWithCredential(credential);
      final firebaseIdToken = await userCredential.user?.getIdToken(true);
      if (firebaseIdToken == null || firebaseIdToken.isEmpty) {
        return SocialAuthTokenResult.failure(
          'Không lấy được Firebase ID Token từ phiên Google.',
        );
      }
      return SocialAuthTokenResult.success(firebaseIdToken);
    } on FirebaseAuthException catch (e) {
      return _mapFirebaseAuthError(e);
    } on PlatformException catch (e) {
      return _mapPlatformException(e, providerLabel: 'Google');
    } catch (e) {
      return SocialAuthTokenResult.failure(
        'Không thể đăng nhập Google lúc này: $e',
      );
    }
  }

  /// Đăng nhập Facebook qua SDK -> trao đổi credential qua Firebase -> trả về Firebase ID Token.
  Future<SocialAuthTokenResult> authenticateWithFacebook() async {
    if (_facebookTestHandler != null) {
      return _facebookTestHandler!();
    }

    final initialized = await ensureInitialized();
    if (!initialized) {
      return SocialAuthTokenResult.failure(
        'Không thể khởi tạo Firebase Auth cho đăng nhập Facebook. Vui lòng kiểm tra cấu hình ứng dụng.',
      );
    }

    try {
      final LoginResult result = await FacebookAuth.instance.login(
        permissions: const ['email', 'public_profile'],
      );

      if (result.status == LoginStatus.cancelled) {
        return SocialAuthTokenResult.cancel();
      }
      if (result.status != LoginStatus.success || result.accessToken == null) {
        final message = (result.message ?? '').trim();
        return SocialAuthTokenResult.failure(
          message.isNotEmpty
              ? message
              : 'Đăng nhập Facebook không thành công. Vui lòng thử lại.',
        );
      }

      final accessToken = result.accessToken!.tokenString;
      if (accessToken.isEmpty) {
        return SocialAuthTokenResult.failure(
          'Không nhận được Access Token hợp lệ từ Facebook.',
        );
      }

      final credential = FacebookAuthProvider.credential(accessToken);
      final userCredential =
          await FirebaseAuth.instance.signInWithCredential(credential);
      final firebaseIdToken = await userCredential.user?.getIdToken(true);
      if (firebaseIdToken == null || firebaseIdToken.isEmpty) {
        return SocialAuthTokenResult.failure(
          'Không lấy được Firebase ID Token từ phiên Facebook.',
        );
      }
      return SocialAuthTokenResult.success(firebaseIdToken);
    } on FirebaseAuthException catch (e) {
      return _mapFirebaseAuthError(e);
    } on PlatformException catch (e) {
      return _mapPlatformException(e, providerLabel: 'Facebook');
    } catch (e) {
      return SocialAuthTokenResult.failure(
        'Không thể đăng nhập Facebook lúc này: $e',
      );
    }
  }

  /// Đăng xuất đồng thời phiên Firebase / Google / Facebook (tương đương firebaseSignOut trên Website).
  Future<void> signOutProviders() async {
    if (_signOutTestHandler != null) {
      try {
        await _signOutTestHandler!();
      } catch (_) {}
      return;
    }

    if (Firebase.apps.isEmpty) return;

    try {
      await FirebaseAuth.instance.signOut();
    } catch (_) {}
    try {
      await _createGoogleSignIn().signOut();
    } catch (_) {}
    try {
      await FacebookAuth.instance.logOut();
    } catch (_) {}
  }

  SocialAuthTokenResult _mapFirebaseAuthError(FirebaseAuthException error) {
    switch (error.code) {
      case 'account-exists-with-different-credential':
        return SocialAuthTokenResult.failure(
          'Email của tài khoản này đã được liên kết với phương thức đăng nhập khác (ví dụ: Google, Facebook hoặc tài khoản thường).',
        );
      case 'network-request-failed':
        return SocialAuthTokenResult.failure(
          'Lỗi kết nối mạng khi liên hệ với dịch vụ xác thực. Vui lòng kiểm tra lại đường truyền internet.',
        );
      case 'operation-not-allowed':
        return SocialAuthTokenResult.failure(
          'Phương thức đăng nhập này chưa được bật trong Firebase Console (Authentication > Sign-in method).',
        );
      case 'user-disabled':
        return SocialAuthTokenResult.failure(
          'Tài khoản này đã bị vô hiệu hóa.',
        );
      case 'invalid-credential':
        return SocialAuthTokenResult.failure(
          'Thông tin xác thực không hợp lệ hoặc đã hết hạn.',
        );
      default:
        final msg = (error.message ?? '').trim();
        return SocialAuthTokenResult.failure(
          msg.isNotEmpty
              ? msg
              : 'Đã xảy ra lỗi khi xác thực tài khoản. Vui lòng thử lại sau.',
        );
    }
  }

  SocialAuthTokenResult _mapPlatformException(
    PlatformException error, {
    required String providerLabel,
  }) {
    final code = error.code.toLowerCase();
    final msg = (error.message ?? '').toLowerCase();
    if (code.contains('cancel') || msg.contains('cancel')) {
      return SocialAuthTokenResult.cancel();
    }
    if (code.contains('network') || msg.contains('network')) {
      return SocialAuthTokenResult.failure(
        'Lỗi kết nối mạng khi đăng nhập $providerLabel. Vui lòng kiểm tra internet.',
      );
    }
    return SocialAuthTokenResult.failure(
      error.message?.trim().isNotEmpty == true
          ? 'Lỗi đăng nhập $providerLabel: ${error.message}'
          : 'Không thể kết nối dịch vụ đăng nhập $providerLabel.',
    );
  }
}
