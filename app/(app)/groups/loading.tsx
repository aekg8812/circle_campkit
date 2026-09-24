import { Skeleton, SkeletonCard } from '@/components/Skeleton'

// グループ一覧の読み込み中に出すスケルトン
export default function GroupsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-14 rounded-2xl" />
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  )
}
