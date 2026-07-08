import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MountainScene } from '@/components/MountainScene'

// トップ（ランディング）ページ。
// ログイン済みならホームへ、未ログインならアウトドア風のヒーローを見せて
// 新規登録／ログインへ誘導する。背景は自作SVG（外部画像なし・軽量）。
export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/home')
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <MountainScene />

      {/* 文字を読みやすくするための暗幕（上下＋中央にほんのり） */}
      <div className="absolute inset-0 bg-black/25" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/45" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 sm:px-10">
          <span className="text-2xl font-bold tracking-tight text-white drop-shadow">
            ⛺ CampKit
          </span>
          <Link
            href="/login"
            className="rounded-full bg-white/15 px-5 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/25"
          >
            ログイン
          </Link>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
          <p className="animate-fade-in-up text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
            for outdoor circles
          </p>
          <h1 className="animate-fade-in-up mt-4 text-4xl font-bold leading-tight text-white drop-shadow-md sm:text-6xl [animation-delay:80ms]">
            計画から、
            <br className="sm:hidden" />
            冒険は始まる。
          </h1>
          <p className="animate-fade-in-up mx-auto mt-5 max-w-md text-base font-medium leading-7 text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)] sm:text-lg [animation-delay:160ms]">
            サークルの計画づくり・参加募集から、
            <br className="hidden sm:block" />
            学校提出用の計画書作成まで。仲間との外遊びを、これひとつで。
          </p>

          <div className="animate-fade-in-up mt-9 flex w-full max-w-xs flex-col gap-3 [animation-delay:240ms] sm:max-w-none sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="rounded-2xl bg-green-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-green-900/20 transition hover:bg-green-500 hover:shadow-xl active:scale-[0.98]"
            >
              無料ではじめる
            </Link>
            <Link
              href="/login"
              className="rounded-2xl bg-white/90 px-8 py-4 text-base font-bold text-gray-800 shadow-lg backdrop-blur-sm transition hover:bg-white active:scale-[0.98]"
            >
              ログイン
            </Link>
          </div>

          <div className="animate-fade-in-up mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-white/80 [animation-delay:320ms]">
            <span>🗺️ 行程表づくり</span>
            <span>🙋 かんたん参加募集</span>
            <span>📄 計画書PDF自動作成</span>
          </div>
        </main>
      </div>
    </div>
  )
}
