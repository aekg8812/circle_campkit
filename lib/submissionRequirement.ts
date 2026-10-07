// 学生係に「何を提出するか」を決める。
//
// 学生係の「活動内容ごとの提出書類一覧」をそのまま表にしたもの:
//
//                      学内                         学外
//   通常の活動          すべて不要                   企画書・名簿（大会なら要項も）
//   通常と異なる活動    企画書（施設は利用許可願も）  企画書・名簿・顧問確認メール
//
// 「通常の活動」は団体の本来の活動目的に沿ったもの（キャンプ・練習・大会など）、
// 「通常と異なる活動」はそれ以外（合宿・親睦会・地域イベントへの参加など）。

export type ActivityLocation = 'on_campus' | 'off_campus'
export type ActivityKind = 'regular' | 'special'

export const ACTIVITY_LOCATION_OPTIONS: { value: ActivityLocation; label: string; hint: string }[] = [
  { value: 'on_campus', label: '学内', hint: '体育館・講義室など' },
  { value: 'off_campus', label: '学外', hint: 'キャンプ場・大会会場など' },
]

export const ACTIVITY_KIND_OPTIONS: { value: ActivityKind; label: string; hint: string }[] = [
  { value: 'regular', label: '通常の活動', hint: 'キャンプ・練習・大会など、本来の活動' },
  { value: 'special', label: '通常と異なる活動', hint: '合宿・親睦会・地域イベントへの参加など' },
]

export type SubmissionRequirement = {
  /** 学生係に何か出す必要があるか */
  required: boolean
  planDocument: boolean
  roster: boolean
  /** 顧問教員から確認を得たメール等のスクリーンショット */
  advisorMail: boolean
  /** 学内の施設を使うなら、施設使用許可願も要る */
  facilityNote: boolean
  /** 大会やイベントに参加するなら、要項など詳細が分かるものも添える */
  tournamentNote: boolean
}

export function parseActivityLocation(value: unknown): ActivityLocation | null {
  return value === 'on_campus' || value === 'off_campus' ? value : null
}

export function parseActivityKind(value: unknown): ActivityKind | null {
  return value === 'regular' || value === 'special' ? value : null
}

/** 2つの答えから、提出するものを求める。どちらか未回答なら null */
export function getSubmissionRequirement(
  location: ActivityLocation | null,
  kind: ActivityKind | null
): SubmissionRequirement | null {
  if (!location || !kind) return null

  if (location === 'on_campus') {
    return kind === 'regular'
      ? {
          required: false,
          planDocument: false,
          roster: false,
          advisorMail: false,
          facilityNote: false,
          tournamentNote: false,
        }
      : {
          required: true,
          planDocument: true,
          roster: false,
          advisorMail: false,
          facilityNote: true,
          tournamentNote: false,
        }
  }

  return kind === 'regular'
    ? {
        required: true,
        planDocument: true,
        roster: true,
        advisorMail: false,
        facilityNote: false,
        tournamentNote: true,
      }
    : {
        required: true,
        planDocument: true,
        roster: true,
        advisorMail: true,
        facilityNote: false,
        tournamentNote: false,
      }
}

/**
 * 提出期限を知らせるべきか。
 * まだ答えていない計画は、出し忘れを防ぐため「必要」として扱う。
 */
export function needsSubmission(location: unknown, kind: unknown): boolean {
  const requirement = getSubmissionRequirement(
    parseActivityLocation(location),
    parseActivityKind(kind)
  )
  return requirement?.required ?? true
}
