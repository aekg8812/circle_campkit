import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewPlanClient from './NewPlanClient'

export default async function NewPlanPage({
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

  const [{ data: membership }, { data: group }] = await Promise.all([
    supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('groups')
      .select('id, name')
      .eq('id', groupId)
      .single(),
  ])

  if (!membership || !group) {
    redirect('/groups')
  }

  return <NewPlanClient group={group} currentUserId={user.id} />
}
