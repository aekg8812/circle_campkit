import { Skeleton } from '@/components/Skeleton'

// 計画作成フォームの読み込み中に出すスケルトン
export default function NewPlanLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-14 rounded-2xl" />
      <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    </div>
  )
}
