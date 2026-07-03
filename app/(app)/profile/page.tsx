import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileTabs from './ProfileTabs'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: profile }, { data: cars }, { data: gear }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single(),
    supabase
      .from('cars')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('gear')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">プロフィール</h1>
      <ProfileTabs
        profile={profile}
        cars={cars ?? []}
        gear={gear ?? []}
        userId={user.id}
      />
    </div>
  )
}
