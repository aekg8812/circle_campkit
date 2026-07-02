'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  name: string
  avatar_url: string | null
  grade: number | null
}

type Member = {
  id: string
  position: string
  user_id: string
  profiles: Profile | null
}

type Group = {
  id: string
  name: string
  image_url: string | null
  created_by: string | null
}

type Plan = {
  id: string
  title: string
  category: string | null
  status: 'draft' | 'recruiting' | 'past' | string | null
  start_date: string | null
  end_date: string | null
  area: string | null
  creator_id: string | null
  created_at: string | null
}

type Props = {
  group: Group
  members: Member[]
  plans: Plan[]
  currentUserId: string
}

type PlanTab = 'draft' | 'recruiting' | 'past'

export default function DashboardClient({ group, members, plans, currentUserId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<PlanTab>('draft')
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const visiblePlans = plans.filter((plan) => plan.status === activeTab)

  const handleLeave = async () => {
    if (!confirm(`「${group.name}」から脱退しますか？`)) return
    setLeaving(true)
    setLeaveError(null)
    const { error } = await supabase.rpc('leave_group', {
      p_group_id: group.id,
    })
    if (error) {
      setLeaveError(error.message)
      setLeaving(false)
      return
    }
    router.push('/groups')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* グループヘッダー */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="w-full h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
          {group.image_url ? (
            <Image
              src={group.image_url}
              alt={group.name}
              width={800}
              height={160}
              className="object-cover w-full h-full"
            />
          ) : (
            <span className="text-6xl text-gray-200">&#x26FA;</span>
          )}
        </div>
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">{group.name}</h1>
          <button
            onClick={handleLeave}
            disabled={leaving}
            className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
          >
            {leaving ? '処理中...' : '脱退'}
          </button>
        </div>
        {leaveError && (
          <p className="text-sm text-red-600 bg-red-50 px-4 pb-3">{leaveError}</p>
        )}
      </div>

      {/* メンバー一覧 */}
      <section>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          メンバー（{members.length}人）
        </h2>
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {m.profiles?.avatar_url ? (
                  <Image
                    src={m.profiles.avatar_url}
                    alt={m.profiles.name}
                    width={36}
                    height={36}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <span className="text-base text-gray-400">&#128100;</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {m.profiles?.name ?? '（名前未設定）'}
                  {m.user_id === currentUserId && (
                    <span className="ml-1 text-xs text-green-600 font-normal">（あなた）</span>
                  )}
                </p>
                {m.profiles?.grade != null && (
                  <p className="text-xs text-gray-400">{m.profiles.grade}年生</p>
                )}
              </div>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                {m.position}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 計画一覧 */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            計画
          </h2>
          <Link
            href={`/groups/${group.id}/plans/new`}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700"
          >
            ＋ 計画を作成
          </Link>
        </div>
        <div className="bg-white rounded-2xl shadow-sm">
          <div className="flex border-b border-gray-100">
            <PlanTabButton
              label="下書き"
              active={activeTab === 'draft'}
              onClick={() => setActiveTab('draft')}
            />
            <PlanTabButton
              label="募集中"
              active={activeTab === 'recruiting'}
              onClick={() => setActiveTab('recruiting')}
            />
            <PlanTabButton
              label="過去"
              active={activeTab === 'past'}
              onClick={() => setActiveTab('past')}
            />
          </div>

          {visiblePlans.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              {activeTab === 'draft'
                ? '下書きの計画はありません'
                : activeTab === 'recruiting'
                  ? '募集中の計画はありません'
                  : '過去の計画はありません'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {visiblePlans.map((plan) => (
                <Link
                  key={plan.id}
                  href={`/groups/${group.id}/plans/${plan.id}`}
                  className="block px-4 py-4 transition hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-800">
                        {plan.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {[plan.category, formatDateRange(plan.start_date, plan.end_date), plan.area]
                          .filter(Boolean)
                          .join(' ／ ') || '日程・場所未設定'}
                      </p>
                    </div>
                    <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      {plan.creator_id === currentUserId ? '起案者' : statusLabel(plan.status)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function PlanTabButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-sm font-semibold transition ${
        active
          ? 'border-b-2 border-green-600 text-green-700'
          : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      {label}
    </button>
  )
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) return ''
  if (startDate && endDate && startDate !== endDate) {
    return `${startDate} 〜 ${endDate}`
  }
  return startDate || endDate || ''
}

function statusLabel(status: Plan['status']) {
  if (status === 'draft') return '下書き'
  if (status === 'recruiting') return '募集中'
  if (status === 'past') return '過去'
  return '計画'
}
