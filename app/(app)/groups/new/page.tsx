'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

const schema = z
  .object({
    name: z.string().min(1, 'グループ名を入力してください'),
    password: z.string().min(4, 'パスワードは4文字以上で入力してください'),
    confirmPassword: z.string().min(1, 'パスワード（確認）を入力してください'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
  })
type FormValues = z.infer<typeof schema>

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

export default function NewGroupPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const onSubmit = async (data: FormValues) => {
    setServerError(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setServerError('ログインしてください')
      return
    }

    let imageUrl: string | null = null
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('group-images')
        .upload(path, imageFile)
      if (uploadError) {
        setServerError('画像のアップロードに失敗しました: ' + uploadError.message)
        return
      }
      const { data: urlData } = supabase.storage
        .from('group-images')
        .getPublicUrl(path)
      imageUrl = urlData.publicUrl
    }

    const { data: groupId, error } = await supabase.rpc('create_group', {
      p_name: data.name,
      p_image_url: imageUrl,
      p_password: data.password,
    })
    if (error) {
      setServerError('グループの作成に失敗しました: ' + error.message)
      return
    }
    router.push(`/groups/${groupId}`)
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/groups" className="text-gray-400 hover:text-gray-600 text-sm">
          ← 戻る
        </Link>
        <h1 className="text-xl font-bold text-gray-800">グループを作成</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        {serverError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
            {serverError}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* グループ画像 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              グループ画像（任意）
            </label>
            <div
              className="w-full h-36 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-green-400 transition overflow-hidden bg-gray-50"
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <Image
                  src={imagePreview}
                  alt="プレビュー"
                  width={400}
                  height={144}
                  className="object-cover w-full h-full"
                />
              ) : (
                <span className="text-sm text-gray-400">クリックして画像を選択</span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>

          {/* グループ名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              グループ名 *
            </label>
            <input
              {...register('name')}
              className={inputClass}
              placeholder="○○大学アウトドアサークル"
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* 参加用パスワード */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              参加用パスワード *
            </label>
            <p className="text-xs text-gray-400 mb-1">
              このパスワードを知るメンバーだけがグループに参加できます
            </p>
            <input
              {...register('password')}
              type="password"
              className={inputClass}
              placeholder="4文字以上"
            />
            {errors.password && (
              <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード（確認）*
            </label>
            <input
              {...register('confirmPassword')}
              type="password"
              className={inputClass}
              placeholder="もう一度入力してください"
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
          >
            {isSubmitting ? '作成中...' : 'グループを作成'}
          </button>
        </form>
      </div>
    </div>
  )
}
