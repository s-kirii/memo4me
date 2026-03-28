# memo4me

`memo4me` は、Notion ライクな編集体験を持つローカル完結のメモアプリです。

設計資料:

- [基本設計](./doc/design.md)
- [詳細設計](./doc/detail-design.md)
- [利用ガイド](./doc/user-guide.md)
- [AI Provider 設定ガイド](./doc/ai-provider-setup.md)
- [リリース運用ガイド](./doc/release-guide.md)

## 開発構成

- `frontend`: `React + Vite + TypeScript`
- `backend`: `Node.js + TypeScript`
- `electron`: Electron shell (`main` / `preload`)
- `doc`: 設計資料

## 開発環境

必要なもの:

- Node.js
- npm
- Google Chrome

## 初回セットアップ

```bash
cd frontend
npm install
```

```bash
cd backend
npm install
```

## 開発時の起動方法

最短で確認したい場合は、ルートで以下を実行する。

```bash
./dev.sh
```

このスクリプトは以下を行う。

- backend を起動する
- frontend を起動する
- `scripts/chrome-launcher.mjs` で Chrome を探索して `http://127.0.0.1:5173` を開く

個別に起動したい場合は、以下の手順でもよい。

1. バックエンドを起動する

```bash
cd backend
npm run dev
```

2. フロントエンドを起動する

```bash
cd frontend
npm run dev
```

3. ブラウザで以下を開く

```text
http://localhost:5173
```

Electron shell で確認したい場合は、ルートで以下を実行する。

```bash
npm run electron:dev
```

このコマンドは以下を行う。

- backend の dev server を起動する
- frontend の Vite dev server を起動する
- Electron ウィンドウで `http://127.0.0.1:5173` を開く
- Electron 終了時は backend も一緒に停止する

## 本番向けビルドと起動

ビルド済みフロントを backend から配信する形で確認したい場合は、ルートで以下を実行する。
これは `Chrome 起動ベースの browser-mode` 確認手順として残している。

1. 本番ビルドを作成する

```bash
node scripts/build-app.mjs
```

2. アプリを起動する

```bash
node scripts/start-app.mjs
```

この起動方法では以下を行う。

- `frontend/dist` と `backend/dist` を前提に起動する
- backend が `frontend/dist` を静的配信する
- `http://127.0.0.1:8787` を Chrome で開く
- DB はユーザーディレクトリ配下の `app.db` を利用する

Chrome が見つからない場合は起動失敗になる。

Electron の本番用 shell まで含めて build したい場合は、ルートで以下を実行する。

```bash
npm run electron:build
```

このコマンドは以下を行う。

- `frontend/dist` と `backend/dist` を再 build する
- Electron の配布物を `dist-electron/` に出力する
- Electron 起動時は bundled backend を内部起動し、外部 Chrome は不要
- Electron 版はウィンドウ左上の `×` でアプリと bundled backend をまとめて終了する

生成物の例:

- macOS
  - `dist-electron/mac-arm64/memo4me.app`
  - `dist-electron/memo4me-1.0.2-mac-arm64.dmg`
- Windows
  - `dist-electron/memo4me-1.0.2-win-arm64.exe`
  - `dist-electron/memo4me-1.0.2-win-x64.exe`

現在の前提環境:

- macOS
  - Apple Silicon (`arm64`) 前提
  - 生成物は `mac-arm64` 向け
- Windows
  - ARM64 または x64 前提
  - 生成物は `win-arm64` / `win-x64` 向け

補足:

- Apple Silicon 以外の macOS 配布物もまだ未対応
- Windows の通常配布は installer `.exe` を使う
- `win-arm64-unpacked/` は確認用の生成物で、利用者配布の本線ではない
- Windows installer は、完了画面の自動起動ではなくインストール後のショートカット起動を前提にする

## AI 機能の現在地

現状は、AI の実行基盤と初期 UI まで入っている。

- 設定メニューから `AI設定` を開ける
- 設定メニューからテーマを切り替えられる
- 設定メニューから `進捗計算` を開き、`全日ベース / 稼働日ベース` を切り替えられる
- Header の `メモ` / `タスク` タブでワークスペースを切り替えられる
- 右ペイン上部の `AIアシスタント` から AIアシスタント モーダルを開ける
- `タスク` ワークスペースでタスクを広い画面で管理できる
- `メモ` 画面には `関連タスク` セクションがあり、このメモ由来のタスクをすぐ開ける
- `新規タスク` は専用モーダルから追加できる
- タスク一覧の左チェックは、`着手日以降なら今日やる対象` であることを示す自動表示として使われる
- タスクには `想定工数[H]` と `進捗率[%]` を設定できる
- `進捗率` は `0%〜100%` を `5%` 刻みで操作でき、`0%=未着手 / 5-95%=進行中 / 100%=完了` として扱われる
- タスクダッシュボードの状況サマリーは `今日やる` タスク専用で、`今日のスプリント達成率` を単一指標で表示する
- 状況サマリーは `P_ij - T_i(j-1)` と `T_ij - T_i(j-1)` を使い、想定工数で重み付けしたその日のスプリント達成率として表示する
- タスクダッシュボードは現在の絞り込み条件に合わせて再集計される
- 炎上予報は工数と進捗率から残工数を計算し、週間 / 月間で日別の必要時間を表示できる
- `要約` / `構造化` / `タスク抽出` / `自由入力` を実行できる
- 結果はメモ単位で履歴保存される
- `タスク抽出` 実行後は AI のタスク候補を確認して選択保存できる
- AI 保存タスクは `タスク` ワークスペースで `AI` バッジ付きで表示される
- `タスク` 画面の詳細表示から `元メモ` を開いて `メモ` ワークスペースへ戻れる

