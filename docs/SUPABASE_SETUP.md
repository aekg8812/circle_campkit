# Supabase セットアップ手順

## 1. 環境変数の設定

`.env.local.example` をコピーして `.env.local` を作成し、値を埋める。

```bash
cp .env.local.example .env.local
```

Supabase ダッシュボード → Settings → API から取得:
- `NEXT_PUBLIC_SUPABASE_URL`: Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Project API Keys → anon public

## 2. マイグレーションの実行

`supabase/migrations/20240101000000_init.sql` を Supabase ダッシュボードの SQL Editor に貼り付けて実行する。

> Supabase CLI を使う場合: `supabase db push`

## 3. Storage バケットの作成

Supabase ダッシュボード → Storage → New Bucket で以下を作成する。

### avatars バケット

- Bucket name: `avatars`
- Public bucket: ✅（チェックする）

**RLS ポリシー:**

```sql
-- avatars: 本人のみアップロード・更新可
create policy "avatars: 本人のみ書き込み可"
on storage.objects for insert
with check (
  bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "avatars: 本人のみ更新可"
on storage.objects for update
using (
  bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
);

-- avatars: 認証ユーザーは閲覧可（パブリックバケットなので不要だが念のため）
create policy "avatars: 認証ユーザーは閲覧可"
on storage.objects for select
using (bucket_id = 'avatars');
```

> ※ avatars は `{user_id}.{ext}` という単一ファイルで管理するため、ポリシーは `name` の先頭要素ではなく `name like '{uid}%'` で書いてもよい。

### gear バケット

- Bucket name: `gear`
- Public bucket: ✅（チェックする）

**RLS ポリシー:**

```sql
-- gear: 本人ディレクトリのみ書き込み可（パス = {owner_id}/{gear_id}.{ext}）
create policy "gear: 本人のみ書き込み可"
on storage.objects for insert
with check (
  bucket_id = 'gear' and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "gear: 本人のみ更新可"
on storage.objects for update
using (
  bucket_id = 'gear' and auth.uid()::text = (storage.foldername(name))[1]
);

-- gear: 認証ユーザーは閲覧可
create policy "gear: 認証ユーザーは閲覧可"
on storage.objects for select
using (bucket_id = 'gear');
```

## 4. Phase 2 マイグレーションの実行

`supabase/migrations/20240201000000_phase2_groups.sql` を Supabase ダッシュボードの SQL Editor に貼り付けて実行する。

> **注意**: Phase 0 の migration（`20240101000000_init.sql`）が先に適用済みであること。

このマイグレーションで以下が追加される:
- `pgcrypto` 拡張（パスワードハッシュ化）
- `group_secrets` テーブル（RLS で直接アクセス拒否）
- `groups` テーブルの RLS 更新（認証ユーザー全員が一覧表示可能）
- `create_group(p_name, p_image_url, p_password)` RPC
- `join_group(p_group_id, p_password)` RPC
- `leave_group(p_group_id)` RPC

### group-images バケット

Supabase ダッシュボード → Storage → New Bucket で作成する。

- Bucket name: `group-images`
- Public bucket: ✅（チェックする）

**RLS ポリシー:**

```sql
-- group-images: 認証ユーザーはアップロード可
create policy "group-images: 認証ユーザーは書き込み可"
on storage.objects for insert
with check (
  bucket_id = 'group-images' and auth.uid() is not null
);

create policy "group-images: 認証ユーザーは更新可"
on storage.objects for update
using (
  bucket_id = 'group-images' and auth.uid() is not null
);

-- group-images: 認証ユーザーは閲覧可
create policy "group-images: 認証ユーザーは閲覧可"
on storage.objects for select
using (bucket_id = 'group-images');
```

## 5. メール認証の確認

Supabase ダッシュボード → Authentication → Email Templates で確認メールが届くか確認する。

ローカル開発中は Supabase ダッシュボード → Authentication → Users から手動でメール確認をスキップできる（「Confirm email」ボタン）。

## 5. 動作確認チェックリスト

- [ ] `/signup` でアカウント作成 → 確認メール受信 → 認証完了
- [ ] `/login` でログイン → `/profile` にリダイレクト
- [ ] プロフィール編集（氏名・学年・学科等）が保存される
- [ ] アバター画像を Storage にアップロードして表示される
- [ ] `/profile/cars` で車の追加・編集・削除が動く
- [ ] `/profile/gear` で道具の追加・編集・削除が動く
- [ ] 道具に写真をアップロードしてサムネイル表示される
- [ ] 未ログイン状態で `/profile` にアクセスすると `/login` にリダイレクトされる
