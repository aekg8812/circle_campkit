'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'

type Group = {
  id: string
  name: string
}

type Props = {
  group: Group
  currentUserId: string
}

const schema = z.object({
  title: z.string().min(1, '行事名を入力してください'),
  category: z.string().optional().nullable(),
  status: z.enum(['draft', 'recruiting']),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})

type FormValues = z.infer<typeof schema>

const inputClass =
  'w-full border border-gray-300 rounded-lg bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500'

export default function NewPlanClient({ group, currentUserId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      category: 'キャンプ',
      status: 'draft',
      start_date: '',
      end_date: '',
      area: '',
      description: '',
    },
  })

  const onSubmit = async (data: FormValues) => {
    setServerError(null)

    const { data: created, error } = await supabase
      .from('plans')
      .insert({
        group_id: group.id,
        creator_id: currentUserId,
        title: data.title,
        category: data.category || null,
        status: data.status,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        area: data.area || null,
        description: data.description || null,
      })
      .select('id')
      .single()

    if (error) {
      setServerError('計画の作成に失敗しました: ' + error.message)
      return
    }

    const { error: participantError } = await supabase
      .from('participants')
      .upsert({
        plan_id: created.id,
        user_id: currentUserId,
      })

    if (participantError) {
      setServerError('計画は作成されましたが、起案者の参加登録に失敗しました: ' + participantError.message)
      return
    }

    router.push(`/groups/${group.id}/plans/${created.id}`)
    router.refresh()
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href={`/groups/${group.id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← 戻る
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {group.name}
          </p>
          <h1 className="text-xl font-bold text-gray-800">計画を作成</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        {serverError && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {serverError}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Field label="行事名 *" error={errors.title?.message}>
            <input {...register('title')} className={inputClass} placeholder="春キャンプ" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="種別" error={errors.category?.message}>
              <select {...register('category')} className={inputClass}>
                <option value="キャンプ">キャンプ</option>
                <option value="合宿">合宿</option>
                <option value="日帰り">日帰り</option>
                <option value="その他">その他</option>
              </select>
            </Field>

            <Field label="状態" error={errors.status?.message}>
              <select {...register('status')} className={inputClass}>
                <option value="draft">下書き</option>
                <option value="recruiting">募集として公開</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="開始日" error={errors.start_date?.message}>
              <input {...register('start_date')} type="date" className={inputClass} />
            </Field>
            <Field label="終了日" error={errors.end_date?.message}>
              <input {...register('end_date')} type="date" className={inputClass} />
            </Field>
          </div>

          <Field label="場所エリア" error={errors.area?.message}>
            <input {...register('area')} className={inputClass} placeholder="福岡県糸島市" />
          </Field>

          <Field label="説明" error={errors.description?.message}>
            <textarea
              {...register('description')}
              className={`${inputClass} min-h-28 resize-y`}
              placeholder="活動内容やメンバーへの補足を書きます"
            />
          </Field>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-green-600 py-2 font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? '作成中...' : '計画を作成'}
          </button>
        </form>
      </div>
    </div>
  )
}

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
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
