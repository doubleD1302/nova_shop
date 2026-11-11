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
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Không thể tải sổ địa chỉ. Vui lòng thử lại.')));
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
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Không thể đặt địa chỉ mặc định.')));
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
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Không thể xóa địa chỉ.')));
      }
    }
  }

  InputDecoration _addressInputDecoration(
    String label, {
    String? hint,
    IconData? icon,
    bool alignLabelWithHint = false,
  }) {
    const borderRadius = BorderRadius.all(Radius.circular(12));
    return InputDecoration(
      isDense: true,
      filled: true,
      fillColor: AppColors.background,
      labelText: label,
      hintText: hint,
      alignLabelWithHint: alignLabelWithHint,
      labelStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
      floatingLabelStyle: const TextStyle(
        color: AppColors.primary,
        fontSize: 12.5,
        fontWeight: FontWeight.w600,
      ),
      hintStyle: const TextStyle(color: AppColors.textHint, fontSize: 12.5),
      prefixIcon: icon != null
          ? Icon(icon, size: 18, color: AppColors.primary)
          : null,
      prefixIconConstraints: icon != null
          ? const BoxConstraints(minWidth: 38, minHeight: 36)
          : null,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      border: const OutlineInputBorder(
        borderRadius: borderRadius,
        borderSide: BorderSide(color: AppColors.border),
      ),
      enabledBorder: const OutlineInputBorder(
        borderRadius: borderRadius,
        borderSide: BorderSide(color: AppColors.border),
      ),
      focusedBorder: const OutlineInputBorder(
        borderRadius: borderRadius,
        borderSide: BorderSide(color: AppColors.primary, width: 1.5),
      ),
    );
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
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return SafeArea(
              top: false,
              child: Padding(
                padding: EdgeInsets.only(
                  left: 16,
                  right: 16,
                  top: 10,
                  bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
                ),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Container(
                          width: 38,
                          height: 4,
                          margin: const EdgeInsets.only(bottom: 12),
                          decoration: BoxDecoration(
                            color: AppColors.border,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(7),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceAlt,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(
                              Icons.add_location_alt_outlined,
                              color: AppColors.primary,
                              size: 18,
                            ),
                          ),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: Text(
                              'Thêm địa chỉ nhận hàng mới',
                              style: TextStyle(
                                fontSize: 16.5,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ),
                          IconButton(
                            visualDensity: VisualDensity.compact,
                            icon: const Icon(
                              Icons.close_rounded,
                              color: AppColors.textSecondary,
                              size: 20,
                            ),
                            onPressed: () => Navigator.pop(ctx),
                          ),
                        ],
                      ),
                      const Divider(height: 18, color: AppColors.border),
                      TextField(
                        controller: nameCtrl,
                        textInputAction: TextInputAction.next,
                        style: const TextStyle(fontSize: 13.5, color: AppColors.textPrimary),
                        decoration: _addressInputDecoration(
                          'Họ và tên người nhận *',
                          icon: Icons.person_outline_rounded,
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: phoneCtrl,
                        keyboardType: TextInputType.phone,
                        textInputAction: TextInputAction.next,
                        style: const TextStyle(fontSize: 13.5, color: AppColors.textPrimary),
                        decoration: _addressInputDecoration(
                          'Số điện thoại *',
                          icon: Icons.phone_outlined,
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: provinceCtrl,
                        textInputAction: TextInputAction.next,
                        style: const TextStyle(fontSize: 13.5, color: AppColors.textPrimary),
                        decoration: _addressInputDecoration(
                          'Tỉnh / Thành phố *',
                          icon: Icons.location_city_outlined,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: districtCtrl,
                              textInputAction: TextInputAction.next,
                              style: const TextStyle(fontSize: 13.5, color: AppColors.textPrimary),
                              decoration: _addressInputDecoration('Quận / Huyện'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextField(
                              controller: wardCtrl,
                              textInputAction: TextInputAction.next,
                              style: const TextStyle(fontSize: 13.5, color: AppColors.textPrimary),
                              decoration: _addressInputDecoration('Phường / Xã'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: detailCtrl,
                        minLines: 2,
                        maxLines: 2,
                        style: const TextStyle(fontSize: 13.5, color: AppColors.textPrimary),
                        decoration: _addressInputDecoration(
                          'Địa chỉ chi tiết (số nhà, tên đường) *',
                          icon: Icons.home_outlined,
                          alignLabelWithHint: true,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Material(
                        color: AppColors.background,
                        clipBehavior: Clip.antiAlias,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: const BorderSide(color: AppColors.border),
                        ),
                        child: SwitchListTile.adaptive(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                          dense: true,
                          title: const Text(
                            'Đặt làm địa chỉ mặc định',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          value: isDefault,
                          activeThumbColor: AppColors.primary,
                          activeTrackColor: AppColors.secondary,
                          onChanged: (val) => setModalState(() => isDefault = val),
                        ),
                      ),
                      const SizedBox(height: 14),
                      Container(
                        width: double.infinity,
                        height: 46,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [AppColors.primary, AppColors.earth],
                          ),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.transparent,
                            shadowColor: Colors.transparent,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
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

                                  if (result != null && mounted && ctx.mounted) {
                                    Navigator.pop(ctx);
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Đã thêm địa chỉ nhận hàng thành công!'), backgroundColor: AppColors.freeshipGreen),
                                    );
                                    _loadAddresses();
                                  } else if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Không thể xác nhận đã thêm địa chỉ. Vui lòng tải lại danh sách trước khi thử lại.')));
                                  }
                                },
                          child: isSubmitting
                              ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                              : const Text('Lưu Địa Chỉ', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
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
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          widget.selectMode ? 'Chọn Địa Chỉ Nhận Hàng' : 'Sổ Địa Chỉ Của Tôi',
          style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 17),
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
            child: const Icon(Icons.location_off_rounded, size: 40, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 18),
          const Text(
            'Chưa có địa chỉ nhận hàng nào',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 6),
          const Text(
            'Thêm địa chỉ để đặt hàng nhanh chóng và tiện lợi',
            style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
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
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: addr.isDefault ? primaryColor : AppColors.border,
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
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.textPrimary),
                ),
                const SizedBox(width: 8),
                Text(
                  '|  ${addr.phone}',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
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
              style: const TextStyle(fontSize: 13, color: AppColors.textPrimary, height: 1.35),
            ),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Divider(height: 1, color: AppColors.border),
            ),
            Row(
              children: [
                if (!addr.isDefault)
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      minimumSize: const Size(0, 30),
                      side: const BorderSide(color: AppColors.border),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                    ),
                    onPressed: () => _setDefault(addr),
                    child: const Text('Thiết lập mặc định', style: TextStyle(fontSize: 11, color: AppColors.textPrimary, fontWeight: FontWeight.w600)),
                  ),
                const Spacer(),
                IconButton(
                  tooltip: 'Xóa địa chỉ',
                  icon: const Icon(Icons.delete_outline_rounded, color: AppColors.flashSaleRed, size: 20),
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
