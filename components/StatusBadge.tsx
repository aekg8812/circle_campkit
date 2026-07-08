// 計画の状態バッジ。色を全画面で統一する（下書き=グレー / 募集中=緑 / 過去=青）。
const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: '下書き', className: 'bg-gray-100 text-gray-600' },
  recruiting: { label: '募集中', className: 'bg-green-100 text-green-700' },
  past: { label: '過去', className: 'bg-sky-100 text-sky-700' },
}

export function StatusBadge({
  status,
  className = '',
}: {
  status: string | null | undefined
  className?: string
}) {
  const style =
    STATUS_STYLES[status ?? ''] ?? { label: '計画', className: 'bg-gray-100 text-gray-600' }

  return (
    <span
      className={`inline-flex flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.className} ${className}`}
    >
      {style.label}
    </span>
  )
}
