import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getMissingDocumentFields } from '@/lib/profileCompleteness'
import {
  formatCapacity,
  formatDeadline,
  getDeadlineStatus,
  getPlanPhase,
  isRecruitmentClosed,
  type RecruitmentInfo,
} from '@/lib/recruitmentStatus'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: profile }, { data: memberships }, { data: myParticipations }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('name, avatar_url, student_id, grade, department, phone, school_email, academic_advisor')
        .eq('id', user.id)
        .single(),
      supabase
        .from('group_members')
        .select('group_id, position, groups(id, name, image_url)')
        .eq('user_id', user.id),
      supabase
        .from('participants')
        .select('plan_id, plans(id, group_id, title, status, start_date, end_date)')
        .eq('user_id', user.id),
    ])

  const missingFields = getMissingDocumentFields(profile)

  const myGroups = (memberships ?? [])
    .map((membership) => ({
      position: membership.position ?? '部員',
      group: Array.isArray(membership.groups)
        ? (membership.groups[0] ?? null)
        : membership.groups,
    }))
    .filter((entry) => entry.group != null)

  const groupNames = new Map(myGroups.map((entry) => [entry.group!.id, entry.group!.name]))
  const groupIds = myGroups.map((entry) => entry.group!.id)

  // 所属グループで「募集中」の計画（未参加のものを後で抽出する）
  const { data: recruitingPlans } =
    groupIds.length > 0
      ? await supabase
          .from('plans')
          .select('id, group_id, title, status, start_date, end_date')
          .in('group_id', groupIds)
          .eq('status', 'recruiting')
      : { data: [] }

  const today = new Date().toISOString().slice(0, 10)
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const myParticipantPlanIds = new Set((myParticipations ?? []).map((p) => p.plan_id))

  // ① 参加確定した計画：開始7日前〜開催中のものだけ（多すぎて見にくくならないように）
  const confirmedSoon = (myParticipations ?? [])
    .map((participation) =>
      Array.isArray(participation.plans)
        ? (participation.plans[0] ?? null)
        : participation.plans
    )
    .filter(
      (plan): plan is NonNullable<typeof plan> =>
        plan != null &&
        plan.status !== 'past' &&
        plan.start_date != null &&
        plan.start_date <= in7Days &&
        (plan.end_date ?? plan.start_date) >= today
    )
    .map((plan) => ({ ...plan, kind: 'confirmed' as const }))

  // ② 自分が参加していない、募集中の計画
  const openPlans = (recruitingPlans ?? []).filter(
    (plan) => !myParticipantPlanIds.has(plan.id)
  )

  // 募集中カードに出す締切・定員の情報
  const openPlanIds = openPlans.map((plan) => plan.id)
  const [{ data: openRecruitments }, { data: openParticipantRows }] =
    openPlanIds.length > 0
      ? await Promise.all([
          supabase
            .from('recruitments')
            .select('plan_id, deadline, capacity, is_closed')
            .in('plan_id', openPlanIds),
          supabase.from('participants').select('plan_id').in('plan_id', openPlanIds),
        ])
      : [{ data: [] }, { data: [] }]

  const openCounts: Record<string, number> = {}
  for (const row of openParticipantRows ?? []) {
    openCounts[row.plan_id] = (openCounts[row.plan_id] ?? 0) + 1
  }

  const recruitmentByPlan = Object.fromEntries(
    (openRecruitments ?? []).map((r) => [
      r.plan_id,
      { deadline: r.deadline, capacity: r.capacity, is_closed: r.is_closed },
    ])
  )

  // 締め切られた（＝実施）・実施日を過ぎた（＝過去）ものは参加できないので出さない
  const recruitingOpen = openPlans
    .filter(
      (plan) =>
        getPlanPhase({
          status: plan.status,
          recruitmentClosed: isRecruitmentClosed(
            recruitmentByPlan[plan.id],
            openCounts[plan.id] ?? 0
          ),
          startDate: plan.start_date,
          endDate: plan.end_date,
          today,
        }) === 'recruiting'
    )
    .map((plan) => ({
      ...plan,
      kind: 'recruiting' as const,
      recruitment: recruitmentByPlan[plan.id] ?? null,
      participantCount: openCounts[plan.id] ?? 0,
    }))

  const upcoming = [
    ...confirmedSoon.map((plan) => ({
      ...plan,
      recruitment: null,
      participantCount: 0,
    })),
    ...recruitingOpen,
  ].sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'))

  return (
    <div className="space-y-6">
      {/* トップ: 今後の予定（参加確定は7日前から＋未参加の募集中）。無ければ案内 */}
      {upcoming.length > 0 ? (
        <UpcomingList items={upcoming} groupNames={groupNames} today={today} />
      ) : (
        myGroups.length === 0 && <WelcomeStrip />
      )}

      {/* プロフィール完成度バナー（計画書に必要な項目が未入力のときだけ表示） */}
      {missingFields.length > 0 && (
        <Link
          href="/profile"
          className="animate-fade-in-up flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 transition hover:bg-amber-100 [animation-delay:40ms]"
        >
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-800">
              プロフィールを完成させましょう
            </p>
            <p className="mt-0.5 text-xs leading-5 text-amber-700">
              計画書に必要な{missingFields.length}項目が未入力です（
              {missingFields.map((field) => field.label).join('・')}）
            </p>
          </div>
          <span className="flex-shrink-0 text-xl text-amber-400">→</span>
        </Link>
      )}

      {/* 自分のグループ（ホームの主役） */}
      <section className="animate-fade-in-up space-y-4 [animation-delay:80ms]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold text-gray-800">自分のグループ</h2>
          {myGroups.length > 0 && (
            <span className="text-sm text-gray-400">{myGroups.length}件</span>
          )}
        </div>

        {myGroups.length === 0 ? (
          <EmptyGroups />
        ) : (
          <>
            <p className="text-sm text-gray-500">
              グループを開くと、計画の作成・参加や計画書づくりができます。
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {myGroups.map((entry) => (
                <Link
                  key={entry.group!.id}
                  href={`/groups/${entry.group!.id}`}
                  className="group overflow-hidden rounded-2xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]"
                >
                  <div className="flex h-32 items-center justify-center overflow-hidden bg-gray-100">
                    {entry.group!.image_url ? (
                      <Image
                        src={entry.group!.image_url}
                        alt=""
                        width={400}
                        height={128}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <span className="text-5xl text-gray-300">⛺</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-gray-800 group-hover:text-green-700">
                        {entry.group!.name}
                      </p>
                      <p className="text-xs text-gray-400">{entry.position}</p>
                    </div>
                    <span className="flex-shrink-0 text-xl text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-green-500">
                      →
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* グループを追加する大きなボタン */}
            <Link
              href="/groups"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-green-300 bg-white py-5 text-base font-bold text-green-700 transition hover:border-green-500 hover:bg-green-50 active:scale-[0.99]"
            >
              ＋ グループに参加 / 新しく作る
            </Link>
          </>
        )}
      </section>
    </div>
  )
}

type UpcomingItem = {
  id: string
  group_id: string
  title: string
  start_date: string | null
  end_date: string | null
  kind: 'confirmed' | 'recruiting'
  recruitment: RecruitmentInfo | null
  participantCount: number
}

/** 今後の予定リスト（参加確定＝緑ヒーロー風、募集中＝白カード） */
function UpcomingList({
  items,
  groupNames,
  today,
}: {
  items: UpcomingItem[]
  groupNames: Map<string, string>
  today: string
}) {
  return (
    <section className="animate-fade-in-up space-y-3">
      <h2 className="text-base font-bold text-gray-800">今後の予定</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <UpcomingCard
            key={item.id}
            item={item}
            groupName={groupNames.get(item.group_id) ?? ''}
            today={today}
          />
        ))}
      </div>
    </section>
  )
}

