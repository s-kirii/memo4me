# memo4me リリース運用ガイド

## 1. 目的

このドキュメントは、`memo4me` の配布と更新を行う人向けの運用メモです。

対象:

- GitHub Releases を作成する人
- 利用者向け配布物を整える人

## 2. 現在の配布方針

現状は以下の方針です。

- GitHub Releases で zip 配布する
- Node.js は同梱しない
- 利用者環境に `Node.js`, `npm`, `Google Chrome` がある前提
- 利用者は `install-*` と `start-*` をダブルクリックして使う

## 3. 配布物に含めるもの

最低限含めるもの:

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
- `README.md`
- `doc/user-guide.md`

## 4. Releases 作成フロー

### 4.1 事前確認

1. 作業ブランチの変更内容を確認する
2. 必要なドキュメント更新が含まれているか確認する
3. `frontend` / `backend` の build が通ることを確認する

推奨確認コマンド:

```bash
node scripts/build-app.mjs
```

### 4.2 配布物の準備

1. リポジトリの内容を配布用フォルダへまとめる
2. 不要なものを含めない
3. OS 別の zip を作る

注意:

- `node_modules`
- `frontend/dist`
- `backend/dist`
- ローカル DB
- `.env`

は不要です。

利用者側の `install-*` が依存導入と build を行います。

### 4.3 zip の分け方

現実的には次のように分けます。

- `memo4me-mac.zip`
- `memo4me-win.zip`

両者の中身はほぼ同じでよいですが、利用ガイドの案内を OS ごとに変えてもよいです。

### 4.4 GitHub Releases 公開

1. Release タグを作る
2. Release ノートを書く
3. OS 別 zip を添付する
4. 利用ガイドへの導線を載せる

## 5. Release ノートに書くべきこと

- 今回の変更概要
- Chrome 必須であること
- Node / npm が必要であること
- 初回は `install-*` を実行すること
- 更新時は新しい zip を展開して使うこと
- 自動更新はまだないこと

## 6. 更新運用

現在は自動更新なしのため、更新は手動です。

利用者向け案内:

1. 新しい Release の zip をダウンロード
2. 別フォルダへ展開
3. `install-*` を実行
4. `start-*` で起動

補足:

- DB はユーザーディレクトリ配下にあるため、通常は更新時も引き継がれます

## 7. 実機で確認したい項目

このドキュメント上では整理のみ行い、実機確認は別タスクとする。

特に以下は重要:

- Windows 社用 PC で `install-memo4me.bat` が通るか
- Windows 社用 PC で `start-memo4me.bat` が Chrome を開けるか
- GitHub Releases からダウンロードした zip でそのまま導入できるか
- 更新版へ差し替えたときに DB が保たれるか

## 8. 将来方針

将来的には次を検討する。

- Node ランタイム同梱
- インストーラ寄りの GUI セットアップ
- 自動更新導線
- Electron による `.app` / `.exe` 化
