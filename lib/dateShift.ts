// 日程を直したときに、行程表・終了日・締切をいっしょに動かすための計算。
//
// 計画の作成画面と編集画面の両方で使う。片方だけ直すと動きが食い違うため、
// ここに1つ置いて共有している。
//
// 日付は必ず new Date(年, 月-1, 日) で組み立てる。
// new Date('2026-10-03') はUTC扱いになり、日本時間では前日にずれてしまうため。

/** YYYY-MM-DD を、時差でずれない形で Date にする */
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

/** 日付を days 日ずらす */
export function shiftIsoDate(value: string, days: number): string {
  const date = parseIsoDate(value)
  if (!date) return value
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

/** 2つの日付が何日離れているか（b - a） */
export function diffInDays(a: string, b: string): number | null {
  const from = parseIsoDate(a)
  const to = parseIsoDate(b)
  if (!from || !to) return null
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

/** 締切が開催日以降になっていないか。開催当日の0時以降は「遅すぎる」とみなす */
export function isDeadlineTooLate(deadline: string, startDate: string): boolean {
  if (deadline === '' || startDate === '') return false
  const start = parseIsoDate(startDate)
  const at = new Date(deadline)
  if (!start || Number.isNaN(at.getTime())) return false
  return at.getTime() >= start.getTime()
}

/** 開催日の前日 23:59。締切が開催日以降になってしまったときの寄せ先 */
export function dayBeforeDeadline(startDate: string): string | null {
  const date = parseIsoDate(startDate)
  if (!date) return null
  date.setDate(date.getDate() - 1)
  return `${toIsoDate(date)}T23:59`
}
