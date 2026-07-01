'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useState, useRef } from 'react'
import Image from 'next/image'

const CATEGORIES = ['テント', '寝袋', '調理', 'テーブル・チェア', '照明', 'その他']

const schema = z.object({
  name: z.string().min(1, '名前を入力してください'),
  category: z.string().optional().nullable(),
  price: z.number().int().min(0).optional().nullable(),
  quantity: z.number().int().min(1).optional().nullable(),
  capacity: z.number().int().min(1).optional().nullable(),
})
type FormValues = z.infer<typeof schema>

type Gear = {
  id: string
  name: string
  category: string | null
  price: number | null
  quantity: number | null
  capacity: number | null
  photo_url: string | null
}

type Props = {
  initialGear: Gear[]
  userId: string
}

export default function GearClient({ initialGear, userId }: Props) {
  const supabase = createClient()
  const [gearList, setGearList] = useState<Gear[]>(initialGear)
  const [editing, setEditing] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const openAdd = () => {
    reset({ name: '', category: '', price: undefined, quantity: undefined, capacity: undefined })
    setEditing(null)
    setPendingPhoto(null)
    setPreviewUrl(null)
    setShowForm(true)
  }

  const openEdit = (g: Gear) => {
    reset({
      name: g.name,
      category: g.category ?? '',
      price: g.price ?? undefined,
      quantity: g.quantity ?? undefined,
      capacity: g.capacity ?? undefined,
    })
    setEditing(g.id)
    setPendingPhoto(null)
    setPreviewUrl(g.photo_url)
    setShowForm(true)
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingPhoto(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const uploadPhoto = async (gearId: string): Promise<string | null> => {
    if (!pendingPhoto) return null
    const ext = pendingPhoto.name.split('.').pop()
    const path = `${userId}/${gearId}.${ext}`
    const { error } = await supabase.storage
      .from('gear')
      .upload(path, pendingPhoto, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('gear').getPublicUrl(path)
    return data.publicUrl
  }

  const onSubmit = async (data: FormValues) => {
    setServerError(null)
    if (editing) {
      const photoUrl = await uploadPhoto(editing)
      const updateData: FormValues & { photo_url?: string } = { ...data }
      if (photoUrl) updateData.photo_url = photoUrl
      const { data: updated, error } = await supabase
        .from('gear')
        .update(updateData)
        .eq('id', editing)
        .select()
        .single()
      if (error) { setServerError(error.message); return }
      setGearList((prev) => prev.map((g) => (g.id === editing ? updated : g)))
    } else {
      const { data: created, error } = await supabase
        .from('gear')
        .insert({ ...data, owner_id: userId })
        .select()
        .single()
      if (error) { setServerError(error.message); return }
      if (pendingPhoto) {
        const photoUrl = await uploadPhoto(created.id)
        if (photoUrl) {
          await supabase.from('gear').update({ photo_url: photoUrl }).eq('id', created.id)
          created.photo_url = photoUrl
        }
      }
      setGearList((prev) => [created, ...prev])
    }
    setShowForm(false)
    reset()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この道具を削除しますか？')) return
    const { error } = await supabase.from('gear').delete().eq('id', id)
    if (error) { setServerError(error.message); return }
    setGearList((prev) => prev.filter((g) => g.id !== id))
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
        ＋ 道具を追加
      </button>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-green-200">
          <h2 className="text-sm font-bold text-gray-700 mb-4">
            {editing ? '道具を編集' : '道具を追加'}
          </h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <Field label="道具名 *" error={errors.name?.message}>
              <input {...register('name')} className={inputClass} placeholder="テント（3人用）" />
            </Field>

            <Field label="カテゴリー" error={errors.category?.message}>
              <select {...register('category')} className={inputClass}>
                <option value="">選択してください</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="金額（円）" error={errors.price?.message}>
                <input {...register('price', { valueAsNumber: true })} type="number" min={0} className={inputClass} placeholder="15000" />
              </Field>
              <Field label="個数" error={errors.quantity?.message}>
                <input {...register('quantity', { valueAsNumber: true })} type="number" min={1} className={inputClass} placeholder="1" />
              </Field>
              <Field label="対応人数" error={errors.capacity?.message}>
                <input {...register('capacity', { valueAsNumber: true })} type="number" min={1} className={inputClass} placeholder="3" />
              </Field>
            </div>

            {/* 写真アップロード */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">写真</label>
              <div
                className="w-full h-28 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-green-400 transition overflow-hidden"
                onClick={() => fileInputRef.current?.click()}
              >
                {previewUrl ? (
                  <Image src={previewUrl} alt="プレビュー" width={200} height={112} className="object-contain h-full" />
                ) : (
                  <span className="text-sm text-gray-400">クリックして写真を選択</span>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>

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

      {gearList.length === 0 ? (
        <p className="text-center text-gray-400 py-10 text-sm">登録された道具はありません</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {gearList.map((g) => (
            <div key={g.id} className="bg-white rounded-2xl shadow-sm p-3">
              {g.photo_url ? (
                <div className="w-full h-28 overflow-hidden rounded-lg mb-2 bg-gray-100">
                  <Image
                    src={g.photo_url}
                    alt={g.name}
                    width={200}
                    height={112}
                    className="object-cover w-full h-full"
                  />
                </div>
              ) : (
                <div className="w-full h-28 bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-3xl text-gray-300">
                  🏕
                </div>
              )}
              <p className="font-semibold text-sm text-gray-800 truncate">{g.name}</p>
              {g.category && <p className="text-xs text-gray-400">{g.category}</p>}
              <p className="text-xs text-gray-500 mt-1">
                {g.quantity != null ? `${g.quantity}個` : ''}
                {g.capacity != null ? ` ／ ${g.capacity}人用` : ''}
                {g.price != null ? ` ／ ¥${g.price.toLocaleString()}` : ''}
              </p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => openEdit(g)} className="text-xs text-blue-600 hover:underline">
                  編集
                </button>
                <button onClick={() => handleDelete(g.id)} className="text-xs text-red-500 hover:underline">
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
