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

- 現在は browser-mode では Node / npm / Google Chrome が必要です
- Electron デスクトップ版は別配布物として build 可能です
- 自動更新機能はまだありません
- `git clone` は前提ではありません
- GitHub Releases から zip をダウンロードして使う想定です
- 現在の Electron 配布物は `mac-arm64` / `win-arm64` / `win-x64` を想定しています

## 3. 導入方法

### 3.0 どの配布形態を使うか

現在は次の 2 系統があります。

- `Electron デスクトップ版`
  - `.app` / `.exe` / installer を使う
  - 外部 Chrome は不要
- `browser-mode`
  - `install-*` / `start-*` を使う
  - Node / npm / Chrome が必要

利用者向けの本線は、今後 `Electron デスクトップ版` です。

### 3.1 GitHub Releases から取得する

1. GitHub Releases から、自分の OS に合った配布物をダウンロードします
2. zip ファイルを展開します
3. 展開したフォルダを任意の場所へ置きます

推奨:

- `git clone` ではなく zip ダウンロードを使う
- 展開先は自分で分かりやすい場所に置く

### 3.2 Electron デスクトップ版の導入

#### macOS

1. `.dmg` を開きます
2. `memo4me.app` を `Applications` へ配置します
3. Finder から `memo4me.app` を起動します

前提:

- Apple Silicon (`arm64`) の Mac を想定しています

#### Windows

1. installer `.exe` を実行します
2. 画面の案内に従ってインストールします
3. インストール完了後、デスクトップまたはスタートメニューの `memo4me` から起動します

前提:

- ARM64 または x64 の Windows PC を想定しています

補足:

- 通常の利用者向けには installer `.exe` を配る前提です
- `win-arm64-unpacked/` は確認用の生成物で、通常配布の本線ではありません
- installer 完了画面からの自動起動は使わず、インストール後にショートカットから起動する前提です

補足:

- 個人データはアプリ本体とは別の保存先にあるため、通常の更新や再インストールでは消えません
- アンインストールしても、個人データは既定では残ります

### 3.3 browser-mode の初回セットアップ

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
- `node_modules` がない、または `package.json` / `package-lock.json` が更新されていれば `npm install`
- 毎回、最新ソースから本番ビルドを作り直す

## 4. 起動方法

### 4.1 Electron デスクトップ版

- macOS
  - `memo4me.app` を起動します
- Windows
  - インストール済みの `memo4me` を起動します

期待結果:

- Electron ウィンドウで `memo4me` が開く
- 外部 Chrome は不要
- 左上の `×` でアプリを閉じられる

### 4.2 browser-mode: macOS

1. `start-memo4me.command` をダブルクリックします
2. `memo4me` が起動し、Google Chrome が自動で開きます

### 4.3 browser-mode: Windows

1. `start-memo4me.bat` をダブルクリックします
2. `memo4me` が起動し、Google Chrome が自動で開きます

期待結果:

- アプリが `http://127.0.0.1:8787` で起動する
- Chrome にアプリ画面が表示される

### 4.4 終了方法

#### Electron デスクトップ版

1. 左上の `×` でウィンドウを閉じます
2. Electron と bundled backend が一緒に終了します

#### browser-mode

1. ブラウザタブを閉じます
2. 必要に応じて起動元ターミナルやランチャー側も終了します

補足:

- Electron 版では、`×` がそのままアプリ終了につながります
- browser-mode は Electron 版とは別の確認導線です

### 4.5 テーマ切り替え

1. 歯車ボタンから `テーマ` を開きます
2. `Soft Editorial`、`Neo Workspace`、`Modern Oasis` から選びます
3. その場で見た目が切り替わります

補足:

- テーマ設定はローカルに保存されます
- 次回起動時も前回のテーマが引き継がれます

### 4.6 ワークスペース切り替え

1. Header の `メモ` / `タスク` タブでワークスペースを切り替えます
2. `メモ` ではメモ一覧と本文編集、関連タスクの確認を行います
3. `タスク` では左のダッシュボードと右の管理キャンバスでタスクを扱います

補足:

