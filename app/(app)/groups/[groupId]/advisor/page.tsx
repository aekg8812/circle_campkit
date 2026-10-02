import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdvisorClient from './AdvisorClient'

export const metadata = { title: '顧問教員' }

export default async function AdvisorPage({
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
      .select('id, name, advisor_name, advisor_affiliation, advisor_phone')
      .eq('id', groupId)
      .single(),
  ])

  if (!membership || !group) {
    redirect('/groups')
  }

  return <AdvisorClient group={group} />
}
