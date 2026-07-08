// スケルトンスクリーン（No.39）
// 目的: データ取得中に「白い画面 → 突然表示」ではなく、
//   コンテンツの形をした灰色のプレースホルダを見せることで
//   「読み込みが進んでいる」と体感でき、待ち時間のストレスを減らす。
// Next.js App Router では各ルートの loading.tsx がこの役割を担い、
//   ページ遷移中に自動で表示される。装飾なので aria-hidden。

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-lg bg-gray-200/70 ${className}`}
    />
  )
}

/** カード型のスケルトン（グループ・計画カードなどの雛形） */
export function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <Skeleton className="h-32 rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  )
}
