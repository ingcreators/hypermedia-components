# Theme Builder 改善計画（確定版）

Status: **出荷済み**(2026-07-04 に origin/main で確認: PR-A の
`packages/core/scripts/token-transform.mjs` と exports の
`./token-transform`、ビルダー修正、neutral ランプ(`data-neutral`
軸)まで実装済み)。以下は計画当時の記録。
関連: PR #157（マージ済み・本計画で修正）、`apps/docs/src/components/ThemeBuilder.astro`、
`apps/docs/src/content/docs/tokens/{themes,theme-builder}.mdx`、
`packages/core/scripts/build-tokens.mjs`

---

## 0. 方針決定の経緯（要点）

- **Option B（component 色 leaf を `var(--hc-color-*)` 中間参照化）は不採用**。
  CSS の var() は宣言要素で解決され「凍結継承」するため、`:root` に一度書いた中間カスタム
  プロパティはサブツリーの `[data-color]` 上書きで再解決されず、部分テーマ切替が壊れる
  （`test-browser/nested-theme.spec.mjs` が現行の具体値・再出力方式を担保）。
- **Way 2（component CSS を `var(--comp, var(--semantic))` に書換え）も不採用**。
  no-build の小さな上書きは可能になるが、色の component マッピングが DTCG から CSS へ移り
  「DTCG tokens are the visual source of truth」規約に反する。
- **採用：全ダウンロード方式（実トランスフォーマ再利用）。**
  ビルダーは実 `buildTokensCss` にユーザー値を流し込み、**完全な成果物**を生成・配布する。
  凍結問題なし／コア改修なし／DTCG 原則を完全維持／利用者はビルド不要。

---

## 1. 修正すべき不具合（PR #157 由来）

現行ビルダーは semantic 変数 7 個だけを上書きしており、コンポーネントは具体値で焼かれた
`--hc-{component}-*` を読むため **primary ボタン・checkbox・radio の色が変わらない**
（focus-ring と ::selection だけ効く）。docs Path A も同じ理由で誤り。本計画で是正する。

---

## 2. 成果物（ビルダーの3つのダウンロード）

すべて実 `buildTokensCss` 出力から生成（ハードコードなし・常に正しい）。

1. **DTCG 全ソース** — ユーザー値を反映した DTCG JSON（`color.<name>.tokens.json`、full theme なら
   `semantic` / `theme.dark` パッチ）。用途：自前ビルド、寄稿（Path B）、Style Dictionary / Figma 連携。
2. **自テーマ CSS ブロック (B)** — そのテーマに必要な `--hc-*` 一式のみを抽出した**追加用**ブロック。
   - accent: `[data-color="<name>"] { …~51 leaf… }`（小）。stock CSS の後ろに足すだけ＝no-build。
   - full theme: `:root,[data-theme="light"]{…}` ＋ `[data-theme="dark"]{…}` の上書き（大きめ）。
3. **全 CSS (A)** — `buildTokensCss` 完全出力（stock 全部＋ユーザーテーマ）。token CSS 差し替え用・自己完結。

`@layer hc.tokens` の扱い（後ろ読み or 同レイヤ）を docs で明記。

---

## 3. 実装（依存関係順に PR 分割。各 PR は origin/main から分岐しマージ後に次へ）

### PR-A: 純粋トランスフォーマの切り出し（挙動不変・低リスク）
- 新規 `packages/core/scripts/token-transform.mjs`：`buildTokensCss` ＋ ヘルパ ＋ `DEFAULT_SOURCES`
  を **node 依存ゼロ**で配置。
- `build-tokens.mjs`：fs I/O ＋ CLI（main / emitOnly / CORE_/AXIS_NAMESPACES）を残し、
  `token-transform.mjs` から re-export（`test/tokens.test.mjs` の import は不変＝挙動保証）。
- `package.json` exports に `"./token-transform": "./scripts/token-transform.mjs"`、`files` に `scripts` 追加。
- 確認：`vitest` 緑、`build` 一致、`lint` 緑。

### PR-B: ビルダー修正 ＋ docs 訂正（= PR #157 の不具合修正）
- `ThemeBuilder.astro` を全面改修：
  - `import { buildTokensCss } from '@hypermedia-components/core/token-transform'`
  - `import * as trees from '@hypermedia-components/core/tokens/*.json'`（primitive/semantic/component/
    theme.dark/color.default/density.comfortable）
  - accent 入力 → 合成 `color.custom` ツリー → `buildTokensCss` → 該当ブロック抽出。
  - プレビュー：生成ブロックを一意属性に向けて `<style>` 注入（具体値なので subtree 安全）。
  - 3 ダウンロード（§2）＋コピー、Apply/Reset。
- `tokens/themes.mdx` Path A 訂正：semantic 7 個では効かない／サブツリー上書き不可の実態を明記し、
  「ビルダー生成ブロック」または Path B を正とする。
- `tokens/theme-builder.mdx` を改稿。CHANGELOG 更新。

### PR-C: neutral ramp ＋ full theme ＋ radius
- ランプ定義（`gray`=現行 primitive 値, `slate`/`zinc`/`neutral`/`stone`=標準 Tailwind）内蔵。
- full theme モード：ランプ → semantic surface/text/border/muted/secondary（light）＋ theme.dark（dark）
  を合成ツリーに反映 → `buildTokensCss` → §2 の (A)/(B)/DTCG を生成。
- radius ノブ（`--hc-control-radius`、フォーム系に作用＝「Control radius」表記）。
- light/dark 2 枚プレビュー。docs 追記・CHANGELOG。

### PR-D: 既存の凍結バグ修正（独立）
- `select.height` / `select.padding-x` / `multicombobox.control.min-height`（density）と
  `skeleton.bg` / `skeleton.highlight`（dark）の `var()` リテラルを `{ref}` へ統一し、
  各テーマブロックで具体値再出力されるよう修正（ネスト density / dark 時の凍結解消）。
- 確認：`vitest` 緑、`nested-density`/`nested-theme` spec 緑。

---

## 4. テスト / 検証
- PR-A 後も `test/tokens.test.mjs` 緑（挙動不変）。
- docs `astro build` 緑（PR-B/C）。
- 既存 `nested-theme.spec` / `nested-density.spec` 緑（全 PR 通じて挙動保証、PR-D で拡張的に担保）。
- 可能なら builder プレビューの最小 Playwright（primary bg が選択色に変わる回帰防止）。

## 5. DTCG 原則の整合
本方式は DTCG ソース → `buildTokensCss` 生成、を一切崩さない。カスタムテーマも DTCG 由来で生成する
ため、「DTCG token sources and generated CSS variables」を文字どおり満たす。
