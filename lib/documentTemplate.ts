// 計画書の「様式」= 表にどの行を、どの順で出すか。
//
// これまでは様式がコードに直接書かれており、プレビュー・PDF・Excel の
// 3箇所に同じ内容が重複していた。ここに定義を1つ置き、3つともここから描く。
//
// グループが様式を決めていない場合（document_template が null）は
// DEFAULT_DOCUMENT_ROWS を使う。
//
// 学校の様式が「企画書（R8.10.02〜）」に変わり、表の行も入れ替わった。
// それより前に保存された様式（version が無いもの）は、行事名・病院など
// 新様式に無い行を含んでいるため、標準様式に置き換え、自分で足した項目だけ引き継ぐ。

import type { PlanDocumentData, ScheduleDayColumn } from '@/lib/planDocument'

/** 新様式で保存した様式に付ける版。これが無い様式は旧様式として扱う */
export const DOCUMENT_TEMPLATE_VERSION = 2

/** 値をどこから持ってくるか。null は「自分で入力する項目」 */
export type DocumentRowSource =
  | 'dateRange'
  | 'place'
  | 'schedule'
  | 'vehicles'
  | 'outsideVisitors'
  | 'lodging'
  | 'notes'
  | null

export type DocumentRow = {
  /** 行を見分けるための名前。custom_ で始まるものは自分で足した項目 */
  key: string
  /** 表の左側に出る見出し */
  label: string
  source: DocumentRowSource
}

/** 学校提出用の標準様式（企画書 R8.10.02〜 の「記」の表） */
export const DEFAULT_DOCUMENT_ROWS: DocumentRow[] = [
  { key: 'dateRange', label: '日時', source: 'dateRange' },
  { key: 'place', label: '場所', source: 'place' },
  { key: 'schedule', label: '内容（詳細に）', source: 'schedule' },
  { key: 'vehicles', label: '入構車両', source: 'vehicles' },
  { key: 'outsideVisitors', label: '来校予定の学外者', source: 'outsideVisitors' },
  { key: 'lodging', label: '宿泊', source: 'lodging' },
  { key: 'notes', label: 'その他報告事項', source: 'notes' },
]

const VALID_SOURCES: DocumentRowSource[] = [
  'dateRange',
  'place',
  'schedule',
  'vehicles',
  'outsideVisitors',
  'lodging',
  'notes',
]

/** 自分で足した項目かどうか */
export function isCustomRow(row: DocumentRow): boolean {
  return row.source === null
}

/**
 * DBに入っている様式を読む。
 * 壊れていたり未設定だったりする場合は標準様式に戻す
 * （画面が真っ白になるより、いつもの様式が出る方が良い）。
 */
export function parseDocumentTemplate(raw: unknown): DocumentRow[] {
  if (!raw || typeof raw !== 'object') return DEFAULT_DOCUMENT_ROWS

  const { rows, version } = raw as { rows?: unknown; version?: unknown }
  if (!Array.isArray(rows) || rows.length === 0) return DEFAULT_DOCUMENT_ROWS
  const isCurrentFormat = version === DOCUMENT_TEMPLATE_VERSION

  const parsed = rows
    .map((row): DocumentRow | null => {
      if (!row || typeof row !== 'object') return null
      const candidate = row as { key?: unknown; label?: unknown; source?: unknown }
      if (typeof candidate.key !== 'string' || candidate.key === '') return null
      if (typeof candidate.label !== 'string') return null

      // 自分で足した項目は source が null（JSON では null か未設定）
      if (candidate.source == null) {
        return { key: candidate.key, label: candidate.label, source: null }
      }
      // 旧様式の行（行事名・病院など）は新様式に無いので外す
      if (
        !isCurrentFormat ||
        typeof candidate.source !== 'string' ||
        !(VALID_SOURCES as string[]).includes(candidate.source)
      ) {
        return null
      }
      return {
        key: candidate.key,
        label: candidate.label,
        source: candidate.source as DocumentRowSource,
      }
    })
    .filter((row): row is DocumentRow => row != null)

  // 旧様式: 標準様式の後ろに、自分で足した項目だけを続ける
  if (!isCurrentFormat) return [...DEFAULT_DOCUMENT_ROWS, ...parsed]

  return parsed.length > 0 ? parsed : DEFAULT_DOCUMENT_ROWS
}

/** 保存する形に整える */
export function serializeDocumentTemplate(rows: DocumentRow[]) {
  return { version: DOCUMENT_TEMPLATE_VERSION, rows }
}

/** 自分で足した項目の新しい key を作る */
export function createCustomRowKey(): string {
  return `custom_${Date.now().toString(36)}`
}

export type ResolvedDocumentRow =
  | { key: string; label: string; kind: 'text'; value: string }
  | { key: string; label: string; kind: 'lines'; values: string[] }
  | { key: string; label: string; kind: 'schedule'; days: ScheduleDayColumn[] }

/** 様式の各行に、実際の値を当てはめる */
export function resolveDocumentRows(
  rows: DocumentRow[],
  data: Omit<PlanDocumentData, 'rows'>,
  customValues: Record<string, string>
): ResolvedDocumentRow[] {
  return rows.map((row): ResolvedDocumentRow => {
    const base = { key: row.key, label: row.label }

    switch (row.source) {
      case 'dateRange':
        return { ...base, kind: 'text', value: data.dateRangeLabel }
      case 'place':
        return { ...base, kind: 'text', value: data.place }
      case 'schedule':
        return { ...base, kind: 'schedule', days: data.scheduleDays }
      case 'vehicles':
        return { ...base, kind: 'text', value: data.vehiclesLabel }
      case 'outsideVisitors':
        return { ...base, kind: 'text', value: data.outsideVisitorsLabel }
      case 'lodging':
        return { ...base, kind: 'lines', values: data.lodgingLines }
      case 'notes':
        return { ...base, kind: 'text', value: data.notes }
      default:
        return { ...base, kind: 'text', value: customValues[row.key] ?? '' }
    }
  })
}

/** 様式の中に、その項目が残っているか（入力欄を出すかどうかの判断に使う） */
export function hasSource(rows: DocumentRow[], source: DocumentRowSource): boolean {
  return rows.some((row) => row.source === source)
}
