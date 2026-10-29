/**
 * Bộ icon SVG inline (không phụ thuộc thư viện ngoài).
 * Mọi icon dùng `currentColor` => đổi màu bằng class Tailwind (text-brand, text-white...).
 */
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': 'true',
}

function Svg({ className = 'h-4 w-4', children, ...rest }) {
  return (
    <svg className={className} {...base} {...rest}>
      {children}
    </svg>
  )
}

export const IconSearch = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.2-3.2" />
  </Svg>
)

export const IconCart = (p) => (
  <Svg {...p}>
    <path d="M3 4h2l2.4 11.2a2 2 0 002 1.6h7.8a2 2 0 002-1.55L21 8H6" />
    <circle cx="10" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
  </Svg>
)

export const IconBell = (p) => (
  <Svg {...p}>
    <path d="M18 9a6 6 0 00-12 0c0 6.2-2.5 7.2-2.5 9h17S18 15.2 18 9Z" />
    <path d="M9.5 21h5" />
    <path d="m4.1 5.8-1.3-1.2m17.1 1.2 1.3-1.2" />
  </Svg>
)

export const IconTicketPercent = (p) => (
  <Svg {...p}>
    <path d="M4 8a2.5 2.5 0 010 5v3a2 2 0 002 2h12a2 2 0 002-2v-3a2.5 2.5 0 010-5V7a2 2 0 00-2-2H6a2 2 0 00-2 2v1Z" />
    <path d="M9 6v2m0 3v2m0 3v2" strokeDasharray="1 1" />
    <path d="m16 9-4 6" />
    <circle cx="12.2" cy="9.2" r=".8" fill="currentColor" stroke="none" />
    <circle cx="15.8" cy="14.8" r=".8" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconMedalCheck = (p) => (
  <Svg {...p}>
    <path d="M8 3h8l-1.2 6H9.2L8 3Z" />
    <circle cx="12" cy="14" r="5" />
    <path d="m9.8 14 1.5 1.5 3-3" />
    <path d="m8.3 18-1 3 3.4-1.2m5-1.8 1 3-3.4-1.2" />
  </Svg>
)

export const IconRefreshReturn = (p) => (
  <Svg {...p}>
    <path d="M20 7v5h-5" />
    <path d="M20 12a8 8 0 00-14.7-4L4 10" />
    <path d="M4 17v-5h5" />
    <path d="M4 12a8 8 0 0014.7 4L20 14" />
  </Svg>
)

export const IconUser = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0114 0" />
  </Svg>
)

export const IconChevronDown = (p) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
)

export const IconChevronRight = (p) => (
  <Svg {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
)

export const IconChevronLeft = (p) => (
  <Svg {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
)

export const IconShieldCheck = (p) => (
  <Svg {...p}>
    <path d="M12 3l7 3v5.5c0 4.4-3 8.1-7 9.5-4-1.4-7-5.1-7-9.5V6z" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
)

export const IconTruck = (p) => (
  <Svg {...p}>
    <path d="M3 6h11v9H3z" />
    <path d="M14 9h4l3 3v3h-7" />
    <circle cx="7" cy="18" r="1.6" />
    <circle cx="17" cy="18" r="1.6" />
  </Svg>
)

export const IconPlus = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const IconMinus = (p) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
)

export const IconTrash = (p) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </Svg>
)

export const IconHome = (p) => (
  <Svg {...p}>
    <path d="M4 11l8-7 8 7v9H4z" />
    <path d="M10 20v-6h4v6" />
  </Svg>
)

export const IconGrid = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
  </Svg>
)

export const IconMenu = (p) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
)

export const IconCheck = (p) => (
  <Svg {...p}>
    <path d="M5 13l4.5 4.5L19 7" />
  </Svg>
)

export const IconClose = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)

export const IconStore = (p) => (
  <Svg {...p}>
    <path d="M4 9.5V20h16V9.5" />
    <path d="M3 9.5l1.8-5h14.4L21 9.5a3 3 0 01-5.4 1.6 3 3 0 01-5.2 0A3 3 0 013 9.5z" />
  </Svg>
)

export const IconPackage = (p) => (
  <Svg {...p}>
    <path d="M12 3l8 4v10l-8 4-8-4V7z" />
    <path d="M4 7l8 4 8-4M12 11v10" />
  </Svg>
)

export const IconChart = (p) => (
  <Svg {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
)

export const IconEdit = (p) => (
  <Svg {...p}>
    <path d="M4 20h4l10-10-4-4L4 16z" />
    <path d="M14 6l4 4" />
  </Svg>
)

export const IconEye = (p) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)

export const IconFilter = (p) => (
  <Svg {...p}>
    <path d="M3 6h18M6 12h12M10 18h4" />
  </Svg>
)

export const IconArrowLeft = (p) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
)

export const IconPhone = (p) => (
  <Svg {...p}>
    <path d="M6 3h3l2 5-2.2 1.4a12 12 0 006.8 6.8L17 14l5 2v3a2 2 0 01-2.2 2A17 17 0 014 6.2 2 2 0 016 3z" />
  </Svg>
)

export const IconGlobe = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.5 2.4 2.5 14.6 0 17M12 3.5c-2.5 2.4-2.5 14.6 0 17" />
  </Svg>
)

export const IconClock = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
)

