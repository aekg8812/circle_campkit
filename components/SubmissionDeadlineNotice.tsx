// 学校提出用の計画書の提出期限（実施日の7営業日前）を知らせる枠。
//
// 計画の詳細と計画書の画面の両方に出す。提出期限を過ぎると受け付けてもらえない
// ことがあるため、期限が近づくほど目立つ色にして、早めの提出を促す。

import Link from 'next/link'
import { formatJpDate } from '@/lib/formatDate'
import { todayLocal } from '@/lib/recruitmentStatus'
import { SUBMISSION_BUSINESS_DAYS, getSubmissionStatus } from '@/lib/submissionDeadline'

const STUDENT_AFFAIRS_PHONE = '0948-29-7524'

export default function SubmissionDeadlineNotice({
  startDate,
  submittedAt,
  href,
}: {
  startDate: string | null
  submittedAt: string | null
  /** 計画書の画面へのリンク（計画書の画面自身では渡さない） */
  href?: string
}) {
  const status = getSubmissionStatus({ startDate, submittedAt, today: todayLocal() })
  if (!status) return null

  const deadlineLabel = formatJpDate(status.deadline)

  const tone =
    status.level === 'submitted'
      ? 'border-green-200 bg-green-50 text-green-800'
      : status.level === 'overdue' || status.level === 'today'
        ? 'border-red-200 bg-red-50 text-red-700'
        : status.level === 'soon'
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-gray-200 bg-gray-50 text-gray-700'

  const headline =
    status.level === 'submitted'
      ? `計画書は学生係へ提出済みです（${formatJpDate(submittedAt?.slice(0, 10))}）`
      : status.level === 'overdue'
        ? `学生係への提出期限（${deadlineLabel}）を過ぎています`
        : status.level === 'today'
          ? `今日（${deadlineLabel}）が学生係への提出期限です`
          : `学生係への提出期限：${deadlineLabel}（あと${status.daysLeft}日）`

  return (
    <div className={`rounded-xl border px-4 py-3 print:hidden ${tone}`}>
      <p className="text-sm font-bold">{headline}</p>
      {status.level !== 'submitted' && (
        <p className="mt-1 text-xs leading-5">
          {status.level === 'overdue'
            ? `受け付けてもらえない場合があります。すぐに学生係（${STUDENT_AFFAIRS_PHONE}）へ相談してください。`
            : `計画書は実施日の${SUBMISSION_BUSINESS_DAYS}営業日前（土日祝・年末年始を除く）までに学生係へ出す決まりです。メールならいつでも受け付けています。`}
        </p>
      )}
      {href && status.level !== 'submitted' && (
        <Link href={href} className="mt-2 inline-block text-xs font-bold underline">
          計画書をつくる →
        </Link>
      )}
    </div>
  )
}
