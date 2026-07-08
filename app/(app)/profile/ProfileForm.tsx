'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useState, useRef } from 'react'
import Image from 'next/image'
import { useToast } from '@/components/Toast'

const schema = z.object({
  name: z.string().min(1, '名前を入力してください'),
  grade: z
    .number()
    .int()
    .min(1)
    .max(6)
    .nullable()
    .transform((v) => (v === null || isNaN(v) ? null : v))
    .optional(),
  department: z.string().optional().nullable(),
  student_id: z.string().optional().nullable(),
  school_email: z.string().email('有効なメールアドレス').optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  academic_advisor: z.string().optional().nullable(),
})
type FormValues = z.infer<typeof schema>

type Profile = {
  id: string
  name: string
  grade: number | null
  department: string | null
  student_id: string | null
  school_email: string | null
  phone: string | null
  academic_advisor: string | null
  avatar_url: string | null
}

type Props = {
  profile: Profile | null
  userId: string
}

export default function ProfileForm({ profile, userId }: Props) {
  const supabase = createClient()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: profile?.name ?? '',
      grade: profile?.grade ?? null,
      department: profile?.department ?? '',
      student_id: profile?.student_id ?? '',
      school_email: profile?.school_email ?? '',
      phone: profile?.phone ?? '',
      academic_advisor: profile?.academic_advisor ?? '',
    },
  })

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${userId}.${ext}`
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })
    if (error) {
      setServerError('アバターのアップロードに失敗しました')
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl = data.publicUrl + `?t=${Date.now()}`
    await supabase
      .from('profiles')
      .update({ avatar_url: data.publicUrl })
      .eq('id', userId)
    setAvatarUrl(publicUrl)
    setUploading(false)
    toast('写真を更新しました')
  }

  const onSubmit = async (data: FormValues) => {
    setServerError(null)
    const { error } = await supabase
      .from('profiles')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
    if (error) {
      setServerError('保存に失敗しました: ' + error.message)
      toast('保存に失敗しました', 'error')
      return
    }
    toast('プロフィールを保存しました')
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      {/* アバター */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden cursor-pointer flex items-center justify-center border-2 border-green-300"
          onClick={() => fileInputRef.current?.click()}
        >
          {avatarUrl ? (
            <Image src={avatarUrl} alt="アバター" width={80} height={80} className="object-cover w-full h-full" />
          ) : (
            <span className="text-3xl text-gray-400">👤</span>
          )}
        </div>
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-sm text-green-600 hover:underline disabled:opacity-50"
          >
            {uploading ? 'アップロード中...' : '写真を変更'}
          </button>
          <p className="text-xs text-gray-400 mt-1">クリックして選択</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      {serverError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{serverError}</p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="氏名 *" error={errors.name?.message}>
          <input {...register('name')} className={inputClass} placeholder="山田 太郎" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="学年" error={errors.grade?.message}>
            <input {...register('grade', { valueAsNumber: true })} type="number" min={1} max={6} className={inputClass} placeholder="1〜6" />
          </Field>
          <Field label="学科・コース" error={errors.department?.message}>
            <input {...register('department')} className={inputClass} placeholder="知能情報工学科" />
          </Field>
        </div>

        <Field label="学籍番号" error={errors.student_id?.message}>
          <input {...register('student_id')} className={inputClass} placeholder="23xxxxx" />
        </Field>

        <Field label="学校用メールアドレス" error={errors.school_email?.message}>
          <input {...register('school_email')} type="email" className={inputClass} placeholder="xxxx@kyutech.ac.jp" />
        </Field>

        <Field label="電話番号" error={errors.phone?.message}>
          <input {...register('phone')} className={inputClass} placeholder="090-xxxx-xxxx" />
        </Field>

        <Field label="指導教員氏名" error={errors.academic_advisor?.message}>
          <input {...register('academic_advisor')} className={inputClass} placeholder="田中 教授" />
        </Field>

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3">
          {isSubmitting ? '保存中...' : '保存'}
        </button>
      </form>
    </div>
  )
}

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
