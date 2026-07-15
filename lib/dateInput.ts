// 日付・日時の入力欄で、「YYYY/MM/DD」の文字部分をクリックしても
// カレンダーが開くようにするためのハンドラ。
// 標準の <input type="date"> はカレンダーアイコンを押したときしか開かないため、
// showPicker() を呼んで入力欄のどこをクリックしても開くようにする。
// （手入力は従来どおり可能。showPicker 非対応のブラウザでは何も起きない）

export function openDatePicker(event: React.MouseEvent<HTMLInputElement>) {
  const input = event.currentTarget as HTMLInputElement & {
    showPicker?: () => void
  }
  try {
    input.showPicker?.()
  } catch {
    // ユーザー操作起因でない等で失敗した場合は、通常の入力欄として振る舞う
  }
}
