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
    createdDateLabel: '令和 8年 7月 6日',
    recipient: DEFAULT_RECIPIENT,
    groupName: groupName || '〇〇サークル',
    representative: {
      name: '例: 山田 太郎',
      studentId: '例: 12345678',
      department: '例: 情報工学部 3年',
      phone: '例: 090-0000-0000',
      email: '例: sample@mail.kyutech.jp',
    },
    advisorName: '例: 九工 花子',
    advisorAffiliation: '例: 情報工学研究院',
    advisorPhone: '例: 093-000-0000',
    drafterName: '例: 山田 太郎',
    title: '例: 春キャンプ',
    dateRangeLabel: '例: 7月18日～7月19日',
    place: '例: 大分県竹田市（久住高原）',
    scheduleDays: [
      {
        label: '7/18',
        lines: ['09:00 大学正門 集合', '12:30 沢水キャンプ場 到着', '18:00 夕食・設営'],
      },
      { label: '7/19', lines: ['08:00 朝食', '10:00 撤収', '15:00 大学 解散'] },
    ],
    lodgingLines: ['例: 沢水キャンプ場', '例: 大分県竹田市久住町', '例: 0974-00-0000'],
    transportLabel: '例: 自家用車（3台）',
    participantCountLabel: '例: 12名',
    hospitalLabel: '例: 竹田市立〇〇病院（キャンプ場から約15km）',
    notes: '例: 雨天時は〇〇体育館に変更します。',
    roster: [],
  }
}

/** 自由入力の項目は、様式を変えた人が中身を決めるので、共通の例文を出す */
export const SAMPLE_CUSTOM_VALUE = '例: ここに自分で入力します'
