// 計画書（参加者名簿・責任者欄）に必要なプロフィール項目がそろっているかを判定する共通ロジック。
// プロフィールの入力欄・ホームのバナー・参加時のチェック・計画書ページの未入力チェックで共有する。
//
// 新様式（R8.10.02〜）の名簿は「学生番号・学科学年・氏名」だけ。
// ただし【責任者】欄に部長の TEL・Mail が載るので、部長だけはその2つも必須。

export type ProfileLike = {
  name?: string | null
  grade?: number | null
  department?: string | null
  student_id?: string | null
  school_email?: string | null
  phone?: string | null
}

type RequiredField = { key: keyof ProfileLike; label: string }

// 名簿に載る項目のうち、氏名以外（氏名は登録時に必ず入る）
export const DOCUMENT_REQUIRED_FIELDS: RequiredField[] = [
  { key: 'student_id', label: '学籍番号' },
  { key: 'department', label: '学科' },
  { key: 'grade', label: '学年' },
]

// 部長だけが追加で必要な項目（計画書の【責任者】欄に載る）
export const LEADER_REQUIRED_FIELDS: RequiredField[] = [
  { key: 'phone', label: '電話番号' },
  { key: 'school_email', label: 'メールアドレス' },
]

/** 部長の役職名。計画書の代表者・責任者になる */
export const LEADER_POSITION = '部長'

/** 計画書に必要な項目のうち、未入力のものを返す（部長なら TEL・Mail も見る） */
export function getMissingDocumentFields(
  profile: ProfileLike | null | undefined,
  options: { isLeader?: boolean } = {}
): RequiredField[] {
  const fields = options.isLeader
    ? [...DOCUMENT_REQUIRED_FIELDS, ...LEADER_REQUIRED_FIELDS]
    : DOCUMENT_REQUIRED_FIELDS
  if (!profile) return fields
  return fields.filter((field) => {
    const value = profile[field.key]
    return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
  })
}
