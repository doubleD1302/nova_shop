import CategoryStrip from '../components/home/CategoryStrip'
import CommitmentStrip from '../components/home/CommitmentStrip'
import FeaturedShops from '../components/home/FeaturedShops'
import FlashSale from '../components/home/FlashSale'
import HeroBanners from '../components/home/HeroBanners'
import HomeProductShelves from '../components/home/HomeProductShelves'
import SuggestSection from '../components/home/SuggestSection'
import TrendTags from '../components/home/TrendTags'

/** Trang chủ ShopNova: ưu tiên khám phá, ưu đãi, gian hàng và sản phẩm từ catalog thật. */
export default function HomePage() {
  return (
    <div className="space-y-0 pb-4">
      <HeroBanners />
      <CategoryStrip />
      <FlashSale />
      <FeaturedShops />
      <TrendTags />
      <HomeProductShelves />
      <SuggestSection />
      <CommitmentStrip />
    </div>
  )
}
