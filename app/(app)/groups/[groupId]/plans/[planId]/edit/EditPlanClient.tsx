'use client'

// 計画の編集。
//
// 以前は基本情報しか編集できず、行程表と募集設定は計画詳細の中でも
// 直せたため、「どこで直すのか」が分からない状態だった。
// 編集はこの画面に集約し、計画詳細は表示だけにしている。

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { openDatePicker } from '@/lib/dateInput'
import { toUserMessage } from '@/lib/errorMessage'

type Group = { id: string; name: string }

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
  budget_per_person: number | null
  default_transport: string | null
}

type ScheduleItem = {
  id: string
  day: string | null
  time: string | null
  sort_order: number | null
  time_label: string | null
  location_name: string | null
  note: string | null
  transport: string | null
}

type Recruitment = {
  id: string
  type: string | null
  capacity: number | null
  deadline: string | null
  is_closed: boolean | null
}

type Props = {
  group: Group
  plan: Plan
  scheduleItems: ScheduleItem[]
  recruitment: Recruitment | null
}

/** 画面で編集する行程の1行。id があれば既存、無ければ新規 */
type ScheduleRow = {
  id?: string
  day: string
  time: string
  time_label: string
  location_name: string
  note: string
  transport: string
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500'

const CATEGORIES = ['キャンプ', '合宿', '日帰り', 'その他']
const TRANSPORTS = ['車', '公共交通', '徒歩', 'その他']
const SCHEDULE_LABELS = ['集合', '出発', '到着', '解散', '休憩', '買い出し']

function createTimeOptions() {
  const options: string[] = []
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 30]) {
      options.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
    }
  }
  return options
}
const TIME_OPTIONS = createTimeOptions()

