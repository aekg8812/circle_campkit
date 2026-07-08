import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import BottomNav from '@/components/BottomNav'
import AppBackdrop from '@/components/AppBackdrop'
import { ToastProvider } from '@/components/Toast'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <ToastProvider>
      <div className="app-surface relative min-h-screen">
        <AppBackdrop />
        <header className="sticky top-0 z-10 border-b border-gray-200/70 bg-white/80 backdrop-blur-md print:hidden">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link
              href="/home"
              className="flex items-center gap-1 text-xl font-bold tracking-tight text-green-700 transition hover:text-green-800"
            >
              ⛺ CampKit
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/home" className="hidden text-gray-600 transition hover:text-green-700 sm:inline">
                ホーム
              </Link>
              <Link href="/profile" className="hidden text-gray-600 transition hover:text-green-700 sm:inline">
                プロフィール
              </Link>
              <LogoutButton />
            </nav>
          </div>
        </header>
        <main className="relative z-[1] mx-auto max-w-5xl px-4 py-6 pb-24 print:max-w-none print:p-0 print:pb-0 sm:pb-6">
          {children}
        </main>
        <BottomNav />
      </div>
    </ToastProvider>
  )
}
