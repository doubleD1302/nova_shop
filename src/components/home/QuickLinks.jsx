import { Link } from 'react-router-dom'
import { quickLinks } from '../../data/homeContent'

/** Dải 8 icon tiện ích ngay dưới banner */
export default function QuickLinks() {
  return (
    <div className="mt-2 grid grid-cols-4 gap-y-3 rounded-sm border border-line bg-white py-3 md:grid-cols-8">
      {quickLinks.map((item) => (
        <Link
          key={item.id}
          to={item.to}
          className="group flex flex-col items-center gap-2 px-1 text-center transition"
        >
          <span
            className={`grid h-11 w-11 place-items-center rounded-full text-[20px] transition group-hover:-translate-y-0.5 group-hover:shadow-sm ${item.bg}`}
          >
            {item.emoji}
          </span>
          <span className="text-[11px] leading-[14px] text-ink-soft transition group-hover:text-brand">
            {item.label}
          </span>
        </Link>
      ))}
    </div>
  )
}
