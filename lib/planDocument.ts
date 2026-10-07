// 計画書（学校提出用）で使うデータ整形ロジック。
// HTMLプレビューと PDF・Excel 出力の両方から参照する。
//
// 様式は「企画書（R8.10.02〜）」に合わせている:
//   1枚目: ○○利用許可願・○○企画（記の表 + 【責任者】）
//   2枚目: 参加者名簿（学生番号・学科学年・氏名）

export type ProfileRow = {
  id: string
  name: string
  grade: number | null
  department: string | null
  student_id: string | null
  school_email: string | null
  phone: string | null
}

export type RosterEntry = {
  number: number
  studentId: string
  /** 学科学年（例: 知能情報工学科 3年） */
  departmentGrade: string
  name: string
}

export type ScheduleDayColumn = {
  label: string // 例: 7/18
  lines: string[] // 例: ["10:00 大学集合", "14:00 キャンプ場到着"]
}

export type PlanDocumentFormValues = {
  created_date: string
  recipient: string
  /** 表題に「○○利用許可願」を出すか */
  apply_facility: boolean
  facility_name: string
  /** 表題に「○○企画」を出すか */
  apply_event: boolean
  /** 空なら計画の行事名を使う */
  event_name: string
  /** 計画書に出す場所。空なら計画の「場所エリア」を使う */
  place: string
  /** 来校予定の学外者の人数。0 なら「無」 */
  outside_visitor_count: number
  lodging_name: string
  lodging_address: string
  /** その他報告事項 */
  notes: string
}

import type { ResolvedDocumentRow } from '@/lib/documentTemplate'

export type PlanDocumentData = {
  createdDateLabel: string // 令和8年10月7日
  recipient: string
  groupName: string
  /** 右上の「代表者氏名」。部長の氏名 */
  representativeName: string
  advisorName: string
  /** 表題（例: 講義室利用許可願・春キャンプ企画） */
  applicationTitle: string
  /** 【責任者】欄。部長の情報 */
  responsible: {
    name: string
    studentId: string
    phone: string
    email: string
  }
  drafterName: string // 起案者（提出メールの差出人に使う）
  title: string // 計画の行事名（ファイル名などに使う）
  dateRangeLabel: string // 令和8年10月24日～10月25日
  place: string
  scheduleDays: ScheduleDayColumn[]
  /** 入構車両（例: 有（3台）） */
  vehiclesLabel: string
  /** 来校予定の学外者（例: 無） */
  outsideVisitorsLabel: string
  /** 宿泊（1行目: 有/無、2行目: 宿泊先） */
  lodgingLines: string[]
  notes: string
  participantCountLabel: string
  roster: RosterEntry[]
  /** 参加者名簿（2枚目）を出すか。学内の活動では名簿は要らない */
  includeRoster: boolean
  /** 表に出す行。グループが様式を変えていればその順・内容になる */
  rows: ResolvedDocumentRow[]
}

export const DEFAULT_RECIPIENT = '九州工業大学情報工学研究院長　殿'

/** 様式の下に書かれている注意書き */
export const SUBMISSION_FOOTNOTE =
  '※許可が下りるまでには時間がかかりますので必ず7営業日前までに学生係へ提出してください。'

// 参加者名簿（2枚目）の様式: 最低20行の枠を出す
export const ROSTER_MIN_ROWS = 20

/** 名簿を様式どおり最低20行になるよう空行で埋める（参加者が20人を超える場合は全員分） */
export function padRoster(roster: RosterEntry[]): (RosterEntry | null)[] {
  const rows: (RosterEntry | null)[] = [...roster]
  while (rows.length < ROSTER_MIN_ROWS) rows.push(null)
  return rows
}

/** ISO日付(YYYY-MM-DD)を和暦表記にする（令和のみ対応） */
export function formatWareki(isoDate: string | null | undefined): string {
  if (!isoDate) return ''
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return ''
  if (year >= 2019) {
    const reiwa = year - 2018
    return `令和${reiwa === 1 ? '元' : reiwa}年${month}月${day}日`
  }
  return `${year}年${month}月${day}日`
}

