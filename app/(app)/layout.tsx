import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/profile" className="text-xl font-bold text-green-700">
            CampKit
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/groups" className="text-gray-600 hover:text-green-700">
              グループ
            </Link>
            <Link href="/profile" className="text-gray-600 hover:text-green-700">
              プロフィール
            </Link>
            <Link href="/profile/cars" className="text-gray-600 hover:text-green-700">
              車
            </Link>
            <Link href="/profile/gear" className="text-gray-600 hover:text-green-700">
              道具
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
