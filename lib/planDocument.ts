// 計画書（学校提出用）で使うデータ整形ロジック。
// HTMLプレビューと PDF 出力の両方から参照する。

export type ProfileRow = {
  id: string
  name: string
  grade: number | null
  department: string | null
  student_id: string | null
  school_email: string | null
  phone: string | null
  academic_advisor: string | null
}

export type RosterEntry = {
  number: number
  studentId: string
  position: string
  grade: string
  department: string
  name: string
  phone: string
  email: string
  advisor: string
}

export type ScheduleDayColumn = {
  label: string // 例: 7/18
  lines: string[] // 例: ["10:00 大学集合", "14:00 キャンプ場到着"]
}

export type PlanDocumentFormValues = {
  created_date: string
  recipient: string
  advisor_name: string
  advisor_affiliation: string
  advisor_phone: string
  lodging_name: string
  lodging_address: string
  lodging_phone: string
  transport_note: string
  hospital_name: string
  hospital_address: string
  hospital_phone: string
  hospital_distance: string
  notes: string
}

export type PlanDocumentData = {
  createdDateLabel: string // 令和 8年 7月 6日
  recipient: string
  groupName: string
  representative: {
    name: string
    studentId: string
    department: string
    phone: string
    email: string
  }
  advisorName: string
  advisorAffiliation: string
  advisorPhone: string
  drafterName: string // 起案者代表
  title: string
  dateRangeLabel: string // 7月18日～7月19日
  place: string
  scheduleDays: ScheduleDayColumn[]
  lodgingLines: string[]
  transportLabel: string
  participantCountLabel: string
  hospitalLabel: string
  notes: string
  roster: RosterEntry[]
}

export const DEFAULT_RECIPIENT = '九州工業大学情報工学研究院長　殿'

// 参加者名簿（2枚目）の様式: 最低20行の枠を出し、欄外に注意書きを載せる
export const ROSTER_MIN_ROWS = 20
export const ROSTER_FOOTNOTE =
  '※TEL・E-mailは、連絡がつきやすいものにしてください。TEL・E-mail・指導教員氏名は、安全を確保するために使用いたします。'

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

/** 開始日〜終了日を「7月18日～7月19日」の形式にする */
export function formatMonthDayRange(
  start: string | null,
  end: string | null
): string {
  const fmt = (iso: string) => {
    const [, month, day] = iso.split('-').map(Number)
    return month && day ? `${month}月${day}日` : iso
  }
  if (!start && !end) return ''
  if (start && end && start !== end) return `${fmt(start)}～${fmt(end)}`
  return fmt(start ?? end ?? '')
}

type ScheduleItemRow = {
  day: string | null
  time: string | null
  time_label: string | null
  location_name: string | null
}

/** 行程を日付ごとの列にまとめる（様式の「日程(詳細に)」欄用） */
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

/** 参加者名簿の1行を作る */
export function buildRoster(
  participants: { user_id: string; profiles: ProfileRow | null }[],
  positions: Map<string, string>
): RosterEntry[] {
  return participants.map((participant, index) => {
    const profile = participant.profiles
    return {
      number: index + 1,
      studentId: profile?.student_id ?? '',
      position: positions.get(participant.user_id) ?? '部員',
      grade: profile?.grade != null ? String(profile.grade) : '',
      department: profile?.department ?? '',
      name: profile?.name ?? '',
      phone: profile?.phone ?? '',
      email: profile?.school_email ?? '',
      advisor: profile?.academic_advisor ?? '',
    }
  })
}

/** 宿泊所欄の行（1行目: 名称 / 2行目: 住所 + TEL。作成例の表記に合わせる） */
export function buildLodgingLines(form: PlanDocumentFormValues): string[] {
  const addressLine = [
    form.lodging_address,
    form.lodging_phone && `TEL ${form.lodging_phone}`,
  ]
    .filter(Boolean)
    .join('　')
  return [form.lodging_name, addressLine].filter(Boolean)
}

/** 周辺の病院等の表記（例: 久住加藤医院(0974-76-0008,車10分)） */
export function buildHospitalLabel(form: PlanDocumentFormValues): string {
  if (!form.hospital_name) return ''
  const detail = [form.hospital_phone, form.hospital_distance]
    .filter(Boolean)
    .join(',')
  const address = form.hospital_address ? ` ${form.hospital_address}` : ''
  return detail
    ? `${form.hospital_name}(${detail})${address}`
    : `${form.hospital_name}${address}`
}
