import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  AI_MODEL,
  Type,
  countNights,
  createAiClient,
  describeSeason,
  parseJsonResponse,
} from '@/lib/ai/client'

// 持ち物の抜け漏れをチェックする。
// 計画の条件（季節・泊数・人数・活動内容）と、いま登録されている持ち物から
// 「足りないもの」を指摘する。今のアプリは登録された物を並べるだけで、
// 足りない物には誰も気付けないため、そこを埋めるのが狙い。
//
// 計画IDだけを受け取り、判断材料はサーバー側で集める（クライアントを信用しない）。

const requestSchema = z.object({
  planId: z.string().uuid(),
})

const resultSchema = z.object({
  summary: z.string(),
  findings: z.array(
    z.object({
      severity: z.enum(['warning', 'info']),
      title: z.string(),
      detail: z.string(),
    })
  ),
})

const SYSTEM_PROMPT = `あなたは日本の大学のアウトドアサークルの装備を点検するアシスタントです。
与えられた計画の条件と、現在登録されている持ち物から、足りないものや危険につながる不足を指摘します。

守ること:
- findings は重要な順に最大6件。無理に数を埋めない。問題が無ければ空配列でよい。
- severity は、安全や実施可否に関わるものを warning、あると良い程度のものを info とする。
- title は20文字以内で、何が足りないかを一言で。
- detail は80文字以内。なぜ必要かを、その計画の条件（季節・泊数・人数）に結びつけて書く。
- すでに登録されている物を「足りない」と言わない。
- 人数に対して数が足りない場合（テントの収容人数など）は具体的な数を挙げる。
- summary は40文字以内の全体講評。
- 一般論の羅列は避け、この計画に固有の指摘を優先する。`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'ログインしてください' }, { status: 401 })
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '入力が正しくありません' }, { status: 400 })
  }

  // 計画が読めるか＝グループのメンバーかどうかは RLS が判断する
  const { data: plan } = await supabase
    .from('plans')
    .select('id, title, category, start_date, end_date, area, description, default_transport')
    .eq('id', parsed.data.planId)
    .maybeSingle()

  if (!plan) {
    return NextResponse.json({ error: 'この計画を参照できません' }, { status: 403 })
  }

  const [{ data: participants }, { data: preparations }] = await Promise.all([
    supabase.from('participants').select('id').eq('plan_id', plan.id),
    supabase.from('preparations').select('type, body').eq('plan_id', plan.id),
  ])

  const personal = (preparations ?? [])
    .filter((row) => row.type !== 'shared')
    .map((row) => row.body)
    .filter(Boolean)
  const shared = (preparations ?? [])
    .filter((row) => row.type === 'shared')
    .map((row) => row.body)
    .filter(Boolean)

  const nights = countNights(plan.start_date, plan.end_date)
  const details = [
    `行事名: ${plan.title}`,
    `種別: ${plan.category || '未設定'}`,
    `場所: ${plan.area || '未設定'}`,
    `時期: ${describeSeason(plan.start_date)}`,
    nights === 0 ? '日程: 日帰り' : `日程: ${nights}泊${nights + 1}日`,
    `交通手段: ${plan.default_transport || '未定'}`,
    `参加人数: ${participants?.length ?? 0}人`,
    plan.description ? `活動内容: ${plan.description}` : '',
    '',
    `個人の持ち物（登録済み）: ${personal.length > 0 ? personal.join('、') : 'なし'}`,
    `共同の持ち物（登録済み）: ${shared.length > 0 ? shared.join('、') : 'なし'}`,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const ai = createAiClient()
    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: `次の計画の持ち物を点検してください。\n\n${details}`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            findings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  severity: { type: Type.STRING, enum: ['warning', 'info'] },
                  title: { type: Type.STRING },
                  detail: { type: Type.STRING },
                },
                required: ['severity', 'title', 'detail'],
              },
            },
          },
          required: ['summary', 'findings'],
        },
        maxOutputTokens: 2048,
        temperature: 0.3,
      },
    })

    const parsedResult = resultSchema.safeParse(parseJsonResponse(response.text))
    if (!parsedResult.success) {
      return NextResponse.json({ error: '点検できませんでした' }, { status: 502 })
    }

    return NextResponse.json(parsedResult.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AIの呼び出しに失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
