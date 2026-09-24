import { Skeleton } from '@/components/Skeleton'

// 提出書類の読み込み中に出すスケルトン。
// 計画・参加者・プロフィール・過去の書類までまとめて取得するため
// 遷移が重く、無反応に見えやすいので必ず出す。
export default function PlanDocumentLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-56" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  )
}
