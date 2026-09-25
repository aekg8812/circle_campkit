import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewPlanClient from './NewPlanClient'
import { toPlanTemplate, type PlanTemplateRow } from '@/lib/planTemplates'

export const metadata = { title: '計画を作成' }

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

  // このグループが自作したテンプレート（組み込みのものと並べて出す）
  const { data: templateRows } = await supabase
    .from('plan_templates')
    .select('id, emoji, name, summary, category, nights, budget, transport, description, schedule')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  const groupTemplates = ((templateRows ?? []) as PlanTemplateRow[]).map(toPlanTemplate)

  return (
    <NewPlanClient
      group={group}
      currentUserId={user.id}
      groupTemplates={groupTemplates}
    />
  )
}
