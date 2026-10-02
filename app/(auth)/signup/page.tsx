'use client'

// 新規登録画面。
//
// ログイン画面と同じ考え方で、主役は「LINEではじめる」ボタン1つ。
// 氏名・メール・パスワードの入力は、LINEが使えない人向けの控えとして折りたたむ。
// LINEで入った場合はアカウントがその場で作られるので、この画面を通らなくてよい。

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Tent } from 'lucide-react'
import { useState } from 'react'
import PasswordInput from '@/components/PasswordInput'
import LineLoginButton from '@/components/LineLoginButton'
import { useLiff } from '@/components/LiffProvider'
import { toUserMessage } from '@/lib/errorMessage'

const schema = z.object({
  name: z.string().min(1, '名前を入力してください'),
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
  confirmPassword: z.string().min(6, 'パスワードを確認してください'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'パスワードが一致しません',
  path: ['confirmPassword'],
})
type FormValues = z.infer<typeof schema>

export default function SignupPage() {
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
  const [done, setDone] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormValues) => {
    setServerError(null)
    const supabase = createClient()
    const email = data.email.trim().toLowerCase()
    const { data: result, error } = await supabase.auth.signUp({
      email,
      password: data.password,
      options: {
        data: { name: data.name },
        // 確認後は、まずプロフィール入力へ誘導する（オンボーディング）。
        // onboarding=1 が付くと、プロフィール保存後にホームへ遷移する。
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent('/profile?onboarding=1')}`,
      },
    })
    if (error) {
      setServerError(toUserMessage(error, 'アカウントを作成できませんでした。'))
      return
    }
    // メール確認が無効な設定なら、この時点でログイン済み → そのまま進める
    if (result.session) {
      router.push('/profile?onboarding=1')
      router.refresh()
      return
    }
    // メール確認が有効なら、確認メールの案内を表示
    setDone(true)
  }

  if (done) {
    return (
      <div className="w-full max-w-sm rounded-2xl bg-white/95 p-8 text-center shadow-xl ring-1 ring-black/5 backdrop-blur">
        <h1 className="text-2xl font-bold text-green-700 mb-4">確認メールを送信しました</h1>
        <p className="text-sm text-gray-600">
          登録したメールアドレスに確認リンクを送信しました。リンクをクリックしてアカウントを有効化してください。
        </p>
        <Link href="/login" className="mt-6 inline-block text-green-600 hover:underline text-sm">
          ログインページへ
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white/95 p-8 shadow-xl ring-1 ring-black/5 backdrop-blur">
      <h1 className="text-center text-2xl font-bold text-green-700">
        <Tent className="mr-1.5 inline-block align-[-0.15em]" size={24} aria-hidden />
        CampKit
      </h1>
      <p className="mt-1 text-center text-sm text-gray-600">はじめる前に、アカウントを作ります</p>

      {isPreviewDeploy && (
        <p className="mt-5 rounded-lg bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800">
          <strong>これは確認用のプレビュー版です。</strong>
          <br />
          LINEに登録してある戻り先が本番のURLなので、ここではLINEログインを使えません
          （押すとLINE側で「400 Bad Request」になります）。
          メールアドレスでログインして確認してください。
        </p>
      )}

      {/* 主役: LINEで登録。判定中は高さを確保して、ちらつかせない */}
      {liffInitializing ? (
        <div aria-hidden className="mt-6">
          <div className="h-14 w-full animate-pulse rounded-xl bg-gray-100" />
          <div className="mx-auto mt-2 h-3 w-3/4 animate-pulse rounded bg-gray-100" />
        </div>
      ) : (
        liffReady && (
          <div className="mt-6">
            <LineLoginButton
              variant="hero"
              label="LINEではじめる"
              note="確認メールのやり取りなしで、すぐに使いはじめられます"
            />
          </div>
        )
      )}

      {/* 控えの手段: メールアドレスで登録 */}
      <div className={liffInitializing || liffReady ? 'mt-6 border-t border-gray-100 pt-5' : 'mt-6'}>
        {!showEmailForm ? (
          <button
            type="button"
            onClick={() => setEmailOpenedByUser(true)}
            className="pressable w-full rounded-xl border border-gray-200 px-4 py-3 text-center transition-ui hover:border-green-400 hover:bg-green-50"
          >
            <span className="block text-xs text-gray-500">LINEでうまくいかない場合</span>
            <span className="mt-0.5 block text-sm font-semibold text-gray-700">
              メールアドレスで登録
            </span>
          </button>
        ) : (
          <>
          <h2 className="mb-1 text-sm font-bold text-gray-700">メールアドレスで登録</h2>

          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">
            学校のメール（例: xxxx@kyutech.ac.jp）を推奨します。他のメールでも登録できます。
          </p>

          {serverError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
              {serverError}
            </p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="signup-name" className="block text-sm font-medium text-gray-700 mb-1">氏名</label>
              <input
                {...register('name')}
                id="signup-name"
                autoComplete="name"
                placeholder="山田 太郎"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス
              </label>
              <input
                {...register('email')}
                id="signup-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="example@kyutech.ac.jp"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {errors.email && (
                <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
              <PasswordInput
                {...register('password')}
                id="signup-password"
                autoComplete="new-password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {errors.password && (
                <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="signup-password-confirm" className="block text-sm font-medium text-gray-700 mb-1">
                パスワード（確認）
              </label>
              <PasswordInput
                {...register('confirmPassword')}
                id="signup-password-confirm"
                autoComplete="new-password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {errors.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-3"
            >
              {isSubmitting ? '登録中...' : 'アカウント作成'}
            </button>
          </form>
          </>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        すでにアカウントをお持ちの方は{' '}
        <Link href="/login" className="text-green-600 hover:underline font-medium">
          ログイン
        </Link>
      </p>
    </div>
  )
}