補足:

- 実行には API キー設定が必要
- 対応 provider は `OpenAI互換` / `Azure OpenAI` / `Gemini`
- `OpenAI互換` / `Azure OpenAI` では `API互換モード` として `auto / responses / chat/completions` を選べる
- タスク管理は独立ワークスペース化済み
- 各 provider の key / endpoint / model の取得方法は [AI Provider 設定ガイド](./doc/ai-provider-setup.md) を参照

## ダブルクリック起動用ランチャー

利用者向けには、Node スクリプトを直接打たずに次のランチャーを使える。

- macOS:
  - `install-memo4me.command`
  - `start-memo4me.command`
- Windows:
  - `install-memo4me.bat`
  - `start-memo4me.bat`

役割:

- `install-*`
  - Node / npm / Chrome の存在確認
  - `node_modules` がない、または `package.json` / `package-lock.json` が更新されていれば `npm install`
  - 毎回 `node scripts/build-app.mjs` を実行して最新ソースから build し直す
- `start-*`
  - `node scripts/start-app.mjs` を呼び出し
  - backend 起動、静的フロント配信、Chrome 起動を行う

まず初回は `install-*` を実行し、その後 `start-*` で起動する。

補足:

- リポジトリを `pull` したあとも、`install-*` を一度実行すると最新 UI / 最新 build が反映される
- DB スキーマ変更を含む更新は、`start-*` 実行時に backend 起動処理の migration で反映される

本番起動後は、画面上部の電源ボタン `⏻` を押すとアプリを安全終了できる。終了後、タブは自動で閉じない場合があるため、その場合は画面の案内に従って手動で閉じる。

## デスクトップ配布の現在地

当面の本線は `Electron + installer` です。

- macOS は `.app` と `.dmg`
- Windows は `memo4me.exe` と NSIS installer
- 更新は当面 `手動更新`
- 個人データはアプリ本体とは別保存なので、更新後も維持される前提

補足:

- デスクトップ配布物固有の責務
  - Electron shell
  - installer
  - OS ごとのアイコン / 配布形式
- 将来 Web 版とも共有したい責務
  - React UI
  - backend API / service / repository
  - SQLite schema
  - AI 実行ロジック

## GitHub 配布の最小構成

browser-mode / 旧ランチャー方式の最小構成は以下を想定する。

- ソースコード一式
- `frontend/package-lock.json`
- `backend/package-lock.json`
- `install-memo4me.command`
- `start-memo4me.command`
- `install-memo4me.bat`
- `start-memo4me.bat`
- `scripts/build-app.mjs`
- `scripts/install-app.mjs`
- `scripts/start-app.mjs`
- `scripts/chrome-launcher.mjs`
- 本 README

利用者は以下を行う。

1. 配布物を展開する
2. `install-*` をダブルクリックする
3. `start-*` をダブルクリックする

Windows でも Node.js と npm が入っていれば同じ考え方で起動できる想定だが、実機確認は別途必要。

デスクトップ版では、上記とは別に `dist-electron/` 配下の `.app` / `.exe` / installer を配布対象とする。

## Node 非同梱の暫定方針と将来方針

現状は `Node.js` を配布物に同梱しない暫定構成である。

つまり利用者環境には以下が必要:

- Node.js
- npm
- Google Chrome

当面の配布改善方針は `Electron + installer` を本線とする。

- Chrome 外部起動はやめて、アプリ内ウィンドウで表示する
- ユーザーに Node / npm を意識させない
- 更新方式はまず `手動更新`
- 個人データはアプリ本体と分離したまま維持する
- アンインストール時も、既定では個人データは削除しない

将来的には以下も比較対象として残す。

- 自動更新の追加
- より洗練された installer / 配布導線
- 必要に応じた Node ランタイム同梱配布の再検討

## 将来の展開候補

将来の配布・運用方針としては、現在次の 3 案を比較対象としている。

### 1. `.app` / `.exe` 化

- 最も配りやすく、利用者にとって自然な配布形態
- Node / npm やブラウザ起動方式を意識させにくい
- 一方で Electron などを前提に、起動方式・更新方式・配布手順の再設計が必要

### 2. Node 同梱版

- 現在の `React + Node.js + SQLite` 構成を大きく崩さずに配布障壁を下げやすい
- Node 未導入端末にも対応しやすい
- ただし `.app` / `.exe` ほどアプリらしい体験にはなりにくい

### 3. Web サービス化

- 配布不要で複数端末からアクセスしやすい
- ただし認証、認可、秘密情報管理、BYOK、運用保守などの論点が一気に増える
- `memo4me` の強みであるローカル完結性とは少し方向が変わる

現時点では、ローカル完結と BYOK の扱いやすさを優先し、`ローカルアプリ寄り` を基本路線としている。
具体的には、まず `Electron + installer` を採用し、将来 Web 化する場合でも React フロントエンドと backend の業務ロジックをできるだけ共通資産として維持する方針で進める。
当面 `start-app.mjs` 系は browser-mode / 検証用の導線として残し、デスクトップ本線は Electron 側へ寄せていく。

## テーマ切り替え

- 設定メニューの `テーマ` から `Soft Editorial` / `Neo Workspace` / `Modern Oasis` を切り替えられる
- テーマ設定は `localStorage` に保存され、次回起動時にも復元される
- 現在は `色 / 角丸 / 影 / 背景 / ボタン質感` のみ切り替える