- `メモ` 画面の `関連タスク` から `タスク` ワークスペースへ直接移動できます
- `タスク` では `未着手 / 進行中` を常時表示し、`完了` は `完了一覧` から確認できます
- `新規タスク` はタスク追加モーダルから作成します
- タスク一覧の左チェックは `今日やる` の設定に使います
- `今日やるのみ` フィルターで当日着手したいタスクだけを絞り込めます
- タスクには `想定工数[H]` と `進捗率[%]` を設定できます
- `進捗率` は `0%〜100%` を `5%` 刻みで操作し、`0%=未着手 / 5-95%=進行中 / 100%=完了` として扱われます
- ダッシュボードの炎上予報は、工数と進捗率から計算した日別必要時間を `週間 / 月間` で確認できます
- 予報カードを押すと、その日の負荷の内訳タスクを確認できます
- タスク詳細の `元メモ` から `メモ` ワークスペースへ戻れます

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

### 8.1 Electron デスクトップ版の更新

1. 新しい配布物をダウンロードします
2. macOS は新しい `memo4me.app` に差し替えます
3. Windows は新しい installer を実行して上書きします

補足:

- DB はユーザーディレクトリ配下にあるため、通常は更新後も引き継がれます
- アプリ本体だけを入れ替えても、個人データはそのまま残ります

### 8.2 browser-mode の更新

更新手順:

1. GitHub Releases から新しい zip をダウンロードする
2. 新しいフォルダへ展開する
3. 必要なら旧フォルダを退避または削除する
4. 新しいフォルダで `install-*` を一度実行する
5. `start-*` で起動する

補足:

- ローカル DB はユーザーディレクトリ配下に保存されるため、通常はアプリ更新で消えません
- `install-*` は毎回 build を作り直すため、pull や差し替え後の最新 UI を反映できます
- DB 項目追加などの更新は、`start-*` 実行時に migration で反映されます
- ただし、更新前にバックアップを取りたい場合は DB ファイルを別途保存してください

## 9. AI 機能の使い方

### 9.1 AI設定を開く

1. アプリ上部の歯車ボタンを押します
2. メニューから `AI設定` を開きます
3. 使用したい provider を選びます
4. `モデル` と `APIキー` を入力します
5. 必要なら `Endpoint` を確認または入力します
6. `接続テスト` で接続確認します
7. 問題なければ `設定を保存` を押します

### 9.2 対応 provider

- `OpenAI互換`
  - 既定 Base URL: `https://api.openai.com/v1`
  - OpenAI 形式の API に使います
- `Azure OpenAI`
  - エンドポイントはユーザーごとの Azure resource に依存します
  - 例: `https://<resource>.openai.azure.com/openai/v1`
- `Gemini`
  - 既定 Base URL: `https://generativelanguage.googleapis.com/v1beta`

provider ごとの key / エンドポイント / モデル の取得方法は、次のガイドを参照してください。

- [AI Provider 設定ガイド](./ai-provider-setup.md)

### 9.3 API キーについて

ルール:

- API キーは provider ごとに設定します
- 既に保存済みのキーは再表示されません
- 置き換えたい場合だけ新しいキーを入力します
- 削除したい場合は `保存済みキーを削除` を使います

補足:

- macOS では Keychain
- Windows では DPAPI

を使う想定です

### 9.4 AIアシスタントの使い方

1. メモを開きます
2. 右ペイン上部の `AI` を押します
3. 次のいずれかを選びます

- `要約`
- `構造化`
- `タスク抽出`
- `自由入力`

結果に対しては次ができます。

- 本文へ反映
- 新しいメモとして保存
- クリップボードへコピー
- `タスク抽出` ではタスク候補を確認して `タスク` へ保存

### 9.5 よくある AI エラー

`APIキーが未設定です`

- AI設定で対象 provider の APIキー を保存してください

`モデルが未設定です`

- AI設定で対象 provider の モデル を入力してください

`エンドポイントが未設定です`

- 特に Azure OpenAI では エンドポイント の入力が必要です

`AI 呼び出しに失敗しました`

- provider
- モデル
- エンドポイント
- APIキー

を確認して、`Test connection` を先に通してください

## 10. FAQ

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