/** 開始日〜終了日を「令和8年10月24日～10月25日」の形式にする（様式の「年 月 日」欄） */
export function formatWarekiRange(start: string | null, end: string | null): string {
  if (!start && !end) return ''
  const first = formatWareki(start ?? end)
  if (!start || !end || start === end) return first
  const [startYear] = start.split('-').map(Number)
  const [endYear, month, day] = end.split('-').map(Number)
  // 年をまたぐときだけ、終わりの日にも年を付ける
  const last = startYear === endYear ? `${month}月${day}日` : formatWareki(end)
  return `${first}～${last}`
}

/** 表題「○○利用許可願・○○企画」。選んだ方だけを出す（両方なら「・」でつなぐ） */
export function buildApplicationTitle(form: PlanDocumentFormValues, planTitle: string): string {
  const parts: string[] = []
  if (form.apply_facility) parts.push(`${form.facility_name.trim() || '○○'}利用許可願`)
  if (form.apply_event) parts.push(`${form.event_name.trim() || planTitle || '○○'}企画`)
  return parts.join('・')
}

/** 「有（3台）」「無」の形にする */
export function formatPresence(count: number, unit: string): string {
  return count > 0 ? `有（${count}${unit}）` : '無'
}

type ScheduleItemRow = {
  day: string | null
  time: string | null
  time_label: string | null
  location_name: string | null
}

/** 行程を日付ごとの列にまとめる（様式の「内容（詳細に）」欄用） */
export function buildScheduleDays(items: ScheduleItemRow[]): ScheduleDayColumn[] {
  const map = new Map<string, string[]>()
  const suffixLabels = ['集合', '出発', '到着', '解散']

  for (const item of items) {
    const key = item.day ?? '日付未定'
    const time = item.time ? item.time.slice(0, 5) : ''
    const location = item.location_name ?? ''
    const label = item.time_label ?? ''
    const text = suffixLabels.includes(label)
      ? `${location}${label}`
      : [location, label && `(${label})`].filter(Boolean).join(' ')
    const line = [time, text].filter(Boolean).join(' ')
    if (!line) continue
    const lines = map.get(key) ?? []
    lines.push(line)
    map.set(key, lines)
  }

  return [...map.entries()].map(([day, lines]) => ({
    label: formatDayShort(day),
    lines,
  }))
}

function formatDayShort(value: string): string {
  const [, month, day] = value.split('-').map(Number)
  if (!month || !day) return value
  return `${month}/${day}`
}

/** 学科学年の欄（例: 知能情報工学科 3年） */
export function formatDepartmentGrade(profile: Pick<ProfileRow, 'department' | 'grade'> | null): string {
  if (!profile) return ''
  return [profile.department?.trim(), profile.grade != null ? `${profile.grade}年` : '']
    .filter(Boolean)
    .join(' ')
}

/** 参加者名簿の1行を作る */
export function buildRoster(
  participants: { user_id: string; profiles: ProfileRow | null }[]
): RosterEntry[] {
  return participants.map((participant, index) => {
    const profile = participant.profiles
    return {
      number: index + 1,
      studentId: profile?.student_id ?? '',
      departmentGrade: formatDepartmentGrade(profile),
      name: profile?.name ?? '',
    }
  })
}

/** 宿泊欄の行（1行目: 有/無 / 2行目: 宿泊先） */
export function buildLodgingLines(form: PlanDocumentFormValues, overnight: boolean): string[] {
  if (!overnight) return ['無']
  const place = [form.lodging_name.trim(), form.lodging_address.trim() && `（${form.lodging_address.trim()}）`]
    .filter(Boolean)
    .join('')
  return ['有', `宿泊先：${place}`]
}

/** 日帰りでなければ宿泊ありとみなす */
export function isOvernight(start: string | null, end: string | null): boolean {
  return Boolean(start && end && end > start)
}
