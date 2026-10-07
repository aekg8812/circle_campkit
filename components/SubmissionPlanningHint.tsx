// 計画の作成・編集画面で、学校への計画書の提出期限を先に見せる。
//
// 計画書には参加者名簿と入構車両の台数が要るので、募集を締め切ってから
// 提出期限（実施日の7営業日前）までに出す必要がある。
// 日程や募集締切を決める時点で気付けるよう、ここで知らせる。

import { formatJpDate } from '@/lib/formatDate'
import { todayLocal } from '@/lib/recruitmentStatus'
import { SUBMISSION_BUSINESS_DAYS, getSubmissionDeadline } from '@/lib/submissionDeadline'

export default function SubmissionPlanningHint({
  startDate,
  recruitDeadline,
}: {
  startDate: string
  /** 募集の締切（datetime-local の値）。募集しない・未入力なら空 */
  recruitDeadline: string
}) {
  const deadline = getSubmissionDeadline(startDate)
  if (!deadline) return null

  const deadlineLabel = formatJpDate(deadline)
  const alreadyPassed = deadline < todayLocal()
  // 募集締切の日付が提出期限の日より後なら、名簿がそろう前に期限が来てしまう
  const recruitTooLate = recruitDeadline !== '' && recruitDeadline.slice(0, 10) > deadline

  if (alreadyPassed) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
        この日程だと、学校への計画書の提出期限（{deadlineLabel}）をすでに過ぎています。
        計画書は実施日の{SUBMISSION_BUSINESS_DAYS}営業日前までに学生係へ出す決まりです。日程を見直してください。
      </p>
    )
  }

  if (recruitTooLate) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
        募集の締切が、学校への計画書の提出期限（<strong>{deadlineLabel}</strong>）より後になっています。
        計画書には参加者名簿と車の台数が要るので、締切は提出期限より前にしてください。
      </p>
    )
  }

  return (
    <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600">
      学校への計画書の提出期限：<strong>{deadlineLabel}</strong>
      （実施日の{SUBMISSION_BUSINESS_DAYS}営業日前）。募集はこの日より前に締め切ってください。
    </p>
  )
}
