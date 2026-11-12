import {
  IconArmchair, IconBabyStroller, IconBall, IconBasket, IconBeautyCosmetics,
  IconCamera, IconCar, IconDeviceMobile, IconDress, IconGrid, IconHandbag,
  IconHeadphones, IconLaptopScreen, IconSneaker, IconTShirt,
} from './Icons'

const icons = {
  'thoi-trang-nam': IconTShirt,
  'thoi-trang-nu': IconDress,
  'dien-thoai': IconDeviceMobile,
  'may-tinh': IconLaptopScreen,
  'phu-kien-cong-nghe': IconHeadphones,
  'dien-tu': IconHeadphones,
  'giay-dep': IconSneaker,
  'tui-xach': IconHandbag,
  'tui-vi': IconHandbag,
  'my-pham': IconBeautyCosmetics,
  'sac-dep': IconBeautyCosmetics,
  'nha-cua': IconArmchair,
  'nha-cua-doi-song': IconArmchair,
  'thiet-bi-gia-dung': IconArmchair,
  'me-be': IconBabyStroller,
  'bach-hoa': IconBasket,
  'the-thao': IconBall,
  'o-to-xe-may': IconCar,
  'may-anh': IconCamera,
}

export default function CategoryIcon({ slug, className = 'h-7 w-7' }) {
  const Icon = icons[slug] || IconGrid
  return <Icon className={className} />
}
