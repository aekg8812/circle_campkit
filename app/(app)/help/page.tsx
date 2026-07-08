import Link from 'next/link'

export const metadata = {
  title: 'ヘルプ・使い方ガイド | CampKit',
}

// はじめての人向けのヘルプページ。
// 「使い方の流れ」「使える機能」「困ったときは（FAQ）」の3部構成。
// FAQ は <details>/<summary> によるアコーディオン（No.17）で、
// JS 不要・キーボード操作やスクリーンリーダーに標準対応している。

const steps = [
  {
    title: 'プロフィールを入力',
    body: '氏名・学籍番号・学年・所属・TEL・学校用メール・指導教員を登録します。ここが計画書の名簿に自動で反映されます。',
    href: '/profile',
    linkLabel: 'プロフィールへ',
  },
  {
    title: 'グループに参加 / 作成',
    body: 'サークルのグループにパスワードで参加するか、新しく作ります。グループの中に計画がぶら下がります。',
    href: '/groups',
    linkLabel: 'グループへ',
  },
  {
    title: '計画を作成して募集',
    body: '行事名・日程・場所を決めて計画を作り、状態を「募集中」にするとメンバーに公開されます。',
    href: null,
    linkLabel: null,
  },
  {
    title: '参加 → 計画書を作成',
    body: 'メンバーが「参加する」を押すと名簿が自動で埋まります。起案者が「計画書を作成する」でPDFを出力できます。',
    href: null,
    linkLabel: null,
  },
]

const features = [
  { icon: '👥', title: 'グループ（サークル）', body: 'パスワード制で参加・作成。招待リンクやLINE共有も。' },
  { icon: '🗺️', title: '計画・行程表', body: 'キャンプ/合宿/日帰りの計画。集合〜解散の行程を地図リンク付きで管理。' },
  { icon: '🙋', title: '参加募集', body: '先着順や時間締切で募集。参加ボタンひとつで名簿に登録。' },
  { icon: '📄', title: '計画書PDF', body: '学校提出用の計画書＋参加者名簿を2ページのPDFで自動作成。' },
  { icon: '🚗', title: '車・道具の登録', body: 'プロフィールから自分の車や持っている道具を登録できます。' },
  { icon: '📝', title: '活動のふりかえり', body: '過去の計画に感想や一人あたりの費用をコメントとして残せます。' },
]

const faqs = [
  {
    q: 'グループに参加できません',
    a: '参加にはグループごとのパスワードが必要です。パスワードは各グループの部長（作成者）が管理しているので、部長に確認してください。招待リンクを開いた場合も、パスワードの入力が必要です。',
  },
  {
    q: '計画書の名簿が空欄になってしまう',
    a: '名簿は各メンバーのプロフィールから自動で作られます。空欄になる場合は、その人のプロフィール（学籍番号・所属・TEL・学校用メール・指導教員など）が未入力です。計画書ページの上部に「誰のどの項目が未入力か」が表示されるので、本人に入力を依頼してください。入力されると自動で反映されます。',
  },
  {
    q: '計画の日程や場所を間違えた',
    a: '計画詳細ページ右上の「✏️ 編集」から、行事名・日程・場所・説明をいつでも修正できます（起案者のみ）。修正内容は計画書にも自動で反映されます。',
  },
  {
    q: '計画を消したい',
    a: '計画詳細ページの一番下に「この計画を削除」ボタンがあります（起案者のみ）。行程・募集・参加者・計画書もまとめて削除され、元に戻せないのでご注意ください。',
  },
  {
    q: 'PDFがうまく作れない / 開けない',
    a: '「計画書を作成する（PDF）」ボタンを押すと端末にPDFがダウンロードされます。反応が無いときは少し待つか、ページを再読み込みしてもう一度お試しください。うまく表示されない場合は、別のPDFビューアやブラウザで開いてみてください。',
  },
  {
    q: 'プロフィール写真が変わらない',
    a: '写真をアップロードしても表示が古いままの場合は、ページを再読み込みしてください。反映まで少し時間がかかることがあります。',
  },
  {
    q: 'ログインできない / パスワードを忘れた',
    a: '登録したメールアドレスとパスワードでログインします（グループのパスワードとは別物です）。メールアドレスやパスワードが分からなくなった場合は、管理者にお問い合わせください。',
  },
]

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/profile" className="text-sm text-gray-500 hover:text-gray-700">
          ← プロフィール
        </Link>
        <h1 className="text-xl font-bold text-gray-800">ヘルプ・使い方ガイド</h1>
      </div>

      {/* 使い方の流れ */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-gray-800">はじめての方へ（4ステップ）</h2>
        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.03]">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-800">{step.title}</p>
                <p className="mt-1 text-sm leading-6 text-gray-600">{step.body}</p>
                {step.href && (
                  <Link
                    href={step.href}
                    className="mt-2 inline-block text-sm font-semibold text-green-600 hover:underline"
                  >
                    {step.linkLabel} →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 使える機能 */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-gray-800">使える機能</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.03]">
              <p className="text-sm font-bold text-gray-800">
                <span className="mr-1.5" aria-hidden>
                  {feature.icon}
                </span>
                {feature.title}
              </p>
              <p className="mt-1 text-sm leading-6 text-gray-600">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 困ったときは（FAQアコーディオン） */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-gray-800">困ったときは</h2>
        <div className="space-y-2">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.03] [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-gray-800">
                {faq.q}
                <span
                  aria-hidden
                  className="flex-shrink-0 text-lg text-gray-400 transition group-open:rotate-45"
                >
                  ＋
                </span>
              </summary>
              <p className="border-t border-gray-100 px-4 py-3.5 text-sm leading-6 text-gray-600">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <p className="rounded-2xl bg-green-50 px-4 py-4 text-sm leading-6 text-green-800">
        解決しないときは、サークルの管理者・部長に相談してください。プロフィールを最新に保っておくと、計画書づくりがスムーズです。
      </p>
    </div>
  )
}
