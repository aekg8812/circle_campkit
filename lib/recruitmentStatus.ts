// 募集の「締切状況」と「定員状況」の表示ロジック。
// グループの計画一覧とホームの募集中カードで共有する。

export type RecruitmentInfo = {
  deadline: string | null
  capacity: number | null
  is_closed: boolean | null
}

/** 締切日時を「7/18 18:00」形式にする */
export function formatDeadline(deadline: string): string {
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return ''
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${month}/${day} ${hh}:${mm}`
}

/** 締切までの残り状況（「あと3日」「本日締切」「締切済」など）と色 */
export function getDeadlineStatus(
  deadline: string | null,
  now: number = Date.now()
): { text: string; className: string } | null {
  if (!deadline) return null

  const target = new Date(deadline).getTime()
  if (Number.isNaN(target)) return null

  const diffMs = target - now
  if (diffMs <= 0) {
    return { text: '締切済', className: 'bg-gray-100 text-gray-500' }
  }

  const diffHours = diffMs / (1000 * 60 * 60)
  if (diffHours < 24) {
    return { text: '本日締切', className: 'bg-red-100 text-red-700' }
  }

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays <= 3) {
    return { text: `締切間近・あと${diffDays}日`, className: 'bg-amber-100 text-amber-700' }
  }

  return { text: `あと${diffDays}日`, className: 'bg-gray-100 text-gray-600' }
}

/** 定員状況（「3/10人」または「3人」） */
export function formatCapacity(participantCount: number, capacity: number | null): string {
  return capacity != null ? `${participantCount}/${capacity}人` : `${participantCount}人`
}

/** 定員に達しているか */
export function isCapacityFull(participantCount: number, capacity: number | null): boolean {
  return capacity != null && participantCount >= capacity
}

/**
 * 募集が締め切られているか。
 * 「起案者が締め切った」「締切日時を過ぎた」「定員が埋まった」のいずれか。
 */
export function isRecruitmentClosed(
  recruitment: RecruitmentInfo | null | undefined,
  participantCount: number,
  now: number = Date.now()
): boolean {
  if (!recruitment) return false
  if (recruitment.is_closed) return true
  if (recruitment.deadline && new Date(recruitment.deadline).getTime() <= now) return true
  return isCapacityFull(participantCount, recruitment.capacity)
}

export type PlanPhase = 'draft' | 'recruiting' | 'in_progress' | 'past'

/** ローカル時刻での今日（YYYY-MM-DD） */
export function todayLocal(now: Date = new Date()): string {
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * 表示用のフェーズを求める。状態遷移は一方向（不可逆）:
 *   下書き →（募集開始）→ 募集中 →（締切/定員/締め切り操作）→ 実施 →（実施日経過）→ 過去
 *
 * 「実施」と「過去」はDBの状態を書き換えずに自動判定する。
 * これにより、実施日を過ぎた計画が「募集中/実施」のまま残る問題が起きない。
 */
export function getPlanPhase(params: {
  status: string | null | undefined
  recruitmentClosed: boolean
  startDate?: string | null
  endDate?: string | null
  today?: string
}): PlanPhase {
  const { status, recruitmentClosed, startDate, endDate } = params
  const today = params.today ?? todayLocal()

  // 起案者が明示的に終了した計画
  if (status === 'past') return 'past'
  // 未公開（下書き）はそのまま
  if (status !== 'recruiting') return 'draft'

  // 実施日（終了日、無ければ開始日）を過ぎていれば自動的に「過去」
  const lastDay = endDate || startDate
  if (lastDay && lastDay < today) return 'past'

  // 募集が締め切られていれば「実施」
  if (recruitmentClosed) return 'in_progress'

  return 'recruiting'
}
