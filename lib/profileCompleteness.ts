// 計画書（参加者名簿）に必要なプロフィール項目がそろっているかを判定する共通ロジック。
// ホームのバナー・参加時の警告・計画書ページの未入力チェックで共有する。

export type ProfileLike = {
  name?: string | null
  grade?: number | null
  department?: string | null
  student_id?: string | null
  school_email?: string | null
  phone?: string | null
  academic_advisor?: string | null
}

// 名簿に載る項目のうち、氏名以外（氏名は登録時に必ず入る）
export const DOCUMENT_REQUIRED_FIELDS: { key: keyof ProfileLike; label: string }[] = [
  { key: 'student_id', label: '学籍番号' },
  { key: 'grade', label: '学年' },
  { key: 'department', label: '所属（学科・コース）' },
  { key: 'phone', label: 'TEL' },
  { key: 'school_email', label: '学校用メール' },
  { key: 'academic_advisor', label: '指導教員氏名' },
]

/** 計画書に必要な項目のうち、未入力のものを返す */
export function getMissingDocumentFields(
  profile: ProfileLike | null | undefined
): { key: keyof ProfileLike; label: string }[] {
  if (!profile) return DOCUMENT_REQUIRED_FIELDS
  return DOCUMENT_REQUIRED_FIELDS.filter((field) => {
    const value = profile[field.key]
    return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
  })
}
