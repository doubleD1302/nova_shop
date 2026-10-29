class FlashSaleItem {
  final String id;
  final String name;
  final String imageUrl;
  final double price;
  final int discount;
  final double soldPercentage;
  final String soldLabel;

  const FlashSaleItem({
    required this.id,
    required this.name,
    required this.imageUrl,
    required this.price,
    required this.discount,
    required this.soldPercentage,
    required this.soldLabel,
  });
}
