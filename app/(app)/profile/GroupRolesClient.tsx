'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'

type Membership = {
  group_id: string
  group_name: string
  position: string
}

const POSITIONS = ['部長', '副部長', '部員']

export default function GroupRolesClient({ memberships }: { memberships: Membership[] }) {
  const supabase = createClient()
  const toast = useToast()
  const router = useRouter()
  const [saving, setSaving] = useState<string | null>(null)
  // 楽観的に表示を更新するためのローカル状態
  const [roles, setRoles] = useState<Record<string, string>>(
    Object.fromEntries(memberships.map((m) => [m.group_id, m.position]))
  )

  const changeRole = async (groupId: string, position: string) => {
    const previous = roles[groupId]
    setRoles((current) => ({ ...current, [groupId]: position }))
    setSaving(groupId)

    const { error } = await supabase.rpc('set_my_group_role', {
      p_group_id: groupId,
      p_position: position,
    })

    setSaving(null)
    if (error) {
      setRoles((current) => ({ ...current, [groupId]: previous }))
      toast('役職の変更に失敗しました', 'error')
      return
    }
    toast('役職を変更しました')
    router.refresh()
  }

  if (memberships.length === 0) return null

  return (
    <section className="mb-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.03]">
      <h2 className="text-sm font-bold text-gray-700">グループでの役職</h2>
      <p className="mt-1 text-xs text-gray-500">
        参加しているグループごとに、自分の役職を選べます。計画書の名簿の「役職」欄に反映されます。
      </p>
      <div className="mt-4 divide-y divide-gray-100">
        {memberships.map((membership) => (
          <div
            key={membership.group_id}
            className="flex items-center justify-between gap-3 py-2.5"
          >
            <span className="min-w-0 truncate text-sm font-semibold text-gray-800">
              {membership.group_name}
            </span>
            <select
              value={roles[membership.group_id] ?? '部員'}
              onChange={(event) => changeRole(membership.group_id, event.target.value)}
              disabled={saving === membership.group_id}
              className="flex-shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
            >
              {POSITIONS.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </section>
  )
}
