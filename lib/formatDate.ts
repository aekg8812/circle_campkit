// 画面に日付を出すときの共通処理。
// 表記を全画面で「9/24(木)」に揃え、曜日を添える。
// （サークルの予定では「それ、土日？」が最初の関心事になるため）
//
// 注意: 'YYYY-MM-DD' を new Date() に直接渡すとUTCとして解釈され、
//   タイムゾーンによっては前日になる。ここでは年月日を分解して組み立てる。
//
// 提出書類の日付（和暦など）は様式が決まっているため、lib/planDocument.ts 側で扱う。

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** 'YYYY-MM-DD' → '9/24(木)'。解釈できない場合は元の文字列を返す */
export function formatJpDate(isoDate: string | null | undefined): string {
  if (!isoDate) return ''
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return isoDate
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()]
  return `${month}/${day}(${weekday})`
}

/** 開始日〜終了日 → '9/24(木) 〜 9/26(土)'。同日・片方のみなら1つだけ返す */
export function formatJpDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): string {
  if (!startDate && !endDate) return ''
  if (startDate && endDate && startDate !== endDate) {
    return `${formatJpDate(startDate)} 〜 ${formatJpDate(endDate)}`
  }
  return formatJpDate(startDate ?? endDate)
}

/** 日時（ISO文字列）→ '9/24(木) 18:00' */
export function formatJpDateTime(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekday = WEEKDAYS[date.getDay()]
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month}/${day}(${weekday}) ${hours}:${minutes}`
}
