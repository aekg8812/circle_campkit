// 学校提出用の計画書（1枚目・本体）をA4の見た目で描く。
//
// 計画書の画面と「学校用計画書の様式」の画面の両方から使う。
// 様式の画面では、サンプルの値を入れて「どんな提出書類になるか」を見せている。
//
// 様式は「企画書（R8.10.02〜）」: 右上に団体名・代表者氏名・顧問教員、
// 中央に表題「○○利用許可願・○○企画」、記の表、右下に【責任者】の枠。

import { SUBMISSION_FOOTNOTE, type PlanDocumentData } from '@/lib/planDocument'

/** 提出様式に似せたA4プレビュー（1枚目: 計画書本体） */
export default function DocumentSheet({ data }: { data: PlanDocumentData }) {
  return (
    <div
      className="plan-document-sheet mx-auto min-w-[640px] max-w-[794px] bg-white p-10 text-[12px] leading-relaxed text-gray-900 shadow-md print:min-w-0 print:p-0 print:shadow-none"
    >
      <p className="text-right">{data.createdDateLabel || '令和　年　月　日'}</p>

      <p className="mt-6">{data.recipient}</p>

      <table className="ml-auto mt-4 border-separate border-spacing-y-1">
        <tbody>
          <UnderlineRow label="団体名" value={data.groupName} />
          <UnderlineRow label="代表者氏名" value={data.representativeName} />
          <UnderlineRow label="顧問教員" value={data.advisorName} />
        </tbody>
      </table>

      <p className="mt-8 text-center text-[13px]">{data.applicationTitle || '○○企画'}</p>

      <p className="mt-6 text-center">下記のように企画しました。</p>
      <p className="text-center">許可していただきますようお願いします。</p>
      <p className="mt-3 text-center">記</p>

      <table className="mt-3 w-full border-collapse [&_td]:border [&_td]:border-gray-800 [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:border-gray-800 [&_th]:px-2 [&_th]:py-1.5">
        <tbody>
          {/* 様式（グループが決めた行の並び）に沿って描く */}
          {data.rows.map((row) => (
            <tr key={row.key}>
              <th className="w-32 bg-gray-50 align-top font-normal">{row.label}</th>
              {row.kind === 'schedule' ? (
                <td className="align-top">
                  {row.days.length === 0 ? (
                    <span className="text-gray-500">行程が未登録です</span>
                  ) : (
                    // 日ごとに横へ並べる（3日を超えたら折り返す）
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-x-4 gap-y-2">
                      {row.days.map((day) => (
                        <div key={day.label}>
                          <p className="font-semibold">{day.label}</p>
                          {day.lines.map((line, index) => (
                            <p key={index}>{line}</p>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              ) : row.kind === 'lines' ? (
                <td>
                  {row.values.map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </td>
              ) : (
                <td className="whitespace-pre-wrap">{row.value}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto mt-6 w-80 border border-gray-800 px-5 py-3">
        <p>【責任者】</p>
        <table className="mt-1 border-separate border-spacing-y-0.5">
          <tbody>
            <PlainRow label="代表者氏名" value={data.responsible.name} />
            <PlainRow label="学籍番号" value={data.responsible.studentId} />
            <PlainRow label="TEL" value={data.responsible.phone} />
            <PlainRow label="Mail" value={data.responsible.email} />
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-[11px]">{SUBMISSION_FOOTNOTE}</p>
    </div>
  )
}

function UnderlineRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="pr-4 align-bottom">{label}</td>
      <td className="min-w-64 border-b border-gray-800 pl-2 align-bottom">
        {value || ' '}
      </td>
    </tr>
  )
}

function PlainRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="pr-4">{label}</td>
      <td className="break-all">{value || ' '}</td>
    </tr>
  )
}
