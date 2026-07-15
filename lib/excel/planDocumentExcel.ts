// 計画書の Excel 出力（1ファイル・2シート：「計画書」「参加者名簿」）。
// PDF と同じデータ（PlanDocumentData）から作るので、内容は常に一致する。
// ライブラリが大きいので、DocumentClient からクリック時に dynamic import する。

import ExcelJS from 'exceljs'
import {
  ROSTER_FOOTNOTE,
  ROSTER_MIN_ROWS,
  padRoster,
  type PlanDocumentData,
} from '@/lib/planDocument'

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
}

/** 見出し（左列）のセル体裁 */
function styleHeaderCell(cell: ExcelJS.Cell) {
  cell.border = THIN_BORDER
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' },
  }
}

function styleValueCell(cell: ExcelJS.Cell) {
  cell.border = THIN_BORDER
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
}

/** 計画書データから Excel の Blob を作る */
export async function generatePlanDocumentExcel(
  data: PlanDocumentData
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'CampKit'

  // ---------------- シート1: 計画書 ----------------
  const sheet = workbook.addWorksheet('計画書')
  sheet.columns = [
    { width: 16 },
    { width: 34 },
    { width: 34 },
  ]

  const addPlain = (text: string, alignment?: ExcelJS.Alignment['horizontal']) => {
    const row = sheet.addRow([text])
    if (alignment) {
      row.getCell(1).alignment = { horizontal: alignment }
    }
    return row
  }

  // 日付（右寄せ）
  const dateRow = sheet.addRow(['', '', data.createdDateLabel || '令和　年　月　日'])
  dateRow.getCell(3).alignment = { horizontal: 'right' }
  sheet.addRow([])

  addPlain(data.recipient)
  sheet.addRow([])

  // 団体・代表者・顧問（ラベル + 値）
  const headerPairs: [string, string][] = [
    ['団体名', data.groupName],
    ['代表者氏名', data.representative.name],
    ['学籍番号', data.representative.studentId],
    ['所属等', data.representative.department],
    ['TEL', data.representative.phone],
    ['E-mail', data.representative.email],
    ['顧問教員', data.advisorName],
    ['所属等', data.advisorAffiliation],
    ['TEL', data.advisorPhone],
    ['起案者代表', data.drafterName],
  ]
  for (const [label, value] of headerPairs) {
    const row = sheet.addRow(['', label, value])
    row.getCell(2).font = { bold: true }
    row.getCell(3).border = { bottom: { style: 'thin' } }
  }

  sheet.addRow([])
  addPlain('下記のとおり、合宿等を企画しました。（申請いたします。）')
  addPlain('許可していただきますようにお願いします。')
  addPlain('記', 'center')
  sheet.addRow([])

  // 記の表
  const scheduleText = data.scheduleDays
    .map((day) => [day.label, ...day.lines].join('\n'))
    .join('\n\n')

  const bodyRows: [string, string][] = [
    ['行事名', data.title],
    ['日時', data.dateRangeLabel],
    ['場所', data.place],
    ['日程（詳細に）', scheduleText],
    ['宿泊所', data.lodgingLines.join('\n')],
    ['移動手段', data.transportLabel],
    ['参加人数', data.participantCountLabel],
    ['周辺の病院等', data.hospitalLabel],
    ['備考', data.notes],
  ]

  for (const [label, value] of bodyRows) {
    const row = sheet.addRow([label, value])
    sheet.mergeCells(`B${row.number}:C${row.number}`)
    styleHeaderCell(row.getCell(1))
    styleValueCell(row.getCell(2))

    // 行程・備考は行を高くして読みやすくする
    if (label === '日程（詳細に）') {
      row.height = Math.max(60, scheduleText.split('\n').length * 14)
    } else if (label === '備考' || label === '宿泊所') {
      row.height = 34
    }
  }

  // ---------------- シート2: 参加者名簿 ----------------
  const roster = workbook.addWorksheet('参加者名簿')
  roster.columns = [
    { header: '', width: 5 },
    { header: '学生番号', width: 13 },
    { header: '役職', width: 9 },
    { header: '学年', width: 6 },
    { header: '所属', width: 30 },
    { header: '氏名', width: 14 },
    { header: 'TEL', width: 16 },
    { header: 'E-mail', width: 34 },
    { header: '指導教員氏名', width: 14 },
  ]

  roster.spliceRows(1, 0, ['参加者名簿'])
  roster.getCell('A1').font = { bold: true, size: 12 }
  roster.addRow([])

  const headerRow = roster.addRow([
    '',
    '学生番号',
    '役職',
    '学年',
    '所属',
    '氏名',
    'TEL',
    'E-mail',
    '指導教員氏名',
  ])
  headerRow.eachCell((cell) => styleHeaderCell(cell))

  // 様式に合わせて最低20行の枠を出す
  for (const [index, entry] of padRoster(data.roster).entries()) {
    const row = roster.addRow([
      index + 1,
      entry?.studentId ?? '',
      entry?.position ?? '',
      entry?.grade ?? '',
      entry?.department ?? '',
      entry?.name ?? '',
      entry?.phone ?? '',
      entry?.email ?? '',
      entry?.advisor ?? '',
    ])
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      styleValueCell(cell)
      if (colNumber === 1 || colNumber === 4) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      }
    })
  }

  roster.addRow([])
  const footnote = roster.addRow([ROSTER_FOOTNOTE])
  footnote.getCell(1).font = { size: 9 }

  // 20人を超えても崩れないよう、実データ行数を基準に印刷範囲を設定
  const lastRosterRow = 3 + Math.max(ROSTER_MIN_ROWS, data.roster.length)
  roster.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    printArea: `A1:I${lastRosterRow}`,
  }
  sheet.pageSetup = { orientation: 'portrait', fitToPage: true }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
