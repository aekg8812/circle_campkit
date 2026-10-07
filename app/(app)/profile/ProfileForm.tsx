'use client'

import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useToast } from '@/components/Toast'
import { toUserMessage } from '@/lib/errorMessage'
import { User } from 'lucide-react'

// 計画書の名簿（学生番号・学科学年・氏名）に載る項目はすべて必須。
// 部長は【責任者】欄に TEL・Mail も載るので、その2つも必須にする。
function createSchema(isLeader: boolean) {
  const required = (message: string) => z.string().trim().min(1, message)
  const gradeMessage = '学年は1〜6で入力してください'
  return z.object({
    name: required('名前を入力してください'),
    grade: z
      .number({ error: '学年を入力してください' })
      .int(gradeMessage)
      .min(1, gradeMessage)
      .max(6, gradeMessage),
    department: required('学科を入力してください'),
    student_id: required('学籍番号を入力してください'),
    school_email: isLeader
      ? required('部長はメールアドレスが必須です').email('有効なメールアドレスを入力してください')
      : z.string().trim().email('有効なメールアドレスを入力してください').or(z.literal('')),
    phone: isLeader ? required('部長は電話番号が必須です') : z.string().trim(),
  })
}

type FormValues = {
  name: string
  grade: number
  department: string
  student_id: string
  school_email: string
  phone: string
}

/** 画像を差し替えた直後に古い画像が表示されないよう、URLにキャッシュ避けを付ける */
function withCacheBuster(url: string) {
  return `${url}?t=${Date.now()}`
}

type Profile = {
  id: string
  name: string
  grade: number | null
  department: string | null
  student_id: string | null
  school_email: string | null
  phone: string | null
  avatar_url: string | null
}

type Props = {
  profile: Profile | null
  userId: string
  redirectHomeOnSave?: boolean
  /** どこかのグループで部長なら、電話番号・メールも必須にする */
  isLeader?: boolean
}

export default function ProfileForm({
  profile,
  userId,
  redirectHomeOnSave = false,
  isLeader = false,
}: Props) {
  const supabase = createClient()
  const toast = useToast()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createSchema(isLeader)) as Resolver<FormValues>,
    defaultValues: {
      name: profile?.name ?? '',
      grade: profile?.grade ?? undefined,
      department: profile?.department ?? '',
      student_id: profile?.student_id ?? '',
      school_email: profile?.school_email ?? '',
      phone: profile?.phone ?? '',
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
    const publicUrl = withCacheBuster(data.publicUrl)
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
      setServerError(toUserMessage(error, '保存できませんでした。'))
      toast('保存に失敗しました', 'error')
      return
    }
    toast('プロフィールを保存しました')
    // 新規登録直後（オンボーディング）のときだけ、保存後にホームへ遷移
    if (redirectHomeOnSave) {
      router.push('/home')
      router.refresh()
    }
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
            <User className="text-gray-400" size={28} aria-hidden />
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
          <p className="text-xs text-gray-500 mt-1">クリックして選択</p>
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
          <input {...register('name')} autoComplete="name" className={inputClass} placeholder="山田 太郎" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="学年 *" error={errors.grade?.message}>
            <input {...register('grade', { valueAsNumber: true })} type="number" min={1} max={6} className={inputClass} placeholder="1〜6" />
          </Field>
          <Field label="学科 *" error={errors.department?.message}>
            <input {...register('department')} className={inputClass} placeholder="知能情報工学科" />
          </Field>
        </div>

        <Field label="学籍番号 *" error={errors.student_id?.message}>
          {/* 学籍番号はアルファベットを含む場合があるため、数字キーパッドに固定しない */}
          <input {...register('student_id')} autoComplete="off" className={inputClass} placeholder="23xxxxx" />
        </Field>

        {/* 部長は計画書の【責任者】欄に載るため必須。それ以外の人は任意 */}
        <Field
          label={isLeader ? '電話番号 *' : '電話番号'}
          error={errors.phone?.message}
        >
          <input {...register('phone')} type="tel" autoComplete="tel" inputMode="tel" className={inputClass} placeholder="090-xxxx-xxxx" />
        </Field>

        <Field
          label={isLeader ? 'メールアドレス *' : 'メールアドレス'}
          error={errors.school_email?.message}
        >
          <input {...register('school_email')} type="email" autoComplete="email" inputMode="email" className={inputClass} placeholder="xxxx@mail.kyutech.jp" />
        </Field>

        <p className="text-xs leading-5 text-gray-500">
          * は必須です。学籍番号・学科・学年・氏名は、計画書の参加者名簿に載ります。
          {isLeader
            ? '部長は、計画書の【責任者】欄に電話番号とメールアドレスも載ります。'
            : '電話番号・メールアドレスは、部長になったときに必須になります。'}
        </p>

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
      {/* label で囲むことで、ラベル文字をタップしても入力欄に移動できる */}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
        {children}
      </label>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
