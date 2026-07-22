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
    { data: currentUserProfile },
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
      .select('id, group_id, creator_id, title, category, status, start_date, end_date, area, description, default_transport, budget_per_person, created_at, updated_at')
      .eq('id', planId)
      .eq('group_id', groupId)
      .single(),
    supabase
      .from('group_members')
      .select('user_id, position')
      .eq('group_id', groupId),
    supabase
      .from('profiles')
      .select('student_id, grade, department, phone, school_email, academic_advisor')
      .eq('id', user.id)
      .single(),
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
    { data: reviews },
    { data: preparations },
    { data: myGear },
    { data: myCars },
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
    supabase
      .from('plan_reviews')
      .select('id, user_id, body, cost_per_person, created_at, profiles(name, avatar_url)')
      .eq('plan_id', planId)
      .order('created_at', { ascending: true }),
    supabase
      .from('preparations')
      .select('id, user_id, type, body, created_at, profiles(name, avatar_url)')
      .eq('plan_id', planId)
      .order('created_at', { ascending: true }),
    supabase
      .from('gear')
      .select('id, name')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('cars')
      .select('id, name, capacity')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const normalizedReviews = (reviews ?? []).map((review) => ({
    ...review,
    profiles: Array.isArray(review.profiles)
      ? (review.profiles[0] ?? null)
      : review.profiles,
  }))

  const normalizedPreparations = (preparations ?? []).map((preparation) => ({
    ...preparation,
    profiles: Array.isArray(preparation.profiles)
      ? (preparation.profiles[0] ?? null)
      : preparation.profiles,
  }))

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
      reviews={normalizedReviews}
      preparations={normalizedPreparations}
      myGear={myGear ?? []}
      myCars={myCars ?? []}
      currentUserId={user.id}
      currentUserProfile={currentUserProfile}
    />
  )
}
