import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DocumentTemplateClient from './DocumentTemplateClient'

export const metadata = { title: '計画書の様式' }

export default async function DocumentTemplatePage({
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
      .maybeSingle(),
    supabase
      .from('groups')
      .select('id, name, document_template')
      .eq('id', groupId)
      .single(),
  ])

  if (!membership || !group) {
    redirect('/groups')
  }

  return (
    <DocumentTemplateClient
      group={{ id: group.id, name: group.name }}
      documentTemplate={group.document_template ?? null}
    />
  )
}
