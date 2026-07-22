'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { openDatePicker } from '@/lib/dateInput'
import { PLAN_TEMPLATES, type PlanTemplate } from '@/lib/planTemplates'

type Group = {
  id: string
  name: string
}

type Props = {
  group: Group
  currentUserId: string
}

type ScheduleRow = {
  day: string
  time: string
  time_label: string
  location_name: string
  note: string
  transport: string
}

const inputClass =
  'w-full border border-gray-300 rounded-lg bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500'

const transportOptions = ['未定', '車', '公共交通', '徒歩', 'その他']
const scheduleLabels = ['集合', '出発', '到着', '解散', '休憩', '買い出し']

function createHalfHourTimeOptions() {
  const options: string[] = []
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 30]) {
      options.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
    }
  }
  return options
}
const timeOptions = createHalfHourTimeOptions()

function emptyRow(day = ''): ScheduleRow {
  return { day, time: '', time_label: '', location_name: '', note: '', transport: '' }
}

/** 日付文字列(YYYY-MM-DD)に日数を足す */
function addDays(base: Date, days: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function NewPlanClient({ group, currentUserId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  // 基本情報
  const [basic, setBasic] = useState({
    title: '',
    category: 'キャンプ',
    start_date: '',
    end_date: '',
    area: '',
    budget: '',
    default_transport: '',
    description: '',
  })
  const setBasicField = (key: keyof typeof basic, value: string) =>
    setBasic((current) => ({ ...current, [key]: value }))

  // 募集設定（最初から入力できるように開いておく）
  const [recruit, setRecruit] = useState({
    enabled: true,
    type: 'deadline' as 'deadline' | 'first_come',
    deadline: '',
    capacity: '',
  })

  // 行程表（最初から1行分を用意しておく。2つ目以降は「＋行程を追加」で増やす）
  const [rows, setRows] = useState<ScheduleRow[]>([emptyRow()])

  // テンプレートを選んで一括入力する
  const applyTemplate = (template: PlanTemplate) => {
    if (
      (basic.title.trim() !== '' || rows.some((row) => row.location_name.trim() !== '')) &&
      !confirm('入力中の内容をテンプレートの内容で置き換えます。よろしいですか？')
    ) {
      return
    }

    // 日程は「例」として、今日から約1か月後を仮に入れておく（あとで調整できる）
    const start = new Date()
    start.setDate(start.getDate() + 30)
    const startStr = addDays(start, 0)
    const endStr = addDays(start, template.nights)

    setBasic({
      title: template.name,
      category: template.category,
      start_date: startStr,
      end_date: endStr,
      area: '',
      budget: String(template.budget),
      default_transport: template.transport,
      description: template.description,
    })

    setRows(
      template.schedule.map((row) => ({
        day: addDays(start, row.dayOffset),
        time: row.time,
        time_label: row.time_label,
        location_name: row.location_name,
        note: row.note ?? '',
        transport: '',
      }))
    )

    // コピーしたらテンプレート一覧は閉じて、フォームに集中できるようにする
    setShowTemplates(false)
  }

  const addRow = () => setRows((current) => [...current, emptyRow(basic.start_date)])
  const removeRow = (index: number) =>
    setRows((current) => current.filter((_, i) => i !== index))
  const setRow = (index: number, key: keyof ScheduleRow, value: string) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [key]: value } : row))
    )

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

    // 募集設定のチェック（有効にした場合のみ）
    let deadlineIso: string | null = null
    let capacity: number | null = null
    if (recruit.enabled) {
      if (!recruit.deadline) {
        setServerError('募集を設定する場合は締切日時を入力してください')
        return
      }
      const d = new Date(recruit.deadline)
      if (Number.isNaN(d.getTime())) {
        setServerError('締切日時が正しくありません')
        return
      }
      deadlineIso = d.toISOString()
      if (recruit.type === 'first_come') {
        capacity = recruit.capacity.trim() === '' ? null : Number(recruit.capacity)
        if (capacity == null || !Number.isInteger(capacity) || capacity < 1) {
          setServerError('先着順では定員（1以上）を入力してください')
          return
        }
      }
    }

    setSubmitting(true)

    // 1) 計画本体（状態は未公開。公開は詳細画面の「募集を開始する」で）
    const { data: created, error } = await supabase
      .from('plans')
      .insert({
        group_id: group.id,
        creator_id: currentUserId,
        title: basic.title.trim(),
        category: basic.category || null,
        status: 'draft',
        start_date: basic.start_date || null,
        end_date: basic.end_date || null,
        area: basic.area || null,
        budget_per_person: budget,
        default_transport: basic.default_transport || null,
        description: basic.description || null,
      })
      .select('id')
      .single()

    if (error || !created) {
      setServerError('計画の作成に失敗しました: ' + (error?.message ?? ''))
      setSubmitting(false)
      return
    }

    // 2) 起案者を参加登録
    await supabase.from('participants').upsert({ plan_id: created.id, user_id: currentUserId })

    // 3) 行程表（場所名が入っている行だけ）
    const validRows = rows.filter((row) => row.location_name.trim() !== '')
    if (validRows.length > 0) {
      const { error: scheduleError } = await supabase.from('schedule_items').insert(
        validRows.map((row, index) => ({
          plan_id: created.id,
          day: row.day || null,
          time: row.time || null,
          sort_order: index,
          time_label: row.time_label || null,
          location_name: row.location_name.trim(),
          map_query: row.location_name.trim(),
          note: row.note || null,
          transport: row.transport || null,
        }))
      )
      if (scheduleError) {
        setServerError('計画は作成されましたが、行程の保存に失敗しました: ' + scheduleError.message)
        setSubmitting(false)
        router.push(`/groups/${group.id}/plans/${created.id}`)
        return
      }
    }

    // 4) 募集設定
    if (recruit.enabled && deadlineIso) {
      const { error: recError } = await supabase.from('recruitments').insert({
        plan_id: created.id,
        type: recruit.type,
        capacity: recruit.type === 'first_come' ? capacity : null,
        deadline: deadlineIso,
        is_closed: false,
      })
      if (recError) {
        setServerError('計画は作成されましたが、募集設定の保存に失敗しました: ' + recError.message)
        setSubmitting(false)
        router.push(`/groups/${group.id}/plans/${created.id}`)
        return
      }
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

      {serverError && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>
      )}

      {/* テンプレートから作成（ボタンを押すと一覧が開く） */}
      <section className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setShowTemplates((open) => !open)}
          aria-expanded={showTemplates}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span>
            <span className="text-sm font-bold text-gray-700">📋 テンプレートから作成</span>
            <span className="ml-2 text-xs text-gray-400">（任意・選ぶと一括入力）</span>
          </span>
          <span
            aria-hidden
            className={`text-lg text-gray-400 transition ${showTemplates ? 'rotate-45' : ''}`}
          >
            ＋
          </span>
        </button>

        {showTemplates && (
          <div className="mt-4">
            <p className="text-xs text-gray-500">
              近い企画を選んで「この内容をコピー」を押すと、下のフォームに一括で入力されます（日程・場所などはあとで調整できます）。
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {PLAN_TEMPLATES.map((template) => (
                <div
                  key={template.id}
                  className="flex items-start gap-3 rounded-xl border border-gray-100 p-3"
                >
                  <span aria-hidden className="text-2xl leading-none">
                    {template.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-800">{template.name}</p>
                    <p className="mt-0.5 text-xs leading-5 text-gray-500">{template.summary}</p>
                    <button
                      type="button"
                      onClick={() => applyTemplate(template)}
                      className="mt-2 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 transition hover:bg-green-100"
                    >
                      📋 この内容をコピー
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

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
                  <option value="キャンプ">キャンプ</option>
                  <option value="合宿">合宿</option>
                  <option value="日帰り">日帰り</option>
                  <option value="その他">その他</option>
                </select>
              </Field>
              <Field label="一人あたり予算（円）">
                <input
                  type="number"
                  min={0}
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
                {transportOptions
                  .filter((option) => option !== '未定')
                  .map((option) => (
                    <option key={option} value={option}>
                      {option}
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

        {/* 行程表（任意） */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-700">行程表（任意）</h2>
            <button
              type="button"
              onClick={addRow}
              className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100"
            >
              ＋ 行程を追加
            </button>
          </div>
          <p className="mb-3 text-xs text-gray-500">
            集合・到着・解散などの流れを入れられます（あとで詳細画面でも追加・編集できます）。
          </p>

          {rows.length === 0 ? (
            <button
              type="button"
              onClick={addRow}
              className="w-full rounded-lg border border-dashed border-gray-300 px-4 py-4 text-center text-sm text-gray-400 transition hover:border-green-400 hover:text-green-600"
            >
              ＋ 行程を追加する
            </button>
          ) : (
            <div className="space-y-4">
              {rows.map((row, index) => (
                <div key={index} className="rounded-xl border border-gray-100 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500">行程 {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="text-xs font-semibold text-red-500 hover:text-red-700"
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
                    />
                    <select
                      value={row.time}
                      onChange={(event) => setRow(index, 'time', event.target.value)}
                      className={inputClass}
                    >
                      <option value="">時刻未定</option>
                      {timeOptions.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                    <select
                      value={row.time_label}
                      onChange={(event) => setRow(index, 'time_label', event.target.value)}
                      className={inputClass}
                    >
                      <option value="">ラベルなし</option>
                      {scheduleLabels.map((label) => (
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
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 募集・参加（任意） */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-gray-700">
            <input
              type="checkbox"
              checked={recruit.enabled}
              onChange={(event) =>
                setRecruit((current) => ({ ...current, enabled: event.target.checked }))
              }
              className="h-4 w-4"
            />
            募集・参加を設定する（任意）
          </label>
          <p className="mt-1 text-xs text-gray-500">
            ここで設定しておくと、あとで「募集を開始する」を押すだけで公開できます。
          </p>

          {recruit.enabled && (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="募集方式">
                  <select
                    value={recruit.type}
                    onChange={(event) =>
                      setRecruit((current) => ({
                        ...current,
                        type: event.target.value as 'deadline' | 'first_come',
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
            </div>
          )}
        </section>

        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-500">
          作成するとそのまま保存され、「自分の計画」に入ります（この時点ではまだグループに公開されません）。
          グループへの公開は、計画の詳細画面の「📣 募集を開始する」から行えます。
        </p>

        <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
          {submitting ? '作成中...' : '計画を作成'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}
