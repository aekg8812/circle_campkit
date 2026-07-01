'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

type Props = {
  group: Group
  members: Member[]
  currentUserId: string
}

type PlanTab = 'recruiting' | 'past'

export default function DashboardClient({ group, members, currentUserId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<PlanTab>('recruiting')
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)

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

      {/* 計画一覧（Phase 3 で実装） */}
      <section>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          計画
        </h2>
        <div className="bg-white rounded-2xl shadow-sm">
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setActiveTab('recruiting')}
              className={`flex-1 py-3 text-sm font-semibold transition ${
                activeTab === 'recruiting'
                  ? 'text-green-700 border-b-2 border-green-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              募集中
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`flex-1 py-3 text-sm font-semibold transition ${
                activeTab === 'past'
                  ? 'text-green-700 border-b-2 border-green-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              過去
            </button>
          </div>
          <div className="p-8 text-center text-gray-400 text-sm">
            Phase 3 で実装予定
          </div>
        </div>
      </section>
    </div>
  )
}
