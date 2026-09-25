// 計画作成の「テンプレート」。選んでコピーすると、作成フォームに一括入力される。
//
// 内容は、このサークルが実際に行った計画をもとにしている。
// 汎用的なひな形だと結局すべて書き直すことになるため、
// 行き先・時刻・立ち寄り先まで具体的に入れてある。
//
// 日程は「例」として、コピー時に今日から少し先の日付を自動で入れる（あとで調整可能）。
// 予算は目安。実績が分かっているものはその値を入れている。

export type TemplateScheduleRow = {
  dayOffset: number // 0=初日, 1=2日目 ...
  time: string // 'HH:MM'（30分刻み・2桁ゼロ埋め）
  time_label: string // 集合/出発/到着/解散/休憩/買い出し
  location_name: string
  note?: string
}

export type PlanTemplate = {
  id: string
  emoji: string
  name: string
  summary: string // カードに出す短い説明
  category: string // キャンプ/合宿/日帰り/その他
  nights: number // 泊数（0=日帰り）
  budget: number // 一人あたりの目安予算（円）
  transport: string // 全体の交通手段
  description: string
  schedule: TemplateScheduleRow[]
}

const UNIVERSITY = '九州工業大学'

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'kuju-sawamizu',
    emoji: '🏕️',
    name: '久住高原キャンプ',
    summary: '1泊2日。沢水キャンプ場。帰りに露天風呂。',
    category: 'キャンプ',
    nights: 1,
    budget: 5000,
    transport: '車',
    description:
      '久住高原・沢水キャンプ場での1泊2日。標高が高く夜は冷えるので防寒具を忘れずに。2日目は久住高原の露天風呂に寄ってから帰ります。',
    schedule: [
      { dayOffset: 0, time: '10:00', time_label: '集合', location_name: `${UNIVERSITY}` },
      {
        dayOffset: 0,
        time: '11:30',
        time_label: '買い出し',
        location_name: '道中のスーパー（買い出し・昼食）',
      },
      {
        dayOffset: 0,
        time: '14:00',
        time_label: '到着',
        location_name: '沢水キャンプ場（テント設営）',
      },
      { dayOffset: 0, time: '18:00', time_label: '', location_name: '夕食・BBQ' },
      {
        dayOffset: 1,
        time: '10:00',
        time_label: '出発',
        location_name: '沢水キャンプ場（チェックアウト）',
      },
      { dayOffset: 1, time: '10:30', time_label: '', location_name: '久住高原を観光' },
      { dayOffset: 1, time: '12:30', time_label: '', location_name: '昼食' },
      {
        dayOffset: 1,
        time: '14:00',
        time_label: '',
        location_name: '久住高原の露天風呂',
        note: '汗を流してから帰路につきます',
      },
      { dayOffset: 1, time: '19:00', time_label: '解散', location_name: `${UNIVERSITY}` },
    ],
  },
  {
    id: 'unzen-tashirobaru',
    emoji: '⛺',
    name: '雲仙・田代原キャンプ',
    summary: '1泊2日。長崎観光と雲仙温泉つき。帰りが遅め。',
    category: 'キャンプ',
    nights: 1,
    budget: 8000,
    transport: '車',
    description:
      '雲仙・田代原キャンプ場での1泊2日。距離があるので朝8時集合、帰着は夜遅くなります。往路で長崎市内を観光し、復路は雲仙温泉に入ってから帰ります。',
    schedule: [
      { dayOffset: 0, time: '08:00', time_label: '集合', location_name: `${UNIVERSITY}` },
      { dayOffset: 0, time: '11:00', time_label: '', location_name: '長崎市内を観光' },
      { dayOffset: 0, time: '12:30', time_label: '', location_name: '昼食（長崎市内）' },
      {
        dayOffset: 0,
        time: '14:00',
        time_label: '買い出し',
        location_name: '道中のスーパー（食材の買い出し）',
      },
      {
        dayOffset: 0,
        time: '16:00',
        time_label: '到着',
        location_name: '田代原キャンプ場（テント設営）',
      },
      { dayOffset: 0, time: '18:30', time_label: '', location_name: '夕食・BBQ' },
      {
        dayOffset: 1,
        time: '10:00',
        time_label: '出発',
        location_name: '田代原キャンプ場（チェックアウト）',
      },
      { dayOffset: 1, time: '11:00', time_label: '', location_name: '雲仙を観光' },
      { dayOffset: 1, time: '16:00', time_label: '', location_name: '雲仙温泉で入浴' },
      { dayOffset: 1, time: '19:00', time_label: '出発', location_name: '雲仙' },
      {
        dayOffset: 1,
        time: '23:00',
        time_label: '解散',
        location_name: `${UNIVERSITY}`,
        note: '帰着が深夜になるため、翌日の予定に注意',
      },
    ],
  },
  {
    id: 'noasobihama',
    emoji: '🏖️',
    name: '野遊び浜キャンプ',
    summary: '1泊2日。海辺で釣り。帰りに宇佐神宮。',
    category: 'キャンプ',
    nights: 1,
    budget: 5000,
    transport: '車',
    description:
      '野遊び浜キャンプ場での1泊2日。夜は早めに片付けて就寝し、翌朝は早朝釣りから始めます。帰りに宇佐神宮に寄って、温泉に入ってから解散します。',
    schedule: [
      { dayOffset: 0, time: '10:00', time_label: '集合', location_name: `${UNIVERSITY}` },
      {
        dayOffset: 0,
        time: '11:30',
        time_label: '買い出し',
        location_name: '道中のスーパー（買い出し・昼食）',
      },
      {
        dayOffset: 0,
        time: '14:00',
        time_label: '到着',
        location_name: '野遊び浜キャンプ場（テント設営）',
      },
      { dayOffset: 0, time: '16:00', time_label: '', location_name: '海辺で遊ぶ' },
      { dayOffset: 0, time: '18:00', time_label: '', location_name: '夕食・BBQ' },
      {
        dayOffset: 0,
        time: '20:00',
        time_label: '',
        location_name: '片付け・就寝',
        note: '翌朝が早いので早めに片付けます',
      },
      {
        dayOffset: 1,
        time: '06:00',
        time_label: '',
        location_name: '早朝釣り',
        note: '釣れたら朝食にできます',
      },
      { dayOffset: 1, time: '09:00', time_label: '', location_name: '片付け開始' },
      {
        dayOffset: 1,
        time: '11:00',
        time_label: '出発',
        location_name: '野遊び浜キャンプ場（チェックアウト）',
      },
      { dayOffset: 1, time: '13:00', time_label: '', location_name: '宇佐神宮を参拝' },
      { dayOffset: 1, time: '15:00', time_label: '', location_name: '温泉で入浴' },
      { dayOffset: 1, time: '18:00', time_label: '解散', location_name: `${UNIVERSITY}` },
    ],
  },
  {
    id: 'day-bbq',
    emoji: '🍖',
    name: '日帰りBBQ・デイキャンプ',
    summary: '日帰り。近場で半日。手軽な定番。',
    category: '日帰り',
    nights: 0,
    budget: 3000,
    transport: '車',
    description:
      '日帰りのBBQ・デイキャンプ。食材・炭・ゴミ袋の担当を決めておくとスムーズです。',
    schedule: [
      { dayOffset: 0, time: '10:00', time_label: '集合', location_name: `${UNIVERSITY}` },
      {
        dayOffset: 0,
        time: '11:00',
        time_label: '買い出し',
        location_name: '道中のスーパー（食材・炭の買い出し）',
      },
      { dayOffset: 0, time: '12:00', time_label: '到着', location_name: '現地（BBQ場）' },
      { dayOffset: 0, time: '16:00', time_label: '', location_name: '片付け' },
      { dayOffset: 0, time: '18:00', time_label: '解散', location_name: `${UNIVERSITY}` },
    ],
  },
]
