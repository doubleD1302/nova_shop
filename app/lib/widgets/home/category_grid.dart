import 'package:flutter/material.dart';
import 'package:shopnova/models/category_item.dart';
import 'package:shopnova/theme/app_colors.dart';
import '../../screens/search/search_screen.dart';

class CategoryGrid extends StatelessWidget {
  final List<CategoryItem> categories;

  const CategoryGrid({super.key, required this.categories});

  void _showAllCategoriesModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(context).size.height * 0.65,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Tất Cả Danh Mục',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF222222),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.grey),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const Divider(),
            Expanded(
              child: GridView.builder(
                padding: const EdgeInsets.symmetric(vertical: 8),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 4,
                  mainAxisSpacing: 16,
                  crossAxisSpacing: 12,
                  childAspectRatio: 0.85,
                ),
                itemCount: categories.length,
                itemBuilder: (c, idx) {
                  final cat = categories[idx];
                  return InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: () {
                      Navigator.pop(ctx);
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => SearchScreen(
                            initialCategory: cat.name,
                            categoryId: (cat.slug != null && cat.slug!.isNotEmpty) ? cat.slug : cat.id,
                            title: 'Ngành hàng: ${cat.name}',
                          ),
                        ),
                      );
                    },
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFFFFF4F0), Color(0xFFFFEAE3)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFFFDDD4), width: 0.8),
                          ),
                          child: Icon(cat.icon, color: AppColors.primary, size: 26),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          cat.name,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF333333)),
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 4,
                    height: 16,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'DANH MỤC NGÀNH HÀNG',
                    style: TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF222222),
                      letterSpacing: 0.2,
                    ),
                  ),
                ],
              ),
              InkWell(
                onTap: () => _showAllCategoriesModal(context),
                borderRadius: BorderRadius.circular(4),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  child: Text(
                    'Xem tất cả >',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 4,
            mainAxisSpacing: 14,
            crossAxisSpacing: 8,
            childAspectRatio: 0.88,
            children: categories.map((category) {
              return InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => SearchScreen(
                        initialCategory: category.name,
                        categoryId: (category.slug != null && category.slug!.isNotEmpty) ? category.slug : category.id,
                        title: 'Ngành hàng: ${category.name}',
                      ),
                    ),
                  );
                },
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFFFF5F2), Color(0xFFFFEBE4)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFFFDDD4), width: 0.8),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFFEE4D2D).withValues(alpha: 0.08),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Icon(category.icon, color: AppColors.primary, size: 24),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      category.name,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF333333),
                      ),
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
