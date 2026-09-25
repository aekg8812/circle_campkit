import { Skeleton } from '@/components/Skeleton'

// 計画詳細の読み込み中に出すスケルトン。
// 集合カード → 基本情報 → 行程表 の並びに形を合わせている。
export default function PlanDetailLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-28 rounded-2xl" />
      <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <Skeleton className="h-4 w-24" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </div>
      <div className="space-y-2 rounded-2xl bg-white p-5 shadow-sm">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    </div>
  )
}
