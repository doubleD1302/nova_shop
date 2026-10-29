import 'package:flutter/material.dart';
import '../../models/address.dart';
import '../../services/address_service.dart';
import '../../theme/app_colors.dart';

/// Màn hình Quản Lý Sổ Địa Chỉ Nhận Hàng (Kết nối trực tiếp Backend API)
class AddressesScreen extends StatefulWidget {
  final bool selectMode;

  const AddressesScreen({super.key, this.selectMode = false});

  @override
  State<AddressesScreen> createState() => _AddressesScreenState();
}

class _AddressesScreenState extends State<AddressesScreen> {
  final Color primaryColor = AppColors.primary;
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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Xác nhận xóa', style: TextStyle(fontWeight: FontWeight.bold)),
        content: Text('Bạn có chắc muốn xóa địa chỉ của "${addr.recipientName}" không?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy', style: TextStyle(color: Colors.grey))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: primaryColor,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Xóa', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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
                          icon: const Icon(Icons.close_rounded),
                          onPressed: () => Navigator.pop(ctx),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: nameCtrl,
                      decoration: InputDecoration(
                        labelText: 'Họ và tên người nhận *',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: phoneCtrl,
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        labelText: 'Số điện thoại *',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: provinceCtrl,
                      decoration: InputDecoration(
                        labelText: 'Tỉnh / Thành phố *',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
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
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: wardCtrl,
                            decoration: InputDecoration(
                              labelText: 'Phường / Xã',
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
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
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
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
                    Container(
                      width: double.infinity,
                      height: 50,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [AppColors.primary, AppColors.earth],
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
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
                                    const SnackBar(content: Text('Đã thêm địa chỉ nhận hàng thành công!'), backgroundColor: Color(0xFF00BFA5)),
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
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: AppColors.border, height: 1),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1E2022), size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          widget.selectMode ? 'Chọn Địa Chỉ Nhận Hàng' : 'Sổ Địa Chỉ Của Tôi',
          style: const TextStyle(color: Color(0xFF1E2022), fontWeight: FontWeight.w700, fontSize: 17),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _addresses.isEmpty
              ? _buildEmptyState()
              : RefreshIndicator(
                  onRefresh: _loadAddresses,
                  color: primaryColor,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    itemCount: _addresses.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (ctx, index) {
                      final addr = _addresses[index];
                      return _buildAddressCard(addr);
                    },
                  ),
                ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          boxShadow: [
            BoxShadow(color: Color(0x0C000000), blurRadius: 10, offset: Offset(0, -3)),
          ],
        ),
        child: SafeArea(
          child: Container(
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primary, AppColors.earth],
              ),
              borderRadius: BorderRadius.circular(10),
              boxShadow: [
                BoxShadow(color: primaryColor.withOpacity(0.3), blurRadius: 8, offset: const Offset(0, 3)),
              ],
            ),
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.transparent,
                shadowColor: Colors.transparent,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: const Icon(Icons.add_location_alt_rounded, size: 20),
              label: const Text('Thêm Địa Chỉ Mới', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              onPressed: _showAddAddressDialog,
            ),
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
          Container(
            width: 80,
            height: 80,
            decoration: const BoxDecoration(color: Color(0xFFF7F7F8), shape: BoxShape.circle),
            child: const Icon(Icons.location_off_rounded, size: 40, color: Color(0xFF8F90A6)),
          ),
          const SizedBox(height: 18),
          const Text(
            'Chưa có địa chỉ nhận hàng nào',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E2022)),
          ),
          const SizedBox(height: 6),
          const Text(
            'Thêm địa chỉ để đặt hàng nhanh chóng và tiện lợi',
            style: TextStyle(fontSize: 13, color: Color(0xFF8F90A6)),
          ),
        ],
      ),
    );
  }

  Widget _buildAddressCard(Address addr) {
    return InkWell(
      onTap: widget.selectMode ? () => Navigator.pop(context, addr) : null,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: addr.isDefault ? primaryColor : const Color(0xFFEEEEF0),
            width: addr.isDefault ? 1.5 : 1,
          ),
          boxShadow: const [
            BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  addr.recipientName,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF1E2022)),
                ),
                const SizedBox(width: 8),
                Text(
                  '|  ${addr.phone}',
                  style: const TextStyle(color: Color(0xFF555770), fontSize: 13),
                ),
                const Spacer(),
                if (addr.isDefault)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceAlt,
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
              style: const TextStyle(fontSize: 13, color: Color(0xFF28293D), height: 1.35),
            ),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Divider(height: 1, color: Color(0xFFEEEEF0)),
            ),
            Row(
              children: [
                if (!addr.isDefault)
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      minimumSize: const Size(0, 30),
                      side: const BorderSide(color: Color(0xFFE2E2E6)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                    ),
                    onPressed: () => _setDefault(addr),
                    child: const Text('Thiết lập mặc định', style: TextStyle(fontSize: 11, color: Color(0xFF1E2022), fontWeight: FontWeight.w600)),
                  ),
                const Spacer(),
                IconButton(
                  tooltip: 'Xóa địa chỉ',
                  icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFD0011B), size: 20),
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
