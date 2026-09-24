import { Skeleton } from '@/components/Skeleton'

// 計画の基本情報を編集する画面の読み込み中に出すスケルトン
export default function EditPlanLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-40" />
      <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-24" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  )
}
