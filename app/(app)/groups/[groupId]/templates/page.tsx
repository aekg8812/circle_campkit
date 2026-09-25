import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TemplatesClient from './TemplatesClient'
import { toPlanTemplate, type PlanTemplateRow } from '@/lib/planTemplates'

export const metadata = { title: '計画テンプレート' }

export default async function TemplatesPage({
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

  const [{ data: membership }, { data: group }, { data: templateRows }] = await Promise.all([
    supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('groups').select('id, name').eq('id', groupId).single(),
    supabase
      .from('plan_templates')
      .select('id, emoji, name, summary, category, nights, budget, transport, description, schedule')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }),
  ])

  if (!membership || !group) {
    redirect('/groups')
  }

  return (
    <TemplatesClient
      group={group}
      currentUserId={user.id}
      templates={((templateRows ?? []) as PlanTemplateRow[]).map(toPlanTemplate)}
    />
  )
}
