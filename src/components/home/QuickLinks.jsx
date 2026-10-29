import { Link } from 'react-router-dom'
import {
  IconDress,
  IconTShirt,
  IconDeviceMobile,
  IconLaptopScreen,
  IconHeadphones,
  IconBeautyCosmetics,
  IconArmchair,
  IconSneaker,
  IconBabyStroller,
  IconBookOpen,
} from '../ui/Icons'

const CATEGORY_ITEMS = [
  {
    id: 'thoi-trang-nu',
    label: 'Thời trang nữ',
    icon: IconDress,
    to: '/tim-kiem?category=thoi-trang-nu',
  },
  {
    id: 'thoi-trang-nam',
    label: 'Thời trang nam',
    icon: IconTShirt,
    to: '/tim-kiem?category=thoi-trang-nam',
  },
  {
    id: 'dien-thoai',
    label: 'Điện thoại & Phụ kiện',
    icon: IconDeviceMobile,
    to: '/tim-kiem?category=dien-thoai',
  },
  {
    id: 'may-tinh',
    label: 'Máy tính & Laptop',
    icon: IconLaptopScreen,
    to: '/tim-kiem?category=may-tinh',
  },
  {
    id: 'dien-tu',
    label: 'Điện tử & Công nghệ',
    icon: IconHeadphones,
    to: '/tim-kiem?category=phu-kien-cong-nghe',
  },
  {
    id: 'lam-dep',
    label: 'Làm đẹp & Sức khỏe',
    icon: IconBeautyCosmetics,
    to: '/tim-kiem?category=sac-dep',
  },
  {
    id: 'nha-cua',
    label: 'Nhà cửa & Đời sống',
    icon: IconArmchair,
    to: '/tim-kiem?category=nha-cua',
  },
  {
    id: 'the-thao',
    label: 'Thể thao & Du lịch',
    icon: IconSneaker,
    to: '/tim-kiem?category=the-thao',
  },
  {
    id: 'me-be',
    label: 'Mẹ & Bé',
    icon: IconBabyStroller,
    to: '/tim-kiem?category=me-be',
  },
  {
    id: 'sach',
    label: 'Sách & Văn phòng phẩm',
    icon: IconBookOpen,
    to: '/tim-kiem?category=thiet-bi-gia-dung',
  },
]

/** Dải 10 danh mục dạng squircle phong cách Terracotta + Cream */
export default function QuickLinks() {
  return (
    <div className="mt-3.5 overflow-hidden rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-3 sm:p-4 shadow-2xs">
      <div className="grid grid-cols-5 md:grid-cols-10 gap-2 sm:gap-3">
        {CATEGORY_ITEMS.map((item) => {
          const IconComp = item.icon
          return (
            <Link
              key={item.id}
              to={item.to}
              className="group flex flex-col items-center p-1.5 text-center transition"
            >
              <span className="grid h-12 w-12 sm:h-13 sm:w-13 place-items-center rounded-2xl border border-[#E6D5C2] bg-[#F5E7D4] text-[#BD6E49] transition-all duration-200 group-hover:-translate-y-1 group-hover:border-[#BD6E49] group-hover:bg-[#F4E6D2] group-hover:shadow-sm">
                <IconComp className="h-6 w-6 stroke-[1.8]" />
              </span>
              <span className="mt-2 line-clamp-2 max-w-[85px] text-[11px] sm:text-[12px] font-medium leading-tight text-[#49352D] transition group-hover:text-[#BD6E49]">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