export const IconLocation = (p) => (
  <Svg {...p}>
    <path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.6" />
  </Svg>
)

export const IconChat = (p) => (
  <Svg {...p}>
    <path d="M21 12a8 8 0 01-11.6 7.1L4 21l1.9-5.4A8 8 0 1121 12z" />
  </Svg>
)

export const IconLogout = (p) => (
  <Svg {...p}>
    <path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4" />
    <path d="M10 8l-4 4 4 4M6 12h9" />
  </Svg>
)

export const IconSparkle = (p) => (
  <Svg {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
  </Svg>
)

/** Các icon "đặc" cần điều khiển fill (sao, tim, tia sét) */
export const IconStar = ({ className = 'h-3.5 w-3.5', filled = true, ...rest }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="1.6"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...rest}
  >
    <path d="M12 3.2l2.7 5.6 6.1.85-4.45 4.3 1.08 6.05L12 17.1l-5.43 2.9L7.65 14 3.2 9.65l6.1-.85z" />
  </svg>
)

export const IconHeart = ({ className = 'h-4 w-4', filled = false, ...rest }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...rest}
  >
    <path d="M12 20s-7-4.3-7-9.3A4.2 4.2 0 0112 8.4 4.2 4.2 0 0119 10.7c0 5-7 9.3-7 9.3z" />
  </svg>
)

export const IconBolt = ({ className = 'h-4 w-4', filled = true, ...rest }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="1.2"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...rest}
  >
    <path d="M13.5 2L5 13.2h5.2L9.6 22 19 10.4h-5.4z" />
  </svg>
)

export const IconArrowRight = (p) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
)

export const IconDress = (p) => (
  <Svg {...p}>
    <path d="M9 3a3 3 0 0 0 6 0" />
    <path d="M9 3 5 7l2.5 2L6 21h12l-1.5-12 2.5-2-4-4" />
    <path d="M10 12h4" />
  </Svg>
)

export const IconTShirt = (p) => (
  <Svg {...p}>
    <path d="M6 4 2 8l3 3 2-2v11h10V9l2 2 3-3-4-4c-2 2-6 2-8 0z" />
  </Svg>
)

export const IconDeviceMobile = (p) => (
  <Svg {...p}>
    <rect x="6" y="2" width="12" height="20" rx="3" />
    <circle cx="12" cy="18" r="1" />
  </Svg>
)

export const IconLaptopScreen = (p) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="12" rx="1.5" />
    <path d="M1 20h22" />
  </Svg>
)

export const IconHeadphones = (p) => (
  <Svg {...p}>
    <path d="M3 14v-3a9 9 0 0 1 18 0v3" />
    <rect x="2" y="14" width="4" height="6" rx="1.5" />
    <rect x="18" y="14" width="4" height="6" rx="1.5" />
  </Svg>
)

export const IconBeautyCosmetics = (p) => (
  <Svg {...p}>
    <path d="m12 3 1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5z" />
    <path d="M19 14l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z" />
    <path d="M5 16l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z" />
  </Svg>
)

export const IconArmchair = (p) => (
  <Svg {...p}>
    <path d="M5 11V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4" />
    <path d="M3 13a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5H3v-5z" />
    <path d="M6 18v3M18 18v3" />
  </Svg>
)

export const IconSneaker = (p) => (
  <Svg {...p}>
    <path d="M3 18h18l-1.5-4a2 2 0 0 0-1.8-1.2H14l-3-4-3 1-3 4-2 1v3.2z" />
    <path d="M7 10l3 3M11 8l3 3" />
  </Svg>
)

export const IconBabyStroller = (p) => (
  <Svg {...p}>
    <circle cx="8" cy="19" r="2" />
    <circle cx="17" cy="19" r="2" />
    <path d="M3 5h3l2.5 8h9.5M19 7h-9M12 7l1 6" />
  </Svg>
)

export const IconBookOpen = (p) => (
  <Svg {...p}>
    <path d="M2 5.5A2.5 2.5 0 0 1 4.5 3h6a2.5 2.5 0 0 1 2.5 2.5v13a2.5 2.5 0 0 0-2.5-2.5h-6A2.5 2.5 0 0 0 2 18.5v-13z" />
    <path d="M22 5.5A2.5 2.5 0 0 0 19.5 3h-6A2.5 2.5 0 0 0 11 5.5v13a2.5 2.5 0 0 1 2.5-2.5h6a2.5 2.5 0 0 1 2.5 2.5v-13z" />
  </Svg>
)

export const IconLock = (p) => (
  <Svg {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
)

export const IconHelpCircle = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </Svg>
)

export const IconMegaphone = (p) => (
  <Svg {...p}>
    <path d="m3 11 18-5v12L3 14v-3z" />
    <path d="M11.6 16.8a3 3 0 0 1-4.2 1.2" />
  </Svg>
)

export const IconWallet = (p) => (
  <Svg {...p}>
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
  </Svg>
)

export const IconWarehouse = (p) => (
  <Svg {...p}>
    <path d="M3 21V9l9-6 9 6v12H3z" />
    <path d="M9 21v-8h6v8" />
  </Svg>
)

export const IconShoppingBag = (p) => (
  <Svg {...p}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
  </Svg>
)

export const IconCopy = (p) => (
  <Svg {...p}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
)

export const IconSettings = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
)

export const IconDotsHorizontal = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </Svg>
)
