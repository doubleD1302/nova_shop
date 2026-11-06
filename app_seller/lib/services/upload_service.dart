import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'api_client.dart';

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

class UploadService {
  static final UploadService _instance = UploadService._internal();
  factory UploadService() => _instance;
  UploadService._internal();

  final ApiClient _client = ApiClient();
  final ImagePicker _picker = ImagePicker();

  static const Map<String, int> imageLimits = {
    'avatar': 1 * 1024 * 1024,      // 1 MiB
    'review': 2 * 1024 * 1024,      // 2 MiB
    'product': 5 * 1024 * 1024,     // 5 MiB
    'shop': 5 * 1024 * 1024,        // 5 MiB
  };

  static const List<String> allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

  static const List<String> forbiddenExtensions = [
    '.svg', '.exe', '.php', '.sh', '.html', '.htm', '.js', '.bat', '.cmd', '.gif'
  ];

  static String? verifyMagicBytesAndGetMime(Uint8List bytes) {
    if (bytes.isEmpty) return null;

    if (bytes.length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) {
      return 'image/jpeg';
    }

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

    if (bytes.length >= 12) {
      final riff = String.fromCharCodes(bytes.sublist(0, 4));
      final webp = String.fromCharCodes(bytes.sublist(8, 12));
      if (riff == 'RIFF' && webp == 'WEBP') {
        return 'image/webp';
      }
    }

    return null;
  }

  Future<UploadResult> uploadBytes({
    required Uint8List bytes,
    required String fileName,
    required String purpose,
  }) async {
    if (bytes.isEmpty) {
      return UploadResult.fail('Ảnh không được rỗng (0 byte). Vui lòng chọn ảnh hợp lệ.');
    }

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

    final detectedMime = verifyMagicBytesAndGetMime(bytes);
    if (detectedMime == null) {
      return UploadResult.fail('File không phải là định dạng hình ảnh hợp lệ hoặc đã bị đổi đuôi file trái phép.');
    }

    final limit = imageLimits[purpose] ?? (5 * 1024 * 1024);
    if (bytes.length > limit) {
      final limitMb = (limit / (1024 * 1024)).toStringAsFixed(0);
      return UploadResult.fail('Dung lượng ảnh vượt quá giới hạn ($limitMb MiB cho $purpose).');
    }

    final base64Data = base64Encode(bytes);
    final dataUrl = 'data:$detectedMime;base64,$base64Data';

    return uploadDataUrl(dataUrl: dataUrl, purpose: purpose);
  }

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
      return UploadResult.fail('Lỗi kết nối khi tải ảnh: $e');
    }
  }

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
        return null;
      }

      final bytes = await file.readAsBytes();
      return await uploadBytes(
        bytes: bytes,
        fileName: file.name,
        purpose: purpose,
      );
    } catch (e) {
      return UploadResult.fail('Không thể chọn ảnh từ thiết bị: $e');
    }
  }
}

