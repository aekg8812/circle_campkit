import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GearClient from './GearClient'

export default async function GearPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: gear } = await supabase
    .from('gear')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">道具の登録</h1>
      <GearClient initialGear={gear ?? []} userId={user.id} />
    </div>
  )
}
