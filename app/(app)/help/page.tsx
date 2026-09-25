import Link from 'next/link'

export const metadata = {
  title: 'ヘルプ・使い方ガイド',
}

// はじめての人向けのヘルプページ。
// 「使い方の流れ」「状態（フェーズ）」「使える機能」「困ったときは（FAQ）」の構成。
// FAQ は <details>/<summary> のアコーディオンで、JS不要・キーボード/スクリーンリーダー対応。

const steps = [
  {
    title: 'プロフィールを入力',
    body: '氏名・学籍番号・学年・所属・TEL・学校用メール・指導教員を登録します。ここが提出書類の名簿に自動で反映されます。車や道具もここから登録できます。',
    href: '/profile',
    linkLabel: 'プロフィールへ',
  },
  {
    title: 'グループに参加 / 作成',
    body: 'サークルのグループにパスワードで参加するか、新しく作ります。グループの中に計画がぶら下がります。招待はリンク・QRコード・LINEで送れます。',
    href: '/groups',
    linkLabel: 'グループへ',
  },
  {
    title: '計画をまとめて作成',
    body: '「計画を作成」で、行事名・日程・場所・予算・行程表・募集設定までを1つのフォームで入力できます。テンプレートを選べば一括入力でき、「✨ AIで下書きを作る」で行程表の案も作れます。作成した時点ではまだ未公開（自分だけ）です。',
    href: null,
    linkLabel: null,
  },
  {
    title: '募集を開始 → 参加',
    body: '計画詳細で「📣 募集を開始する」を押すと、グループ全員に公開されます。メンバーは「参加する」、まだ分からなければ「未定で登録」を選べます。参加すると持ち物・車の登録をお願いされます。',
    href: null,
    linkLabel: null,
  },
  {
    title: '提出書類をつくる',
    body: '「📄 提出書類をつくる」から、「1. 内容を入力 → 2. 見た目を確認 → 3. 提出する」の順に進みます。入力は自動で保存されます。名簿はプロフィールから自動で埋まり、PDFまたはExcelで出力できます。',
    href: null,
    linkLabel: null,
  },
]

const phases = [
  { label: '未公開', color: 'bg-gray-100 text-gray-600', body: 'あなただけが見られます（「自分の計画」タブ）。' },
  { label: '募集中', color: 'bg-green-100 text-green-700', body: 'グループに公開中。参加を受け付けています。' },
  { label: '準備中', color: 'bg-indigo-100 text-indigo-700', body: '締め切られ、参加者が確定した状態。当日に向けて準備します。' },
  { label: '過去', color: 'bg-sky-100 text-sky-700', body: '実施日を過ぎた計画。ふりかえりを記録できます。' },
]

const features = [
  { icon: '💬', title: 'LINEでログイン', body: 'ログイン画面の「LINEでログイン」を使うと、確認メールのやり取りなしで始められます。LINEのトークから開いた場合もそのまま使えます。' },
  { icon: '👥', title: 'グループ（サークル）', body: 'パスワード制で参加・作成。グループ名横の「☰ メニュー」から招待（リンク/QR/LINE）・自分の役職の変更・グループ編集・テンプレートや様式の編集・脱退ができます。' },
  { icon: '🗺️', title: '計画・行程表', body: '基本情報・行程表・募集をまとめて入力。行程はタイムライン表示で、地図リンク付き。あとから追加・編集・並べ替えもできます。' },
  { icon: '🏕️', title: '計画テンプレート', body: '定番の行き先を登録しておくと、次回から一括入力できます。計画詳細の「⭐ テンプレートに保存」で、うまくいった行程をそのまま残せます。' },
  { icon: '✨', title: 'AIの補助', body: '行き先と日程から行程表の下書きを作れます。持ち物では「足りない物をチェック」で、季節・泊数・人数から不足を指摘します。あくまで提案なので、最後は自分たちで判断してください。' },
  { icon: '🙋', title: '参加募集', body: '「時間締切」または「先着順＆時間締切」で募集。参加するか「未定」かを選べ、未定は定員に数えません。締切や定員に達すると自動的に締め切られます。' },
  { icon: '🎒', title: '持ち物・準備', body: '募集開始後に表示。「個人の持ち物」と「共同の持ち物（みんなで使う）」に分けて登録でき、プロフィールの道具・車からワンタップ追加もできます。' },
  { icon: '📄', title: '提出書類（PDF / Excel）', body: '計画書＋参加者名簿を出力します。入力は自動保存。グループのメンバーなら誰でも入力でき、代表者も選べます。表の項目は「計画書の様式」から追加・削除・並べ替えできます。' },
  { icon: '💰', title: '予算と集金', body: '計画に「一人あたり予算」を設定できます。設定すると起案者が参加者ごとに集金を記録でき、「3/5人・残り10,000円」のように進み具合が分かります。' },
  { icon: '📝', title: '活動のふりかえり', body: '過去になった計画に、感想と一人あたりの費用をコメントとして残せます（平均費用も自動集計）。' },
  { icon: '📋', title: '計画の複製', body: '計画詳細の「📋 自分の計画に複製」で、内容を引き継いだ新しい計画を作れます。毎年の合宿などに便利です。' },
]

