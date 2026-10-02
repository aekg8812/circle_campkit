import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EditPlanClient from './EditPlanClient'

export const metadata = { title: '計画を編集' }

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
      .select('id, group_id, creator_id, title, category, start_date, end_date, area, description, budget_per_person, default_transport')
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

  // 行程表と募集設定も、この画面でまとめて編集する
  const [{ data: scheduleItems }, { data: recruitment }] = await Promise.all([
    supabase
      .from('schedule_items')
      .select('id, day, time, sort_order, time_label, location_name, note, transport')
      .eq('plan_id', planId)
      .order('day', { ascending: true, nullsFirst: false })
      .order('time', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true }),
    supabase
      .from('recruitments')
      .select('id, type, capacity, deadline, is_closed')
      .eq('plan_id', planId)
      .maybeSingle(),
  ])

  return (
    <EditPlanClient
      group={group}
      plan={plan}
      scheduleItems={scheduleItems ?? []}
      recruitment={recruitment}
    />
  )
}
