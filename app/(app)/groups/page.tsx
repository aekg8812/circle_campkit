import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
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
      <div className="mb-6 flex items-center gap-3">
        <Link href="/home" className="text-sm text-gray-500 hover:text-gray-700">
          ← ホーム
        </Link>
        <h1 className="text-xl font-bold text-gray-800">グループに参加・作成</h1>
      </div>
      <GroupsClient
        myGroups={myGroups}
        otherGroups={otherGroups}
        initialJoinGroupId={join ?? null}
      />
    </div>
  )
}
