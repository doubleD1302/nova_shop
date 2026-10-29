/**
 * Khung 2 cột cho trang đăng nhập / đăng ký:
 * Bên trái: Giới thiệu NovaShop nền be kem #F5E7D4 + hình minh họa + danh sách cam kết
 * Bên phải: Biểu mẫu form đăng nhập / đăng ký nền trắng ngà #FFFCF7
 */
export default function AuthLayout({
  title = 'Đăng Nhập',
  subtitle = 'Dùng tài khoản người mua hoặc người bán để tiếp tục.',
  bannerTitle = 'Mua sắm & bán hàng trên cùng một sàn',
  children,
}) {
  return (
    <div className="w-full max-w-[960px] mx-auto my-6 sm:my-10 overflow-hidden rounded-[24px] sm:rounded-[28px] border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xs">
      <div className="grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
        {/* Cột trái: Giới thiệu NovaShop nền be kem #F5E7D4 */}
        <div className="md:col-span-5 bg-[#F5E7D4] p-6 sm:p-8 lg:p-10 flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#E6D5C2]">
          <div>
            <div className="flex items-center gap-2.5">
              <img
                src="/images/logo.png"
                alt="NovaShop Logo"
                className="h-9 w-9 object-contain rounded-full shadow-2xs"
              />
              <span className="text-[22px] sm:text-[25px] font-black tracking-tight text-[#49352D]">
                Nova<span className="text-[#BD6E49]">Shop</span>
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-[#8B7566]">
              Sàn thương mại điện tử cho người bán và người mua kết nối trực tiếp.
            </p>
          </div>

          {/* Hình minh họa giỏ quà / mua sắm Terracotta sắc nét */}
          <div className="my-6 flex justify-center items-center">
            <img
              src="/images/auth-illustration.png?v=terracotta"
              alt="Mua sắm NovaShop"
              className="max-h-[160px] sm:max-h-[175px] w-auto object-contain drop-shadow-2xs transition-transform duration-300 hover:scale-105"
            />
          </div>

          {/* Khối cam kết dưới chân cột trái */}
          <div className="space-y-2.5">
            <p className="text-[13px] sm:text-[14px] font-bold text-[#80513B]">
              {bannerTitle}
            </p>
            <ul className="space-y-2 text-[12px] sm:text-[13px] text-[#49352D]">
              <li className="flex items-center gap-2">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#BD6E49] text-[10px] font-bold text-[#FFFCF7] shadow-2xs">
                  ✓
                </span>
                <span>Nhiều người bán – nhiều sản phẩm, đa dạng lựa chọn</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#BD6E49] text-[10px] font-bold text-[#FFFCF7] shadow-2xs">
                  ✓
                </span>
                <span>Mức giá hợp lý, nhiều chương trình khuyến mãi hấp dẫn</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#BD6E49] text-[10px] font-bold text-[#FFFCF7] shadow-2xs">
                  ✓
                </span>
                <span>Theo dõi đơn hàng và đánh giá uy tín dễ dàng</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#BD6E49] text-[10px] font-bold text-[#FFFCF7] shadow-2xs">
                  ✓
                </span>
                <span>Kênh người bán chuyên nghiệp, hỗ trợ tận tâm</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Cột phải: Form đăng nhập / đăng ký nền trắng ngà #FFFCF7 */}
        <div className="md:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-[#FFFCF7]">
          <div className="max-w-[420px] mx-auto w-full">
            <h1 className="text-[24px] sm:text-[26px] font-bold text-[#49352D] tracking-tight">
              {title}
            </h1>
            <p className="mt-1 text-[13px] text-[#8B7566]">
              {subtitle}
            </p>

            <div className="mt-6">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
