// 計画書 PDF の組み立て。@react-pdf/renderer はバンドルが大きいため、
// このモジュールごとクリック時に dynamic import して使う。
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer'
import {
  SUBMISSION_FOOTNOTE,
  padRoster,
  type PlanDocumentData,
  type RosterEntry,
} from '@/lib/planDocument'

// IPAexゴシック（public/fonts/ に同梱）。日本語をPDFに埋め込むために必須
// ブラウザでは同一オリジンのURL、Node（テスト実行時）ではファイルパスで解決する
Font.register({
  family: 'IPAex',
  src:
    typeof window === 'undefined'
      ? `${process.cwd()}/public/fonts/ipaexg.ttf`
      : '/fonts/ipaexg.ttf',
})
// 単語間での自動改行を無効化し、日本語らしい文字単位の折り返しにする
Font.registerHyphenationCallback((word) => [...word].flatMap((char) => [char, '']))

const BORDER = '0.8pt solid #000'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'IPAex',
    fontSize: 9,
    paddingVertical: 40,
    paddingHorizontal: 48,
    color: '#000',
  },
  right: { textAlign: 'right' },
  headerTable: { alignSelf: 'flex-end', marginTop: 12, width: 260 },
  headerRow: { flexDirection: 'row', marginBottom: 3 },
  headerLabel: { width: 72 },
  headerValue: {
    flex: 1,
    borderBottom: '0.6pt solid #000',
    paddingLeft: 4,
    minHeight: 11,
  },
  center: { textAlign: 'center' },
  table: { marginTop: 8, border: BORDER, borderBottom: 0 },
  row: { flexDirection: 'row', borderBottom: BORDER },
  th: {
    width: 90,
    borderRight: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 5,
    backgroundColor: '#f3f4f6',
  },
  td: { flex: 1, paddingVertical: 4, paddingHorizontal: 5 },
  scheduleDay: { paddingRight: 6, marginBottom: 4 },
  responsibleBox: {
    alignSelf: 'flex-end',
    width: 240,
    marginTop: 18,
    border: BORDER,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  rosterTable: { marginTop: 8, border: BORDER, borderBottom: 0, fontSize: 9 },
  rosterCell: {
    borderRight: BORDER,
    paddingVertical: 3,
    paddingHorizontal: 3,
    minHeight: 16,
  },
})

// 参加者名簿の列。様式どおり先頭の番号列は見出しなし
const ROSTER_COLUMNS: { key: keyof RosterEntry; label: string; flex: number; center?: boolean }[] = [
  { key: 'number', label: '', flex: 0.4, center: true },
  { key: 'studentId', label: '学生番号', flex: 1.4, center: true },
  { key: 'departmentGrade', label: '学科学年', flex: 1.4 },
  { key: 'name', label: '氏　　　名', flex: 2.6 },
]

function HeaderRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.headerRow}>
      <Text style={styles.headerLabel}>{label}</Text>
      <Text style={styles.headerValue}>{value || ' '}</Text>
    </View>
  )
}

function BodyRow({ label, value, minHeight }: { label: string; value: string; minHeight?: number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.th}>{label}</Text>
      <Text style={[styles.td, minHeight ? { minHeight } : {}]}>{value || ' '}</Text>
    </View>
  )
}

