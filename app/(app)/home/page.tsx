import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getMissingDocumentFields } from '@/lib/profileCompleteness'

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
        .select('plans(id, group_id, title, status, start_date, end_date)')
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

  // 参加中の計画のうち、これから行われる直近の1件を「次の予定」として選ぶ
  const today = new Date().toISOString().slice(0, 10)
  const nextPlan = (myParticipations ?? [])
    .map((participation) =>
      Array.isArray(participation.plans)
        ? (participation.plans[0] ?? null)
        : participation.plans
    )
    .filter(
      (plan): plan is NonNullable<typeof plan> =>
        plan != null &&
        plan.status !== 'past' &&
        (plan.start_date == null || plan.start_date >= today)
    )
    .sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'))[0]

  return (
    <div className="space-y-6">
      {/* トップ: 次の予定があればヒーロー表示、なければ使い方ガイドへの案内 */}
      {nextPlan ? (
        <NextPlanHero plan={nextPlan} groupName={groupNames.get(nextPlan.group_id) ?? ''} today={today} />
      ) : (
        <WelcomeStrip />
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

/** 参加中の直近の計画を大きく表示するヒーロー（カウントダウン付き） */
function NextPlanHero({
  plan,
  groupName,
  today,
}: {
  plan: {
    id: string
    group_id: string
    title: string
    start_date: string | null
    end_date: string | null
  }
  groupName: string
  today: string
}) {
  const countdown = getCountdownLabel(plan.start_date, today)
  const dateLabel =
    plan.start_date && plan.end_date && plan.start_date !== plan.end_date
      ? `${formatJpDate(plan.start_date)} 〜 ${formatJpDate(plan.end_date)}`
      : plan.start_date
        ? formatJpDate(plan.start_date)
        : '日程未定'

  return (
    <Link
      href={`/groups/${plan.group_id}/plans/${plan.id}`}
      className="animate-fade-in-up group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 to-emerald-500 p-5 text-white shadow-sm transition hover:shadow-lg active:scale-[0.99]"
    >
      <HeroSilhouette />
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-green-50/90">
            次の予定
          </p>
          {countdown && (
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm">
              {countdown}
            </span>
          )}
        </div>
        <h2 className="mt-2 text-xl font-bold leading-tight">{plan.title}</h2>
        <p className="mt-1 text-sm text-green-50">
          {groupName && `${groupName}・`}
          {dateLabel}
        </p>
        <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-white/90 transition group-hover:gap-2">
          計画を開く →
        </p>
      </div>
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
