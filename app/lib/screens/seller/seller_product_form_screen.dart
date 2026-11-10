import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../config/api_config.dart';
import '../../services/api_client.dart';
import '../../theme/portal_theme.dart';

const List<String> kImageRoles = [
  '1. Ảnh chính (Mặt trước - Đại diện)',
  '2. Góc bên cạnh / Phía sau',
  '3. Cận cảnh chi tiết sản phẩm',
  '4. Góc khác / Bối cảnh thực tế',
];

class FormProductImage {
  String url;
  String? dataUrl;
  String? sourcePageUrl;
  String? author;
  String? licenseName;
  String? licenseUrl;
  String? title;
  String? altText;
  bool isUploading;
  String? uploadError;

  FormProductImage({
    required this.url,
    this.dataUrl,
    this.sourcePageUrl,
    this.author,
    this.licenseName,
    this.licenseUrl,
    this.title,
    this.altText,
    this.isUploading = false,
    this.uploadError,
  });

  Map<String, dynamic> toApiPayload(String fallbackName) {
    final isUploaded = url.startsWith('/uploads/');
    return {
      'url': url,
      'altText': (altText != null && altText!.trim().isNotEmpty) ? altText!.trim() : fallbackName,
      if (!isUploaded) ...{
        'sourcePageUrl': sourcePageUrl ?? '',
        'author': (author != null && author!.trim().isNotEmpty) ? author!.trim() : 'Wikimedia Commons',
        'licenseName': (licenseName != null && licenseName!.trim().isNotEmpty) ? licenseName!.trim() : 'CC BY-SA 4.0',
        'licenseUrl': (licenseUrl != null && licenseUrl!.trim().isNotEmpty) ? licenseUrl!.trim() : 'https://creativecommons.org/licenses/by-sa/4.0/',
        'title': (title != null && title!.trim().isNotEmpty) ? title!.trim() : fallbackName,
      },
    };
  }
}

class SellerProductFormScreen extends StatefulWidget {
  final Map<String, dynamic>? initialProduct;
  final Map<String, dynamic>? shopInfo;
  final List<dynamic>? initialCategories;

  const SellerProductFormScreen({
    super.key,
    this.initialProduct,
    this.shopInfo,
    this.initialCategories,
  });

  @override
  State<SellerProductFormScreen> createState() => _SellerProductFormScreenState();
}

