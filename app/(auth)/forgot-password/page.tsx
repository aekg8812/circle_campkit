'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useState } from 'react'

const schema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
})
type FormValues = z.infer<typeof schema>

const cardClass =
  'w-full max-w-sm rounded-2xl bg-white/95 p-8 shadow-xl ring-1 ring-black/5 backdrop-blur'

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormValues) => {
    setServerError(null)
    const supabase = createClient()
    // 再設定リンクのメールを送る。メール本文のリンク（テンプレートで設定）が
    // /auth/confirm に token_hash を渡し、検証後に /reset-password へ遷移する。
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${location.origin}/reset-password`,
    })
    if (error) {
      setServerError(error.message)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className={`${cardClass} text-center`}>
        <h1 className="text-2xl font-bold text-green-700 mb-4">メールを送信しました</h1>
        <p className="text-sm text-gray-600 leading-6">
          {getValues('email')} 宛に、パスワード再設定用のリンクを送りました。
          メール内のリンクを開いて、新しいパスワードを設定してください。
        </p>
        <p className="mt-4 text-xs text-gray-400">
          メールが届かない場合は、迷惑メールフォルダもご確認ください。
        </p>
        <Link href="/login" className="mt-6 inline-block text-green-600 hover:underline text-sm">
          ログインページへ戻る
        </Link>
      </div>
    )
  }

  return (
    <div className={cardClass}>
      <h1 className="text-2xl font-bold text-center mb-2 text-green-700">⛺ CampKit</h1>
      <h2 className="text-lg font-semibold mb-1 text-gray-700">パスワードの再設定</h2>
      <p className="text-sm text-gray-500 mb-4">
        登録したメールアドレスを入力してください。再設定用のリンクをお送りします。
      </p>

      {serverError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{serverError}</p>
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

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full py-3"
        >
          {isSubmitting ? '送信中...' : '再設定リンクを送信'}
        </button>
      </form>

      <p className="text-sm text-center text-gray-500 mt-6">
        <Link href="/login" className="text-green-600 hover:underline font-medium">
          ログインに戻る
        </Link>
      </p>
    </div>
  )
}
