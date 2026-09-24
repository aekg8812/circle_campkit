import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// LINEログインの受け口。
// 流れ:
//   1. クライアント（LIFF）から LINE の IDトークンを受け取る
//   2. LINE のサーバーでトークンを検証する（改ざん・なりすまし防止）
//   3. LINEユーザーIDから決まるメールアドレスで Supabase のユーザーを用意する
//   4. マジックリンクのワンタイムトークンだけを発行して返す（メールは送らない）
//   5. クライアントがそれを verifyOtp に渡してセッションを確立する
//
// Supabase は LINE を標準のプロバイダとして持っていないため、この中継が必要になる。
// パスワードは一切扱わず、セッション発行は Supabase 側の仕組みに任せている。

// LINEユーザーIDから、そのユーザー専用のメールアドレスを組み立てる。
// .invalid は RFC 2606 で「実在しないことが保証された」TLD なので、
// 実際のメールアドレスと衝突せず、誤送信も起こらない。
function buildEmailForLineUser(lineUserId: string) {
  return `line_${lineUserId}@line.campkit.invalid`
}

type LineVerifyResponse = {
  sub?: string
  name?: string
  picture?: string
  error?: string
  error_description?: string
}

export async function POST(request: NextRequest) {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID
  if (!channelId) {
    return NextResponse.json(
      { error: 'サーバー設定が未完了です（LINE_LOGIN_CHANNEL_ID）' },
      { status: 500 }
    )
  }

  let idToken: unknown
  try {
    const body = await request.json()
    idToken = body?.idToken
  } catch {
    return NextResponse.json({ error: 'リクエストの形式が正しくありません' }, { status: 400 })
  }

  if (typeof idToken !== 'string' || idToken === '') {
    return NextResponse.json({ error: 'IDトークンがありません' }, { status: 400 })
  }

  // 1) LINE にIDトークンを検証してもらう。
  //    client_id を渡すので、他チャネル向けのトークンは弾かれる。
  let verified: LineVerifyResponse
  try {
    const response = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
    })
    verified = await response.json()
    if (!response.ok || !verified.sub) {
      return NextResponse.json(
        { error: 'LINEの認証に失敗しました', detail: verified.error_description ?? null },
        { status: 401 }
      )
    }
  } catch {
    return NextResponse.json({ error: 'LINEへの問い合わせに失敗しました' }, { status: 502 })
  }

  const lineUserId = verified.sub
  const email = buildEmailForLineUser(lineUserId)

  let admin
  try {
    admin = createAdminClient()
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'サーバー設定が未完了です' },
      { status: 500 }
    )
  }

  // 2) ユーザーを用意する。すでに居る場合は「登録済み」エラーになるだけなので無視する。
  //    email_confirm: true にして、確認メールのやり取りを不要にする。
  //    名前は profiles 作成トリガーが raw_user_meta_data から拾う。
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      name: verified.name ?? 'LINEユーザー',
      avatar_url: verified.picture ?? null,
      line_user_id: lineUserId,
    },
  })

  const alreadyRegistered =
    createError != null && /already|registered|exists/i.test(createError.message)

  if (createError && !alreadyRegistered) {
    return NextResponse.json(
      { error: 'ユーザーの作成に失敗しました', detail: createError.message },
      { status: 500 }
    )
  }

  // 3) ログイン用のワンタイムトークンを発行する。
  //    generateLink はリンクを「作るだけ」で、メールは送信されない。
  const { data, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  const tokenHash = data?.properties?.hashed_token
  if (linkError || !tokenHash) {
    return NextResponse.json(
      { error: 'ログイン用トークンの発行に失敗しました', detail: linkError?.message ?? null },
      { status: 500 }
    )
  }

  return NextResponse.json({ tokenHash })
}
