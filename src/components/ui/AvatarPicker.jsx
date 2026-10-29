import { useRef, useState } from 'react'
import SmartImage from './SmartImage'
import { apiUploadSellerImage } from '../../utils/api'

export function readImageAsDataUrl(file, maxSize = 1200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không đọc được tệp ảnh.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Tệp không phải ảnh hợp lệ.'))
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.88))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export default function AvatarPicker({ value = {}, onChange, title = 'Ảnh đại diện', note = '' }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pickFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setError('Chọn ảnh PNG, JPG hoặc WebP có dung lượng tối đa 5 MB.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const dataUrl = await readImageAsDataUrl(file)
      const response = await apiUploadSellerImage(dataUrl)
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success || !result?.data?.url) {
        throw new Error(result?.message || `Không thể tải ảnh lên (HTTP ${response.status}).`)
      }
      onChange({ avatarUrl: result.data.url })
    } catch (uploadError) {
      setError(uploadError.message || 'Có lỗi khi tải ảnh lên.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-sm border border-line p-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="relative grid h-[76px] w-[76px] shrink-0 place-items-center overflow-hidden rounded-full border-2 border-brand-soft bg-white">
          <SmartImage src={value.avatarUrl || ''} alt="Ảnh đại diện" className="h-full w-full object-cover" />
          {busy ? <span className="absolute inset-0 grid place-items-center bg-black/40 text-[11px] font-medium text-white">Đang tải...</span> : null}
        </span>
        <div className="min-w-[200px] flex-1">
          <p className="text-[13px] font-semibold text-ink">{title}</p>
          {note ? <p className="mt-0.5 text-[12px] text-muted">{note}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="rounded-sm bg-brand px-3.5 py-1.5 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-60">
              Tải ảnh lên
            </button>
            {value.avatarUrl ? <button type="button" onClick={() => onChange({ avatarUrl: null })} className="rounded-sm border border-line px-3.5 py-1.5 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand">Xóa ảnh</button> : null}
          </div>
          {error ? <p className="mt-2 text-[12px] text-rose-600">{error}</p> : null}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={pickFile} className="hidden" aria-label="Chọn ảnh đại diện" />
      <p className="mt-4 text-[11px] text-muted">Ảnh do bạn tải lên sẽ được lưu trên máy chủ. Khi chưa có ảnh, gian hàng sẽ hiển thị trạng thái chưa có ảnh.</p>
    </div>
  )
}
