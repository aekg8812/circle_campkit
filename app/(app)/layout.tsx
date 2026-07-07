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
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 print:hidden">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/home" className="text-xl font-bold text-green-700">
            ⛺ CampKit
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/home" className="text-gray-600 hover:text-green-700">
              ホーム
            </Link>
            <Link href="/groups" className="text-gray-600 hover:text-green-700">
              グループ
            </Link>
            <Link href="/profile" className="text-gray-600 hover:text-green-700">
              プロフィール
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6 print:max-w-none print:p-0">{children}</main>
    </div>
  )
}
