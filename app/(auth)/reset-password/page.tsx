'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import PasswordInput from '@/components/PasswordInput'
import type { EmailOtpType } from '@supabase/supabase-js'

const schema = z
  .object({
    password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
    confirmPassword: z.string().min(6, 'パスワードを確認してください'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
  })
type FormValues = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [done, setDone] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  // メールのリンクからセッションを確立する。
  // 方式に依存しないよう、以下のいずれにも対応する:
  //  - token_hash 方式（/reset-password?token_hash=...&type=recovery）→ verifyOtp
  //  - code 方式（?code=...）→ exchangeCodeForSession
  //  - すでにセッション確立済み（/auth/confirm 経由など）→ getSession
  useEffect(() => {
    const supabase = createClient()

    const establishSession = async () => {
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get('token_hash')
      const type = params.get('type') as EmailOtpType | null
      const code = params.get('code')

      try {
        if (tokenHash && type) {
          await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
        } else if (code) {
          await supabase.auth.exchangeCodeForSession(code)
        }
      } catch {
        // 検証に失敗しても、既存セッションがあるか下でもう一度確認する
      }

      const { data } = await supabase.auth.getSession()
      setHasSession(Boolean(data.session))
      setChecking(false)

      // URL からトークンを消して、履歴に残さない／再実行を防ぐ
      if (tokenHash || code) {
        window.history.replaceState(null, '', window.location.pathname)
      }
    }

    establishSession()

    // ハッシュ方式（#access_token=...&type=recovery）など、非同期に確立される場合の保険
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setHasSession(true)
        setChecking(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const onSubmit = async (data: FormValues) => {
    setServerError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) {
      setServerError(error.message)
      return
    }
    setDone(true)
    setTimeout(() => {
      router.push('/home')
      router.refresh()
    }, 1500)
  }

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white/95 p-8 shadow-xl ring-1 ring-black/5 backdrop-blur">
      <h1 className="text-2xl font-bold text-center mb-2 text-green-700">⛺ CampKit</h1>
      <h2 className="text-lg font-semibold mb-4 text-gray-700">新しいパスワードの設定</h2>

      {checking ? (
        <p className="text-sm text-gray-500 text-center py-6">確認中...</p>
      ) : done ? (
        <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-3 text-center">
          パスワードを更新しました。ホームへ移動します...
        </p>
      ) : !hasSession ? (
        <div className="text-center">
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-3">
            再設定リンクが無効か、期限切れの可能性があります。
          </p>
          <Link
            href="/forgot-password"
            className="mt-4 inline-block text-green-600 hover:underline text-sm font-medium"
          >
            もう一度リンクを送る
          </Link>
        </div>
      ) : (
        <>
          {serverError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
              {serverError}
            </p>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                新しいパスワード
              </label>
              <PasswordInput
                {...register('password')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {errors.password && (
                <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                新しいパスワード（確認）
              </label>
              <PasswordInput
                {...register('confirmPassword')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {errors.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3">
              {isSubmitting ? '更新中...' : 'パスワードを更新'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
