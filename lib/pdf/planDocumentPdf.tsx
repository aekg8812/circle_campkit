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
  ROSTER_FOOTNOTE,
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
    width: 72,
    borderRight: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 5,
    backgroundColor: '#f3f4f6',
  },
  td: { flex: 1, paddingVertical: 4, paddingHorizontal: 5 },
  scheduleCol: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRight: BORDER,
  },
  rosterTable: { marginTop: 8, border: BORDER, borderBottom: 0, fontSize: 8 },
  rosterCell: {
    borderRight: BORDER,
    paddingVertical: 3,
    paddingHorizontal: 3,
    minHeight: 16,
  },
})

// 参加者名簿の列。様式どおり先頭の番号列は見出しなし
const ROSTER_COLUMNS: { key: keyof RosterEntry | 'number'; label: string; flex: number; center?: boolean }[] = [
  { key: 'number', label: '', flex: 0.4, center: true },
  { key: 'studentId', label: '学生番号', flex: 1.1, center: true },
  { key: 'position', label: '役職', flex: 0.7, center: true },
  { key: 'grade', label: '学年', flex: 0.45, center: true },
  { key: 'department', label: '所属', flex: 2.0 },
  { key: 'name', label: '氏名', flex: 1.2 },
  { key: 'phone', label: 'TEL', flex: 1.2 },
  { key: 'email', label: 'E-mail', flex: 2.6 },
  { key: 'advisor', label: '指導教員氏名', flex: 1.0 },
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
          <HeaderRow label="代表者氏名" value={data.representative.name} />
          <HeaderRow label="学籍番号" value={data.representative.studentId} />
          <HeaderRow label="所属等" value={data.representative.department} />
          <HeaderRow label="TEL" value={data.representative.phone} />
          <HeaderRow label="E-mail" value={data.representative.email} />
          <HeaderRow label="顧問教員" value={data.advisorName} />
          <HeaderRow label="所属等" value={data.advisorAffiliation} />
          <HeaderRow label="TEL" value={data.advisorPhone} />
        </View>

        <View style={[styles.headerTable, { marginTop: 10 }]}>
          <HeaderRow label="起案者代表" value={data.drafterName} />
        </View>

        <Text style={{ marginTop: 16 }}>
          下記のとおり、合宿等を企画しました。（申請いたします。）
        </Text>
        <Text>許可していただきますようにお願いします。</Text>
        <Text style={[styles.center, { marginTop: 8 }]}>記</Text>

        <View style={styles.table}>
          <BodyRow label="行事名" value={data.title} />
          <BodyRow label="日時" value={data.dateRangeLabel} />
          <BodyRow label="場所" value={data.place} />

          <View style={styles.row}>
            <Text style={styles.th}>{'日程\n（詳細に）'}</Text>
            <View style={{ flex: 1, flexDirection: 'row' }}>
              {data.scheduleDays.length === 0 ? (
                <Text style={styles.td}> </Text>
              ) : (
                data.scheduleDays.map((day, index) => (
                  <View
                    key={day.label}
                    style={[
                      styles.scheduleCol,
                      index === data.scheduleDays.length - 1 ? { borderRight: 0 } : {},
                    ]}
                  >
                    <Text>{day.label}</Text>
                    {day.lines.map((line, lineIndex) => (
                      <Text key={lineIndex}>{line}</Text>
                    ))}
                  </View>
                ))
              )}
            </View>
          </View>

          <BodyRow label="宿泊所" value={data.lodgingLines.join('\n')} />
          <BodyRow label="移動手段" value={data.transportLabel} />
          <BodyRow label="参加人数" value={data.participantCountLabel} />
          <BodyRow label="周辺の病院等" value={data.hospitalLabel} />
          <BodyRow label="備考" value={data.notes} minHeight={40} />
        </View>
      </Page>

      {/* 2枚目: 参加者名簿（横向き・最低20行の枠） */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text>参加者名簿</Text>
        <View style={styles.rosterTable}>
          <View style={styles.row}>
            {ROSTER_COLUMNS.map((column, index) => (
              <Text
                key={index}
                style={[
                  styles.rosterCell,
                  { flex: column.flex, textAlign: 'center' },
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
                    { flex: column.flex },
                    column.center ? { textAlign: 'center' } : {},
                    index === ROSTER_COLUMNS.length - 1 ? { borderRight: 0 } : {},
                  ]}
                >
                  {column.key === 'number'
                    ? String(rowIndex + 1)
                    : entry
                      ? String(entry[column.key as keyof RosterEntry] ?? '') || ' '
                      : ' '}
                </Text>
              ))}
            </View>
          ))}
        </View>
        <Text style={{ marginTop: 8, fontSize: 8 }}>{ROSTER_FOOTNOTE}</Text>
      </Page>
    </Document>
  )
}

/** 計画書データから PDF Blob を生成する（ブラウザ専用） */
export async function generatePlanDocumentPdf(data: PlanDocumentData): Promise<Blob> {
  return pdf(<PlanDocumentPdf data={data} />).toBlob()
}
