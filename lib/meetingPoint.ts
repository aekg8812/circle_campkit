// 「当日の集合」を1件選ぶ共通処理。
// 行程表のうち「集合」ラベルの行を優先し、無ければ最初の行を使う。
// （行程は day → time → sort_order の順で取得しているため、先頭が一番早い予定になる）

export type MeetingScheduleItem = {
  day: string | null
  time: string | null
  time_label: string | null
  location_name: string | null
}

export function pickMeetingItem<T extends MeetingScheduleItem>(items: T[]): T | null {
  if (items.length === 0) return null
  return items.find((item) => item.time_label === '集合') ?? items[0]
}

/** 「10:00」形式に整える（DBのtime型は秒まで入ることがある） */
export function formatMeetingTime(time: string | null): string {
  if (!time) return ''
  return time.slice(0, 5)
}
