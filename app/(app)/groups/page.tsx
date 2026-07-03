import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GroupsClient from './GroupsClient'

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ join?: string }>
}) {
  const { join } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: allGroups }, { data: myMemberships }] = await Promise.all([
    supabase
      .from('groups')
      .select('id, name, image_url')
      .order('created_at', { ascending: false }),
    supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id),
  ])

  const myGroupIds = new Set((myMemberships ?? []).map((m) => m.group_id))
  const myGroups = (allGroups ?? []).filter((g) => myGroupIds.has(g.id))
  const otherGroups = (allGroups ?? []).filter((g) => !myGroupIds.has(g.id))

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">グループ</h1>
      <GroupsClient
        myGroups={myGroups}
        otherGroups={otherGroups}
        initialJoinGroupId={join ?? null}
      />
    </div>
  )
}
