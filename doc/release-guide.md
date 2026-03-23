# memo4me リリース運用ガイド

## 1. 目的

このドキュメントは、`memo4me` の配布と更新を行う人向けの運用メモです。

対象:

- GitHub Releases を作成する人
- 利用者向け配布物を整える人

## 2. 現在の配布方針

現在の本線は `Electron + installer` です。

- macOS
  - `.app`
  - `.dmg`
- Windows
  - `memo4me.exe`
  - installer `.exe`

補足:

- `install-*` / `start-*` は browser-mode の確認導線として残す
- 自動更新はまだ入れない
- アプリ本体と個人データは分離して保持する
- 将来 Web 版も見据え、配布物固有ロジックは Electron shell に閉じ込める
- 現在の配布物は `mac-arm64` / `win-arm64` 前提で作成している
- Intel / AMD 向け Windows (`x64`) はまだ未対応

## 3. 配布物に含めるもの

### 3.1 Electron デスクトップ版

想定する配布物:

- macOS
  - `memo4me.app`
  - `memo4me-<version>-mac-arm64.dmg`
- Windows
  - `memo4me-<version>-win-arm64.exe`

補足:

- `dist-electron/` の生成物を元に配布する
- Windows installer は NSIS
- `win-arm64-unpacked/` は確認用の生成物として残る
- 利用者向けの通常配布は installer `.exe` を使う
- installer 完了画面からの自動起動には依存せず、インストール後のショートカット起動を案内する

### 3.2 browser-mode

旧来の配布物は browser-mode 用に残す。

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
- `doc/ai-provider-setup.md`

## 4. Releases 作成フロー

### 4.1 事前確認

1. 作業ブランチの変更内容を確認する
2. 必要なドキュメント更新が含まれているか確認する
3. `frontend` / `backend` の build が通ることを確認する
4. Electron 配布物が生成できることを確認する

推奨確認コマンド:

```bash
npm run electron:build:mac
npm run electron:build:win
```

### 4.2 配布物の準備

1. `npm run electron:build:mac` / `npm run electron:build:win` を実行する
2. `dist-electron/` の成果物を確認する
3. 配布対象だけを Release に添付する

主な確認対象:

- `dist-electron/mac-arm64/memo4me.app`
- `dist-electron/memo4me-<version>-mac-arm64.dmg`
- `dist-electron/memo4me-<version>-win-arm64.exe`

前提環境:

- macOS: Apple Silicon (`arm64`)
- Windows: ARM64

配布対象外:

- `latest.yml`
- `*.blockmap`
- ローカル DB
- `.env`
- build の途中生成物

### 4.3 GitHub Releases 公開

1. Release タグを作る
2. Release ノートを書く
3. OS 別配布物を添付する
4. 利用ガイドへの導線を載せる

## 5. Release ノートに書くべきこと

- 今回の変更概要
- macOS は `.dmg` / `.app`、Windows は installer `.exe` を使うこと
- 外部 Chrome は不要であること
- Node / npm を利用者に要求しないこと
- 更新時は新しい配布物でアプリ本体を差し替えること
- 自動更新はまだないこと
- 個人データは通常そのまま引き継がれること

## 6. 更新運用

現在は自動更新なしのため、更新は手動です。

利用者向け案内:

- macOS
  1. 新しい `.dmg` をダウンロード
  2. 新しい `memo4me.app` に差し替える
- Windows
  1. 新しい installer `.exe` をダウンロード
  2. そのまま実行して上書きする

補足:

- DB はユーザーディレクトリ配下にあるため、通常は更新時も引き継がれます
- アンインストールしても、既定では個人データは削除しません

## 7. 実機で確認したい項目

このドキュメント上では整理のみ行い、実機確認は別タスクとする。

特に以下は重要:

- macOS で `.app` を Finder から起動できるか
- Windows で installer `.exe` からインストールできるか
- Windows でショートカット起動できるか
- 更新版へ差し替えたときに DB が保たれるか
- アンインストール後もデータを再利用できるか

## 8. 将来方針

将来的には次を検討する。

- 自動更新導線
- 署名 / notarization
- 配布アーティファクトの整理
- 必要に応じた browser-mode の縮退

### 8.1 配布方式の比較観点

将来の配布方式は、次の 3 案で比較して判断する。

#### A. `.app` / `.exe` 化

- 利用者体験は最も良い
- Node / npm を意識させずに配布しやすい
- 署名、配布サイズ、Electron 化など追加作業は重い

#### B. Node 同梱版

- 現在の構成を活かしやすい
- Node 未導入端末への配布障壁を下げられる
- 配布体験は改善するが、完全なネイティブアプリほど自然ではない

#### C. Web サービス化

- URL 配布だけで済み、複数端末からアクセスしやすい
- 一方で認証、認可、秘密管理、BYOK、安全性、運用保守の論点が大きく増える
- 現在のローカル完結前提とは別系統の再設計になる

現時点の `memo4me` はローカル完結が主軸のため、優先度としては `.app` / `.exe` 化が先で、Web サービス化は別 PJ として扱う前提である。
