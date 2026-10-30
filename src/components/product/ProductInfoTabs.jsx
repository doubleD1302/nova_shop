import { useState } from 'react'
import { formatNumber } from '../../utils/format'
import { getCategoryName } from '../../data/categories'

const TABS = [
  { id: 'desc', label: 'Chi Tiết Sản Phẩm' },
  { id: 'specs', label: 'Thông Số Kỹ Thuật' },
  { id: 'ship', label: 'Vận Chuyển & Đổi Trả' },
]

/** Khối mô tả / thông số / chính sách vận chuyển của sản phẩm */
export default function ProductInfoTabs({ product }) {
  const [tab, setTab] = useState('desc')

  const categoryLabel = getCategoryName(product?.categoryId) || product?.categoryName || 'Sản phẩm tiêu chuẩn'
  const shopLabel = product?.shopName || 'ShopNova Official Store'
  const locationLabel = product?.location || 'TP. Hồ Chí Minh'
  const stockCount = typeof product?.stock === 'number' ? product.stock : 120

  const specEntries = Array.isArray(product?.specs)
    ? product.specs
    : Object.entries(product?.specs || {})

  return (
    <section id="chi-tiet" className="mt-3 rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xs overflow-hidden">
      <div className="flex flex-wrap items-center gap-6 border-b border-[#E6D5C2] bg-[#F5E7D4] px-4">
        <h2 className="py-3 text-[16px] font-bold text-[#49352D]">Chi Tiết Sản Phẩm</h2>
        <div className="flex flex-wrap gap-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`py-3 text-[13px] font-medium transition ${
                tab === t.id
                  ? 'border-b-2 border-[#BD6E49] text-[#BD6E49]'
                  : 'text-[#8B7566] hover:text-[#BD6E49]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-5">
        {tab === 'desc' ? (
          <div className="space-y-4">
            <div className="grid gap-x-8 gap-y-2 text-[13px] md:grid-cols-2">
              <div className="flex">
                <span className="w-[130px] shrink-0 text-[#8B7566]">Danh Mục</span>
                <span className="font-medium text-[#49352D]">{categoryLabel}</span>
              </div>
              <div className="flex">
                <span className="w-[130px] shrink-0 text-[#8B7566]">Gian hàng</span>
                <span className="font-medium text-[#49352D]">{shopLabel}</span>
              </div>
              <div className="flex">
                <span className="w-[130px] shrink-0 text-[#8B7566]">Kho hàng</span>
                <span className="font-medium text-[#49352D]">{formatNumber(stockCount)} sản phẩm có sẵn</span>
              </div>
              <div className="flex">
                <span className="w-[130px] shrink-0 text-[#8B7566]">Gửi từ</span>
                <span className="font-medium text-[#49352D]">{locationLabel}</span>
              </div>
            </div>

            <div className="whitespace-pre-line text-[14px] leading-[24px] text-[#49352D]">
              {product?.description || 'Sản phẩm chính hãng ShopNova với chất lượng kiểm định nghiêm ngặt, đóng gói cẩn thận và hỗ trợ bảo hành chính hãng toàn quốc.'}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <span className="rounded-full bg-[#F5E7D4] px-3 py-1 text-[12px] font-semibold text-[#BD6E49]">
                #ChínhHãng100%
              </span>
              <span className="rounded-full bg-[#F5E7D4] px-3 py-1 text-[12px] font-semibold text-[#BD6E49]">
                #FreeshipExtra
              </span>
              <span className="rounded-full bg-[#F5E7D4] px-3 py-1 text-[12px] font-semibold text-[#BD6E49]">
                #ĐổiTrả15Ngày
              </span>
              {(product?.tags || []).map((t) => (
                <span key={t} className="rounded-full bg-[#F5E7D4] px-3 py-1 text-[12px] text-[#8B7566]">
                  #{t}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {tab === 'specs' ? (
          specEntries.length > 0 ? (
            <table className="w-full max-w-[720px] border border-[#E6D5C2] text-[13px] rounded-lg overflow-hidden">
              <tbody>
                {specEntries.map(([k, v], i) => (
                  <tr key={k} className={i % 2 === 0 ? 'bg-[#FDF9F3]' : 'bg-[#FFFCF7]'}>
                    <td className="w-[190px] border-r border-[#E6D5C2] px-3 py-2 font-medium text-[#8B7566]">{k}</td>
                    <td className="px-3 py-2 text-[#49352D]">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-[13px] text-[#8B7566]">
              <p>• Xuất xứ: Việt Nam / Nhập khẩu chính ngạch</p>
              <p className="mt-1">• Tiêu chuẩn chất lượng: Đạt chuẩn sàn thương mại điện tử NovaShop</p>
              <p className="mt-1">• Hạn bảo hành: 12 tháng chính hãng</p>
            </div>
          )
        ) : null}

        {tab === 'ship' ? (
          <div className="space-y-4 text-[13px] text-ink-soft">
            <div>
              <p className="mb-1 font-semibold text-ink">Phí vận chuyển</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Miễn phí vận chuyển cho đơn hàng từ 1.000.000₫ (Freeship Extra).</li>
                <li>Phí giao hàng tiêu chuẩn 16.500₫ cho mỗi gian hàng trong đơn.</li>
                <li>Hỗ trợ giao nhanh trong 2 giờ tại nội thành Hà Nội và TP. Hồ Chí Minh.</li>
              </ul>
            </div>
            <div>
              <p className="mb-1 font-semibold text-ink">Chính sách đổi trả</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Đổi trả miễn phí trong 15 ngày kể từ khi nhận hàng.</li>
                <li>Hoàn tiền 100% nếu sản phẩm không đúng mô tả hoặc lỗi nhà sản xuất.</li>
                <li>Người bán chịu phí vận chuyển hai chiều với sản phẩm lỗi.</li>
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
