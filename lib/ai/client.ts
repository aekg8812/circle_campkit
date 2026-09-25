import 'server-only'

import Anthropic from '@anthropic-ai/sdk'

// AI機能で使う Anthropic クライアント。
// ⚠️ APIキーはサーバー専用。NEXT_PUBLIC_ を付けず、ブラウザへ渡さないこと。

export const AI_MODEL = 'claude-opus-5'

export function createAiClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('AI機能が未設定です（ANTHROPIC_API_KEY）')
  }
  return new Anthropic({ apiKey })
}

/** 開始日から季節を言葉にする（持ち物の判断材料にする） */
export function describeSeason(isoDate: string | null | undefined): string {
  if (!isoDate) return '時期未定'
  const month = Number(isoDate.split('-')[1])
  if (!month) return '時期未定'
  if (month <= 2 || month === 12) return `${month}月（冬）`
  if (month <= 5) return `${month}月（春）`
  if (month <= 8) return `${month}月（夏）`
  return `${month}月（秋）`
}

/** 泊数（日帰りなら0） */
export function countNights(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): number {
  if (!startDate || !endDate || startDate === endDate) return 0
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000)
  return diff > 0 ? diff : 0
}
