'use client'

// ログイン画面。
//
// このアプリはLINE（LIFF）から開かれることを前提にしているので、
// 主役は「LINEでログイン」ボタン1つ。メールとパスワードは、
// LINEがうまくいかなかった人向けの控えの手段として折りたたんでおく。
//
// LIFFが使えない環境（LIFF ID未設定・初期化失敗）ではLINEボタンが出ないため、
// その場合だけメールの入力欄を最初から開いておく。

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import PasswordInput from '@/components/PasswordInput'
import LineLoginButton from '@/components/LineLoginButton'
import { useLiff } from '@/components/LiffProvider'

const schema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  // Vercelのプレビュー配信は本番とURLが違う。LINEには本番のURLしか登録して
  // いないため、ここでLINEログインを押すと必ず400 Bad Requestになる。
  // ボタンを出さずに理由を伝えて、メールでの確認に誘導する。
  const isPreviewDeploy = process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview'
  const liff = useLiff()
  const liffReady = liff.ready && !isPreviewDeploy
  const liffInitializing = liff.initializing && !isPreviewDeploy
  // LINEが使えないと分かった場合だけ、メールの入力欄を最初から開く
  const lineUnavailable = !liffInitializing && !liffReady
  const [emailOpenedByUser, setEmailOpenedByUser] = useState(false)
  const showEmailForm = emailOpenedByUser || lineUnavailable

  const [serverError, setServerError] = useState<string | null>(null)
  // メール未確認のとき、確認メールの再送を案内する
  const [needsConfirm, setNeedsConfirm] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormValues) => {
    setServerError(null)
    setNeedsConfirm(null)
    setResent(false)
    const supabase = createClient()
    // メールの前後の空白・大文字は事故のもとなので整える
    const email = data.email.trim().toLowerCase()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: data.password,
    })
    if (error) {
      // 原因を切り分けて、正しい対処を案内する（一律「パスワードが違う」にしない）
      const message = error.message.toLowerCase()
      if (message.includes('not confirmed') || message.includes('confirm')) {
        setNeedsConfirm(email)
      } else {
        setServerError('メールアドレスまたはパスワードが正しくありません')
      }
      return
    }
    router.push('/home')
    router.refresh()
  }

  const resendConfirmation = async () => {
    if (!needsConfirm) return
    setResending(true)
    const supabase = createClient()
    await supabase.auth.resend({
      type: 'signup',
      email: needsConfirm,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=/home` },
    })
    setResending(false)
    setResent(true)
  }

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white/95 p-8 shadow-xl ring-1 ring-black/5 backdrop-blur">
      <h1 className="text-center text-2xl font-bold text-green-700">⛺ CampKit</h1>
      <p className="mt-1 text-center text-sm text-gray-600">
        サークルの計画・持ち物・参加者をまとめて管理
      </p>

      {isPreviewDeploy && (
        <p className="mt-5 rounded-lg bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800">
          <strong>これは確認用のプレビュー版です。</strong>
          <br />
          LINEに登録してある戻り先が本番のURLなので、ここではLINEログインを使えません
          （押すとLINE側で「400 Bad Request」になります）。
          メールアドレスでログインして確認してください。
        </p>
      )}

      {/* 主役: LINEでログイン。判定中は高さを確保して、ちらつかせない */}
      {liffInitializing ? (
        <div aria-hidden className="mt-6">
          <div className="h-14 w-full animate-pulse rounded-xl bg-gray-100" />
          <div className="mx-auto mt-2 h-3 w-3/4 animate-pulse rounded bg-gray-100" />
        </div>
      ) : (
        liffReady && (
          <div className="mt-6">
            <LineLoginButton variant="hero" />
          </div>
        )
      )}

      {/* 控えの手段: メールアドレスでログイン */}
      <div className={liffInitializing || liffReady ? 'mt-6 border-t border-gray-100 pt-5' : 'mt-6'}>
        {showEmailForm ? (
          <>
            <h2 className="mb-3 text-sm font-bold text-gray-700">メールアドレスでログイン</h2>

            {serverError && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {serverError}
              </p>
            )}

            {needsConfirm && (
              <div className="mb-4 rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">
                <p className="font-bold">メールアドレスの確認が済んでいません</p>
                <p className="mt-1 text-xs leading-5">
                  登録時の確認メールのリンクを開くとログインできます。届いていない場合は下から再送してください。
                </p>
                {resent ? (
                  <p className="mt-2 text-xs font-semibold text-green-700">
                    確認メールを再送しました。メールをご確認ください（迷惑メールもご確認を）。
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={resendConfirmation}
                    disabled={resending}
                    className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition-ui hover:bg-amber-700 disabled:opacity-50"
                  >
                    {resending ? '送信中...' : '確認メールを再送する'}
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-gray-700">
                  メールアドレス
                </label>
                <input
                  {...register('email')}
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="example@kyutech.ac.jp"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  パスワード
                </label>
                <PasswordInput
                  {...register('password')}
                  id="login-password"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
                )}
              </div>

              <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3">
                {isSubmitting ? 'ログイン中...' : 'ログイン'}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-gray-500">
              メールで登録していない方は{' '}
              <Link href="/signup" className="font-medium text-green-600 hover:underline">
                新規登録
              </Link>
            </p>
            <p className="mt-2 text-center text-sm">
              <Link
                href="/forgot-password"
                className="text-gray-500 hover:text-green-600 hover:underline"
              >
                パスワードをお忘れですか？
              </Link>
            </p>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEmailOpenedByUser(true)}
            className="pressable w-full rounded-xl border border-gray-200 px-4 py-3 text-center transition-ui hover:border-green-400 hover:bg-green-50"
          >
            <span className="block text-xs text-gray-500">LINEでうまくいかない場合</span>
            <span className="mt-0.5 block text-sm font-semibold text-gray-700">
              メールアドレスでログイン
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