function toDateTimeLocalValue(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

export default function EditPlanClient({ group, plan, scheduleItems, recruitment }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [basic, setBasic] = useState({
    title: plan.title ?? '',
    category: plan.category ?? 'キャンプ',
    start_date: plan.start_date ?? '',
    end_date: plan.end_date ?? '',
    area: plan.area ?? '',
    budget: plan.budget_per_person != null ? String(plan.budget_per_person) : '',
    default_transport: plan.default_transport ?? '',
    description: plan.description ?? '',
  })

  const [rows, setRows] = useState<ScheduleRow[]>(
    scheduleItems.map((item) => ({
      id: item.id,
      day: item.day ?? '',
      time: item.time ? item.time.slice(0, 5) : '',
      time_label: item.time_label ?? '',
      location_name: item.location_name ?? '',
      note: item.note ?? '',
      transport: item.transport ?? '',
    }))
  )
  // 画面から消された行は、保存時にまとめて削除する
  const [removedIds, setRemovedIds] = useState<string[]>([])

  const [recruit, setRecruit] = useState({
    enabled: recruitment != null,
    type: recruitment?.type === 'first_come' ? 'first_come' : 'deadline',
    capacity: recruitment?.capacity != null ? String(recruitment.capacity) : '',
    deadline: toDateTimeLocalValue(recruitment?.deadline ?? null),
    is_closed: recruitment?.is_closed ?? false,
  })

  const setBasicField = (key: keyof typeof basic, value: string) =>
    setBasic((current) => ({ ...current, [key]: value }))

  const setRow = (index: number, key: keyof ScheduleRow, value: string) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [key]: value } : row))
    )

  const addRow = () =>
    setRows((current) => [
      ...current,
      {
        day: basic.start_date,
        time: '',
        time_label: '',
        location_name: '',
        note: '',
        transport: '',
      },
    ])

  const removeRow = (index: number) => {
    const target = rows[index]
    if (target.id) setRemovedIds((current) => [...current, target.id as string])
    setRows((current) => current.filter((_, i) => i !== index))
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setServerError(null)

    if (basic.title.trim() === '') {
      setServerError('行事名を入力してください')
      return
    }
    if (basic.start_date && basic.end_date && basic.end_date < basic.start_date) {
      setServerError('終了日は開始日以降にしてください')
      return
    }

    const budget = basic.budget.trim() === '' ? null : Number(basic.budget)
    if (budget != null && (!Number.isInteger(budget) || budget < 0)) {
      setServerError('予算は0以上の整数（円）で入力してください')
      return
    }

    let deadlineIso: string | null = null
    let capacity: number | null = null
    if (recruit.enabled) {
      if (!recruit.deadline) {
        setServerError('募集を設定する場合は締切日時を入力してください')
        return
      }
      const date = new Date(recruit.deadline)
      if (Number.isNaN(date.getTime())) {
        setServerError('締切日時が正しくありません')
        return
      }
      deadlineIso = date.toISOString()
      if (recruit.type === 'first_come') {
        capacity = recruit.capacity.trim() === '' ? null : Number(recruit.capacity)
        if (capacity == null || !Number.isInteger(capacity) || capacity < 1) {
          setServerError('先着順では定員（1以上）を入力してください')
          return
        }
      }
    }

    setSaving(true)

    // 1) 基本情報
    const { error: planError } = await supabase
      .from('plans')
      .update({
        title: basic.title.trim(),
        category: basic.category || null,
        start_date: basic.start_date || null,
        end_date: basic.end_date || null,
        area: basic.area || null,
        budget_per_person: budget,
        default_transport: basic.default_transport || null,
        description: basic.description || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', plan.id)

    if (planError) {
      setServerError(toUserMessage(planError, '計画を更新できませんでした。'))
      setSaving(false)
      return
    }

    // 2) 行程表。消された行を削除し、既存は更新、新規は追加する
    if (removedIds.length > 0) {
      const { error } = await supabase.from('schedule_items').delete().in('id', removedIds)
      if (error) {
        setServerError(toUserMessage(error, '行程を削除できませんでした。'))
        setSaving(false)
        return
      }
    }

    const validRows = rows.filter((row) => row.location_name.trim() !== '')
    for (const [index, row] of validRows.entries()) {
      const payload = {
        day: row.day || null,
        time: row.time || null,
        sort_order: index,
        time_label: row.time_label || null,
        location_name: row.location_name.trim(),
        map_query: row.location_name.trim(),
        note: row.note || null,
        transport: row.transport || null,
      }

      const { error } = row.id
        ? await supabase.from('schedule_items').update(payload).eq('id', row.id)
        : await supabase.from('schedule_items').insert({ ...payload, plan_id: plan.id })

      if (error) {
        setServerError(toUserMessage(error, '行程を保存できませんでした。'))
        setSaving(false)
        return
      }
    }

    // 3) 募集設定
    if (recruit.enabled && deadlineIso) {
      const { error } = await supabase.from('recruitments').upsert(
        {
          plan_id: plan.id,
          type: recruit.type,
          capacity: recruit.type === 'first_come' ? capacity : null,
          deadline: deadlineIso,
          is_closed: recruit.is_closed,
        },
        { onConflict: 'plan_id' }
      )
      if (error) {
        setServerError(toUserMessage(error, '募集設定を保存できませんでした。'))
        setSaving(false)
        return
      }
    } else if (!recruit.enabled && recruitment) {
      const { error } = await supabase.from('recruitments').delete().eq('plan_id', plan.id)
      if (error) {
        setServerError(toUserMessage(error, '募集設定を削除できませんでした。'))
        setSaving(false)
        return
      }
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
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {group.name}
          </p>
          <h1 className="text-xl font-bold text-gray-800">計画を編集</h1>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {/* 基本情報 */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-gray-700">基本情報</h2>
          <div className="space-y-4">
            <Field label="行事名 *">
              <input
                value={basic.title}
                onChange={(event) => setBasicField('title', event.target.value)}
                className={inputClass}
                placeholder="春キャンプ"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="種別">
                <select
                  value={basic.category}
                  onChange={(event) => setBasicField('category', event.target.value)}
                  className={inputClass}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="一人あたり予算（円）">
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={basic.budget}
                  onChange={(event) => setBasicField('budget', event.target.value)}
                  className={inputClass}
                  placeholder="例: 5000"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="開始日">
                <input
                  type="date"
                  onClick={openDatePicker}
                  value={basic.start_date}
                  onChange={(event) => setBasicField('start_date', event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="終了日">
                <input
                  type="date"
                  onClick={openDatePicker}
                  value={basic.end_date}
                  onChange={(event) => setBasicField('end_date', event.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="場所エリア">
              <input
                value={basic.area}
                onChange={(event) => setBasicField('area', event.target.value)}
                className={inputClass}
                placeholder="福岡県糸島市"
              />
            </Field>

            <Field label="全体の交通手段">
              <select
                value={basic.default_transport}
                onChange={(event) => setBasicField('default_transport', event.target.value)}
                className={inputClass}
              >
                <option value="">未定</option>
                {TRANSPORTS.map((transport) => (
                  <option key={transport} value={transport}>
                    {transport}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="説明">
              <textarea
                value={basic.description}
                onChange={(event) => setBasicField('description', event.target.value)}
                className={`${inputClass} min-h-24 resize-y`}
                placeholder="活動内容やメンバーへの補足を書きます"
              />
            </Field>
          </div>
        </section>

        {/* 行程表 */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-gray-700">行程表</h2>
            <button
              type="button"
              onClick={addRow}
              className="pressable rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:border-green-400"
            >
              ＋ 行程を追加
            </button>
          </div>
          <p className="mb-3 text-xs text-gray-500">
            保存すると、ここで並べた内容がそのまま計画の行程表になります。
          </p>

          {rows.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
              行程はまだありません
            </p>
          ) : (
            <div className="space-y-3">
              {rows.map((row, index) => (
                <div key={row.id ?? `new-${index}`} className="rounded-xl border border-gray-100 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-500">行程 {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="pressable rounded-lg px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50"
                    >
                      削除
                    </button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      type="date"
                      onClick={openDatePicker}
                      value={row.day}
                      onChange={(event) => setRow(index, 'day', event.target.value)}
                      className={inputClass}
                      aria-label="日付"
                    />
                    <select
                      value={row.time}
                      onChange={(event) => setRow(index, 'time', event.target.value)}
                      className={inputClass}
                      aria-label="時刻"
                    >
                      <option value="">時刻未定</option>
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                    <select
                      value={row.time_label}
                      onChange={(event) => setRow(index, 'time_label', event.target.value)}
                      className={inputClass}
                      aria-label="ラベル"
                    >
                      <option value="">ラベルなし</option>
                      {SCHEDULE_LABELS.map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    value={row.location_name}
                    onChange={(event) => setRow(index, 'location_name', event.target.value)}
                    className={`${inputClass} mt-2`}
                    placeholder="場所名（例: 大学正門、○○キャンプ場）"
                  />
                  <textarea
                    value={row.note}
                    onChange={(event) => setRow(index, 'note', event.target.value)}
                    className={`${inputClass} mt-2 min-h-14 resize-y`}
                    placeholder="この場所の注釈（任意）"
                  />
                  <select
                    value={row.transport}
                    onChange={(event) => setRow(index, 'transport', event.target.value)}
                    className={`${inputClass} mt-2`}
                    aria-label="交通手段"
                  >
                    <option value="">
                      全体の交通手段を使う
                      {basic.default_transport ? `（${basic.default_transport}）` : '（未定）'}
                    </option>
                    {TRANSPORTS.map((transport) => (
                      <option key={transport} value={transport}>
                        {transport}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 募集・参加 */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-gray-700">
            <input
              type="checkbox"
              checked={recruit.enabled}
              onChange={(event) =>
                setRecruit((current) => ({ ...current, enabled: event.target.checked }))
              }
            />
            募集・参加を設定する
          </label>
          {!recruit.enabled && recruitment && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              保存すると募集方式・締切・定員の設定が消えます（参加しているメンバーはそのまま残ります）。
            </p>
          )}

          {recruit.enabled && (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="募集方式">
                  <select
                    value={recruit.type}
                    onChange={(event) =>
                      setRecruit((current) => ({
                        ...current,
                        type: event.target.value,
                        capacity: event.target.value === 'first_come' ? current.capacity : '',
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="deadline">時間締切</option>
                    <option value="first_come">先着順＆時間締切</option>
                  </select>
                </Field>
                {recruit.type === 'first_come' && (
                  <Field label="定員（先着人数）">
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={recruit.capacity}
                      onChange={(event) =>
                        setRecruit((current) => ({ ...current, capacity: event.target.value }))
                      }
                      className={inputClass}
                      placeholder="例: 10"
                    />
                  </Field>
                )}
              </div>

              <Field label="締切日時">
                <input
                  type="datetime-local"
                  onClick={openDatePicker}
                  value={recruit.deadline}
                  onChange={(event) =>
                    setRecruit((current) => ({ ...current, deadline: event.target.value }))
                  }
                  className={inputClass}
                />
              </Field>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={recruit.is_closed}
                  onChange={(event) =>
                    setRecruit((current) => ({ ...current, is_closed: event.target.checked }))
                  }
                />
                募集を締め切る
              </label>
            </div>
          )}
        </section>

        {serverError && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600"
          >
            {serverError}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={saving} className="btn-primary flex-1 py-3 sm:flex-none sm:px-8">
            {saving ? '保存中...' : '保存する'}
          </button>
          <Link href={`/groups/${group.id}/plans/${plan.id}`} className="btn-secondary">
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      {/* label で囲むことで、ラベル文字をタップしても入力欄に移動できる */}
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}
