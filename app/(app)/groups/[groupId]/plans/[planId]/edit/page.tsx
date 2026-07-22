import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EditPlanClient from './EditPlanClient'

export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ groupId: string; planId: string }>
}) {
  const { groupId, planId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: membership }, { data: group }, { data: plan }] = await Promise.all([
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
    supabase
      .from('plans')
      .select('id, group_id, creator_id, title, category, start_date, end_date, area, description, budget_per_person')
      .eq('id', planId)
      .eq('group_id', groupId)
      .single(),
  ])

  if (!membership || !group) {
    redirect('/groups')
  }

  if (!plan) {
    redirect(`/groups/${groupId}`)
  }

  // 編集は起案者のみ
  if (plan.creator_id !== user.id) {
    redirect(`/groups/${groupId}/plans/${planId}`)
  }

  return <EditPlanClient group={group} plan={plan} />
}
