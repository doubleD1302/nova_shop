import { useState } from 'react'
import { formatNumber } from '../../utils/format'

const TABS = [
  { id: 'desc', label: 'Chi Tiết Sản Phẩm' },
  { id: 'specs', label: 'Thông Số Kỹ Thuật' },
  { id: 'ship', label: 'Vận Chuyển & Đổi Trả' },
]

/** Khối mô tả / thông số / chính sách vận chuyển của sản phẩm */
export default function ProductInfoTabs({ product }) {
  const [tab, setTab] = useState('desc')

  return (
    <section id="chi-tiet" className="mt-3 rounded-sm border border-line bg-white">
      <div className="flex flex-wrap items-center gap-6 border-b border-line px-4">
        <h2 className="py-3 text-[16px] font-bold text-ink">Chi Tiết Sản Phẩm</h2>
        <div className="flex flex-wrap gap-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`py-3 text-[13px] transition ${
                tab === t.id ? 'border-b-2 border-brand font-medium text-brand' : 'text-ink-soft hover:text-brand'
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
                <span className="w-[130px] shrink-0 text-muted">Danh Mục</span>
                <span className="text-ink-soft">{product.categoryId}</span>
              </div>
              <div className="flex">
                <span className="w-[130px] shrink-0 text-muted">Thương hiệu</span>
                <span className="text-ink-soft">{product.shopName}</span>
              </div>
              <div className="flex">
                <span className="w-[130px] shrink-0 text-muted">Kho hàng</span>
                <span className="text-ink-soft">{formatNumber(product.stock)}</span>
              </div>
              <div className="flex">
                <span className="w-[130px] shrink-0 text-muted">Gửi từ</span>
                <span className="text-ink-soft">{product.location}</span>
              </div>
            </div>

            <div className="whitespace-pre-line text-[14px] leading-[22px] text-ink-soft">{product.description}</div>

            <div className="flex flex-wrap gap-2">
              {(product.tags || []).map((t) => (
                <span key={t} className="rounded-full bg-page px-3 py-1 text-[12px] text-ink-soft">
                  #{t}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {tab === 'specs' ? (
          <table className="w-full max-w-[720px] border border-line text-[13px]">
            <tbody>
              {(product.specs || []).map(([k, v], i) => (
                <tr key={k} className={i % 2 === 0 ? 'bg-page/60' : 'bg-white'}>
                  <td className="w-[190px] border-r border-line px-3 py-2 text-muted">{k}</td>
                  <td className="px-3 py-2 text-ink-soft">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
