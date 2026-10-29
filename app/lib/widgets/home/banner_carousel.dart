import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shopnova/models/banner_item.dart';
import '../../screens/search/search_screen.dart';
import '../../theme/app_colors.dart';

class BannerCarousel extends StatefulWidget {
  final List<BannerItem> banners;

  const BannerCarousel({super.key, required this.banners});

  @override
  State<BannerCarousel> createState() => _BannerCarouselState();
}

class _BannerCarouselState extends State<BannerCarousel> {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 4), (timer) {
      if (_currentPage < widget.banners.length - 1) {
        _currentPage++;
      } else {
        _currentPage = 0;
      }
      if (_pageController.hasClients) {
        _pageController.animateToPage(
          _currentPage,
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeInOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.banners.isEmpty) return const SizedBox();

    return Column(
      children: [
        SizedBox(
          height: 165,
          child: PageView.builder(
            controller: _pageController,
            onPageChanged: (index) {
              setState(() {
                _currentPage = index;
              });
            },
            itemCount: widget.banners.length,
            itemBuilder: (context, index) {
              final banner = widget.banners[index];
              return GestureDetector(
                onTap: () {
                  final title = banner.title.toLowerCase();
                  if (title.contains('mega') || title.contains('sale')) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => SearchScreen(
                          title: banner.title,
                          initialSort: 'discount',
                        ),
                      ),
                    );
                  } else if (title.contains('freeship')) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => SearchScreen(
                          title: banner.title,
                          filterFreeship: true,
                        ),
                      ),
                    );
                  } else if (title.contains('mall')) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => SearchScreen(
                          title: banner.title,
                          filterMall: true,
                        ),
                      ),
                    );
                  } else {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => SearchScreen(
                          title: banner.title,
                          initialSort: 'newest',
                        ),
                      ),
                    );
                  }
                },
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(
                    color: banner.backgroundColor,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.08),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Stack(
                  children: [
                    if (banner.imageUrl.isNotEmpty && banner.imageUrl.startsWith('http'))
                      Positioned.fill(
                        child: Image.network(
                          banner.imageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const SizedBox(),
                        ),
                      ),
                    // Gradient overlay
                    Positioned.fill(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.transparent,
                              Colors.black.withValues(alpha: 0.65),
                            ],
                          ),
                        ),
                      ),
                    ),
                    // Content
                    Positioned(
                      bottom: 14,
                      left: 14,
                      right: 14,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            banner.title,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.3,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            banner.subtitle,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Tag
                    Positioned(
                      top: 12,
                      left: 12,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [AppColors.primary, AppColors.earth],
                          ),
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.15),
                              blurRadius: 4,
                            ),
                          ],
                        ),
                        child: const Text(
                          '⚡ ĐẠI TIỆC MUA SẮM',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 9.5,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(
            widget.banners.length,
            (index) {
              final isSelected = _currentPage == index;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: isSelected ? 18 : 6,
                height: 5,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(3),
                  color: isSelected ? AppColors.primary : AppColors.border,
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 4),
      ],
    );
  }
}
