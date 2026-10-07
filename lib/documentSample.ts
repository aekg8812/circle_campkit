// 「学校用計画書の様式」の画面で出すプレビュー用の、架空のサンプル。
//
// この画面は特定の計画に紐づいていないので、実データを出すことができない。
// 空欄の枠だけを見せても「どの欄に何が入るのか」が伝わらないため、
// 架空の計画を1つ用意して、様式を変えたときの見え方が分かるようにしている。
//
// ここには実在の個人情報を置かない（画面に氏名・学籍番号・電話がそのまま出るため）。

import { DEFAULT_RECIPIENT, type PlanDocumentData } from '@/lib/planDocument'

/** プレビューに使う架空の計画。値はすべて例であることが分かる文言にしている */
export function createSampleDocumentData(groupName: string): Omit<PlanDocumentData, 'rows'> {
  return {
    createdDateLabel: '令和8年10月7日',
    recipient: DEFAULT_RECIPIENT,
    groupName: groupName || '〇〇サークル',
    representativeName: '例: 山田 太郎',
    advisorName: '例: 九工 花子',
    applicationTitle: '例: 春キャンプ企画',
    responsible: {
      name: '例: 山田 太郎',
      studentId: '例: 12345678',
      phone: '例: 090-0000-0000',
      email: '例: sample@mail.kyutech.jp',
    },
    drafterName: '例: 山田 太郎',
    title: '例: 春キャンプ',
    dateRangeLabel: '例: 令和8年10月24日～10月25日',
    place: '例: 大分県竹田市（久住高原）',
    scheduleDays: [
      {
        label: '10/24',
        lines: ['09:00 大学正門 集合', '12:30 沢水キャンプ場 到着', '18:00 夕食・設営'],
      },
      { label: '10/25', lines: ['08:00 朝食', '10:00 撤収', '15:00 大学 解散'] },
    ],
    vehiclesLabel: '例: 有（3台）',
    outsideVisitorsLabel: '例: 無',
    lodgingLines: ['例: 有', '宿泊先：沢水キャンプ場（大分県竹田市久住町）'],
    notes: '例: 雨天時は中止します。',
    participantCountLabel: '例: 12人',
    roster: [],
    includeRoster: true,
  }
}

/** 自由入力の項目は、様式を変えた人が中身を決めるので、共通の例文を出す */
export const SAMPLE_CUSTOM_VALUE = '例: ここに自分で入力します'
