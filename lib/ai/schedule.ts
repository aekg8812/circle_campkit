import 'server-only'

// AIが返した行程表を、フォームがそのまま受け取れる形に整える。
//
// プロンプトで形式を指示しても、モデルが "9:00" のように返すことがある。
// フォームの時刻プルダウンは "09:00" 形式なので、一致しないと空欄になる。
// プロンプトの精度に頼らず、ここで必ず正しい形にしてから返す。

/** フォームの時刻プルダウンと同じ形式（30分刻み・2桁ゼロ埋め）に丸める */
export function normalizeTime(raw: unknown): string {
  if (typeof raw !== 'string') return ''

  // 全角コロンや前後の空白も受け入れる
  const match = /^(\d{1,2})\s*[:：]\s*(\d{1,2})$/.exec(raw.trim())
  if (!match) return ''

  let hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return ''
  if (hour > 23 || minute > 59) return ''

  // 00分か30分に寄せる（15分未満は切り捨て、45分以上は次の時間へ繰り上げ）
  let snappedMinute: number
  if (minute < 15) {
    snappedMinute = 0
  } else if (minute < 45) {
    snappedMinute = 30
  } else {
    snappedMinute = 0
    hour += 1
  }

  // 繰り上げで日をまたぐ場合は、その日の最後に留める
  if (hour > 23) {
    hour = 23
    snappedMinute = 30
  }

  return `${String(hour).padStart(2, '0')}:${String(snappedMinute).padStart(2, '0')}`
}

// フォームのラベル選択肢と一致させる（ここに無い値は空にする）
export const SCHEDULE_LABELS = ['集合', '出発', '到着', '解散', '休憩', '買い出し'] as const

export type NormalizedRow = {
  dayOffset: number
  time: string
  timeLabel: string
  locationName: string
  note: string
}

type RawRow = {
  dayOffset?: unknown
  time?: unknown
  timeLabel?: unknown
  locationName?: unknown
  note?: unknown
}

/**
 * 行程の配列を整える。
 * - 時刻を 30分刻み・2桁ゼロ埋めに丸める
 * - ラベルを選択肢内の値に限定する
 * - dayOffset を 0〜泊数 の範囲に収める
 * - 場所名が空の行は捨てる
 * - 日付→時刻の順に並べ直す（モデルが順番を崩しても直る）
 */
export function normalizeScheduleRows(rows: unknown, nights: number): NormalizedRow[] {
  if (!Array.isArray(rows)) return []

  const maxDayOffset = Math.max(0, nights)

  const normalized = rows
    .map((row: RawRow): NormalizedRow | null => {
      const locationName = typeof row.locationName === 'string' ? row.locationName.trim() : ''
      if (locationName === '') return null

      const rawDay = Number(row.dayOffset)
      const dayOffset = Number.isInteger(rawDay)
        ? Math.min(Math.max(rawDay, 0), maxDayOffset)
        : 0

      const timeLabel =
        typeof row.timeLabel === 'string' &&
        (SCHEDULE_LABELS as readonly string[]).includes(row.timeLabel)
          ? row.timeLabel
          : ''

      const note = typeof row.note === 'string' ? row.note.trim().slice(0, 60) : ''

      return {
        dayOffset,
        time: normalizeTime(row.time),
        timeLabel,
        locationName: locationName.slice(0, 60),
        note,
      }
    })
    .filter((row): row is NormalizedRow => row != null)

  // 日付順 → 時刻順。時刻が取れなかった行は、その日の最後に回す
  return normalized.sort((a, b) => {
    if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset
    const timeA = a.time || '99:99'
    const timeB = b.time || '99:99'
    return timeA.localeCompare(timeB)
  })
}
