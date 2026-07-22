// 計画作成の「テンプレート」。選んでコピーすると、作成フォームに一括入力される。
// 日程は「例」として、コピー時に今日から少し先の日付を自動で入れる（あとで調整可能）。
// 場所名などは汎用的なひな形にしてあるので、実際の内容に書き換えて使う。

export type TemplateScheduleRow = {
  dayOffset: number // 0=初日, 1=2日目 ...
  time: string // 'HH:MM'（30分刻み）
  time_label: string // 集合/出発/到着/解散 など
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

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'summer-camp',
    emoji: '🏕️',
    name: '夏のキャンプ',
    summary: '1泊2日。テント泊で川遊び・BBQなど。',
    category: 'キャンプ',
    nights: 1,
    budget: 6000,
    transport: '車',
    description: '夏のキャンプ（1泊2日）。水分補給と熱中症対策を忘れずに。',
    schedule: [
      { dayOffset: 0, time: '10:00', time_label: '集合', location_name: '大学（集合場所）' },
      { dayOffset: 0, time: '13:00', time_label: '到着', location_name: '○○キャンプ場' },
      { dayOffset: 0, time: '18:00', time_label: '', location_name: 'BBQ・夕食' },
      { dayOffset: 1, time: '10:00', time_label: '出発', location_name: '○○キャンプ場' },
      { dayOffset: 1, time: '13:00', time_label: '解散', location_name: '大学（解散場所）' },
    ],
  },
  {
    id: 'winter-camp',
    emoji: '⛄',
    name: '冬のキャンプ',
    summary: '1泊2日。防寒対策をしっかりと。',
    category: 'キャンプ',
    nights: 1,
    budget: 7000,
    transport: '車',
    description: '冬のキャンプ（1泊2日）。防寒着・カイロ・温かい飲み物を用意しましょう。',
    schedule: [
      { dayOffset: 0, time: '10:00', time_label: '集合', location_name: '大学（集合場所）' },
      { dayOffset: 0, time: '13:00', time_label: '到着', location_name: '○○キャンプ場' },
      { dayOffset: 0, time: '18:00', time_label: '', location_name: '鍋・夕食' },
      { dayOffset: 1, time: '10:00', time_label: '出発', location_name: '○○キャンプ場' },
      { dayOffset: 1, time: '13:00', time_label: '解散', location_name: '大学（解散場所）' },
    ],
  },
  {
    id: 'day-hike',
    emoji: '🥾',
    name: '日帰りハイキング',
    summary: '日帰り。近場の山や自然を歩く。',
    category: '日帰り',
    nights: 0,
    budget: 2000,
    transport: '公共交通',
    description: '日帰りハイキング。歩きやすい靴・雨具・行動食を用意しましょう。',
    schedule: [
      { dayOffset: 0, time: '08:30', time_label: '集合', location_name: '最寄り駅' },
      { dayOffset: 0, time: '10:00', time_label: '到着', location_name: '登山口' },
      { dayOffset: 0, time: '12:00', time_label: '休憩', location_name: '山頂（昼食）' },
      { dayOffset: 0, time: '16:00', time_label: '解散', location_name: '最寄り駅' },
    ],
  },
  {
    id: 'bbq',
    emoji: '🍖',
    name: 'デイキャンプ・BBQ',
    summary: '日帰り。手ぶらでも楽しめる定番。',
    category: '日帰り',
    nights: 0,
    budget: 3000,
    transport: '車',
    description: '日帰りBBQ。食材・炭・ゴミ袋の担当を分担しましょう。',
    schedule: [
      { dayOffset: 0, time: '10:00', time_label: '集合', location_name: '大学（集合場所）' },
      { dayOffset: 0, time: '11:00', time_label: '到着', location_name: '○○公園・BBQ場' },
      { dayOffset: 0, time: '16:00', time_label: '解散', location_name: '現地解散' },
    ],
  },
  {
    id: 'spring-training',
    emoji: '🌸',
    name: '春の合宿',
    summary: '2泊3日。新歓・親睦向けの合宿。',
    category: '合宿',
    nights: 2,
    budget: 12000,
    transport: '車',
    description: '春の合宿（2泊3日）。新入生歓迎・親睦を兼ねた活動。',
    schedule: [
      { dayOffset: 0, time: '10:00', time_label: '集合', location_name: '大学（集合場所）' },
      { dayOffset: 0, time: '14:00', time_label: '到着', location_name: '宿泊先' },
      { dayOffset: 1, time: '09:00', time_label: '', location_name: '終日活動' },
      { dayOffset: 2, time: '10:00', time_label: '出発', location_name: '宿泊先' },
      { dayOffset: 2, time: '15:00', time_label: '解散', location_name: '大学（解散場所）' },
    ],
  },
  {
    id: 'beach',
    emoji: '🏖️',
    name: '海水浴・ビーチ',
    summary: '日帰り。海で泳いだり遊んだり。',
    category: '日帰り',
    nights: 0,
    budget: 3000,
    transport: '公共交通',
    description: '海水浴（日帰り）。日焼け止め・飲み物・着替えを用意しましょう。',
    schedule: [
      { dayOffset: 0, time: '09:00', time_label: '集合', location_name: '最寄り駅' },
      { dayOffset: 0, time: '10:30', time_label: '到着', location_name: '○○海水浴場' },
      { dayOffset: 0, time: '16:00', time_label: '解散', location_name: '最寄り駅' },
    ],
  },
  {
    id: 'autumn-camp',
    emoji: '🍁',
    name: '紅葉・秋キャンプ',
    summary: '1泊2日。紅葉を楽しむ秋の定番。',
    category: 'キャンプ',
    nights: 1,
    budget: 6000,
    transport: '車',
    description: '秋のキャンプ（1泊2日）。朝晩は冷えるので上着を用意しましょう。',
    schedule: [
      { dayOffset: 0, time: '10:00', time_label: '集合', location_name: '大学（集合場所）' },
      { dayOffset: 0, time: '13:00', time_label: '到着', location_name: '○○キャンプ場' },
      { dayOffset: 1, time: '10:00', time_label: '出発', location_name: '○○キャンプ場' },
      { dayOffset: 1, time: '13:00', time_label: '解散', location_name: '大学（解散場所）' },
    ],
  },
]
