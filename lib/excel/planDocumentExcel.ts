// 計画書の Excel 出力（1ファイル・2シート：「計画書」「参加者名簿」）。
// PDF と同じデータ（PlanDocumentData）から作るので、内容は常に一致する。
// ライブラリが大きいので、DocumentClient からクリック時に dynamic import する。

import ExcelJS from 'exceljs'
import {
  ROSTER_MIN_ROWS,
  SUBMISSION_FOOTNOTE,
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

  // 団体名・代表者氏名・顧問教員（ラベル + 値）
  const headerPairs: [string, string][] = [
    ['団体名', data.groupName],
    ['代表者氏名', data.representativeName],
    ['顧問教員', data.advisorName],
  ]
  for (const [label, value] of headerPairs) {
    const row = sheet.addRow(['', label, value])
    row.getCell(2).font = { bold: true }
    row.getCell(3).border = { bottom: { style: 'thin' } }
  }

  sheet.addRow([])
  const titleRow = sheet.addRow([data.applicationTitle || '○○企画'])
  sheet.mergeCells(`A${titleRow.number}:C${titleRow.number}`)
  titleRow.getCell(1).alignment = { horizontal: 'center' }
  titleRow.getCell(1).font = { size: 12 }
  sheet.addRow([])
  for (const text of ['下記のように企画しました。', '許可していただきますようお願いします。', '記']) {
    const row = sheet.addRow([text])
    sheet.mergeCells(`A${row.number}:C${row.number}`)
    row.getCell(1).alignment = { horizontal: 'center' }
  }
  sheet.addRow([])

  // 記の表。様式（グループが決めた行の並び）に沿って描く
  for (const documentRow of data.rows) {
    let value = ''
    if (documentRow.kind === 'schedule') {
      value = documentRow.days
        .map((day) => [day.label, ...day.lines].join('\n'))
        .join('\n\n')
    } else if (documentRow.kind === 'lines') {
      value = documentRow.values.join('\n')
    } else {
      value = documentRow.value
    }

    const row = sheet.addRow([documentRow.label, value])
    sheet.mergeCells(`B${row.number}:C${row.number}`)
    styleHeaderCell(row.getCell(1))
    styleValueCell(row.getCell(2))

    // 複数行になる項目は行を高くして読みやすくする
    if (documentRow.kind === 'schedule') {
      row.height = Math.max(60, value.split('\n').length * 14)
    } else if (value.includes('\n') || documentRow.key === 'notes') {
      row.height = 34
    }
  }

  // 【責任者】（部長の情報）
  sheet.addRow([])
  const responsiblePairs: [string, string][] = [
    ['【責任者】', ''],
    ['代表者氏名', data.responsible.name],
    ['学籍番号', data.responsible.studentId],
    ['TEL', data.responsible.phone],
    ['Mail', data.responsible.email],
  ]
  for (const [label, value] of responsiblePairs) {
    sheet.addRow(['', label, value])
  }

  sheet.addRow([])
  const footnote = sheet.addRow([SUBMISSION_FOOTNOTE])
  footnote.getCell(1).font = { size: 9 }

  // ---------------- シート2: 参加者名簿 ----------------
  // 名簿が要らない活動（学内）では、シートごと作らない
  if (data.includeRoster) {
    addRosterSheet(workbook, data)
  }

  sheet.pageSetup = { orientation: 'portrait', fitToPage: true }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** シート2: 参加者名簿 */
function addRosterSheet(workbook: ExcelJS.Workbook, data: PlanDocumentData) {
  const roster = workbook.addWorksheet('参加者名簿')
  // 列に header を付けると1行目に見出しが入り、下の見出し行と二重になるので幅だけ決める
  roster.columns = [{ width: 5 }, { width: 16 }, { width: 24 }, { width: 30 }]

  roster.addRow(['参加者名簿'])
  roster.getCell('A1').font = { bold: true, size: 12 }
  roster.addRow([])

  const headerRow = roster.addRow(['', '学生番号', '学科学年', '氏名'])
  headerRow.eachCell((cell) => styleHeaderCell(cell))

  // 様式に合わせて最低20行の枠を出す
  for (const [index, entry] of padRoster(data.roster).entries()) {
    const row = roster.addRow([
      index + 1,
      entry?.studentId ?? '',
      entry?.departmentGrade ?? '',
      entry?.name ?? '',
    ])
    row.height = 22
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      styleValueCell(cell)
      if (colNumber <= 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      }
    })
  }

  // 20人を超えても崩れないよう、実データ行数を基準に印刷範囲を設定
  const lastRosterRow = 3 + Math.max(ROSTER_MIN_ROWS, data.roster.length)
  roster.pageSetup = {
    orientation: 'portrait',
    fitToPage: true,
    printArea: `A1:D${lastRosterRow}`,
  }
}