function PlanDocumentPdf({ data }: { data: PlanDocumentData }) {
  return (
    <Document title={`計画書_${data.title}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.right}>{data.createdDateLabel || '令和　年　月　日'}</Text>

        <Text style={{ marginTop: 14 }}>{data.recipient}</Text>

        <View style={styles.headerTable}>
          <HeaderRow label="団体名" value={data.groupName} />
          <HeaderRow label="代表者氏名" value={data.representativeName} />
          <HeaderRow label="顧問教員" value={data.advisorName} />
        </View>

        <Text style={[styles.center, { marginTop: 22, fontSize: 10 }]}>
          {data.applicationTitle || '○○企画'}
        </Text>

        <Text style={[styles.center, { marginTop: 14 }]}>下記のように企画しました。</Text>
        <Text style={styles.center}>許可していただきますようお願いします。</Text>
        <Text style={[styles.center, { marginTop: 8 }]}>記</Text>

        <View style={styles.table}>
          {/* 様式（グループが決めた行の並び）に沿って描く */}
          {data.rows.map((row) => {
            if (row.kind === 'schedule') {
              // 日ごとに横へ並べる（3日を超えたら折り返す）
              const width = `${100 / Math.min(Math.max(row.days.length, 1), 3)}%`
              return (
                <View key={row.key} style={styles.row} wrap={false}>
                  <Text style={styles.th}>{row.label}</Text>
                  <View style={[styles.td, { flexDirection: 'row', flexWrap: 'wrap', minHeight: 60 }]}>
                    {row.days.length === 0 ? (
                      <Text> </Text>
                    ) : (
                      row.days.map((day) => (
                        <View key={day.label} style={[styles.scheduleDay, { width }]}>
                          <Text>{day.label}</Text>
                          {day.lines.map((line, lineIndex) => (
                            <Text key={lineIndex}>{line}</Text>
                          ))}
                        </View>
                      ))
                    )}
                  </View>
                </View>
              )
            }

            const value = row.kind === 'lines' ? row.values.join('\n') : row.value
            // その他報告事項は書き込む余白が要るので、少し高さを持たせる
            const minHeight = row.key === 'notes' ? 40 : undefined
            return <BodyRow key={row.key} label={row.label} value={value} minHeight={minHeight} />
          })}
        </View>

        <View style={styles.responsibleBox} wrap={false}>
          <Text>【責任者】</Text>
          <ResponsibleRow label="代表者氏名" value={data.responsible.name} />
          <ResponsibleRow label="学籍番号" value={data.responsible.studentId} />
          <ResponsibleRow label="TEL" value={data.responsible.phone} />
          <ResponsibleRow label="Mail" value={data.responsible.email} />
        </View>

        <Text style={{ marginTop: 18, fontSize: 8 }}>{SUBMISSION_FOOTNOTE}</Text>
      </Page>

      {/* 2枚目: 参加者名簿（最低20行の枠）。名簿が要らない活動では出さない */}
      {data.includeRoster && (
        <Page size="A4" style={styles.page}>
          <Text>参加者名簿</Text>
          <View style={styles.rosterTable}>
            <View style={styles.row}>
              {ROSTER_COLUMNS.map((column, index) => (
                <Text
                  key={index}
                  style={[
                    styles.rosterCell,
                    { flex: column.flex, textAlign: 'center', minHeight: 22 },
                    index === ROSTER_COLUMNS.length - 1 ? { borderRight: 0 } : {},
                  ]}
                >
                  {column.label || ' '}
                </Text>
              ))}
            </View>
            {padRoster(data.roster).map((entry, rowIndex) => (
              <View key={rowIndex} style={styles.row} wrap={false}>
                {ROSTER_COLUMNS.map((column, index) => (
                  <Text
                    key={index}
                    style={[
                      styles.rosterCell,
                      { flex: column.flex, minHeight: 26 },
                      column.center ? { textAlign: 'center' } : {},
                      index === ROSTER_COLUMNS.length - 1 ? { borderRight: 0 } : {},
                    ]}
                  >
                    {column.key === 'number'
                      ? String(rowIndex + 1)
                      : entry
                        ? String(entry[column.key] ?? '') || ' '
                        : ' '}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </Page>
      )}
    </Document>
  )
}

function ResponsibleRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', marginTop: 3 }}>
      <Text style={{ width: 64 }}>{label}</Text>
      <Text style={{ flex: 1 }}>{value || ' '}</Text>
    </View>
  )
}

/** 計画書データから PDF Blob を生成する（ブラウザ専用） */
export async function generatePlanDocumentPdf(data: PlanDocumentData): Promise<Blob> {
  return pdf(<PlanDocumentPdf data={data} />).toBlob()
}
