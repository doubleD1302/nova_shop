import { useRef, useState } from 'react'
import SmartImage from './SmartImage'
import { shopAvatar } from '../../utils/image'

const EMOJIS = ['🙂', '😎', '🦊', '🐱', '🐼', '🌸', '⚡', '🌿', '🎧', '👨', '👩', '🧑', '🏪', '🛍️', '💎', '🍀']

/**
 * Thu nhỏ ảnh người dùng tải lên (tối đa 256px) rồi chuyển thành data URL
 * => lưu được vào localStorage mà không bị quá dung lượng.
 */
export function readImageAsDataUrl(file, maxSize = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không đọc được tệp ảnh'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Tệp không phải ảnh hợp lệ'))
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Bộ đổi ẢNH ĐẠI DIỆN dùng chung cho tài khoản người dùng và gian hàng người bán.
 * value: { avatarUrl, emoji, hue, name }
 * onChange(patch): ví dụ onChange({ avatarUrl: '...' }) hoặc onChange({ emoji: '🦊' })
 */
export default function AvatarPicker({ value = {}, onChange, title = 'Ảnh đại diện', note = '' }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const emoji = value.emoji || '🙂'
  const hue = value.hue ?? 12
  const preview = value.avatarUrl || shopAvatar({ name: value.name || 'Người dùng', emoji, hue })

  const pickFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn tệp ảnh (jpg, png, webp...)')
      return
    }
    setBusy(true)
    setError('')
    try {
      const dataUrl = await readImageAsDataUrl(file)
      onChange({ avatarUrl: dataUrl })
    } catch (err) {
      setError(err.message || 'Có lỗi khi tải ảnh')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-sm border border-line p-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="relative grid h-[76px] w-[76px] shrink-0 place-items-center overflow-hidden rounded-full border-2 border-brand-soft bg-white">
          <SmartImage src={preview} fallback={preview} alt="Ảnh đại diện" className="h-full w-full object-cover" />
          {busy ? (
            <span className="absolute inset-0 grid place-items-center bg-black/40 text-[11px] font-medium text-white">
              Đang tải...
            </span>
          ) : null}
        </span>

        <div className="min-w-[200px] flex-1">
          <p className="text-[13px] font-semibold text-ink">{title}</p>
          {note ? <p className="mt-0.5 text-[12px] text-muted">{note}</p> : null}

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-sm bg-brand px-3.5 py-1.5 text-[13px] font-medium text-white transition hover:brightness-105"
            >
              Tải ảnh lên
            </button>
            <button
              type="button"
              onClick={() => onChange({ avatarUrl: null })}
              className="rounded-sm border border-line px-3.5 py-1.5 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
            >
              Xoá ảnh
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({
                  emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
                  hue: Math.floor(Math.random() * 360),
                  avatarUrl: null,
                })
              }
              className="rounded-sm border border-line px-3.5 py-1.5 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
            >
              Ngẫu nhiên
            </button>
          </div>

          {error ? <p className="mt-2 text-[12px] text-rose-600">{error}</p> : null}
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} className="hidden" aria-label="Chọn ảnh đại diện" />

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase text-muted">Chọn biểu tượng</p>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onChange({ emoji: e, avatarUrl: null })}
                className={`grid h-9 w-9 place-items-center rounded-full border text-[18px] transition ${
                  !value.avatarUrl && e === emoji ? 'border-brand bg-brand-soft' : 'border-line hover:border-brand-light'
                }`}
                aria-label={`Biểu tượng ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase text-muted">
            Màu nền (dùng khi chưa tải ảnh lên)
          </p>
          <input
            type="range"
            min="0"
            max="360"
            value={hue}
            onChange={(e) => onChange({ hue: Number(e.target.value) })}
            className="w-full accent-[#ee4d2d]"
          />
          <div
            className="mt-2 h-3 w-full rounded-full"
            style={{
              backgroundImage:
                'linear-gradient(90deg, hsl(0 85% 55%), hsl(60 85% 55%), hsl(180 85% 45%), hsl(300 85% 55%), hsl(360 85% 55%))',
            }}
          />
          <p className="mt-2 text-[11px] text-muted">
            Ảnh đại diện dùng ngay ở header, trang tài khoản và các đánh giá của bạn.
          </p>
        </div>
      </div>
    </div>
  )
}
