'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

const schema = z.object({
  name: z.string().optional().nullable(),
  capacity: z.number().int().min(1, '1以上を入力してください'),
  luggage_capacity: z.string().optional().nullable(),
})
type FormValues = z.infer<typeof schema>

type Car = {
  id: string
  name: string | null
  capacity: number | null
  luggage_capacity: string | null
}

type Props = {
  initialCars: Car[]
  userId: string
}

export default function CarsClient({ initialCars, userId }: Props) {
  const supabase = createClient()
  const [cars, setCars] = useState<Car[]>(initialCars)
  const [editing, setEditing] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const openAdd = () => {
    reset({ name: '', capacity: undefined, luggage_capacity: '' })
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (car: Car) => {
    reset({
      name: car.name ?? '',
      capacity: car.capacity ?? undefined,
      luggage_capacity: car.luggage_capacity ?? '',
    })
    setEditing(car.id)
    setShowForm(true)
  }

  const onSubmit = async (data: FormValues) => {
    setServerError(null)
    if (editing) {
      const { data: updated, error } = await supabase
        .from('cars')
        .update(data)
        .eq('id', editing)
        .select()
        .single()
      if (error) { setServerError(error.message); return }
      setCars((prev) => prev.map((c) => (c.id === editing ? updated : c)))
    } else {
      const { data: created, error } = await supabase
        .from('cars')
        .insert({ ...data, owner_id: userId })
        .select()
        .single()
      if (error) { setServerError(error.message); return }
      setCars((prev) => [created, ...prev])
    }
    setShowForm(false)
    reset()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この車を削除しますか？')) return
    const { error } = await supabase.from('cars').delete().eq('id', id)
    if (error) { setServerError(error.message); return }
    setCars((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="space-y-4">
      {serverError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{serverError}</p>
      )}

      <button
        onClick={openAdd}
        className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
      >
        ＋ 車を追加
      </button>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-green-200">
          <h2 className="text-sm font-bold text-gray-700 mb-4">
            {editing ? '車を編集' : '車を追加'}
          </h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <Field label="車種・呼び名" error={errors.name?.message}>
              <input {...register('name')} className={inputClass} placeholder="プリウス / 青い車 など" />
            </Field>
            <Field label="乗車人数 *" error={errors.capacity?.message}>
              <input {...register('capacity', { valueAsNumber: true })} type="number" min={1} className={inputClass} placeholder="5" />
            </Field>
            <Field label="積載量（自由記述）" error={errors.luggage_capacity?.message}>
              <input {...register('luggage_capacity')} className={inputClass} placeholder="トランク中サイズ2個" />
            </Field>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50 text-sm"
              >
                {isSubmitting ? '保存中...' : '保存'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 rounded-lg transition text-sm"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {cars.length === 0 ? (
        <p className="text-center text-gray-400 py-10 text-sm">登録された車はありません</p>
      ) : (
        <div className="space-y-3">
          {cars.map((car) => (
            <div
              key={car.id}
              className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold text-gray-800">
                  {car.name || '（名称なし）'}
                </p>
                <p className="text-sm text-gray-500">
                  乗車 {car.capacity}人
                  {car.luggage_capacity ? ` ／ 積載: ${car.luggage_capacity}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(car)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  編集
                </button>
                <button
                  onClick={() => handleDelete(car.id)}
                  className="text-xs text-red-500 hover:underline"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
