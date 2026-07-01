import { createClient } from '@/lib/supabase/server'
import CarsClient from './CarsClient'

export default async function CarsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: cars } = await supabase
    .from('cars')
    .select('*')
    .eq('owner_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">車の登録</h1>
      <CarsClient initialCars={cars ?? []} userId={user!.id} />
    </div>
  )
}
