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
      .select('id, group_id, creator_id, title, category, status, start_date, end_date, area, description, created_at, updated_at')
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

  const memberIds = (groupMembers ?? []).map((member) => member.user_id)

  const [
    { data: scheduleItems },
    { data: planNotes },
    { data: transports },
    { data: cars },
    { data: recruitment },
    { data: participants },
  ] = await Promise.all([
    supabase
      .from('schedule_items')
      .select('id, day, time, sort_order, time_label, location_name, location_type, map_query')
      .eq('plan_id', planId)
      .order('day', { ascending: true, nullsFirst: false })
      .order('time', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true }),
    supabase
      .from('plan_notes')
      .select('id, note_type, body')
      .eq('plan_id', planId),
    supabase
      .from('transports')
      .select('id, type, note, transport_cars(id, car_id, note, cars(id, owner_id, name, capacity, luggage_capacity))')
      .eq('plan_id', planId),
    memberIds.length > 0
      ? supabase
          .from('cars')
          .select('id, owner_id, name, capacity, luggage_capacity, profiles(name)')
          .in('owner_id', memberIds)
      : Promise.resolve({ data: [] }),
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

  const normalizedCars = (cars ?? []).map((car) => ({
    ...car,
    profiles: Array.isArray(car.profiles) ? (car.profiles[0] ?? null) : car.profiles,
  }))

  const normalizedTransports = (transports ?? []).map((transport) => ({
    ...transport,
    transport_cars: (transport.transport_cars ?? []).map((transportCar) => ({
      ...transportCar,
      cars: Array.isArray(transportCar.cars)
        ? (transportCar.cars[0] ?? null)
        : transportCar.cars,
    })),
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
      planNotes={planNotes ?? []}
      transports={normalizedTransports}
      cars={normalizedCars}
      recruitment={recruitment}
      participants={normalizedParticipants}
      currentUserId={user.id}
    />
  )
}
