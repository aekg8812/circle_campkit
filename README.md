# CampKit

アウトドアサークルの運営を一元化する Web アプリです。
計画づくり・参加募集・持ち物の共有から、**学校提出用の計画書の作成**までをまとめて行えます。

- **本番**: https://campkit-king-k-57s-projects.vercel.app
- **LINE から開く**: https://liff.line.me/2011727048-0Tdp92M9

スマートフォン（特に LINE アプリ内）での利用を前提に作られています。

---

## できること

| 機能 | 概要 |
|---|---|
| グループ（サークル） | パスワード制で参加。招待リンク・QR・LINE で共有 |
| 計画・行程表 | 集合から解散までをタイムラインで管理。地図リンク付き |
| 参加募集 | 「時間締切」または「先着順＆時間締切」。締切・定員で自動的に締め切り |
| 持ち物・準備 | 個人の持ち物と共同の持ち物を分けて登録 |
| **提出書類** | 計画書＋参加者名簿を PDF / Excel で出力。様式はグループごとに編集可能 |
| ふりかえり | 活動後に感想と一人あたりの費用を記録（平均を自動集計） |
| LINE ログイン | 確認メールのやり取りなしでログイン |
| AI 補助 | 行程表の下書き生成 / 持ち物の抜け漏れチェック |

---

## 技術スタック

- **Next.js 16**（App Router）/ React 19 / TypeScript
- **Supabase**（認証・PostgreSQL・Storage・RLS）
- **Vercel**（ホスティング）
- **LIFF**（LINE アプリ内での起動・LINE ログイン）
- **Gemini API**（AI 機能）
- PDF 出力: `@react-pdf/renderer` / Excel 出力: `exceljs`

---

## セットアップ

### 1. 取得して依存関係を入れる

```bash
git clone git@github.com:aekg8812/circle_campkit.git
cd circle_campkit
npm install
```

### 2. `.env.local` を用意する

プロジェクト直下に `.env.local` を作り、以下を設定します。
**接続情報は Slack の DM など安全な経路で共有してください。README やコミットに貼らないこと。**

```bash
# 必須（これが無いとアプリが起動しません）
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# 任意（未設定でもアプリは動きますが、該当機能が無効になります）
NEXT_PUBLIC_LIFF_ID=...            # LINE アプリ内での起動
LINE_LOGIN_CHANNEL_ID=...          # LINE ログインの検証
SUPABASE_SERVICE_ROLE_KEY=...      # LINE ログインのユーザー紐付け
GEMINI_API_KEY=...                 # AI 機能
GEMINI_MODEL=gemini-3.5-flash      # 省略可。モデルを変えたいときだけ
```

> ⚠️ **`SUPABASE_SERVICE_ROLE_KEY` と `LINE_LOGIN_CHANNEL_ID`、`GEMINI_API_KEY` に `NEXT_PUBLIC_` を付けないでください。**
> 付けるとブラウザに露出します。特にサービスロール鍵は RLS をすべて迂回できるため、漏れると全データを読み書きされます。

未設定のときの挙動は次のとおりです。

| 未設定の変数 | 起きること |
|---|---|
| `NEXT_PUBLIC_LIFF_ID` | 「LINEでログイン」ボタンが表示されない。招待リンクは通常のURLになる |
| `LINE_LOGIN_CHANNEL_ID` / `SUPABASE_SERVICE_ROLE_KEY` | LINEログインが失敗する |
| `GEMINI_API_KEY` | AI のボタンを押すとエラーが出る |

### 3. 開発サーバーを起動する

```bash
npm run dev
```

http://localhost:3000 を開きます。

---

## 開発コマンド

```bash
npm run dev      # 開発サーバー
npm run build    # 本番ビルド（型チェックも走る）
npx tsc --noEmit # 型チェックだけ
npx eslint .     # Lint
```

> **コミット前に `npx tsc --noEmit` と `npx eslint .` を通してください。**
> `npm run build` の出力は長く、型エラーを見落としやすいためです。

---

## ディレクトリ構成

```
app/
  (auth)/          ログイン・新規登録・パスワード再設定
  (app)/           ログイン後の画面（認証ガードは (app)/layout.tsx）
    home/          ホーム（今後の予定・やること・自分のグループ）
    groups/        グループ一覧・ダッシュボード・計画・提出書類
    profile/       プロフィール・車・道具
  api/
    auth/line/     LINEログインの受け口
    ai/            AI機能（行程表の下書き / 持ち物チェック）
components/        画面をまたいで使う部品
lib/
  supabase/        Supabase クライアント（client / server / admin）
  ai/              AI 機能の共通処理
  documentTemplate.ts  計画書の様式の定義
  planDocument.ts      計画書のデータ整形
docs/
  houshin.md       開発の進め方（まずこれを読む）
  DESIGN.md        データモデル・ロール・RLS方針（仕様の「正」）
supabase/
  migrations/      DBマイグレーション（追記のみ）
```

---

## ドキュメント

- **[docs/houshin.md](docs/houshin.md)** — 開発の進め方・運用ルール。**作業を始める前にこれを読んでください**
- **[docs/DESIGN.md](docs/DESIGN.md)** — データモデル・ロール定義・RLS 方針。仕様の「正」です
- **[AGENTS.md](AGENTS.md)** — AI エージェント向けの注意書き

---

## 注意

- **Supabase は全員で1つのプロジェクトを共有しています。** テスト時に他人のデータを消さないよう注意してください
- **マイグレーションは追記のみ。** 既存ファイルは編集せず、新しいファイルを追加してください
- **`main` に直接 push しないでください。** ブランチを切って Pull Request を出してください
