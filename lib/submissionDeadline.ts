// 学校提出用の計画書の「提出期限」を求める。
//
// 学生係の決まり: 企画書は必ず実施希望日の「7営業日前まで」に学生係へ提出する。
// 営業日 = 土日・祝日・年末年始（12/29〜1/3）を除いた日。
// 夏の一斉休業などの大学独自の休みは年ごとに変わるので含めていない
// （画面では「目安」として出し、早めの提出を促す）。
//
// 日付は 'YYYY-MM-DD' の文字列で扱い、new Date(年, 月-1, 日) で組み立てる
// （new Date('2026-10-03') はUTC扱いになり、日本時間で前日にずれるため）。

export const SUBMISSION_BUSINESS_DAYS = 7

function parseIsoDate(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function toIsoDate(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** その月の第n月曜日（日付） */
function nthMonday(year: number, month: number, n: number): number {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const firstMonday = 1 + ((8 - firstDay) % 7)
  return firstMonday + (n - 1) * 7
}

/** 春分日・秋分日（1980〜2099年で使える近似式） */
function equinoxDay(year: number, base: number): number {
  return Math.floor(base + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}

const holidayCache = new Map<number, Set<string>>()

/** その年の国民の祝日（振替休日・国民の休日を含む）を 'YYYY-MM-DD' の集合で返す */
function japaneseHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year)
  if (cached) return cached

  const fixed: [number, number][] = [
    [1, 1], // 元日
    [1, nthMonday(year, 1, 2)], // 成人の日
    [2, 11], // 建国記念の日
    [2, 23], // 天皇誕生日
    [3, equinoxDay(year, 20.8431)], // 春分の日
    [4, 29], // 昭和の日
    [5, 3], // 憲法記念日
    [5, 4], // みどりの日
    [5, 5], // こどもの日
    [7, nthMonday(year, 7, 3)], // 海の日
    [8, 11], // 山の日
    [9, nthMonday(year, 9, 3)], // 敬老の日
    [9, equinoxDay(year, 23.2488)], // 秋分の日
    [10, nthMonday(year, 10, 2)], // スポーツの日
    [11, 3], // 文化の日
    [11, 23], // 勤労感謝の日
  ]

  const holidays = new Set(fixed.map(([month, day]) => toIsoDate(new Date(year, month - 1, day))))

  // 振替休日: 祝日が日曜なら、その後の最初の「祝日でない日」が休み
  for (const iso of [...holidays]) {
    const date = parseIsoDate(iso)!
    if (date.getDay() !== 0) continue
    const next = new Date(date)
    do {
      next.setDate(next.getDate() + 1)
    } while (holidays.has(toIsoDate(next)))
    holidays.add(toIsoDate(next))
  }

  // 国民の休日: 祝日に挟まれた平日（9月の連休で起きる）
  for (const iso of [...holidays]) {
    const date = parseIsoDate(iso)!
    const middle = new Date(date)
    middle.setDate(middle.getDate() + 1)
    const after = new Date(date)
    after.setDate(after.getDate() + 2)
    if (
      middle.getDay() !== 0 &&
      !holidays.has(toIsoDate(middle)) &&
      holidays.has(toIsoDate(after))
    ) {
      holidays.add(toIsoDate(middle))
    }
  }

  holidayCache.set(year, holidays)
  return holidays
}

/** 学生係の窓口が開いている日か（土日・祝日・年末年始を除く） */
export function isBusinessDay(date: Date): boolean {
  const weekday = date.getDay()
  if (weekday === 0 || weekday === 6) return false
  const month = date.getMonth() + 1
  const day = date.getDate()
  // 年末年始（12/29〜1/3）
  if ((month === 12 && day >= 29) || (month === 1 && day <= 3)) return false
  return !japaneseHolidays(date.getFullYear()).has(toIsoDate(date))
}

/**
 * 実施日（開始日）から、学生係への提出期限を求める。
 * 実施日の前日からさかのぼって数え、7つ目の営業日が期限（その日のうちに提出）。
 */
export function getSubmissionDeadline(startDate: string | null | undefined): string | null {
  if (!startDate) return null
  const date = parseIsoDate(startDate)
  if (!date) return null

  let count = 0
  while (count < SUBMISSION_BUSINESS_DAYS) {
    date.setDate(date.getDate() - 1)
    if (isBusinessDay(date)) count += 1
  }
  return toIsoDate(date)
}

export type SubmissionStatus = {
  /** 提出期限（YYYY-MM-DD） */
  deadline: string
  /** 今日から期限までの日数（暦日）。期限当日は 0、過ぎていれば負 */
  daysLeft: number
  /**
   * submitted = 提出済み / overdue = 期限切れ / today = 今日が期限
   * soon = あと3日以内 / ok = まだ余裕がある
   */
  level: 'submitted' | 'overdue' | 'today' | 'soon' | 'ok'
}

/** 提出期限までの状況。実施日が無い計画では null */
export function getSubmissionStatus(params: {
  startDate: string | null | undefined
  submittedAt?: string | null
  today: string
}): SubmissionStatus | null {
  const deadline = getSubmissionDeadline(params.startDate)
  if (!deadline) return null

  const from = parseIsoDate(params.today)
  const to = parseIsoDate(deadline)
  const daysLeft =
    from && to ? Math.round((to.getTime() - from.getTime()) / 86_400_000) : 0

  const level: SubmissionStatus['level'] = params.submittedAt
    ? 'submitted'
    : daysLeft < 0
      ? 'overdue'
      : daysLeft === 0
        ? 'today'
        : daysLeft <= 3
          ? 'soon'
          : 'ok'

  return { deadline, daysLeft, level }
}

/** 一覧などに出す短い文言（例: 「書類提出 あと3日」） */
export function submissionStatusLabel(status: SubmissionStatus): string {
  switch (status.level) {
    case 'submitted':
      return '書類提出済み'
    case 'overdue':
      return '書類の提出期限切れ'
    case 'today':
      return '書類提出 今日まで'
    default:
      return `書類提出 あと${status.daysLeft}日`
  }
}

/** 文言に合わせた色（StatusBadge と同じ系統の淡い色） */
export function submissionStatusClassName(status: SubmissionStatus): string {
  switch (status.level) {
    case 'submitted':
      return 'bg-green-100 text-green-700'
    case 'overdue':
    case 'today':
      return 'bg-red-100 text-red-700'
    case 'soon':
      return 'bg-amber-100 text-amber-800'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}
