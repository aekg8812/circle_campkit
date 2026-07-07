import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', user.id)
      .single(),
    supabase
      .from('group_members')
      .select('group_id, position, groups(id, name, image_url)')
      .eq('user_id', user.id),
  ])

  const myGroups = (memberships ?? []).map((membership) => ({
    position: membership.position ?? '部員',
    group: Array.isArray(membership.groups)
      ? (membership.groups[0] ?? null)
      : membership.groups,
  })).filter((entry) => entry.group != null)

  const groupIds = myGroups.map((entry) => entry.group!.id)

  const [{ data: myParticipations }, { data: recruitingPlans }] = await Promise.all([
    supabase
      .from('participants')
      .select('plan_id, plans(id, group_id, title, category, status, start_date, end_date, area)')
      .eq('user_id', user.id),
    groupIds.length > 0
      ? supabase
          .from('plans')
          .select('id, group_id, title, category, status, start_date, end_date, area')
          .in('group_id', groupIds)
          .eq('status', 'recruiting')
          .order('start_date', { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] }),
  ])

  const groupNames = new Map(myGroups.map((entry) => [entry.group!.id, entry.group!.name]))

  const upcomingPlans = (myParticipations ?? [])
    .map((participation) =>
      Array.isArray(participation.plans)
        ? (participation.plans[0] ?? null)
        : participation.plans
    )
    .filter((plan): plan is NonNullable<typeof plan> => plan != null && plan.status !== 'past')
    .sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'))

  return (
    <div className="space-y-8">
      {/* あいさつ */}
      <section className="animate-fade-in-up rounded-2xl bg-gradient-to-br from-green-600 to-emerald-500 p-6 text-white shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20">
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt=""
                width={56}
                height={56}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-2xl">⛺</span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold">
              こんにちは、{profile?.name ?? 'ゲスト'}さん
            </h1>
            <p className="mt-1 text-sm text-green-50">
              CampKit — サークル活動の計画から計画書作成までを一元管理
            </p>
          </div>
        </div>
      </section>

      {/* クイックリンク */}
      <section className="animate-fade-in-up grid grid-cols-2 gap-3 sm:grid-cols-4 [animation-delay:80ms]">
        <QuickLink href="/groups" icon="👥" label="グループ" />
        <QuickLink href="/profile" icon="🪪" label="プロフィール" />
        <QuickLink href="/profile/cars" icon="🚗" label="車の登録" />
        <QuickLink href="/profile/gear" icon="🎒" label="道具の登録" />
      </section>

      {/* 参加予定の計画 */}
      <section className="animate-fade-in-up space-y-3 [animation-delay:160ms]">
        <h2 className="text-sm font-bold text-gray-700">参加予定の計画</h2>
        {upcomingPlans.length === 0 ? (
          <EmptyCard text="参加予定の計画はまだありません" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcomingPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                groupName={groupNames.get(plan.group_id) ?? ''}
              />
            ))}
          </div>
        )}
      </section>

      {/* 募集中の計画 */}
      <section className="animate-fade-in-up space-y-3 [animation-delay:240ms]">
        <h2 className="text-sm font-bold text-gray-700">募集中の計画</h2>
        {(recruitingPlans ?? []).length === 0 ? (
          <EmptyCard text="現在募集中の計画はありません" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(recruitingPlans ?? []).map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                groupName={groupNames.get(plan.group_id) ?? ''}
              />
            ))}
          </div>
        )}
      </section>

      {/* 自分のグループ */}
      <section className="animate-fade-in-up space-y-3 [animation-delay:320ms]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700">自分のグループ</h2>
          <Link href="/groups" className="text-xs font-semibold text-green-600 hover:underline">
            すべて見る →
          </Link>
        </div>
        {myGroups.length === 0 ? (
          <EmptyCard text="まだグループに参加していません">
            <Link
              href="/groups"
              className="mt-2 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              グループを探す
            </Link>
          </EmptyCard>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {myGroups.map((entry) => (
              <Link
                key={entry.group!.id}
                href={`/groups/${entry.group!.id}`}
                className="group flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                  {entry.group!.image_url ? (
                    <Image
                      src={entry.group!.image_url}
                      alt=""
                      width={48}
                      height={48}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xl text-gray-300">⛺</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-800 group-hover:text-green-700">
                    {entry.group!.name}
                  </p>
                  <p className="text-xs text-gray-500">{entry.position}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1.5 rounded-2xl bg-white py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-95"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-semibold text-gray-700">{label}</span>
    </Link>
  )
}

function PlanCard({
  plan,
  groupName,
}: {
  plan: {
    id: string
    group_id: string
    title: string
    category: string | null
    status: string | null
    start_date: string | null
    end_date: string | null
    area: string | null
  }
  groupName: string
}) {
  const dateLabel =
    plan.start_date && plan.end_date && plan.start_date !== plan.end_date
      ? `${plan.start_date} 〜 ${plan.end_date}`
      : (plan.start_date ?? '日程未定')

  return (
    <Link
      href={`/groups/${plan.group_id}/plans/${plan.id}`}
      className="group rounded-2xl bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold uppercase tracking-wider text-gray-400">
          {groupName}
        </p>
        <span
          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            plan.status === 'recruiting'
              ? 'bg-green-50 text-green-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {plan.status === 'recruiting' ? '募集中' : plan.status === 'draft' ? '下書き' : '計画'}
        </span>
      </div>
      <p className="mt-1 truncate text-sm font-bold text-gray-800 group-hover:text-green-700">
        {plan.title}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        {dateLabel}
        {plan.area ? ` / ${plan.area}` : ''}
      </p>
    </Link>
  )
}

function EmptyCard({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-8 text-center shadow-sm">
      <p className="text-sm text-gray-400">{text}</p>
      {children}
    </div>
  )
}
