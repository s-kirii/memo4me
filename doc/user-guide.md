# memo4me 利用ガイド

## 1. このガイドの対象

このガイドは、`memo4me` を実際に使う利用者向けの手順書です。

対象:

- macOS または Windows で `memo4me` を起動したい人
- コマンド操作をなるべく避けたい人
- Git や `git clone` を使わずに導入したい人

## 2. 前提

現在の `memo4me` は、以下が入っていることを前提にしています。

- Node.js
- npm
- Google Chrome

補足:

- 現在は Node 同梱版ではありません
- 自動更新機能はまだありません
- `git clone` は前提ではありません
- GitHub Releases から zip をダウンロードして使う想定です

## 3. 導入方法

### 3.1 GitHub Releases から取得する

1. GitHub Releases から、自分の OS に合った配布物をダウンロードします
2. zip ファイルを展開します
3. 展開したフォルダを任意の場所へ置きます

推奨:

- `git clone` ではなく zip ダウンロードを使う
- 展開先は自分で分かりやすい場所に置く

### 3.2 初回セットアップ

#### macOS

1. `install-memo4me.command` をダブルクリックします
2. 必要な確認とセットアップが自動で進みます
3. 完了後にウィンドウを閉じます

#### Windows

1. `install-memo4me.bat` をダブルクリックします
2. 必要な確認とセットアップが自動で進みます
3. 完了後にウィンドウを閉じます

セットアップで行うこと:

- Node / npm / Chrome の存在確認
- `node_modules` がなければ `npm install`
- build 成果物がなければ本番ビルド作成

## 4. 起動方法

### 4.1 macOS

1. `start-memo4me.command` をダブルクリックします
2. `memo4me` が起動し、Google Chrome が自動で開きます

### 4.2 Windows

1. `start-memo4me.bat` をダブルクリックします
2. `memo4me` が起動し、Google Chrome が自動で開きます

期待結果:

- アプリが `http://127.0.0.1:8787` で起動する
- Chrome にアプリ画面が表示される

## 5. Chrome について

`memo4me` は Google Chrome 前提で起動します。

ルール:

- Chrome が見つかった場合のみ起動する
- Chrome が見つからない場合は起動失敗になる
- 別ブラウザへ自動フォールバックはしません

## 6. Chrome が見つからない場合の対処

### 6.1 共通

以下の点を確認してください。

- Google Chrome がインストール済みか
- Chrome を通常どおり起動できるか
- 標準的な場所にインストールされているか

### 6.2 Windows

確認コマンド:

```powershell
where chrome.exe
```

標準的な確認先:

- `C:\Program Files\Google\Chrome\Application\chrome.exe`
- `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`
- `%LocalAppData%\Google\Chrome\Application\chrome.exe`

### 6.3 macOS

標準的な確認先:

- `/Applications/Google Chrome.app`
- `~/Applications/Google Chrome.app`

確認コマンド:

```bash
node scripts/chrome-launcher.mjs find
```

このコマンドでパスが表示されれば、Chrome 探索は通っています。

## 7. よくあるエラー

### `Chrome is required but was not found.`

原因:

- Chrome 未インストール
- 標準的でない場所にインストールされている
- 利用端末の制限で探索できない

対処:

- Chrome をインストールする
- 標準的な場所に入っているか確認する
- Windows では `where chrome.exe` を確認する

### `Node.js is required but was not found.`

原因:

- Node.js が未インストール

対処:

- Node.js をインストールする
- その後、再度 `install-*` を実行する

### 起動したが画面が表示されない

確認先:

```text
http://127.0.0.1:8787
```

API 生存確認:

```text
http://127.0.0.1:8787/api/health
```

期待レスポンス:

```json
{"status":"ok"}
```

## 8. 更新方法

現在は自動更新機能はありません。

更新手順:

1. GitHub Releases から新しい zip をダウンロードする
2. 新しいフォルダへ展開する
3. 必要なら旧フォルダを退避または削除する
4. 新しいフォルダで `install-*` を一度実行する
5. `start-*` で起動する

補足:

- ローカル DB はユーザーディレクトリ配下に保存されるため、通常はアプリ更新で消えません
- ただし、更新前にバックアップを取りたい場合は DB ファイルを別途保存してください

## 9. FAQ

### `git clone` は必要ですか？

不要です。  
利用者向けには GitHub Releases の zip ダウンロードを前提にしています。

### 初回に何をダブルクリックすればよいですか？

- 初回: `install-*`
- 2 回目以降: `start-*`

### 毎回 `install-*` を実行する必要はありますか？

通常は不要です。  
更新後や、依存関係に問題があるときだけ再実行してください。

### メモのデータはどこに保存されますか？

ローカルの SQLite に保存されます。

- macOS: `~/Library/Application Support/memo4me/app.db`
- Windows: `%AppData%/memo4me/app.db`
