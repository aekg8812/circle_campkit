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
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormValues) => {
    setServerError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (error) {
      setServerError('メールアドレスまたはパスワードが正しくありません')
      return
    }
    router.push('/home')
    router.refresh()
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