function UpcomingCard({
  item,
  groupName,
  today,
}: {
  item: UpcomingItem
  groupName: string
  today: string
}) {
  const dateLabel =
    item.start_date && item.end_date && item.start_date !== item.end_date
      ? `${formatJpDate(item.start_date)} 〜 ${formatJpDate(item.end_date)}`
      : item.start_date
        ? formatJpDate(item.start_date)
        : '日程未定'

  const href = `/groups/${item.group_id}/plans/${item.id}`

  // 参加確定は緑のヒーロー風、募集中は白カード
  if (item.kind === 'confirmed') {
    const countdown = getCountdownLabel(item.start_date, today)
    return (
      <Link
        href={href}
        className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 to-emerald-500 p-5 text-white shadow-sm transition hover:shadow-lg active:scale-[0.99]"
      >
        <HeroSilhouette />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold backdrop-blur-sm">
              参加確定
            </span>
            {countdown && (
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm">
                {countdown}
              </span>
            )}
          </div>
          <h3 className="mt-2 text-lg font-bold leading-tight">{item.title}</h3>
          <p className="mt-1 text-sm text-green-50">
            {groupName && `${groupName}・`}
            {dateLabel}
          </p>
        </div>
      </Link>
    )
  }

  // 募集中カード：締切状況・定員を出し、「参加する」で詳細ページへ
  const deadlineStatus = getDeadlineStatus(item.recruitment?.deadline ?? null)
  const isClosed = item.recruitment?.is_closed === true

  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.03] transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
    >
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
            募集中
          </span>
          {groupName && <span className="truncate text-xs text-gray-400">{groupName}</span>}
        </div>
        <p className="truncate text-sm font-bold text-gray-800 group-hover:text-green-700">
          {item.title}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">{dateLabel}</p>

        {/* 締切状況・定員状況 */}
        {item.recruitment && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {isClosed ? (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                締め切り済み
              </span>
            ) : (
              deadlineStatus && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${deadlineStatus.className}`}
                >
                  {deadlineStatus.text}
                </span>
              )
            )}
            {item.recruitment.deadline && (
              <span className="text-xs text-gray-500">
                締切 {formatDeadline(item.recruitment.deadline)}
              </span>
            )}
            <span className="text-xs text-gray-500">
              ・{formatCapacity(item.participantCount, item.recruitment.capacity)}
            </span>
          </div>
        )}
      </div>

      {/* 参加ボタン（押すと計画の詳細ページへ） */}
      <span className="btn-primary flex-shrink-0 whitespace-nowrap">参加する →</span>
    </Link>
  )
}

/** ヒーローカードの下部に敷く、ごく薄い山のシルエット */
function HeroSilhouette() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-16 w-full text-white/10"
      viewBox="0 0 1200 120"
      preserveAspectRatio="none"
    >
      <path
        d="M0 80 L200 42 L400 82 L600 34 L800 82 L1000 44 L1200 76 L1200 120 L0 120 Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** 予定がまだ無い人向けの案内（使い方ガイドへ誘導） */
function WelcomeStrip() {
  return (
    <section className="animate-fade-in-up relative flex flex-col gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 to-emerald-500 p-5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <HeroSilhouette />
      <div className="relative z-10 min-w-0">
        <p className="text-lg font-bold">CampKit へようこそ ⛺</p>
        <p className="mt-1 text-sm text-green-50">
          サークルの計画づくりから、学校提出用の計画書作成までをまとめて。
        </p>
      </div>
      <Link
        href="/help"
        className="relative z-10 inline-flex flex-shrink-0 items-center justify-center gap-1 rounded-xl bg-white/95 px-5 py-2.5 text-sm font-bold text-green-700 shadow-sm transition hover:bg-white active:scale-[0.98]"
      >
        使い方ガイドを見る →
      </Link>
    </section>
  )
}

/** 開始日までの残り日数を「今日 / 明日 / あと○日」で表す */
function getCountdownLabel(startDate: string | null, today: string): string | null {
  if (!startDate) return null
  const start = new Date(startDate + 'T00:00:00')
  const base = new Date(today + 'T00:00:00')
  const diffDays = Math.round((start.getTime() - base.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return '開催中・当日'
  if (diffDays === 1) return '明日'
  return `あと${diffDays}日`
}

function formatJpDate(value: string): string {
  const [, month, day] = value.split('-').map(Number)
  if (!month || !day) return value
  return `${month}月${day}日`
}

/** グループ未参加のユーザー向けの案内 */
function EmptyGroups() {
  return (
    <div className="animate-fade-in-up rounded-2xl bg-white px-6 py-10 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
        <span className="text-4xl">⛺</span>
      </div>
      <p className="text-base font-bold text-gray-800">
        まずはグループに参加しましょう
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-500">
        サークルのグループに参加するか、新しく作ると、計画の作成や参加ができるようになります。
      </p>
      <Link
        href="/groups"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-8 py-4 text-base font-bold text-white shadow-sm transition hover:bg-green-700 active:scale-[0.98]"
      >
        グループに参加・作成する
      </Link>
    </div>
  )
}
