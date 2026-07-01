'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

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
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { name: data.name },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })
    if (error) {
      setServerError(error.message)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8 text-center">
          <h1 className="text-2xl font-bold text-green-700 mb-4">確認メールを送信しました</h1>
          <p className="text-sm text-gray-600">
            登録したメールアドレスに確認リンクを送信しました。リンクをクリックしてアカウントを有効化してください。
          </p>
          <Link href="/login" className="mt-6 inline-block text-green-600 hover:underline text-sm">
            ログインページへ
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-2 text-green-700">CampKit</h1>
        <h2 className="text-lg font-semibold mb-1 text-gray-700">新規登録</h2>

        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">
          学校用メールアドレス（例: xxxx@kyutech.ac.jp）の使用を推奨します。任意のメールでも登録可能です。
        </p>

        {serverError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
            {serverError}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">氏名</label>
            <input
              {...register('name')}
              placeholder="山田 太郎"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

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
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              {...register('password')}
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {errors.password && (
              <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード（確認）
            </label>
            <input
              {...register('confirmPassword')}
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
          >
            {isSubmitting ? '登録中...' : 'アカウント作成'}
          </button>
        </form>

        <p className="text-sm text-center text-gray-500 mt-6">
          すでにアカウントをお持ちの方は{' '}
          <Link href="/login" className="text-green-600 hover:underline font-medium">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  )
}