const faqs = [
  {
    q: 'ログインできない（人によってできる／できない）',
    a: 'いちばん確実なのは「LINEでログイン」です。確認メールのやり取りが不要なので、この問題自体が起きません。メールアドレスで登録した場合は、登録時に届く確認メールのリンクを一度開く必要があります。届いていない場合は、ログイン画面でメールとパスワードを入れると「確認メールを再送する」ボタンが出ます（迷惑メールフォルダもご確認を）。',
  },
  {
    q: 'メールとLINE、どちらで登録すればいい？',
    a: 'これから始めるなら「LINEでログイン」をおすすめします。ただし、メールで登録したアカウントとLINEで登録したアカウントは別物として扱われます。メールで登録済みの人がLINEでログインすると、それまでのグループや計画が見えない新しいアカウントになるのでご注意ください。',
  },
  {
    q: 'パスワードを忘れた',
    a: 'ログイン画面の「パスワードをお忘れですか？」からメールアドレスを入力すると、再設定用のリンクが届きます。リンクを開いて新しいパスワードを設定してください。※これはログイン用パスワードの話で、グループの参加パスワードとは別物です。',
  },
  {
    q: 'グループに参加できません',
    a: '参加にはグループごとの「参加パスワード」が必要です。パスワードはそのグループの作成者が管理しているので、作成者に確認してください。招待リンクやQRを開いた場合も、パスワードの入力が必要です。',
  },
  {
    q: '自分の役職（部長・部員）はどこで変えるの？',
    a: 'グループ画面の「☰ メニュー」を開き、「自分の役職」から部長／副部長／部員を選べます。ここで選んだ役職が提出書類の名簿に反映されます。',
  },
  {
    q: '「未定」で登録したあと、参加に変えたい',
    a: '計画詳細の「募集・参加」にある「参加に変更する」を押してください。逆に「未定に変更」もできます。未定のあいだは定員に数えられず、提出書類の名簿にも載りません。',
  },
  {
    q: '状態が「未公開・募集中・準備中・過去」と変わるのは？',
    a: '計画は 未公開 →（募集を開始）→ 募集中 →（締切・定員・締め切り操作）→ 準備中 →（実施日を過ぎる）→ 過去 と一方向に進みます。「準備中」「過去」は日付などから自動で切り替わるので、基本的に操作は不要です。',
  },
  {
    q: '実施日を過ぎたのに過去にならない',
    a: '現在は、終了日（無ければ開始日）を過ぎると自動的に「過去」タブへ移ります。表示が古い場合はページを再読み込みしてください。',
  },
  {
    q: '持ち物・準備の欄が見当たらない',
    a: '持ち物・準備は「募集を開始してから（募集中・準備中）」表示されます。計画段階（未公開）では出ません。登録できるのはその計画に参加したメンバーだけです。',
  },
  {
    q: '集金の記録はどこでするの？',
    a: '計画に「一人あたり予算」を設定していると、計画詳細の参加者一覧に「未払い」ボタンが出ます（起案者のみ）。受け取ったら押してください。参加者からは自分の支払い状態だけが見えます。',
  },
  {
    q: '提出書類の名簿が空欄になってしまう',
    a: '名簿は各メンバーのプロフィールから自動で作られます。空欄になる場合は、その人のプロフィール（学籍番号・所属・TEL・学校用メール・指導教員など）が未入力です。提出書類の「2. 見た目を確認」に「誰のどの項目が未入力か」が出るので、本人に入力を依頼してください。',
  },
  {
    q: '提出書類の入力は保存されているの？',
    a: '自動で保存されます。入力の手が止まると保存され、画面上部に「✓ 保存しました」と出ます。保存ボタンはありません。',
  },
  {
    q: 'PDFやExcelはどこで出せるの？',
    a: '提出書類の「3. 提出する」まで進むと、PDF・Excel・印刷のボタンが出ます。未入力の項目があれば警告が出ますが、そのまま出力することもできます。反応が無いときは少し待つか、ページを再読み込みしてお試しください。',
  },
  {
    q: 'プレビューの文字が小さくて読めない',
    a: '計画書はA4サイズなので、スマホの画面幅には収まりません。「2. 見た目を確認」で「プレビューを開く」を押すと、全画面で表示されます。',
  },
  {
    q: '計画書に載せる項目を増やしたい／減らしたい',
    a: 'グループ画面の「☰ メニュー」→「📄 計画書の様式を編集」から、表に出す項目を追加・削除・並べ替えできます。追加した項目は、計画書の入力画面に自動で現れます。いつでも「標準の様式に戻す」で元に戻せます。',
  },
  {
    q: '自分たちのテンプレートを作りたい',
    a: '2つの方法があります。（1）計画詳細の「⭐ テンプレートに保存」で、いまの行程をそのまま残す。（2）グループ画面の「☰ メニュー」→「🏕️ 計画テンプレートを編集」で、空から作る。どちらも、あとから名前や行程を直せます。',
  },
  {
    q: '計画の日程や場所を間違えた / 計画を消したい',
    a: '計画詳細の「✏️ 基本情報を編集」からいつでも修正できます（起案者）。削除は「⚙️ この計画を管理」を開いた中にあります。行程・募集・参加者・提出書類もまとめて消え、元に戻せないのでご注意ください。',
  },
  {
    q: '募集の設定や交通手段はどこで変えるの？',
    a: '計画詳細の「⚙️ この計画を管理」にまとめてあります（起案者のみ）。参加するだけの人には表示されません。',
  },
  {
    q: '締切日時などの入力欄で、カレンダーが出ない',
    a: '日付・締切日時の欄は、どこをクリックしてもカレンダーが開きます（手入力も可能）。うまく出ない場合は、欄の右端のカレンダーアイコンからも開けます。',
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
        <h2 className="text-base font-bold text-gray-800">はじめての方へ（5ステップ）</h2>
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

      {/* 計画の状態（フェーズ） */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-gray-800">計画の状態（フェーズ）</h2>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.03]">
          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs font-bold">
            {phases.map((phase, index) => (
              <span key={phase.label} className="flex items-center gap-1.5">
                <span className={`rounded-full px-2.5 py-0.5 ${phase.color}`}>{phase.label}</span>
                {index < phases.length - 1 && <span className="text-gray-400">→</span>}
              </span>
            ))}
          </div>
          <ul className="space-y-1.5">
            {phases.map((phase) => (
              <li key={phase.label} className="flex gap-2 text-sm text-gray-600">
                <span className={`h-fit flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${phase.color}`}>
                  {phase.label}
                </span>
                <span className="leading-6">{phase.body}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-500">
            状態は一方向に進みます（戻せません）。「準備中」「過去」は自動で切り替わります。
          </p>
        </div>
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
                  className="flex-shrink-0 text-lg text-gray-500 transition-ui group-open:rotate-45"
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
        解決しないときは、サークルの管理者・グループの作成者に相談してください。プロフィールを最新に保っておくと、提出書類づくりがスムーズです。
      </p>
    </div>
  )
}
