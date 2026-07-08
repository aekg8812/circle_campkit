import { Skeleton } from '@/components/Skeleton'

// グループダッシュボード読み込み中のスケルトン
export default function GroupLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-52 rounded-2xl" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      </div>
    </div>
  )
}
