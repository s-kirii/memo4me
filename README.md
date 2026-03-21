# memo4me

`memo4me` は、Notion ライクな編集体験を持つローカル完結のメモアプリです。

設計資料:

- [基本設計](/xxxxx/memo4me/doc/design.md)
- [詳細設計](/xxxxx/memo4me/doc/detail-design.md)
- [利用ガイド](/xxxxx/memo4me/doc/user-guide.md)
- [リリース運用ガイド](/xxxxx/memo4me/doc/release-guide.md)

## 開発構成

- `frontend`: `React + Vite + TypeScript`
- `backend`: `Node.js + TypeScript`
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

## 本番向けビルドと起動

ビルド済みフロントを backend から配信する形で確認したい場合は、ルートで以下を実行する。

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

## AI 機能の現在地

現状は、AI の実行基盤と初期 UI まで入っている。

- Header の `AI Settings` から provider 設定を開ける
- 右ペイン上部の `AI` から AI Assistant モーダルを開ける
- Header の `Tasks` からタスクリストモーダルを開ける
- Header の `Exit` から本番起動中のアプリ全体を終了できる
- `Summary` / `Structure` / `Action items` / `Quick prompt` を実行できる
- 結果はメモ単位で履歴保存される
- `Action items` 実行後は AI task candidates を確認して選択保存できる
- AI 保存タスクは `Tasks` モーダルで `AI` バッジ付きで表示される

補足:

- 実行には API キー設定が必要
- 対応 provider は `OpenAI-compatible` / `Azure OpenAI` / `Gemini`
- タスクリストは独立モーダルとして追加済み

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
  - `node_modules` がなければ `npm install`
  - build 成果物がなければ `node scripts/build-app.mjs`
- `start-*`
  - `node scripts/start-app.mjs` を呼び出し
  - backend 起動、静的フロント配信、Chrome 起動を行う

まず初回は `install-*` を実行し、その後 `start-*` で起動する。

本番起動後は、画面上部の `Exit` を押すとアプリを安全終了できる。終了後、タブは自動で閉じない場合があるため、その場合は画面の案内に従って手動で閉じる。

## GitHub 配布の最小構成

現時点の最小構成は以下を想定する。

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

## Node 非同梱の暫定方針と将来方針

現状は `Node.js` を配布物に同梱しない暫定構成である。

つまり利用者環境には以下が必要:

- Node.js
- npm
- Google Chrome

将来的には以下を検討する。

- Node ランタイム同梱配布
- よりインストーラ寄りの GUI セットアップ
- 更新ランチャーの追加
