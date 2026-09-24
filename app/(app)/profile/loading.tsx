import { Skeleton } from '@/components/Skeleton'

// プロフィール画面の読み込み中に出すスケルトン
export default function ProfileLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-12 rounded-2xl" />
      <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <Skeleton className="h-20 w-20 rounded-full" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    </div>
  )
}
