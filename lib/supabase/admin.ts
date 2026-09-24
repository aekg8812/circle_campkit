import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// サービスロール鍵を使う管理用クライアント。
// ⚠️ この鍵は RLS をすべて迂回できるため、絶対にクライアントへ渡さないこと。
//   `server-only` を import しているので、誤ってクライアントから読み込むと
//   ビルド時にエラーになる。環境変数も NEXT_PUBLIC_ を付けない。
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase の接続情報が未設定です（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）'
    )
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
