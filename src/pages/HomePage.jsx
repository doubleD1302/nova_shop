import CategoryStrip from '../components/home/CategoryStrip'
import CommitmentStrip from '../components/home/CommitmentStrip'
import FeaturedShops from '../components/home/FeaturedShops'
import FlashSale from '../components/home/FlashSale'
import HeroBanners from '../components/home/HeroBanners'
import QuickLinks from '../components/home/QuickLinks'
import SuggestSection from '../components/home/SuggestSection'
import TrendTags from '../components/home/TrendTags'

/** TRANG CHỦ — bố cục theo đúng thiết kế: banner → quick links → danh mục → flash sale → gian hàng → gợi ý */
export default function HomePage() {
  return (
    <div className="space-y-0">
      <HeroBanners />
      <QuickLinks />
      <CategoryStrip />
      <FlashSale />
      <FeaturedShops />
      <TrendTags />
      <SuggestSection />
      <CommitmentStrip />
    </div>
  )
}
