import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlanDetailClient from './PlanDetailClient'

export default async function PlanDetailPage({
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

  const [
    { data: membership },
    { data: group },
    { data: plan },
    { data: groupMembers },
  ] = await Promise.all([
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
      .select('id, group_id, creator_id, title, category, status, start_date, end_date, area, description, default_transport, created_at, updated_at')
      .eq('id', planId)
      .eq('group_id', groupId)
      .single(),
    supabase
      .from('group_members')
      .select('user_id, position')
      .eq('group_id', groupId),
  ])

  if (!membership || !group) {
    redirect('/groups')
  }

  if (!plan) {
    redirect(`/groups/${groupId}`)
  }

  const [
    { data: scheduleItems },
    { data: recruitment },
    { data: participants },
  ] = await Promise.all([
    supabase
      .from('schedule_items')
      .select('id, day, time, sort_order, time_label, location_name, location_type, map_query, note, transport')
      .eq('plan_id', planId)
      .order('day', { ascending: true, nullsFirst: false })
      .order('time', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true }),
    supabase
      .from('recruitments')
      .select('id, type, capacity, deadline, is_closed')
      .eq('plan_id', planId)
      .maybeSingle(),
    supabase
      .from('participants')
      .select('id, user_id, joined_at, profiles(name, avatar_url, grade)')
      .eq('plan_id', planId)
      .order('joined_at', { ascending: true }),
  ])

  const memberPositions = new Map(
    (groupMembers ?? []).map((member) => [member.user_id, member.position ?? '部員'])
  )

  const normalizedParticipants = (participants ?? []).map((participant) => ({
    ...participant,
    profiles: Array.isArray(participant.profiles)
      ? (participant.profiles[0] ?? null)
      : participant.profiles,
    position: memberPositions.get(participant.user_id) ?? '部員',
  }))

  return (
    <PlanDetailClient
      group={group}
      plan={plan}
      scheduleItems={scheduleItems ?? []}
      recruitment={recruitment}
      participants={normalizedParticipants}
      currentUserId={user.id}
    />
  )
}
