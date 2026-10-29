import 'package:flutter/material.dart';
import '../../data/website_data.dart';

class CommitmentStripWidget extends StatelessWidget {
  const CommitmentStripWidget({super.key});

  @override
  Widget build(BuildContext context) {
    final items = WebsiteData.commitments;

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'TẠI SAO MUA HÀNG TẠI SHOPNOVA?',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: Color(0xFF555555),
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 2.3,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
            ),
            itemCount: items.length,
            itemBuilder: (context, index) {
              final c = items[index];
              return Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: c.backgroundColor,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Text(
                      c.emoji,
                      style: const TextStyle(fontSize: 24),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            c.title,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF222222),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            c.desc,
                            style: const TextStyle(
                              fontSize: 10,
                              color: Color(0xFF666666),
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
