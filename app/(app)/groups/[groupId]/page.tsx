import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function GroupDashboardPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // メンバーでなければグループ一覧へリダイレクト
  const { data: membership } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    redirect('/groups')
  }

  const [{ data: group }, { data: members }, { data: plans }] = await Promise.all([
    supabase
      .from('groups')
      .select('id, name, image_url, created_by')
      .eq('id', groupId)
      .single(),
    supabase
      .from('group_members')
      .select('id, position, user_id, profiles(name, avatar_url, grade)')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true }),
    supabase
      .from('plans')
      .select('id, title, category, status, start_date, end_date, area, creator_id, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }),
  ])

  if (!group) {
    redirect('/groups')
  }

  // Supabase FK join は配列で返すため単一オブジェクトに正規化
  const normalizedMembers = (members ?? []).map((m) => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles,
  }))

  return (
    <DashboardClient
      group={group}
      members={normalizedMembers}
      plans={plans ?? []}
      currentUserId={user.id}
    />
  )
}
