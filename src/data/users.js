/**
 * NGƯỜI DÙNG (mock) — gồm người mua và người bán.
 * role: 'buyer' | 'seller' | 'admin'
 * shopId: chỉ có ở tài khoản người bán (mỗi người bán sở hữu 1 shop).
 */
export const users = [
  {
    id: 'u_minhanh',
    username: 'minhanh',
    password: '123456',
    fullName: 'Minh Anh',
    role: 'buyer',
    rank: 'Thành viên Vàng',
    email: 'minhanh@shopnova.vn',
    phone: '0901234567',
    avatarEmoji: '👩',
    hue: 340,
    address: {
      fullName: 'Nguyễn Minh Anh',
      phone: '0901234567',
      province: 'TP. Hồ Chí Minh',
      district: 'Quận 1',
      ward: 'Phường Bến Nghé',
      detail: '25 Lý Tự Trọng',
    },
  },
  {
    id: 'u_quockhanh',
    username: 'quockhanh',
    password: '123456',
    fullName: 'Quốc Khánh',
    role: 'buyer',
    rank: 'Thành viên Bạc',
    email: 'quockhanh@shopnova.vn',
    phone: '0912345678',
    avatarEmoji: '🧑',
    hue: 210,
    address: {
      fullName: 'Trần Quốc Khánh',
      phone: '0912345678',
      province: 'Hà Nội',
      district: 'Quận Cầu Giấy',
      ward: 'Phường Dịch Vọng',
      detail: '12 Xuân Thuỷ',
    },
  },
  {
    id: 'u_ankerseller',
    username: 'ankerseller',
    password: '123456',
    fullName: 'Anker Official',
    role: 'seller',
    shopId: 'anker-official',
    rank: 'Người bán uy tín',
    email: 'seller@anker.vn',
    phone: '0987654321',
    avatarEmoji: '⚡',
    hue: 205,
    address: {
      fullName: 'Anker Việt Nam',
      phone: '0987654321',
      province: 'TP. Hồ Chí Minh',
      district: 'Quận Bình Thạnh',
      ward: 'Phường 25',
      detail: '208 Nguyễn Hữu Cảnh',
    },
  },
  {
    id: 'u_cocoonseller',
    username: 'cocoonseller',
    password: '123456',
    fullName: 'Cocoon Việt Nam',
    role: 'seller',
    shopId: 'cocoon-official',
    rank: 'Người bán uy tín',
    email: 'seller@cocoon.vn',
    phone: '0977123456',
    avatarEmoji: '🌿',
    hue: 140,
    address: {
      fullName: 'Cocoon Việt Nam',
      phone: '0977123456',
      province: 'TP. Hồ Chí Minh',
      district: 'Quận 3',
      ward: 'Phường 6',
      detail: '180 Nam Kỳ Khởi Nghĩa',
    },
  },
]

/** Tài khoản đang đăng nhập mặc định khi mới mở web (giả lập sẵn phiên) */
export const DEFAULT_BUYER_ID = 'u_minhanh'

export const findUserById = (id) => users.find((u) => u.id === id) || null
