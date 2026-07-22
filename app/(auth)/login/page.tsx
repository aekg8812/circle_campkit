'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import PasswordInput from '@/components/PasswordInput'

const schema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
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
      <h1 className="text-2xl font-bold text-center mb-6 text-green-700">⛺ CampKit</h1>
        <h2 className="text-lg font-semibold mb-4 text-gray-700">ログイン</h2>

        {serverError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
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
                className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700 disabled:opacity-50"
              >
                {resending ? '送信中...' : '確認メールを再送する'}
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス
            </label>
            <input
              {...register('email')}
              type="email"
              placeholder="example@kyutech.ac.jp"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {errors.email && (
              <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード
            </label>
            <PasswordInput
              {...register('password')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {errors.password && (
              <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-3"
          >
            {isSubmitting ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <p className="text-sm text-center text-gray-500 mt-6">
          アカウントをお持ちでない方は{' '}
          <Link href="/signup" className="text-green-600 hover:underline font-medium">
            新規登録
          </Link>
        </p>
      <p className="text-sm text-center mt-2">
        <Link href="/forgot-password" className="text-gray-400 hover:text-green-600 hover:underline">
          パスワードをお忘れですか？
        </Link>
      </p>
    </div>
  )
}
