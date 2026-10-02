// 学校提出用の計画書（1枚目・本体）をA4の見た目で描く。
//
// 計画書の画面と「学校用計画書の様式」の画面の両方から使う。
// 様式の画面では、サンプルの値を入れて「どんな提出書類になるか」を見せている。

import type { PlanDocumentData } from '@/lib/planDocument'

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
          <UnderlineRow label="代表者氏名" value={data.representative.name} />
          <UnderlineRow label="学籍番号" value={data.representative.studentId} />
          <UnderlineRow label="所属等" value={data.representative.department} />
          <UnderlineRow label="TEL" value={data.representative.phone} />
          <UnderlineRow label="E-mail" value={data.representative.email} />
          <UnderlineRow label="顧問教員" value={data.advisorName} />
          <UnderlineRow label="所属等" value={data.advisorAffiliation} />
          <UnderlineRow label="TEL" value={data.advisorPhone} />
        </tbody>
      </table>

      <table className="ml-auto mt-4 border-separate border-spacing-y-1">
        <tbody>
          <UnderlineRow label="起案者代表" value={data.drafterName} />
        </tbody>
      </table>

      <p className="mt-6">下記のとおり、合宿等を企画しました。（申請いたします。）</p>
      <p>許可していただきますようにお願いします。</p>
      <p className="mt-3 text-center">記</p>

      <table className="mt-3 w-full border-collapse [&_td]:border [&_td]:border-gray-800 [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:border-gray-800 [&_th]:px-2 [&_th]:py-1.5">
        <tbody>
          {/* 様式（グループが決めた行の並び）に沿って描く */}
          {data.rows.map((row) => (
            <tr key={row.key}>
              <th className="w-24 bg-gray-50 font-normal align-top">{row.label}</th>
              {row.kind === 'schedule' ? (
                row.days.length === 0 ? (
                  <td colSpan={2} className="text-gray-500">
                    行程が未登録です
                  </td>
                ) : (
                  row.days.slice(0, 2).map((day) => (
                    <td
                      key={day.label}
                      className="align-top"
                      colSpan={row.days.length === 1 ? 2 : 1}
                    >
                      <p className="font-semibold">{day.label}</p>
                      {day.lines.map((line, index) => (
                        <p key={index}>{line}</p>
                      ))}
                    </td>
                  ))
                )
              ) : row.kind === 'lines' ? (
                <td colSpan={2}>
                  {row.values.map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </td>
              ) : (
                <td colSpan={2} className="whitespace-pre-wrap">
                  {row.value}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


function UnderlineRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="pr-4 align-bottom">{label}</td>
      <td className="min-w-64 border-b border-gray-800 pl-2 align-bottom">
        {value || ' '}
      </td>
    </tr>
  )
}
