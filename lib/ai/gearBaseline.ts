import 'server-only'

// キャンプの基本装備の目安。
// このサークルが実際に新入生へ案内している内容をもとにしている。
// AIの点検は、これを基準線として「登録されていないもの」を見つける。
//
// プロンプトに直接書かずデータとして持つのは、
// サークルごとに事情が違うため、あとで差し替えやすくするため。

export const GEAR_BASELINE = {
  essential: [
    '着替え',
    '洗面用具',
    '防寒具',
    'タオル',
    'ビニール袋',
    '充電器',
    '虫よけ',
    '日焼け止め',
    '薬',
    '毛布または寝袋',
  ],
  recommended: [
    { name: '椅子', reason: '無いと立ちっぱなしになる' },
    { name: 'マット', reason: '無いと寝るときにつらい' },
    { name: 'ライト', reason: 'サークルの備品も少しあるが数が足りないことがある' },
  ],
  notes: [
    '標高が高い場所は、夏でも夜が冷える',
    '服装は汚れてもよいものにする',
    'その他、各自が持ってきたいものは自由に持参してよい',
  ],
} as const

/** プロンプトに差し込む形に整える */
export function formatGearBaseline(): string {
  const essential = GEAR_BASELINE.essential.map((item) => `  - ${item}`).join('\n')
  const recommended = GEAR_BASELINE.recommended
    .map((item) => `  - ${item.name}（${item.reason}）`)
    .join('\n')
  const notes = GEAR_BASELINE.notes.map((note) => `  - ${note}`).join('\n')

  return `必ず必要なもの:
${essential}

あった方がよいもの:
${recommended}

補足:
${notes}`
}
