import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProfileTabs from './ProfileTabs'
import { getMissingDocumentFields } from '@/lib/profileCompleteness'

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

  const missingFields = getMissingDocumentFields(profile)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-800">プロフィール</h1>
        <Link
          href="/help"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-600 transition hover:border-green-400 hover:text-green-700"
        >
          <span aria-hidden>❓</span>
          ヘルプ・使い方
        </Link>
      </div>

      {missingFields.length > 0 && (
        <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-bold text-green-800">
            👋 ようこそ！まずはプロフィールを完成させましょう
          </p>
          <p className="mt-1 text-xs leading-5 text-green-700">
            ここで入力した内容は、計画に参加したときに<strong>計画書の名簿へ自動で反映</strong>されます。
            未入力：{missingFields.map((field) => field.label).join('・')}
          </p>
        </div>
      )}

      <ProfileTabs
        profile={profile}
        cars={cars ?? []}
        gear={gear ?? []}
        userId={user.id}
      />
    </div>
  )
}