class _SellerProductFormScreenState extends State<SellerProductFormScreen> {
  final ApiClient _client = ApiClient();
  final ImagePicker _picker = ImagePicker();
  final NumberFormat _currencyFormat = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);

  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameController;
  late TextEditingController _priceController;
  late TextEditingController _originalPriceController;
  late TextEditingController _stockController;
  late TextEditingController _descriptionController;
  late TextEditingController _searchQueryController;

  String _selectedCategory = '';
  String _selectedStatus = 'draft';
  bool _freeShipping = false;

  List<FormProductImage> _images = [];
  List<Map<String, dynamic>> _categories = [];
  bool _loadingCategories = false;
  bool _saving = false;
  String? _errorMessage;

  // Commons search state
  bool _isSearchingCommons = false;
  List<Map<String, dynamic>> _commonsSearchResults = [];
  bool _showCommonsSearch = false;

  bool get _isEditing => widget.initialProduct != null;
  bool get _isShopSuspended => widget.shopInfo?['status'] == 'suspended';
  String? get _shopSuspensionReason => widget.shopInfo?['suspensionReason']?.toString() ?? widget.shopInfo?['suspension_reason']?.toString();
  String? get _rejectionReason => widget.initialProduct?['rejectionReason']?.toString() ?? widget.initialProduct?['rejection_reason']?.toString();
  bool get _isRejected => widget.initialProduct?['approvalStatus'] == 'rejected' || widget.initialProduct?['approval_status'] == 'rejected';

  @override
  void initState() {
    super.initState();
    final p = widget.initialProduct;

    _nameController = TextEditingController(text: p?['name']?.toString() ?? '');
    _priceController = TextEditingController(text: p?['price'] != null ? p!['price'].toString() : '');
    _originalPriceController = TextEditingController(
      text: p?['originalPrice'] != null && p!['originalPrice'] != ''
          ? p['originalPrice'].toString()
          : (p?['original_price'] != null ? p!['original_price'].toString() : ''),
    );
    _stockController = TextEditingController(
      text: (p?['stock'] ?? (p?['variants'] is List && (p!['variants'] as List).isNotEmpty ? p['variants'][0]['stock'] : 10)).toString(),
    );
    _descriptionController = TextEditingController(text: p?['description']?.toString() ?? '');
    _searchQueryController = TextEditingController();

    _freeShipping = p?['freeShipping'] == true || p?['freeship'] == true || p?['free_shipping'] == 1 || p?['free_shipping'] == true;

    final initialStatus = p?['status']?.toString();
    if (['draft', 'active', 'hidden'].contains(initialStatus)) {
      _selectedStatus = initialStatus!;
    } else {
      _selectedStatus = 'draft';
    }

    _selectedCategory = p?['categoryId']?.toString() ?? p?['categorySlug']?.toString() ?? p?['category_slug']?.toString() ?? '';

    // Initialize images
    if (p?['images'] is List) {
      final list = p!['images'] as List;
      for (final item in list) {
        if (item is Map) {
          final url = item['url']?.toString() ?? '';
          if (url.isNotEmpty) {
            _images.add(FormProductImage(
              url: url,
              sourcePageUrl: item['sourcePageUrl']?.toString() ?? item['source_page_url']?.toString(),
              author: item['author']?.toString(),
              licenseName: item['licenseName']?.toString() ?? item['license_name']?.toString(),
              licenseUrl: item['licenseUrl']?.toString() ?? item['license_url']?.toString(),
              title: item['title']?.toString(),
              altText: item['altText']?.toString() ?? item['alt_text']?.toString(),
            ));
          }
        } else if (item is String && item.isNotEmpty) {
          _images.add(FormProductImage(url: item));
        }
      }
    } else if (p?['imageUrl'] != null && p!['imageUrl'].toString().isNotEmpty) {
      _images.add(FormProductImage(url: p['imageUrl'].toString()));
    }

    if (widget.initialCategories != null && widget.initialCategories!.isNotEmpty) {
      _categories = widget.initialCategories!.map((c) => Map<String, dynamic>.from(c as Map)).toList();
      _ensureCategorySelected();
    } else {
      _loadCategories();
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _priceController.dispose();
    _originalPriceController.dispose();
    _stockController.dispose();
    _descriptionController.dispose();
    _searchQueryController.dispose();
    super.dispose();
  }

  void _ensureCategorySelected() {
    if (_selectedCategory.isEmpty && _categories.isNotEmpty) {
      setState(() {
        _selectedCategory = (_categories[0]['slug'] ?? _categories[0]['id']).toString();
      });
    } else if (_categories.isNotEmpty) {
      final exists = _categories.any((c) => (c['slug'] ?? c['id']).toString() == _selectedCategory);
      if (!exists) {
        setState(() {
          _selectedCategory = (_categories[0]['slug'] ?? _categories[0]['id']).toString();
        });
      }
    }
  }

  Future<void> _loadCategories() async {
    setState(() => _loadingCategories = true);
    final res = await _client.get('/api/v1/categories');
    if (!mounted) return;
    setState(() => _loadingCategories = false);

    if (res.success && res.data != null) {
      final dynamic raw = res.data is Map ? (res.data['categories'] ?? res.data) : res.data;
      if (raw is List) {
        setState(() {
          _categories = raw.map((c) => Map<String, dynamic>.from(c as Map)).toList();
          _ensureCategorySelected();
        });
      }
    }
  }

  String _formatImageUrl(String url) {
    if (url.startsWith('/uploads/')) {
      return '${ApiConfig.baseUrl}$url';
    }
    return url;
  }

  Future<void> _pickImages(ImageSource source) async {
    final remaining = 4 - _images.length;
    if (remaining <= 0) {
      _showToast('Đã có đủ 4 ảnh. Vui lòng xóa bớt ảnh trước khi thêm mới.', isError: true);
      return;
    }

    try {
      if (source == ImageSource.gallery && remaining > 1) {
        final List<XFile> pickedList = await _picker.pickMultiImage(
          maxWidth: 1600,
          maxHeight: 1600,
          imageQuality: 85,
        );
        if (pickedList.isEmpty) return;

        final toProcess = pickedList.take(remaining).toList();
        for (final xfile in toProcess) {
          await _uploadLocalImage(xfile);
        }
      } else {
        final XFile? picked = await _picker.pickImage(
          source: source,
          maxWidth: 1600,
          maxHeight: 1600,
          imageQuality: 85,
        );
        if (picked == null) return;
        await _uploadLocalImage(picked);
      }
    } catch (e) {
      _showToast('Không thể chọn ảnh: $e', isError: true);
    }
  }

  Future<void> _uploadLocalImage(XFile file) async {
    final bytes = await file.readAsBytes();
    if (bytes.length > 5 * 1024 * 1024) {
      _showToast('Ảnh quá lớn (tối đa 5 MB mỗi ảnh).', isError: true);
      return;
    }

    final ext = file.path.split('.').last.toLowerCase();
    final mime = ext == 'png' ? 'image/png' : (ext == 'webp' ? 'image/webp' : 'image/jpeg');
    final base64String = base64Encode(bytes);
    final dataUrl = 'data:$mime;base64,$base64String';

    final tempImage = FormProductImage(
      url: '',
      dataUrl: dataUrl,
      isUploading: true,
      altText: _nameController.text.trim(),
    );

    setState(() {
      _images.add(tempImage);
      _errorMessage = null;
    });

    try {
      final res = await _client.post(
        '/api/v1/uploads/images',
        body: {
          'dataUrl': dataUrl,
          'purpose': 'product',
        },
      );

      if (!mounted) return;

      if (res.success && res.data != null && res.data['url'] != null) {
        setState(() {
          tempImage.url = res.data['url'].toString();
          tempImage.isUploading = false;
        });
      } else {
        setState(() {
          tempImage.isUploading = false;
          tempImage.uploadError = res.message.isNotEmpty ? res.message : 'Lỗi tải ảnh lên máy chủ.';
        });
        _showToast(tempImage.uploadError!, isError: true);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        tempImage.isUploading = false;
        tempImage.uploadError = e.toString();
      });
      _showToast('Lỗi tải ảnh: $e', isError: true);
    }
  }

  Future<void> _searchCommonsImages() async {
    final query = _searchQueryController.text.trim().isNotEmpty
        ? _searchQueryController.text.trim()
        : _nameController.text.trim();

    if (query.length < 3) {
      _showToast('Vui lòng nhập từ khóa tìm kiếm tối thiểu 3 ký tự.', isError: true);
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _isSearchingCommons = true;
      _commonsSearchResults = [];
      _errorMessage = null;
    });

    final res = await _client.get('/api/v1/seller/images/search', queryParams: {'q': query});
    if (!mounted) return;

    setState(() => _isSearchingCommons = false);

    if (res.success && res.data != null && res.data['images'] is List) {
      final list = (res.data['images'] as List).map((i) => Map<String, dynamic>.from(i as Map)).toList();
      setState(() {
        _commonsSearchResults = list;
      });
      if (list.isEmpty) {
        _showToast('Không tìm thấy ảnh phù hợp có giấy phép thương mại.', isError: false);
      }
    } else {
      _showToast(res.message.isNotEmpty ? res.message : 'Không thể tìm ảnh Commons.', isError: true);
    }
  }

  void _selectCommonsImage(Map<String, dynamic> item) {
    if (_images.length >= 4) {
      _showToast('Đã đủ 4 ảnh. Vui lòng xóa bớt ảnh trước khi thêm.', isError: true);
      return;
    }

    final url = item['url']?.toString() ?? '';
    final sourcePageUrl = item['sourcePageUrl']?.toString() ?? '';

    if (_images.any((img) => img.url == url || (img.sourcePageUrl != null && img.sourcePageUrl == sourcePageUrl))) {
      _showToast('Ảnh này đã được chọn.', isError: true);
      return;
    }

    setState(() {
      _images.add(FormProductImage(
        url: url,
        sourcePageUrl: sourcePageUrl,
        author: item['author']?.toString() ?? 'Wikimedia Commons',
        licenseName: item['licenseName']?.toString() ?? 'CC BY-SA',
        licenseUrl: item['licenseUrl']?.toString() ?? 'https://creativecommons.org/',
        title: item['title']?.toString(),
        altText: _nameController.text.trim().isNotEmpty ? _nameController.text.trim() : item['title']?.toString(),
      ));
      _errorMessage = null;
    });

    _showToast('Đã chọn ảnh thành công!');
  }

  void _addManualUrlDialog() {
    if (_images.length >= 4) {
      _showToast('Đã đủ 4 ảnh. Vui lòng xóa bớt ảnh trước khi thêm.', isError: true);
      return;
    }

    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: SellerTheme.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Nhập link ảnh trực tiếp', style: TextStyle(fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(
            hintText: 'https://...',
            labelText: 'URL ảnh (HTTPS)',
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          ElevatedButton(
            onPressed: () {
              final text = ctrl.text.trim();
              if (text.startsWith('http://') || text.startsWith('https://')) {
                setState(() {
                  _images.add(FormProductImage(url: text));
                });
                Navigator.pop(ctx);
              } else {
                _showToast('URL ảnh phải bắt đầu bằng https:// hoặc http://', isError: true);
              }
            },
            child: const Text('Thêm ảnh'),
          ),
        ],
      ),
    );
  }

  void _removeImage(int index) {
    setState(() {
      _images.removeAt(index);
    });
  }

  void _showImageSourcePicker() {
    final remaining = 4 - _images.length;
    if (remaining <= 0) {
      _showToast('Đã đủ 4 ảnh theo quy chuẩn.', isError: true);
      return;
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: SellerTheme.card,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Text(
                'Thêm ảnh sản phẩm (còn thiếu $remaining ảnh)',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: SellerTheme.textPrimary),
              ),
            ),
            const Divider(color: SellerTheme.border),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined, color: SellerTheme.primary),
              title: const Text('Chọn từ Thư viện ảnh (Gallery)', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('Tự động tải lên máy chủ ShopNova', style: TextStyle(fontSize: 12, color: SellerTheme.textSecondary)),
              onTap: () {
                Navigator.pop(ctx);
                _pickImages(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined, color: SellerTheme.primary),
              title: const Text('Chụp ảnh mới bằng Camera', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('Chụp góc thật của sản phẩm', style: TextStyle(fontSize: 12, color: SellerTheme.textSecondary)),
              onTap: () {
                Navigator.pop(ctx);
                _pickImages(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.travel_explore_rounded, color: SellerTheme.primary),
              title: const Text('Tìm ảnh Wikimedia Commons chuẩn bản quyền', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('Kho ảnh miễn phí thương mại CC BY-SA, CC0', style: TextStyle(fontSize: 12, color: SellerTheme.textSecondary)),
              onTap: () {
                Navigator.pop(ctx);
                setState(() => _showCommonsSearch = true);
              },
            ),
            ListTile(
              leading: const Icon(Icons.link_rounded, color: SellerTheme.textSecondary),
              title: const Text('Nhập liên kết ảnh trực tiếp (URL)', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('Link ảnh công khai https://', style: TextStyle(fontSize: 12, color: SellerTheme.textSecondary)),
              onTap: () {
                Navigator.pop(ctx);
                _addManualUrlDialog();
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showToast(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? SellerTheme.danger : SellerTheme.success,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _submitForm() async {
    if (_isShopSuspended) {
      _showToast('Gian hàng đang bị tạm khóa. Không thể đăng hoặc lưu sản phẩm.', isError: true);
      return;
    }

    final name = _nameController.text.trim();
    final price = int.tryParse(_priceController.text.trim().replaceAll('.', '').replaceAll(',', '')) ?? 0;
    final origPriceText = _originalPriceController.text.trim().replaceAll('.', '').replaceAll(',', '');
    final originalPrice = origPriceText.isNotEmpty ? int.tryParse(origPriceText) : null;
    final stock = int.tryParse(_stockController.text.trim()) ?? 0;
    final description = _descriptionController.text.trim();

    // Validations
    if (name.isEmpty || name.length < 5) {
      setState(() => _errorMessage = 'Vui lòng nhập tên sản phẩm (tối thiểu 5 ký tự).');
      return;
    }
    if (_selectedCategory.isEmpty) {
      setState(() => _errorMessage = 'Vui lòng chọn ngành hàng sản phẩm.');
      return;
    }
    if (price <= 0) {
      setState(() => _errorMessage = 'Giá bán phải là số nguyên dương lớn hơn 0.');
      return;
    }
    if (originalPrice != null && originalPrice < price) {
      setState(() => _errorMessage = 'Giá gốc niêm yết phải lớn hơn hoặc bằng giá bán.');
      return;
    }
    if (stock < 0) {
      setState(() => _errorMessage = 'Số lượng tồn kho không được âm.');
      return;
    }
    if (description.isEmpty) {
      setState(() => _errorMessage = 'Vui lòng nhập mô tả chi tiết sản phẩm.');
      return;
    }

    // Exact 4 images rule matching website
    if (_images.length != 4) {
      setState(() => _errorMessage = 'Sản phẩm bắt buộc phải có đúng 4 ảnh góc chụp thực tế. Hiện tại có ${_images.length}/4 ảnh.');
      return;
    }

    if (_images.any((img) => img.isUploading)) {
      setState(() => _errorMessage = 'Đang có ảnh đang tải lên, vui lòng đợi hoàn tất.');
      return;
    }

    if (_images.any((img) => img.url.isEmpty)) {
      setState(() => _errorMessage = 'Có ảnh bị lỗi tải lên. Vui lòng xóa và chọn lại ảnh khác.');
      return;
    }

    setState(() {
      _saving = true;
      _errorMessage = null;
    });

    final payloadImages = _images.map((img) => img.toApiPayload(name)).toList();

    final body = {
      'name': name,
      'categoryId': _selectedCategory,
      'price': price,
      if (originalPrice != null) 'originalPrice': originalPrice,
      'stock': stock,
      'description': description,
      'status': _selectedStatus,
      'freeShipping': _freeShipping,
      'images': payloadImages,
    };

    final productId = widget.initialProduct?['id']?.toString();
    final res = productId != null
        ? await _client.put('/api/v1/seller/products/$productId', body: body)
        : await _client.post('/api/v1/seller/products', body: body);

    if (!mounted) return;

    setState(() => _saving = false);

    if (res.success) {
      _showToast(productId != null ? 'Cập nhật sản phẩm thành công!' : 'Đã đăng sản phẩm mới thành công!');
      Navigator.pop(context, true);
    } else {
      final msg = res.message.isNotEmpty ? res.message : 'Lỗi khi lưu sản phẩm lên máy chủ.';
      setState(() => _errorMessage = msg);
      _showToast(msg, isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final previewPrice = int.tryParse(_priceController.text.trim().replaceAll('.', '').replaceAll(',', '')) ?? 0;
    final previewOrigPrice = int.tryParse(_originalPriceController.text.trim().replaceAll('.', '').replaceAll(',', '')) ?? 0;
    final discount = (previewOrigPrice > previewPrice && previewOrigPrice > 0)
        ? ((previewOrigPrice - previewPrice) / previewOrigPrice * 100).round()
        : 0;

    return Theme(
      data: SellerTheme.lightTheme,
      child: Scaffold(
      backgroundColor: SellerTheme.background,
      appBar: AppBar(
        title: Text(
          _isEditing ? 'Chỉnh Sửa Sản Phẩm' : 'Đăng Sản Phẩm Mới',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17, color: SellerTheme.textPrimary),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: ElevatedButton(
              onPressed: (_saving || _isShopSuspended) ? null : _submitForm,
              style: ElevatedButton.styleFrom(
                backgroundColor: SellerTheme.primary,
                foregroundColor: SellerTheme.card,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : Text(
                      _isEditing ? 'Lưu thay đổi' : 'Đăng bán',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
            ),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Shop Suspended Warning
            if (_isShopSuspended) ...[
              _buildSuspendedBanner(),
              const SizedBox(height: 16),
            ],

            // Admin Rejected Banner
            if (_isRejected) ...[
              _buildRejectedBanner(),
              const SizedBox(height: 16),
            ],

            // Error Message Banner
            if (_errorMessage != null) ...[
              _buildErrorBanner(_errorMessage!),
              const SizedBox(height: 16),
            ],

            // Section 1: 4-Slot Real Images
            _buildImageSection(),
            const SizedBox(height: 16),

            // Commons Search Section (if expanded)
            if (_showCommonsSearch) ...[
              _buildCommonsSearchSection(),
              const SizedBox(height: 16),
            ],

            // Section 2: Basic Info
            _buildBasicInfoSection(),
            const SizedBox(height: 16),

            // Section 3: Pricing & Inventory
            _buildPricingSection(),
            const SizedBox(height: 16),

            // Section 4: Shipping & Status
            _buildShippingAndStatusSection(),
            const SizedBox(height: 16),

            // Section 5: Live Market Preview
            _buildLivePreviewSection(previewPrice, previewOrigPrice, discount),
            const SizedBox(height: 32),

            // Big Save Button at bottom
            SizedBox(
              height: 50,
              child: ElevatedButton.icon(
                icon: _saving
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.cloud_upload_outlined, size: 20),
                label: Text(
                  _saving ? 'Đang gửi dữ liệu...' : (_isEditing ? 'LƯU THAY ĐỔI SẢN PHẨM' : 'ĐĂNG BÁN SẢN PHẨM NGAY'),
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                ),
                onPressed: (_saving || _isShopSuspended) ? null : _submitForm,
                style: ElevatedButton.styleFrom(
                  backgroundColor: SellerTheme.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
      ),
    );
  }

  Widget _buildSuspendedBanner() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.red.shade200),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Colors.red.shade800, size: 20),
              const SizedBox(width: 8),
              Text(
                'Gian hàng của bạn hiện đang bị tạm khóa',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.red.shade900),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Lý do: ${_shopSuspensionReason ?? "Vi phạm chính sách sàn hoặc tiêu chuẩn cộng đồng."}',
            style: TextStyle(fontSize: 12.5, color: Colors.red.shade800),
          ),
          const SizedBox(height: 4),
          Text(
            'Tính năng đăng và cập nhật sản phẩm tạm thời bị hạn chế. Vui lòng liên hệ Quản trị viên để được hỗ trợ.',
            style: TextStyle(fontSize: 11.5, color: Colors.red.shade700),
          ),
        ],
      ),
    );
  }

  Widget _buildRejectedBanner() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.orange.shade200),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.cancel_outlined, color: Colors.orange.shade900, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Sản phẩm đã bị Ban Quản Trị từ chối kiểm duyệt',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: Colors.orange.shade900),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Lý do từ chối: ${_rejectionReason ?? "Vui lòng cập nhật lại thông tin và hình ảnh phù hợp chính sách sàn."}',
            style: TextStyle(fontSize: 12.5, color: Colors.orange.shade900),
          ),
          const SizedBox(height: 6),
          Text(
            '💡 Ghi chú: Khi bạn thực hiện chỉnh sửa và nhấn "Lưu thay đổi", hệ thống sẽ tự động chuyển sản phẩm về trạng thái "Chờ duyệt" để Admin kiểm tra lại.',
            style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Colors.orange.shade800),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorBanner(String error) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFDE8E8),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF8B4B4)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: SellerTheme.danger, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(error, style: const TextStyle(fontSize: 12.5, color: SellerTheme.danger, fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }

  Widget _buildImageSection() {
    return Container(
      decoration: BoxDecoration(
        color: SellerTheme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: SellerTheme.border),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Hình ảnh sản phẩm (${_images.length}/4)',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary),
              ),
              if (_images.length < 4)
                TextButton.icon(
                  onPressed: _showImageSourcePicker,
                  icon: const Icon(Icons.add_photo_alternate_outlined, size: 16),
                  label: const Text('Thêm ảnh', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold)),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFFF5E7D4),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: SellerTheme.border),
            ),
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text(
                  'Quy định chuẩn 4 góc chụp thật:',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11.5, color: Color(0xFFA95532)),
                ),
                SizedBox(height: 3),
                Text(
                  '• Mỗi sản phẩm phải có đúng 4 ảnh góc chụp thực tế.\n• Vị trí 1: Ảnh chính mặt trước. Vị trí 2: Góc nghiêng/sau. Vị trí 3: Cận cảnh chi tiết. Vị trí 4: Bối cảnh thực tế.',
                  style: TextStyle(fontSize: 11, color: SellerTheme.textSecondary, height: 1.3),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // 4 image slots grid
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: 4,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 0.95,
            ),
            itemBuilder: (ctx, index) {
              if (index < _images.length) {
                return _buildFilledImageSlot(index);
              } else {
                return _buildEmptyImageSlot(index);
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _buildFilledImageSlot(int index) {
    final image = _images[index];
    final displayUrl = _formatImageUrl(image.url);

    return Container(
      decoration: BoxDecoration(
        color: SellerTheme.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: SellerTheme.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (image.isUploading)
                  const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        CircularProgressIndicator(strokeWidth: 2, color: SellerTheme.primary),
                        SizedBox(height: 6),
                        Text('Đang tải lên...', style: TextStyle(fontSize: 11, color: SellerTheme.textSecondary)),
                      ],
                    ),
                  )
                else if (image.dataUrl != null && image.dataUrl!.startsWith('data:image'))
                  Image.memory(
                    base64Decode(image.dataUrl!.split(',').last),
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const Center(child: Icon(Icons.broken_image, color: Colors.grey)),
                  )
                else
                  Image.network(
                    displayUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const Center(
                      child: Text('Lỗi tải ảnh', style: TextStyle(fontSize: 11, color: Colors.red)),
                    ),
                  ),

                // Delete button
                Positioned(
                  top: 4,
                  right: 4,
                  child: InkWell(
                    onTap: () => _removeImage(index),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.9),
                        borderRadius: BorderRadius.circular(6),
                        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4)],
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.close, size: 12, color: Colors.red),
                          SizedBox(width: 2),
                          Text('Xóa', style: TextStyle(fontSize: 10, color: Colors.red, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                ),

                // Cover badge for index 0
                if (index == 0)
                  Positioned(
                    top: 4,
                    left: 4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                      decoration: BoxDecoration(
                        color: SellerTheme.primary,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text('Ảnh đại diện', style: TextStyle(fontSize: 9.5, color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ),
              ],
            ),
          ),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 6),
            color: const Color(0xFFF5E7D4),
            child: Text(
              kImageRoles[index],
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: SellerTheme.textSecondary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyImageSlot(int index) {
    return InkWell(
      onTap: _showImageSourcePicker,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFFFBF3E8),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: SellerTheme.primary.withOpacity(0.4),
            style: BorderStyle.solid,
            width: 1.5,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add_photo_alternate_outlined, size: 28, color: SellerTheme.primary.withOpacity(0.8)),
            const SizedBox(height: 6),
            Text(
              '+ Thêm ảnh vị trí ${index + 1}',
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: SellerTheme.primary),
            ),
            const SizedBox(height: 2),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Text(
                kImageRoles[index],
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 9.5, color: SellerTheme.textSecondary),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCommonsSearchSection() {
    return Container(
      decoration: BoxDecoration(
        color: SellerTheme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: SellerTheme.border),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.travel_explore_rounded, color: SellerTheme.primary, size: 18),
                  SizedBox(width: 6),
                  Text('Tìm ảnh Wikimedia Commons', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: SellerTheme.textPrimary)),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.close, size: 18, color: SellerTheme.textSecondary),
                onPressed: () => setState(() => _showCommonsSearch = false),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Nhập tên sản phẩm để tìm kiếm kho ảnh chuẩn bản quyền thương mại (CC BY, CC0):',
            style: TextStyle(fontSize: 11.5, color: SellerTheme.textSecondary),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchQueryController,
                  decoration: InputDecoration(
                    hintText: _nameController.text.trim().isNotEmpty ? _nameController.text.trim() : 'Từ khóa tìm kiếm ảnh...',
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: _isSearchingCommons ? null : _searchCommonsImages,
                style: ElevatedButton.styleFrom(
                  backgroundColor: SellerTheme.primary,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  minimumSize: Size.zero,
                ),
                child: _isSearchingCommons
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Tìm ảnh', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              ),
            ],
          ),

          if (_commonsSearchResults.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text('Kết quả (${_commonsSearchResults.length} ảnh):', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: SellerTheme.textPrimary)),
            const SizedBox(height: 8),
            SizedBox(
              height: 190,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _commonsSearchResults.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (ctx, idx) {
                  final item = _commonsSearchResults[idx];
                  final url = item['url']?.toString() ?? '';
                  final title = item['title']?.toString() ?? '';
                  final isChosen = _images.any((img) => img.url == url);

                  return Container(
                    width: 130,
                    decoration: BoxDecoration(
                      color: SellerTheme.background,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: SellerTheme.border),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Image.network(
                            url,
                            width: double.infinity,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const Center(child: Icon(Icons.broken_image, size: 20, color: Colors.grey)),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(6),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                title,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary),
                              ),
                              const SizedBox(height: 4),
                              SizedBox(
                                width: double.infinity,
                                height: 26,
                                child: OutlinedButton(
                                  style: OutlinedButton.styleFrom(
                                    padding: EdgeInsets.zero,
                                    side: BorderSide(color: isChosen ? Colors.grey : SellerTheme.primary),
                                  ),
                                  onPressed: isChosen ? null : () => _selectCommonsImage(item),
                                  child: Text(
                                    isChosen ? 'Đã chọn' : 'Chọn ảnh',
                                    style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: isChosen ? Colors.grey : SellerTheme.primary),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBasicInfoSection() {
    return Container(
      decoration: BoxDecoration(
        color: SellerTheme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: SellerTheme.border),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Thông tin cơ bản sản phẩm', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
          const SizedBox(height: 12),

          // Tên sản phẩm
          TextField(
            controller: _nameController,
            maxLength: 200,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'Tên sản phẩm *',
              hintText: 'Ví dụ: Áo sơ mi nam Oxford cao cấp form regular fit',
            ),
          ),
          const SizedBox(height: 12),

          // Ngành hàng Dropdown
          if (_loadingCategories)
            const Center(child: Padding(padding: EdgeInsets.all(8), child: CircularProgressIndicator(strokeWidth: 2)))
          else
            DropdownButtonFormField<String>(
              value: _categories.any((c) => (c['slug'] ?? c['id']).toString() == _selectedCategory)
                  ? _selectedCategory
                  : (_categories.isNotEmpty ? (_categories[0]['slug'] ?? _categories[0]['id']).toString() : null),
              decoration: const InputDecoration(labelText: 'Ngành hàng *'),
              items: _categories.map((c) {
                final id = (c['slug'] ?? c['id']).toString();
                final name = c['name']?.toString() ?? id;
                return DropdownMenuItem<String>(
                  value: id,
                  child: Text(name, style: const TextStyle(fontSize: 13, color: SellerTheme.textPrimary)),
                );
              }).toList(),
              onChanged: (val) {
                if (val != null) setState(() => _selectedCategory = val);
              },
            ),
          const SizedBox(height: 14),

          // Mô tả chi tiết
          TextField(
            controller: _descriptionController,
            maxLines: 5,
            maxLength: 10000,
            decoration: const InputDecoration(
              labelText: 'Mô tả chi tiết sản phẩm *',
              hintText: 'Mô tả chất liệu, kiểu dáng, hướng dẫn chọn size, bảo hành và chính sách đổi trả...',
              alignLabelWithHint: true,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPricingSection() {
    return Container(
      decoration: BoxDecoration(
        color: SellerTheme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: SellerTheme.border),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Giá bán & Kho hàng', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _priceController,
                  keyboardType: TextInputType.number,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    labelText: 'Giá bán (₫) *',
                    hintText: '199000',
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _originalPriceController,
                  keyboardType: TextInputType.number,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    labelText: 'Giá gốc niêm yết (₫)',
                    hintText: '250000',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          TextField(
            controller: _stockController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Số lượng tồn kho *',
              hintText: '50',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildShippingAndStatusSection() {
    return Container(
      decoration: BoxDecoration(
        color: SellerTheme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: SellerTheme.border),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Cài đặt vận chuyển & Hiển thị', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
          const SizedBox(height: 12),

          // Freeship Switch
          Material(
            color: Colors.transparent,
            child: SwitchListTile(
              contentPadding: EdgeInsets.zero,
              activeColor: SellerTheme.primary,
              title: const Text('Miễn phí vận chuyển (Freeship)', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: SellerTheme.textPrimary)),
              subtitle: const Text('Gắn huy hiệu Freeship thu hút thêm khách hàng mua sắm', style: TextStyle(fontSize: 11.5, color: SellerTheme.textSecondary)),
              value: _freeShipping,
              onChanged: (val) => setState(() => _freeShipping = val),
            ),
          ),
          const Divider(color: SellerTheme.border),
          const SizedBox(height: 6),

          // Trạng thái hiển thị Dropdown
          DropdownButtonFormField<String>(
            value: _selectedStatus,
            decoration: const InputDecoration(
              labelText: 'Trạng thái hiển thị',
            ),
            items: [
              if (_isEditing && widget.initialProduct?['status'] == 'active')
                const DropdownMenuItem(value: 'active', child: Text('Đang bán')),
              const DropdownMenuItem(value: 'draft', child: Text('Bản nháp')),
              const DropdownMenuItem(value: 'hidden', child: Text('Ẩn khỏi trang mua sắm')),
            ],
            onChanged: (val) {
              if (val != null) setState(() => _selectedStatus = val);
            },
          ),
          const SizedBox(height: 4),
          const Text(
            'Sản phẩm mới sau khi lưu sẽ được gửi đến Quản trị viên duyệt trước khi hiển thị công khai trên sàn.',
            style: TextStyle(fontSize: 11, color: SellerTheme.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildLivePreviewSection(int price, int origPrice, int discount) {
    final name = _nameController.text.trim().isNotEmpty ? _nameController.text.trim() : 'Tên sản phẩm của bạn';
    final hasImage = _images.isNotEmpty;
    final coverImage = hasImage ? _images[0] : null;

    return Container(
      decoration: BoxDecoration(
        color: SellerTheme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: SellerTheme.border),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.remove_red_eye_outlined, color: SellerTheme.primary, size: 18),
              SizedBox(width: 6),
              Text('Xem trước trên sàn NovaShop', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
            ],
          ),
          const SizedBox(height: 12),

          Container(
            decoration: BoxDecoration(
              color: SellerTheme.background,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: SellerTheme.border),
            ),
            clipBehavior: Clip.antiAlias,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Product cover image preview
                Container(
                  width: 110,
                  height: 110,
                  color: const Color(0xFFF0E5D8),
                  child: coverImage != null
                      ? (coverImage.dataUrl != null && coverImage.dataUrl!.startsWith('data:image')
                          ? Image.memory(base64Decode(coverImage.dataUrl!.split(',').last), fit: BoxFit.cover)
                          : Image.network(_formatImageUrl(coverImage.url), fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Center(child: Icon(Icons.broken_image, size: 24, color: Colors.grey))))
                      : const Center(child: Text('Chưa có ảnh', style: TextStyle(fontSize: 11, color: SellerTheme.textSecondary))),
                ),

                // Product details preview
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: SellerTheme.textPrimary),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Text(
                              _currencyFormat.format(price),
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: SellerTheme.primary),
                            ),
                            if (origPrice > price) ...[
                              const SizedBox(width: 6),
                              Text(
                                _currencyFormat.format(origPrice),
                                style: const TextStyle(fontSize: 11, color: SellerTheme.textSecondary, decoration: TextDecoration.lineThrough),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            if (discount > 0)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                decoration: BoxDecoration(color: Colors.red.shade100, borderRadius: BorderRadius.circular(4)),
                                child: Text('-$discount%', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.red.shade800)),
                              ),
                            if (discount > 0 && _freeShipping) const SizedBox(width: 4),
                            if (_freeShipping)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                decoration: BoxDecoration(color: Colors.green.shade100, borderRadius: BorderRadius.circular(4)),
                                child: Text('FREESHIP', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.green.shade800)),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
