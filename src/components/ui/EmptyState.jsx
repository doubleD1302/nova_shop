/** Trạng thái rỗng dùng chung */
export default function EmptyState({ emoji = '🔍', title = 'Không có dữ liệu', description = '', action = null }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 bg-white px-6 py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-page text-[28px]">{emoji}</div>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description ? <p className="max-w-md text-[13px] text-muted">{description}</p> : null}
      {action}
    </div>
  )
}
