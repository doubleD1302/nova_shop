import { commitments } from '../../data/homeContent'
import { IconGrid, IconStore, IconTruck, IconPackage } from '../ui/Icons'

const COMMITMENT_ICONS = { c1: IconGrid, c2: IconStore, c3: IconTruck, c4: IconPackage }

/** Khối "Tại sao mua hàng tại ShopNova" — nền trắng, 4 ô ngang */
export default function CommitmentStrip() {
  return (
    <section className="mt-5 grid grid-cols-1 overflow-hidden rounded-2xl border border-line bg-white shadow-card sm:grid-cols-2 lg:grid-cols-4">
      {commitments.map((c) => {
        const CommitmentIcon = COMMITMENT_ICONS[c.id]
        return (
          <div key={c.id} className="flex items-center gap-3 border-b border-r border-line px-4 py-4 last:border-r-0">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-page text-earth">
              <CommitmentIcon className="h-[21px] w-[21px]" />
            </span>
            <span className="leading-tight">
              <span className="block text-[13px] font-semibold text-ink">{c.title}</span>
              <span className="block text-[11px] text-muted">{c.desc}</span>
            </span>
          </div>
        )
      })}
    </section>
  )
}
