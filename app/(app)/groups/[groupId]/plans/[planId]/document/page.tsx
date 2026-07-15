import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DocumentClient from './DocumentClient'

export default async function PlanDocumentPage({
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
      .select('id, group_id, creator_id, title, status, start_date, end_date, area, default_transport')
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

  const profileColumns =
    'id, name, grade, department, student_id, school_email, phone, academic_advisor'

  const [
    { data: scheduleItems },
    { data: participants },
    { data: planDocument },
    { data: creatorProfile },
  ] = await Promise.all([
    supabase
      .from('schedule_items')
      .select('id, day, time, sort_order, time_label, location_name')
      .eq('plan_id', planId)
      .order('day', { ascending: true, nullsFirst: false })
      .order('time', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true }),
    supabase
      .from('participants')
      .select(`id, user_id, joined_at, profiles(${profileColumns})`)
      .eq('plan_id', planId)
      .order('joined_at', { ascending: true }),
    supabase
      .from('plan_documents')
      .select('*')
      .eq('plan_id', planId)
      .maybeSingle(),
    plan.creator_id
      ? supabase
          .from('profiles')
          .select(profileColumns)
          .eq('id', plan.creator_id)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const normalizedParticipants = (participants ?? []).map((participant) => ({
    ...participant,
    profiles: Array.isArray(participant.profiles)
      ? (participant.profiles[0] ?? null)
      : participant.profiles,
  }))

  // 代表者に選べる候補（グループのメンバー全員のプロフィール）
  const memberIds = (groupMembers ?? []).map((member) => member.user_id)
  const { data: memberProfiles } =
    memberIds.length > 0
      ? await supabase.from('profiles').select(profileColumns).in('id', memberIds)
      : { data: [] }

  const profileById = new Map((memberProfiles ?? []).map((p) => [p.id, p]))

  // 既定の代表者: 保存済み → 部長（複数いれば先頭）→ 起案者
  const leaderId = (groupMembers ?? []).find(
    (member) => member.position === '部長'
  )?.user_id

  const defaultRepresentativeId =
    planDocument?.representative_user_id ?? leaderId ?? plan.creator_id ?? null

  const leaderProfile =
    (defaultRepresentativeId ? profileById.get(defaultRepresentativeId) : null) ??
    creatorProfile

  return (
    <DocumentClient
      group={group}
      plan={plan}
      scheduleItems={scheduleItems ?? []}
      participants={normalizedParticipants}
      memberPositions={(groupMembers ?? []).map((member) => ({
        user_id: member.user_id,
        position: member.position ?? '部員',
      }))}
      memberProfiles={memberProfiles ?? []}
      defaultRepresentativeId={defaultRepresentativeId}
      planDocument={planDocument}
      creatorProfile={creatorProfile}
      leaderProfile={leaderProfile}
      currentUserId={user.id}
    />
  )
}
