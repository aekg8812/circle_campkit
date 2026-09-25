'use client'

// グループが自作する計画テンプレートの管理画面。
//
// 「よく行く場所」は年々変わるので、コードを直さずにアプリ内で足せるようにする。
// 作り方は2通り:
//   1. 計画詳細の「⭐ テンプレートに保存」で、うまくいった行程をそのまま残す
//   2. この画面で空から作る
// どちらも、ここで名前・予算・行程を直せる。

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import { toUserMessage } from '@/lib/errorMessage'
import type { PlanTemplate, TemplateScheduleRow } from '@/lib/planTemplates'

type Props = {
  group: { id: string; name: string }
  currentUserId: string
  templates: PlanTemplate[]
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500'

// 計画作成フォームと同じ選択肢に揃える（コピーしたとき、そのまま入るように）
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

export default function TemplatesClient({ group, currentUserId, templates }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addTemplate = async () => {
    setError(null)
    setCreating(true)

    const { error: insertError } = await supabase.from('plan_templates').insert({
      group_id: group.id,
      created_by: currentUserId,
      name: '新しいテンプレート',
      emoji: '🏕️',
      category: 'キャンプ',
      nights: 1,
      transport: '車',
      schedule: [],
    })

    setCreating(false)
    if (insertError) {
      setError(toUserMessage(insertError, 'テンプレートを作成できませんでした。'))
      return
    }
    toast('テンプレートを作成しました')
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/groups/${group.id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← 戻る
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {group.name}
          </p>
          <h1 className="text-xl font-bold text-gray-800">計画テンプレート</h1>
        </div>
      </div>

      <p className="rounded-xl bg-white p-4 text-sm leading-6 text-gray-600 shadow-sm">
        よく行く場所を登録しておくと、<strong>計画を作るときに一括で入力</strong>できます。
        <br />
        計画詳細の <strong>「⭐ テンプレートに保存」</strong> からも作れます。
        うまくいった行程をそのまま残すなら、そちらが簡単です。
      </p>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>
      )}

      {templates.length === 0 ? (
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm">
          <p className="text-4xl">🏕️</p>
          <p className="mt-3 text-base font-bold text-gray-800">
            まだテンプレートがありません
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-500">
            定番の行き先を登録しておくと、次回から書き直さずに使えます。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <TemplateEditor key={template.id} template={template} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addTemplate}
        disabled={creating}
        className="pressable flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-green-300 bg-white py-4 text-sm font-bold text-green-700 hover:border-green-500 hover:bg-green-50 disabled:opacity-50"
      >
        {creating ? '作成中...' : '＋ 空のテンプレートを作る'}
      </button>
    </div>
  )
}

/** テンプレート1件の編集。既定では畳んでおき、開いたときだけ中身を出す */
function TemplateEditor({ template }: { template: PlanTemplate }) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const confirm = useConfirm()

  const [form, setForm] = useState({
    emoji: template.emoji,
    name: template.name,
    summary: template.summary,
    category: template.category,
    nights: String(template.nights),
    budget: template.budget ? String(template.budget) : '',
    transport: template.transport,
    description: template.description,
  })
  const [rows, setRows] = useState<TemplateScheduleRow[]>(template.schedule)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setField = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const setRow = (index: number, key: keyof TemplateScheduleRow, value: string | number) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [key]: value } : row))
    )

  const moveRow = (index: number, direction: -1 | 1) => {
    const next = index + direction
    if (next < 0 || next >= rows.length) return
    setRows((current) => {
      const copy = [...current]
      ;[copy[index], copy[next]] = [copy[next], copy[index]]
      return copy
    })
  }

  const addRow = () =>
    setRows((current) => [
      ...current,
      { dayOffset: 0, time: '', time_label: '', location_name: '', note: '' },
    ])

  const removeRow = (index: number) =>
    setRows((current) => current.filter((_, i) => i !== index))

  const save = async () => {
    setError(null)

    if (form.name.trim() === '') {
      setError('テンプレート名を入力してください')
      return
    }

    const budget = form.budget.trim() === '' ? null : Number(form.budget)
    if (budget != null && (!Number.isInteger(budget) || budget < 0)) {
      setError('予算は0以上の整数（円）で入力してください')
      return
    }

    setSaving(true)
    const { error: saveError } = await supabase
      .from('plan_templates')
      .update({
        emoji: form.emoji || '🏕️',
        name: form.name.trim(),
        summary: form.summary.trim() || null,
        category: form.category,
        nights: Number(form.nights) || 0,
        budget,
        transport: form.transport || null,
        description: form.description.trim() || null,
        // 場所名が空の行は保存しない（コピーしても使えないため）
        schedule: rows.filter((row) => row.location_name.trim() !== ''),
        updated_at: new Date().toISOString(),
      })
      .eq('id', template.id)

    setSaving(false)
    if (saveError) {
      setError(toUserMessage(saveError, 'テンプレートを保存できませんでした。'))
      return
    }

    toast('テンプレートを保存しました')
    router.refresh()
  }

  const remove = async () => {
    if (
      !(await confirm({
        title: `「${template.name}」を削除しますか？`,
        message: 'このテンプレートは使えなくなります。作った計画には影響しません。',
        confirmLabel: '削除する',
        tone: 'danger',
      }))
    ) {
      return
    }

    const { error: deleteError } = await supabase
      .from('plan_templates')
      .delete()
      .eq('id', template.id)

    if (deleteError) {
      setError(toUserMessage(deleteError, 'テンプレートを削除できませんでした。'))
      return
    }
    toast('テンプレートを削除しました')
    router.refresh()
  }

  const nights = Number(form.nights) || 0
  const dayOptions = Array.from({ length: nights + 1 }, (_, index) => index)

  return (
    <details className="group rounded-2xl bg-white p-4 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-3">
        <span aria-hidden className="text-2xl leading-none">
          {form.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-gray-800">{form.name}</span>
          <span className="block text-xs text-gray-500">
            {nights === 0 ? '日帰り' : `${nights}泊${nights + 1}日`}・行程{rows.length}件
          </span>
        </span>
        <span aria-hidden className="text-gray-400 transition-ui group-open:rotate-90">
          ›
        </span>
      </summary>

      <div className="mt-4 space-y-4">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
            {error}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-[80px_1fr]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">絵文字</span>
            <input
              value={form.emoji}
              onChange={(event) => setField('emoji', event.target.value)}
              maxLength={4}
              className={`${inputClass} text-center text-lg`}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">テンプレート名</span>
            <input
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              className={inputClass}
              placeholder="久住高原キャンプ"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600">一覧に出す短い説明</span>
          <input
            value={form.summary}
            onChange={(event) => setField('summary', event.target.value)}
            className={inputClass}
            placeholder="1泊2日。沢水キャンプ場。帰りに露天風呂。"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">種別</span>
            <select
              value={form.category}
              onChange={(event) => setField('category', event.target.value)}
              className={inputClass}
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">泊数</span>
            <select
              value={form.nights}
              onChange={(event) => setField('nights', event.target.value)}
              className={inputClass}
            >
              <option value="0">日帰り</option>
              <option value="1">1泊2日</option>
              <option value="2">2泊3日</option>
              <option value="3">3泊4日</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">
              一人あたり予算（円）
            </span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={form.budget}
              onChange={(event) => setField('budget', event.target.value)}
              className={inputClass}
              placeholder="5000"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">交通手段</span>
            <select
              value={form.transport}
              onChange={(event) => setField('transport', event.target.value)}
              className={inputClass}
            >
              <option value="">未定</option>
              {TRANSPORTS.map((transport) => (
                <option key={transport} value={transport}>
                  {transport}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600">説明</span>
          <textarea
            value={form.description}
            onChange={(event) => setField('description', event.target.value)}
            className={`${inputClass} min-h-20 resize-y`}
            placeholder="標高が高く夜は冷えるので防寒具を忘れずに。"
          />
        </label>

        {/* 行程 */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-gray-700">行程</p>
            <button
              type="button"
              onClick={addRow}
              className="pressable rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:border-green-400"
            >
              ＋ 行程を追加
            </button>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-3 py-3 text-center text-xs text-gray-500">
              行程はまだありません
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((row, index) => (
                <div key={index} className="rounded-xl border border-gray-100 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-500">行程 {index + 1}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveRow(index, -1)}
                        disabled={index === 0}
                        aria-label="ひとつ上へ"
                        className="pressable rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveRow(index, 1)}
                        disabled={index === rows.length - 1}
                        aria-label="ひとつ下へ"
                        className="pressable rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="pressable rounded-lg px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50"
                      >
                        削除
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <select
                      value={String(row.dayOffset)}
                      onChange={(event) =>
                        setRow(index, 'dayOffset', Number(event.target.value))
                      }
                      className={inputClass}
                      aria-label="何日目か"
                    >
                      {dayOptions.map((day) => (
                        <option key={day} value={day}>
                          {day + 1}日目
                        </option>
                      ))}
                    </select>
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
                    placeholder="場所名（例: 沢水キャンプ場）"
                  />
                  <input
                    value={row.note ?? ''}
                    onChange={(event) => setRow(index, 'note', event.target.value)}
                    className={`${inputClass} mt-2`}
                    placeholder="補足（任意）"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <button type="button" onClick={save} disabled={saving} className="btn-primary">
            {saving ? '保存中...' : '保存する'}
          </button>
          <button type="button" onClick={remove} className="btn-secondary">
            削除
          </button>
        </div>
      </div>
    </details>
  )
}
