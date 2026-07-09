// @hypermedia-components/core — Japanese locale pack.
//
// A complete translation of DEFAULT_MESSAGES (../i18n.js): every string a
// behavior can inject. Pass it to setMessages() once at startup, before
// behaviors install:
//
//   import { setMessages } from '@hypermedia-components/core/i18n';
//   import ja from '@hypermedia-components/core/locales/ja';
//   setMessages(ja);
//
// App-specific wording can be layered on top with a second setMessages()
// call — later merges win.
//
// Completeness is enforced by test/locales.test.mjs: a pack must cover
// every DEFAULT_MESSAGES key (and carry no stale ones), so a behavior that
// adds keys fails CI until every shipped pack translates them.

/** @type {Readonly<Record<string, string>>} */
const ja = Object.freeze({
  'combobox.empty': '一致する項目がありません',
  'combobox.loading': '読み込み中…',
  'combobox.error': '選択肢を読み込めませんでした',
  'combobox.create': '「{value}」を作成',
  'multicombobox.empty': '一致する項目がありません',
  'multicombobox.create': '「{value}」を追加',
  'multicombobox.remove': '{label} を削除',
  'calendar.label': 'カレンダー',
  'calendar.prevMonth': '前の月',
  'calendar.nextMonth': '次の月',
  'calendar.month': '月',
  'calendar.year': '年',
  'confirm.message': '続行しますか？',
  'confirm.title': '確認',
  'confirm.confirm': '実行',
  'confirm.cancel': 'キャンセル',
  'datagrid.selected': '{selected} 件選択中',
  'fieldErrors.unknown': '入力値が正しくありません',
  'copy.ok': 'コピーしました',
  'shell.toggleNav': 'ナビゲーションを開閉',
  'shell.collapseNav': 'サイドバーを折りたたむ',
  'splitter.resize': 'パネルの幅を変更',
  'themeToggle.label': 'カラーテーマを切り替え',
  'toast.dismiss': '閉じる',
  'toast.label': '通知',
});

export default ja;
