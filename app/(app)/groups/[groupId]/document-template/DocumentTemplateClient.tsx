'use client'

// 学校用計画書の「様式」を編集する画面。
//
// 毎回の入力画面に項目の追加・削除を混ぜると複雑になるので、別画面に分けた。
// 様式は一度決めれば滅多に変えないため、普段使う人はこの画面を見なくてよい。
//
// 「なにがどう変わるのか分かりづらい」という声があったので、
// 編集している様式をそのまま当てはめた提出書類の見本を、下に出している。
// この画面は特定の計画に紐づいていないため、見本の中身は架空のサンプル。

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { useConfirm } from '@/components/ConfirmDialog'
import { toUserMessage } from '@/lib/errorMessage'
import DocumentSheet from '@/components/DocumentSheet'
import { createSampleDocumentData, SAMPLE_CUSTOM_VALUE } from '@/lib/documentSample'
import {
  DEFAULT_DOCUMENT_ROWS,
  createCustomRowKey,
  isCustomRow,
  parseDocumentTemplate,
  resolveDocumentRows,
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
  const [savedRows, setSavedRows] = useState<DocumentRow[]>(() =>
    parseDocumentTemplate(documentTemplate)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 欄の一覧は縦に長いので、見本を見たいときは畳めるようにする
  const [editorOpen, setEditorOpen] = useState(true)

  const dirty = JSON.stringify(rows) !== JSON.stringify(savedRows)

  // 編集中の様式を、架空のサンプルに当てはめた見本
  const sampleDocument = useMemo(() => {
    const base = createSampleDocumentData(group.name)
    const customValues = Object.fromEntries(
      rows.filter(isCustomRow).map((row) => [row.key, SAMPLE_CUSTOM_VALUE])
    )
    const visibleRows = rows
      .map((row) => ({ ...row, label: row.label.trim() }))
      .filter((row) => row.label !== '')
    return { ...base, rows: resolveDocumentRows(visibleRows, base, customValues) }
  }, [rows, group.name])

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

    setSavedRows(cleaned)
    setRows(cleaned)
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
          <h1 className="text-xl font-bold text-gray-800">学校用計画書の様式</h1>
        </div>
      </div>

      <p className="rounded-xl bg-white p-4 text-sm leading-6 text-gray-600 shadow-sm">
        学校に提出する計画書の表に、<strong>どの項目を、どの順で出すか</strong>を決めます。
        変えた結果は、<strong>このページの下にある見本</strong>ですぐ確認できます。
        <br />
        変更は<strong>このグループの計画書すべて</strong>に反映されます。
        提出先の様式に合わせて、項目を足したり外したりしてください。
      </p>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>
      )}

      {/* 欄の変更。縦に長いので、見本を見たいときは畳めるようにする */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setEditorOpen((current) => !current)}
          aria-expanded={editorOpen}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-ui hover:bg-gray-50"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-gray-700">欄の変更</span>
            <span className="text-xs text-gray-500">{rows.length}項目</span>
            {dirty && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                未保存
              </span>
            )}
          </span>
          <span className="flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-gray-500">
            {editorOpen ? '折りたたむ' : '開く'}
            <span aria-hidden className={`transition-ui ${editorOpen ? 'rotate-90' : ''}`}>
              ›
            </span>
          </span>
        </button>

        {editorOpen && (
          <div className="border-t border-gray-100">
            <div className="divide-y divide-gray-100">
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

            <div className="space-y-3 border-t border-gray-100 p-4">
              <button
                type="button"
                onClick={addCustomRow}
                className="pressable flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-green-300 bg-white py-3 text-sm font-bold text-green-700 hover:border-green-500 hover:bg-green-50"
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
                保存するまで反映されません。外した項目は「標準の様式に戻す」で戻せます。
              </p>
            </div>
          </div>
        )}
      </section>

      {/* 提出書類の見本。様式を変えると、ここの見た目がそのまま変わる */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-700">提出書類の見本</h2>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          保存していない変更も、この見本に反映されます。
        </p>
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          ※ 中身はすべて<strong>架空のサンプル</strong>です。実際の計画書では、計画の内容と、
          計画書の画面で入力した値が入ります。
        </p>

        {/* A4の原寸なので、狭い画面では横にスクロールして見てもらう */}
        <div className="mt-3 overflow-x-auto rounded-xl bg-gray-100 p-3">
          <DocumentSheet data={sampleDocument} />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          ※ 画面に収まらない場合は、横にスクロールできます。
        </p>
      </section>
    </div>
  )
}
