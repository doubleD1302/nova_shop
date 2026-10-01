import { commitments } from '../../data/homeContent'

/** Khối "Tại sao mua hàng tại ShopNova" — nền trắng, 4 ô ngang */
export default function CommitmentStrip() {
  return (
    <section className="mt-3 grid grid-cols-2 rounded-sm border border-line bg-white lg:grid-cols-4">
      {commitments.map((c) => (
        <div key={c.id} className="flex items-center gap-3 border-b border-r border-line px-4 py-4 last:border-r-0">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[20px] ${c.bg}`}>
            {c.emoji}
          </span>
          <span className="leading-tight">
            <span className="block text-[13px] font-semibold text-ink">{c.title}</span>
            <span className="block text-[11px] text-muted">{c.desc}</span>
          </span>
        </div>
      ))}
    </section>
  )
}
