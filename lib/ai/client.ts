import 'server-only'

import { GoogleGenAI, Type } from '@google/genai'

// AI機能で使う Gemini クライアント。
// ⚠️ APIキーはサーバー専用。NEXT_PUBLIC_ を付けず、ブラウザへ渡さないこと。
//
// モデルは環境変数で差し替えられるようにしている。
// 無料枠のあるモデルは変わりうるので、コード変更なしで切り替えたいため。
export const AI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash'

export { Type }

export function createAiClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('AI機能が未設定です（GEMINI_API_KEY）')
  }
  return new GoogleGenAI({ apiKey })
}

/** モデルの返した JSON を安全に取り出す。壊れていれば null */
export function parseJsonResponse(text: string | undefined): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
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

// --- エラーの扱い -------------------------------------------------
//
// Gemini のエラーは、本文がそのまま JSON の文字列になっていることがある。
// 例: {"error":{"code":503,"message":"This model is currently experiencing
//      high demand...","status":"UNAVAILABLE"}}
// これをそのまま画面に出すと、利用者には何のことか分からない。
// 原文はサーバーのログにだけ残し、画面には日本語の案内だけを返す。

/** エラーからHTTPステータスらしき数字を取り出す */
function extractStatusCode(error: unknown): number | null {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { status?: unknown; code?: unknown }
    if (typeof candidate.status === 'number') return candidate.status
    if (typeof candidate.code === 'number') return candidate.code
  }
  const message = error instanceof Error ? error.message : String(error ?? '')
  const inJson = message.match(/"code"\s*:\s*(\d{3})/)
  if (inJson) return Number(inJson[1])
  const inText = message.match(/\b(400|401|403|404|429|500|502|503|504)\b/)
  return inText ? Number(inText[1]) : null
}

/** 混み合い・一時的な不具合など、少し待てば直る見込みのあるもの */
function isTemporary(code: number | null): boolean {
  return code === 500 || code === 502 || code === 503 || code === 504
}

/** 画面に出す日本語の案内にする。原文はログにだけ残す */
export function toAiErrorMessage(error: unknown): string {
  console.error('[ai] 呼び出しに失敗:', error)

  // 設定漏れは、こちらで出している日本語メッセージなのでそのまま使う
  if (error instanceof Error && error.message.includes('GEMINI_API_KEY')) {
    return error.message
  }

  const code = extractStatusCode(error)
  if (isTemporary(code)) {
    return 'AIが混み合っています。少し待ってから、もう一度お試しください。'
  }
  if (code === 429) {
    return 'AIの利用が上限に達しました。時間をおいてから、もう一度お試しください。'
  }
  if (code === 401 || code === 403) {
    return 'AI機能の設定に問題があります。管理者に連絡してください。'
  }
  if (code === 400) {
    return 'AIに渡す内容に問題がありました。計画の入力を見直してから、もう一度お試しください。'
  }
  return 'AIを呼び出せませんでした。時間をおいて、もう一度お試しください。'
}

/**
 * 混み合いで失敗したときだけ、少し待って呼び直す。
 * 「Spikes in demand are usually temporary」と案内されるとおり、
 * 1〜2秒おいて再送すれば通ることが多いため。
 * 利用上限(429)は待っても変わらないので、繰り返さない。
 */
export async function generateWithRetry<T>(run: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await run()
    } catch (error) {
      lastError = error
      if (attempt === attempts - 1 || !isTemporary(extractStatusCode(error))) break
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)))
    }
  }
  throw lastError
}
