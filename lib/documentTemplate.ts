// 計画書の「様式」= 表にどの行を、どの順で出すか。
//
// これまでは様式がコードに直接書かれており、プレビュー・PDF・Excel の
// 3箇所に同じ内容が重複していた。ここに定義を1つ置き、3つともここから描く。
//
// グループが様式を決めていない場合（document_template が null）は
// DEFAULT_DOCUMENT_ROWS を使うので、既存の計画書は何も変わらない。

import type { PlanDocumentData, ScheduleDayColumn } from '@/lib/planDocument'

/** 値をどこから持ってくるか。null は「自分で入力する項目」 */
export type DocumentRowSource =
  | 'title'
  | 'dateRange'
  | 'place'
  | 'schedule'
  | 'lodging'
  | 'transport'
  | 'participantCount'
  | 'hospital'
  | 'notes'
  | null

export type DocumentRow = {
  /** 行を見分けるための名前。custom_ で始まるものは自分で足した項目 */
  key: string
  /** 表の左側に出る見出し */
  label: string
  source: DocumentRowSource
}

/** 学校提出用の標準様式（これまで固定で出していた内容） */
export const DEFAULT_DOCUMENT_ROWS: DocumentRow[] = [
  { key: 'title', label: '行事名', source: 'title' },
  { key: 'dateRange', label: '日時', source: 'dateRange' },
  { key: 'place', label: '場所', source: 'place' },
  { key: 'schedule', label: '日程（詳細に）', source: 'schedule' },
  { key: 'lodging', label: '宿泊所', source: 'lodging' },
  { key: 'transport', label: '移動手段', source: 'transport' },
  { key: 'participantCount', label: '参加人数', source: 'participantCount' },
  { key: 'hospital', label: '周辺の病院等', source: 'hospital' },
  { key: 'notes', label: '備考', source: 'notes' },
]

const VALID_SOURCES: DocumentRowSource[] = [
  'title',
  'dateRange',
  'place',
  'schedule',
  'lodging',
  'transport',
  'participantCount',
  'hospital',
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

  const rows = (raw as { rows?: unknown }).rows
  if (!Array.isArray(rows) || rows.length === 0) return DEFAULT_DOCUMENT_ROWS

  const parsed = rows
    .map((row): DocumentRow | null => {
      if (!row || typeof row !== 'object') return null
      const candidate = row as { key?: unknown; label?: unknown; source?: unknown }
      if (typeof candidate.key !== 'string' || candidate.key === '') return null
      if (typeof candidate.label !== 'string') return null

      const source =
        typeof candidate.source === 'string' &&
        (VALID_SOURCES as string[]).includes(candidate.source)
          ? (candidate.source as DocumentRowSource)
          : null

      return { key: candidate.key, label: candidate.label, source }
    })
    .filter((row): row is DocumentRow => row != null)

  return parsed.length > 0 ? parsed : DEFAULT_DOCUMENT_ROWS
}

/** 保存する形に整える */
export function serializeDocumentTemplate(rows: DocumentRow[]) {
  return { rows }
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
      case 'title':
        return { ...base, kind: 'text', value: data.title }
      case 'dateRange':
        return { ...base, kind: 'text', value: data.dateRangeLabel }
      case 'place':
        return { ...base, kind: 'text', value: data.place }
      case 'schedule':
        return { ...base, kind: 'schedule', days: data.scheduleDays }
      case 'lodging':
        return { ...base, kind: 'lines', values: data.lodgingLines }
      case 'transport':
        return { ...base, kind: 'text', value: data.transportLabel }
      case 'participantCount':
        return { ...base, kind: 'text', value: data.participantCountLabel }
      case 'hospital':
        return { ...base, kind: 'text', value: data.hospitalLabel }
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
