// 当日いちばん知りたいこと（いつ・どこに集合か／自分は何を持つか）だけを、
// 計画詳細のいちばん上にまとめて出すカード。
// 行程表を下までスクロールしなくても答えが出る状態にするのが狙い。

import { createGoogleMapsSearchUrl } from '@/lib/maps'
import { formatJpDate } from '@/lib/formatDate'
import { formatMeetingTime, type MeetingScheduleItem } from '@/lib/meetingPoint'

type Props = {
  item: MeetingScheduleItem & { map_query?: string | null }
  /** 自分が持っていくものの名前。無ければ行ごと出さない */
  myItems?: string[]
}

export default function MeetingCard({ item, myItems = [] }: Props) {
  const dateLabel = formatJpDate(item.day)
  const timeLabel = formatMeetingTime(item.time)
  const place = item.location_name ?? ''
  const mapUrl = createGoogleMapsSearchUrl(item.map_query || place)

  // 日時も場所も無いなら、出す意味がない
  if (!dateLabel && !timeLabel && !place) return null

  return (
    <section className="rounded-2xl bg-gradient-to-br from-green-600 to-emerald-500 p-4 text-white shadow-sm">
      <p className="text-xs font-bold text-green-50/90">
        {item.time_label || '集合'}
      </p>

      <p className="mt-1 text-2xl font-bold leading-tight">
        {[dateLabel, timeLabel].filter(Boolean).join(' ') || '日時未定'}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-green-50">
          📍 {place || '場所未定'}
        </span>
        {mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-shrink-0 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold backdrop-blur-sm transition hover:bg-white/30"
          >
            地図
          </a>
        )}
      </div>

      {myItems.length > 0 && (
        <p className="mt-2.5 border-t border-white/20 pt-2.5 text-xs text-green-50">
          🎒 自分の持ち物: {myItems.join('、')}
        </p>
      )}
    </section>
  )
}
