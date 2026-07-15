'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { openDatePicker } from '@/lib/dateInput'

type Group = {
  id: string
  name: string
}

type Plan = {
  id: string
  group_id: string
  creator_id: string | null
  title: string
  category: string | null
  start_date: string | null
  end_date: string | null
  area: string | null
  description: string | null
}

type Props = {
  group: Group
  plan: Plan
}

const schema = z
  .object({
    title: z.string().min(1, '行事名を入力してください'),
    category: z.string().optional().nullable(),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    area: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
  })
  .refine(
    (data) => !data.start_date || !data.end_date || data.end_date >= data.start_date,
    { message: '終了日は開始日以降にしてください', path: ['end_date'] }
  )

type FormValues = z.infer<typeof schema>

const inputClass =
  'w-full border border-gray-300 rounded-lg bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500'

export default function EditPlanClient({ group, plan }: Props) {
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
      title: plan.title ?? '',
      category: plan.category ?? 'キャンプ',
      start_date: plan.start_date ?? '',
      end_date: plan.end_date ?? '',
      area: plan.area ?? '',
      description: plan.description ?? '',
    },
  })

  const onSubmit = async (data: FormValues) => {
    setServerError(null)

    const { error } = await supabase
      .from('plans')
      .update({
        title: data.title,
        category: data.category || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        area: data.area || null,
        description: data.description || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', plan.id)

    if (error) {
      setServerError('計画の更新に失敗しました: ' + error.message)
      return
    }

    router.push(`/groups/${group.id}/plans/${plan.id}`)
    router.refresh()
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/groups/${group.id}/plans/${plan.id}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← 戻る
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {group.name}
          </p>
          <h1 className="text-xl font-bold text-gray-800">基本情報を編集</h1>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        {serverError && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {serverError}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Field label="行事名 *" error={errors.title?.message}>
            <input {...register('title')} className={inputClass} placeholder="春キャンプ" />
          </Field>

          <Field label="種別" error={errors.category?.message}>
            <select {...register('category')} className={inputClass}>
              <option value="キャンプ">キャンプ</option>
              <option value="合宿">合宿</option>
              <option value="日帰り">日帰り</option>
              <option value="その他">その他</option>
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="開始日" error={errors.start_date?.message}>
              <input {...register('start_date')} type="date" onClick={openDatePicker} className={inputClass} />
            </Field>
            <Field label="終了日" error={errors.end_date?.message}>
              <input {...register('end_date')} type="date" onClick={openDatePicker} className={inputClass} />
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

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 text-base">
            {isSubmitting ? '保存中...' : '変更を保存'}
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
