import 'package:flutter/material.dart';
import '../../models/address.dart';
import '../../services/address_service.dart';

/// Màn hình Quản Lý Sổ Địa Chỉ Nhận Hàng (Kết nối trực tiếp Backend API)
class AddressesScreen extends StatefulWidget {
  final bool selectMode; // Nếu true, cho phép bấm chọn địa chỉ để quay về trang Checkout

  const AddressesScreen({super.key, this.selectMode = false});

  @override
  State<AddressesScreen> createState() => _AddressesScreenState();
}

class _AddressesScreenState extends State<AddressesScreen> {
  final Color primaryColor = const Color(0xFFEE4D2D);
  final AddressService _addressService = AddressService();

  List<Address> _addresses = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadAddresses();
  }

  Future<void> _loadAddresses() async {
    setState(() => _isLoading = true);
    try {
      final list = await _addressService.getAddresses();
      if (mounted) {
        setState(() {
          _addresses = list;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _setDefault(Address addr) async {
    final success = await _addressService.setDefaultAddress(addr.id);
    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã đặt làm địa chỉ mặc định.')),
      );
      _loadAddresses();
    }
  }

  Future<void> _delete(Address addr) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xác nhận xóa'),
        content: Text('Bạn có chắc muốn xóa địa chỉ của "${addr.recipientName}" không?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: primaryColor),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Xóa', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final success = await _addressService.deleteAddress(addr.id);
      if (success && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã xóa địa chỉ thành công.')),
        );
        _loadAddresses();
      }
    }
  }

  void _showAddAddressDialog() {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final provinceCtrl = TextEditingController(text: 'TP. Hồ Chí Minh');
    final districtCtrl = TextEditingController();
    final wardCtrl = TextEditingController();
    final detailCtrl = TextEditingController();
    bool isDefault = _addresses.isEmpty;
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Thêm địa chỉ nhận hàng mới',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () => Navigator.pop(ctx),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: nameCtrl,
                      decoration: InputDecoration(
                        labelText: 'Họ và tên người nhận *',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: phoneCtrl,
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        labelText: 'Số điện thoại *',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: provinceCtrl,
                      decoration: InputDecoration(
                        labelText: 'Tỉnh / Thành phố *',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: districtCtrl,
                            decoration: InputDecoration(
                              labelText: 'Quận / Huyện',
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: wardCtrl,
                            decoration: InputDecoration(
                              labelText: 'Phường / Xã',
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: detailCtrl,
                      maxLines: 2,
                      decoration: InputDecoration(
                        labelText: 'Địa chỉ chi tiết (số nhà, tên đường) *',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    const SizedBox(height: 8),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Đặt làm địa chỉ mặc định', style: TextStyle(fontSize: 14)),
                      value: isDefault,
                      activeColor: primaryColor,
                      onChanged: (val) => setModalState(() => isDefault = val),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primaryColor,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        onPressed: isSubmitting
                            ? null
                            : () async {
                                final name = nameCtrl.text.trim();
                                final phone = phoneCtrl.text.trim();
                                final prov = provinceCtrl.text.trim();
                                final detail = detailCtrl.text.trim();

                                if (name.isEmpty || phone.isEmpty || prov.isEmpty || detail.isEmpty) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Vui lòng điền đủ các trường có dấu *')),
                                  );
                                  return;
                                }

                                setModalState(() => isSubmitting = true);
                                final result = await _addressService.createAddress(
                                  recipientName: name,
                                  phone: phone,
                                  province: prov,
                                  district: districtCtrl.text.trim().isNotEmpty ? districtCtrl.text.trim() : null,
                                  ward: wardCtrl.text.trim().isNotEmpty ? wardCtrl.text.trim() : null,
                                  detail: detail,
                                  isDefault: isDefault,
                                );
                                setModalState(() => isSubmitting = false);

                                if (result != null && mounted) {
                                  Navigator.pop(ctx);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Đã thêm địa chỉ nhận hàng thành công!'), backgroundColor: Colors.green),
                                  );
                                  _loadAddresses();
                                }
                              },
                        child: isSubmitting
                            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : const Text('Lưu Địa Chỉ', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          widget.selectMode ? 'Chọn Địa Chỉ Nhận Hàng' : 'Sổ Địa Chỉ Của Tôi',
          style: const TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 17),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _addresses.isEmpty
              ? _buildEmptyState()
              : RefreshIndicator(
                  onRefresh: _loadAddresses,
                  color: primaryColor,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: _addresses.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (ctx, index) {
                      final addr = _addresses[index];
                      return _buildAddressCard(addr);
                    },
                  ),
                ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(12),
        color: Colors.white,
        child: SafeArea(
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: primaryColor,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            icon: const Icon(Icons.add),
            label: const Text('Thêm Địa Chỉ Mới', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            onPressed: _showAddAddressDialog,
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.location_off_outlined, size: 72, color: Colors.grey.shade400),
          const SizedBox(height: 14),
          const Text(
            'Chưa có địa chỉ nhận hàng nào',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.black87),
          ),
          const SizedBox(height: 6),
          Text(
            'Thêm địa chỉ để đặt hàng nhanh chóng và tiện lợi',
            style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
          ),
        ],
      ),
    );
  }

  Widget _buildAddressCard(Address addr) {
    return InkWell(
      onTap: widget.selectMode ? () => Navigator.pop(context, addr) : null,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: addr.isDefault ? primaryColor : Colors.grey.shade200,
            width: addr.isDefault ? 1.5 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  addr.recipientName,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                ),
                const SizedBox(width: 8),
                Text(
                  '|  ${addr.phone}',
                  style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
                ),
                const Spacer(),
                if (addr.isDefault)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: primaryColor.withValues(alpha: 0.1),
                      border: Border.all(color: primaryColor, width: 0.8),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      'Mặc định',
                      style: TextStyle(color: primaryColor, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              addr.fullAddress,
              style: TextStyle(fontSize: 13, color: Colors.grey.shade800, height: 1.3),
            ),
            const Divider(height: 20),
            Row(
              children: [
                if (!addr.isDefault)
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      minimumSize: const Size(0, 30),
                    ),
                    onPressed: () => _setDefault(addr),
                    child: const Text('Thiết lập mặc định', style: TextStyle(fontSize: 12, color: Colors.black87)),
                  ),
                const Spacer(),
                IconButton(
                  tooltip: 'Xóa địa chỉ',
                  icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
                  onPressed: () => _delete(addr),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
