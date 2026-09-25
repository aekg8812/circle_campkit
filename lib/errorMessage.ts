// 画面に出すエラー文言を作る。
//
// Supabase がそのまま返す文言は
//   duplicate key value violates unique constraint "participants_plan_id_user_id_key"
// のような英語のうえ、テーブル名や制約名という内部構造まで見えてしまう。
// 利用者には意味が分からず、開発者にしか価値がない情報なので、
// ここで人が読める日本語に置き換える。詳細はコンソールに残す。

type ErrorLike = { message?: unknown; code?: unknown } | null | undefined

function readMessage(error: ErrorLike): string {
  if (!error) return ''
  if (typeof error.message === 'string') return error.message
  return ''
}

function readCode(error: ErrorLike): string {
  if (!error) return ''
  if (typeof error.code === 'string') return error.code
  return ''
}

/**
 * 利用者向けの文言に変換する。
 * @param error   Supabase や fetch が返したエラー
 * @param fallback 個別の事情が分からないときに出す文（例: 「保存できませんでした」）
 */
export function toUserMessage(error: ErrorLike, fallback: string): string {
  // 原因を追えるよう、元の内容は開発者向けに残しておく
  if (error) console.error(fallback, error)

  const raw = readMessage(error)
  const message = raw.toLowerCase()
  const code = readCode(error)

  // 自前の RPC（create_group / join_group など）は日本語で理由を返すので、
  // 日本語が含まれていればそのまま見せた方が親切
  if (/[ぁ-んァ-ヶ一-龠]/.test(raw)) {
    return raw
  }

  // 認証まわり（Supabase Auth は英語で返す）
  if (message.includes('user already registered') || message.includes('already been registered')) {
    return 'このメールアドレスはすでに登録されています。ログインをお試しください。'
  }
  if (message.includes('invalid login credentials')) {
    return 'メールアドレスまたはパスワードが正しくありません。'
  }
  if (message.includes('email not confirmed')) {
    return 'メールアドレスの確認が済んでいません。確認メールのリンクを開いてください。'
  }
  if (message.includes('password should be at least')) {
    return 'パスワードは6文字以上で入力してください。'
  }
  if (message.includes('for security purposes') || message.includes('rate limit')) {
    return '続けて試行されました。しばらく待ってからもう一度お試しください。'
  }

  // 一意制約違反（すでに同じものがある）
  if (code === '23505' || message.includes('duplicate key')) {
    return 'すでに登録されています。画面を再読み込みしてご確認ください。'
  }

  // 権限（RLS）で弾かれた
  if (
    code === '42501' ||
    message.includes('row-level security') ||
    message.includes('permission denied')
  ) {
    return 'この操作をする権限がありません。'
  }

  // 参照先が無い（消された計画に対する操作など）
  if (code === '23503' || message.includes('foreign key')) {
    return '対象が見つかりませんでした。すでに削除された可能性があります。'
  }

  // ログインの期限切れ
  if (
    message.includes('jwt expired') ||
    message.includes('invalid token') ||
    message.includes('not authenticated')
  ) {
    return 'ログインの有効期限が切れました。開き直してからもう一度お試しください。'
  }

  // 通信そのものが届いていない
  if (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed')
  ) {
    return '通信に失敗しました。電波の良い場所でもう一度お試しください。'
  }

  // ファイルが大きすぎる
  if (message.includes('payload too large') || message.includes('exceeded the maximum')) {
    return 'ファイルのサイズが大きすぎます。小さい画像でお試しください。'
  }

  return `${fallback}しばらくしてからもう一度お試しください。`
}
