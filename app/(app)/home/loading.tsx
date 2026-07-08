import { Skeleton, SkeletonCard } from '@/components/Skeleton'

// ホーム読み込み中に表示されるスケルトン（体感速度の向上）
export default function HomeLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 rounded-2xl" />
      <div className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  )
}
