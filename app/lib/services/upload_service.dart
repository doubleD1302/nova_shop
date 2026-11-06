import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'api_client.dart';

/// Kết quả tải ảnh lên máy chủ ShopNova
class UploadResult {
  final bool success;
  final String? url;
  final String? mimeType;
  final String? error;

  UploadResult({
    required this.success,
    this.url,
    this.mimeType,
    this.error,
  });

  factory UploadResult.ok(String url, {String? mimeType}) {
    return UploadResult(success: true, url: url, mimeType: mimeType);
  }

  factory UploadResult.fail(String error) {
    return UploadResult(success: false, error: error);
  }
}

/// Service xử lý tải ảnh lên máy chủ ShopNova qua API:
/// POST /api/v1/uploads/images
///
/// Tuân thủ quy chuẩn bảo mật & ràng buộc dữ liệu:
/// 1. Whitelist MIME & Magic Bytes: chỉ cho phép .jpg, .jpeg, .png, .webp. Cấm tuyệt đối .svg, .exe, .php, .sh, .html, .gif nặng.
/// 2. Giới hạn dung lượng:
///    - 'product': Tối đa 5 MiB
///    - 'shop': Tối đa 5 MiB
///    - 'review': Tối đa 2 MiB
///    - 'avatar': Tối đa 1 MiB
///    - Chặn file rỗng 0 byte
/// 3. Tối ưu hóa & nén tự động: resize về tối đa 1200px, chất lượng 80.
class UploadService {
  static final UploadService _instance = UploadService._internal();
  factory UploadService() => _instance;
  UploadService._internal();

  final ApiClient _client = ApiClient();
  final ImagePicker _picker = ImagePicker();

  /// Giới hạn dung lượng theo từng mục đích (tính bằng byte)
  static const Map<String, int> imageLimits = {
    'avatar': 1 * 1024 * 1024,      // 1 MiB
    'review': 2 * 1024 * 1024,      // 2 MiB
    'product': 5 * 1024 * 1024,     // 5 MiB
    'shop': 5 * 1024 * 1024,        // 5 MiB
  };

  /// Whitelist các đuôi file hợp lệ
  static const List<String> allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

  /// Danh sách phần mở rộng nguy hiểm cấm tuyệt đối
  static const List<String> forbiddenExtensions = [
    '.svg', '.exe', '.php', '.sh', '.html', '.htm', '.js', '.bat', '.cmd', '.gif'
  ];

  /// Kiểm tra Magic Bytes (File Signatures) xác thực định dạng ảnh thực sự
  static String? verifyMagicBytesAndGetMime(Uint8List bytes) {
    if (bytes.isEmpty) return null;

    // 1. JPEG: FF D8 FF
    if (bytes.length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) {
      return 'image/jpeg';
    }

    // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
    if (bytes.length >= 8 &&
        bytes[0] == 0x89 &&
        bytes[1] == 0x50 &&
        bytes[2] == 0x4E &&
        bytes[3] == 0x47 &&
        bytes[4] == 0x0D &&
        bytes[5] == 0x0A &&
        bytes[6] == 0x1A &&
        bytes[7] == 0x0A) {
      return 'image/png';
    }

    // 3. WEBP: RIFF .... WEBP
    if (bytes.length >= 12) {
      final riff = String.fromCharCodes(bytes.sublist(0, 4));
      final webp = String.fromCharCodes(bytes.sublist(8, 12));
      if (riff == 'RIFF' && webp == 'WEBP') {
        return 'image/webp';
      }
    }

    return null; // Không khớp bất kỳ định dạng ảnh hợp lệ nào
  }

  /// Tải ảnh lên máy chủ từ mảng byte
  Future<UploadResult> uploadBytes({
    required Uint8List bytes,
    required String fileName,
    required String purpose,
  }) async {
    // 1. Kiểm tra file rỗng (0 byte)
    if (bytes.isEmpty) {
      return UploadResult.fail('Ảnh không được rỗng (0 byte). Vui lòng chọn ảnh hợp lệ.');
    }

    // 2. Kiểm tra phần mở rộng file (Whitelist extension)
    final lowerName = fileName.toLowerCase();
    for (final ext in forbiddenExtensions) {
      if (lowerName.endsWith(ext)) {
        return UploadResult.fail('Định dạng file $ext bị cấm vì lý do an toàn. Chỉ chấp nhận .jpg, .jpeg, .png, .webp.');
      }
    }

    bool isAllowedExt = false;
    for (final ext in allowedExtensions) {
      if (lowerName.endsWith(ext)) {
        isAllowedExt = true;
        break;
      }
    }
    if (!isAllowedExt && fileName.contains('.')) {
      return UploadResult.fail('Định dạng file không được hỗ trợ. Chỉ cho phép các định dạng: .jpg, .jpeg, .png, .webp.');
    }

    // 3. Kiểm tra Magic Bytes (File Signature) đầu file
    final detectedMime = verifyMagicBytesAndGetMime(bytes);
    if (detectedMime == null) {
      return UploadResult.fail('File không phải là định dạng hình ảnh hợp lệ hoặc đã bị thay đổi phần mở rộng trái phép.');
    }

    // 4. Kiểm tra giới hạn dung lượng
    final limit = imageLimits[purpose] ?? (5 * 1024 * 1024);
    if (bytes.length > limit) {
      final limitMb = (limit / (1024 * 1024)).toStringAsFixed(0);
      return UploadResult.fail('Dung lượng ảnh vượt quá giới hạn cho phép ($limitMb MiB cho mục đích $purpose).');
    }

    // 5. Đóng gói Base64 Data URL gửi lên Backend
    final base64Data = base64Encode(bytes);
    final dataUrl = 'data:$detectedMime;base64,$base64Data';

    return uploadDataUrl(dataUrl: dataUrl, purpose: purpose);
  }

  /// Tải ảnh lên máy chủ từ chuỗi dataUrl (data:image/...;base64,...)
  Future<UploadResult> uploadDataUrl({
    required String dataUrl,
    required String purpose,
  }) async {
    try {
      final response = await _client.post(
        '/api/v1/uploads/images',
        body: {
          'dataUrl': dataUrl,
          'purpose': purpose,
        },
      );

      if (response.success && response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        final url = data['url']?.toString();
        final mime = data['mimeType']?.toString();
        if (url != null && url.isNotEmpty) {
          return UploadResult.ok(url, mimeType: mime);
        }
      }

      final msg = response.message ?? '';
      return UploadResult.fail(msg.isNotEmpty ? msg : 'Không thể tải ảnh lên máy chủ.');
    } catch (e) {
      debugPrint('[UploadService] uploadDataUrl error: $e');
      return UploadResult.fail('Lỗi kết nối khi tải ảnh: $e');
    }
  }

  /// Mở thư viện chọn ảnh từ thiết bị với tự động nén và resize
  /// Max width: 1200px, Max height: 1200px, Quality: 80
  Future<UploadResult?> pickAndUploadImage({
    required String purpose,
    ImageSource source = ImageSource.gallery,
  }) async {
    try {
      final XFile? file = await _picker.pickImage(
        source: source,
        maxWidth: 1200,
        maxHeight: 1200,
        imageQuality: 80,
      );

      if (file == null) {
        return null; // Người dùng hủy chọn
      }

      final bytes = await file.readAsBytes();
      return await uploadBytes(
        bytes: bytes,
        fileName: file.name,
        purpose: purpose,
      );
    } catch (e) {
      debugPrint('[UploadService] pickAndUploadImage error: $e');
      return UploadResult.fail('Không thể chọn ảnh từ thiết bị: $e');
    }
  }
}
