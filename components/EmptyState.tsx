// 空状態の共通表示。素っ気ない「まだありません」を、
// アイコン＋ひとこと＋（任意で）次の行動ボタン付きのカードに統一する。

export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
  bare = false,
  className = '',
}: {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
  /** カードの枠を出さず、中身だけ表示する（親が既にカードのとき用） */
  bare?: boolean
  className?: string
}) {
  const wrapper = bare
    ? 'px-6 py-8 text-center'
    : 'rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-black/[0.03]'

  return (
    <div className={`${wrapper} ${className}`}>
      <div
        aria-hidden
        className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50 text-3xl"
      >
        {icon}
      </div>
      <p className="text-sm font-bold text-gray-700">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-gray-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
