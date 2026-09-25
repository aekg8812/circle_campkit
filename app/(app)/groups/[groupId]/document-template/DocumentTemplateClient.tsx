'use client'

// 計画書の「様式」を編集する画面。
//
// 毎回の入力画面に項目の追加・削除を混ぜると複雑になるので、別画面に分けた。
// 様式は一度決めれば滅多に変えないため、普段使う人はこの画面を見なくてよい。

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import { toUserMessage } from '@/lib/errorMessage'
import {
  DEFAULT_DOCUMENT_ROWS,
  createCustomRowKey,
  isCustomRow,
  parseDocumentTemplate,
  serializeDocumentTemplate,
  type DocumentRow,
} from '@/lib/documentTemplate'

type Props = {
  group: { id: string; name: string }
  documentTemplate: unknown
}

/** 自動で入る項目が、どこから値を取ってくるかの説明 */
const SOURCE_HINTS: Record<string, string> = {
  title: '計画の行事名が入ります',
  dateRange: '計画の日程が入ります',
  place: '計画の場所エリアが入ります',
  schedule: '行程表から自動で作られます',
  lodging: '計画書の「宿泊所」の入力が入ります',
  transport: '計画書の「移動手段」の入力が入ります',
  participantCount: '参加者の人数が入ります',
  hospital: '計画書の「病院」の入力が入ります',
  notes: '計画書の「備考」の入力が入ります',
}

export default function DocumentTemplateClient({ group, documentTemplate }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const confirm = useConfirm()

  const [rows, setRows] = useState<DocumentRow[]>(() => parseDocumentTemplate(documentTemplate))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const move = (index: number, direction: -1 | 1) => {
    const next = index + direction
    if (next < 0 || next >= rows.length) return
    setRows((current) => {
      const copy = [...current]
      ;[copy[index], copy[next]] = [copy[next], copy[index]]
      return copy
    })
  }

  const rename = (index: number, label: string) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, label } : row)))

  const remove = async (index: number) => {
    const target = rows[index]
    if (
      !(await confirm({
        title: `「${target.label}」を様式から外しますか？`,
        message: isCustomRow(target)
          ? 'この項目に入力した内容は、計画書に出なくなります。'
          : 'この行が計画書に出なくなります。あとで「標準の様式に戻す」で復活できます。',
        confirmLabel: '外す',
        tone: 'danger',
      }))
    ) {
      return
    }
    setRows((current) => current.filter((_, i) => i !== index))
  }

  const addCustomRow = () =>
    setRows((current) => [
      ...current,
      { key: createCustomRowKey(), label: '新しい項目', source: null },
    ])

  const resetToDefault = async () => {
    if (
      !(await confirm({
        title: '標準の様式に戻しますか？',
        message: '追加した項目は様式から外れます（入力した内容は残ります）。',
        confirmLabel: '戻す',
      }))
    ) {
      return
    }
    setRows(DEFAULT_DOCUMENT_ROWS)
  }

  const save = async () => {
    setError(null)

    const cleaned = rows
      .map((row) => ({ ...row, label: row.label.trim() }))
      .filter((row) => row.label !== '')

    if (cleaned.length === 0) {
      setError('項目が1つもありません。少なくとも1つは残してください。')
      return
    }

    setSaving(true)
    const { error: saveError } = await supabase
      .from('groups')
      .update({ document_template: serializeDocumentTemplate(cleaned) })
      .eq('id', group.id)
    setSaving(false)

    if (saveError) {
      setError(toUserMessage(saveError, '様式を保存できませんでした。'))
      return
    }

    toast('様式を保存しました')
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
          <h1 className="text-xl font-bold text-gray-800">計画書の様式</h1>
        </div>
      </div>

      <p className="rounded-xl bg-white p-4 text-sm leading-6 text-gray-600 shadow-sm">
        学校に提出する計画書の表に、<strong>どの項目を、どの順で出すか</strong>を決めます。
        変更は<strong>このグループの計画書すべて</strong>に反映されます。
        <br />
        提出先の様式に合わせて、項目を足したり外したりしてください。
      </p>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>
      )}

      <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-sm">
        {rows.map((row, index) => (
          <div key={row.key} className="flex items-start gap-3 p-4">
            <div className="flex flex-shrink-0 flex-col gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="ひとつ上へ"
                className="pressable rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === rows.length - 1}
                aria-label="ひとつ下へ"
                className="pressable rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 disabled:opacity-30"
              >
                ↓
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">
                  表に出す見出し
                </span>
                <input
                  value={row.label}
                  onChange={(event) => rename(index, event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </label>
              <p className="mt-1.5 text-xs text-gray-500">
                {isCustomRow(row) ? (
                  <>
                    <span className="mr-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                      自由入力
                    </span>
                    計画書ごとに自分で入力します
                  </>
                ) : (
                  <>
                    <span className="mr-1 rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-700">
                      自動
                    </span>
                    {SOURCE_HINTS[row.source ?? ''] ?? '自動で入ります'}
                  </>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={() => remove(index)}
              className="pressable flex-shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50"
            >
              外す
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addCustomRow}
        className="pressable flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-green-300 bg-white py-4 text-sm font-bold text-green-700 hover:border-green-500 hover:bg-green-50"
      >
        ＋ 項目を追加
      </button>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={saving} className="btn-primary">
          {saving ? '保存中...' : '様式を保存'}
        </button>
        <button type="button" onClick={resetToDefault} className="btn-secondary">
          標準の様式に戻す
        </button>
      </div>

      <p className="text-xs leading-5 text-gray-500">
        ※ 保存するまで変更は反映されません。外した項目は「標準の様式に戻す」でいつでも復活できます。
      </p>
    </div>
  )
}
