# memo4me 詳細設計書

## 1. このドキュメントの目的

本書は、[design.md](./design.md) を前提に、実装者が解釈で迷わずに着手できる粒度まで仕様を具体化することを目的とする。

本書では以下を定義する。

- 画面ごとの UI と状態遷移
- Notion ライクな編集体験の具体的なルール
- API 契約
- DB スキーマ詳細
- フロントエンドとバックエンドの責務分離
- 自動保存、エラー、空状態、配布の仕様
- MVP 完了の判定基準

## 2. 対象範囲

本書は、現在のアプリ本体実装と、その周辺の配布導線を対象にする。

現状含まれるもの:

- ローカル Web アプリとしての起動
- メモの作成、閲覧、編集、削除
- タグ管理
- 検索、絞り込み、並び替え
- Tiptap による Notion ライクな編集体験
- SQLite へのローカル保存
- Windows 社用 PC を含む複数 PC での利用を意識した配布導線
- AI 設定モーダル
- AI アシスタントによる要約、構造化、タスク抽出、自由入力
- `メモ` / `タスク` ワークスペース切り替え
- タスクダッシュボードとタスク管理キャンバス
- テーマ切り替え

現状含めないもの:

- 外部同期
- 複数ユーザー
- 権限管理
- 画像添付
- テーブル DB、リレーション DB、カスタムプロパティ
- モバイル最適化

## 3. 前提と参照資料

### 3.1 参照資料

- [design.md](./design.md)

### 3.2 前提

- フロントエンドは `React + Vite + TypeScript`
- エディタは `Tiptap`
- バックエンドは `Node.js + TypeScript`
- DB は `SQLite`
- ブラウザは `Google Chrome` 前提で開く
- API は `127.0.0.1` でのみ待ち受ける
- 将来 Go 移行を考慮し、フロントエンドは HTTP API のみに依存する

### 3.3 現在の確定事項

- 削除は `論理削除ではなく物理削除`
- 検索は `大文字小文字を区別しない部分一致`
- ローカル保存先は `ユーザーデータディレクトリ配下`
- ブラウザ起動は `Chrome 前提`
- Chrome が見つからない場合は起動失敗とする
- タスクリストは実装済み
- AI アシスタントは実装済み
- タスク管理は `独立ワークスペース` を主とし、完了確認のみ補助モーダルを使う

## 4. 画面一覧

MVP で扱う画面状態は以下。

- メイン画面
- タスク画面
- メモ未選択状態
- 新規メモ作成直後
- 検索結果表示
- タグ絞り込み表示
- 保存中、保存完了、保存失敗表示

実装としてはルーティングを増やしすぎず、単一画面内のワークスペース切り替えで表現する。

## 5. 画面詳細

### 5.1 メイン画面

メモ画面は 2 カラムで構成する。

- Header:
  - アプリ名表示
  - `メモ` / `タスク` ワークスペースタブ
  - `新規メモ` ボタン
  - 設定メニュー
  - 終了ボタン
- 左カラム:
  - 絞り込み検索
  - 並び替えセレクト
  - タグフィルタ
  - メモ一覧
- 右カラム:
  - タイトル入力欄
  - 更新日時表示
  - 保存状態表示
  - `AIアシスタント` ボタン
  - 選択テキストがある場合の `選択範囲をタスク化` ボタン
  - 削除ボタン
  - タグ編集 UI
  - `関連タスク` セクション
  - `このメモのタスクを管理` 導線
  - 本文開始を示す区切り線
  - リッチテキストエディタ

表示ルール:

- 左カラム幅は固定寄り、右カラムは可変とする
- 左カラムの `Filters` 領域は固定し、`NoteList` のみスクロールする
- 左カラムと右カラムのスクロールは独立させる
- 一覧の各行には `タイトル`、`抜粋(2行程度)`、`更新日時` を表示する
- 一覧の各行にはタグを 1 件まで補助表示してよい
- タイトル未入力メモは一覧上 `Untitled` と表示する
- 右カラムは常に 1 件のメモにフォーカスする

### 5.2 タスク画面

タスク画面は `左: ダッシュボード` `右: タスク管理キャンバス` の 2 領域で構成する。

- Header:
  - `メモ` / `タスク` ワークスペースタブ
  - `新規タスク` ボタン
  - 設定メニュー
  - 終了ボタン
- 左領域:
  - 常時表示のダッシュボード
  - 全体進捗
  - タグ別消化状況
  - 炎上予報
- 右領域:
  - `新規タスク` ボタンから開くタスク作成モーダル
  - 検索
  - タグ絞り込み
  - `今日やるのみ` フィルタ
  - 並び替え
  - `未着手 / 進行中` の 2 セクション同時表示
  - `完了` は必要時にモーダル表示
  - 各タスクは 1 行表示
  - 必要時のみ詳細展開

表示ルール:

- 左領域は固定幅の常時表示ダッシュボードとする
- 左ダッシュボードの集計は、現在の検索・タグ・元メモ・`今日やる` フィルタ条件に合わせて再計算する
- 右領域は `大きな詳細ペイン` ではなく、状態別の管理キャンバスとする
- 右領域では `未着手 / 進行中` を同時表示し、`完了` は補助モーダルで確認する
- 各タスク行は `今日やるチェック / タイトル / 期日 / タグ / 展開ボタン` を基本構成とする
- `今日やる` は完了タスクでは自動解除し、完了タスクには設定できない
- 展開したタスクのみ、状態変更、元メモ紐付け、着手目標、期日、タグ、2行メモを編集可能とする
- タスク詳細の `元メモ` から `メモ` ワークスペースへ戻れるようにする

### 5.3 メモ未選択状態

メモが 0 件のとき、または起動直後に選択対象がないときの状態。

表示内容:

- 右カラム中央に空状態メッセージを表示する
- メモ 0 件時と未選択時でメッセージを分岐する

ルール:

- 右カラムに編集 UI は表示しない
- 新規メモ作成ボタンは常に活性

### 5.4 新規メモ作成時

新規メモ作成ボタン押下時の仕様。

処理:

1. 空メモを作成する API を呼ぶ
2. 作成成功後、そのメモを選択状態にする
3. 右カラムを編集可能状態にする

初期値:

- title: 空文字
- contentMd: 空文字
- tags: 空配列

表示:

- 作成後は一覧を再取得し、新規メモを選択する
- 右カラムは即座に編集可能とする

### 5.4 検索結果表示時

検索ボックス入力時は 300ms 程度の debounce を入れて検索する。

表示ルール:

- 検索対象は `title`, `content_plain`, `tags.name`
- 条件に一致したメモのみ一覧に表示する
- ヒット 0 件時は一覧部に `一致するメモはありません` を表示する
- 検索中も現在選択メモの編集は継続できる

### 5.5 タグ絞り込み時

タグクリックまたはタグフィルタ選択時の仕様。

表示ルール:

- 指定タグを持つメモのみ一覧表示する
- タグ絞り込みと検索語は同時適用する
- MVP ではタグ条件は 1 つのみとする

### 5.6 保存中・保存完了・保存失敗時

保存状態は右カラム上部に小さく表示する。

状態:

- `保存中...`
- `保存完了`
- `保存失敗`
- `準備完了`

表示ルール:

- 初期状態および保存済み安定状態では `準備完了` を表示する
- 現状実装では保存成功後に `保存完了` を表示し、次回変更まで保持してよい
- 保存失敗時は赤系の視認しやすい表示にする
- 保存失敗中も入力内容はフロントエンド state に保持する

## 6. ユーザーフロー

### 6.1 初回起動からメモ閲覧まで

1. ユーザーがランチャーを起動する
2. ローカル API サーバーが起動する
3. ブラウザでアプリを開く
4. フロントエンドが `GET /api/notes` と `GET /api/tags` を呼ぶ
5. メモが 1 件以上あれば先頭メモを自動選択する
6. 0 件なら空状態を表示する

### 6.2 新規メモ作成フロー

1. `新規メモ` を押す
2. `POST /api/notes` を呼ぶ
3. 一覧を更新する
4. 新規メモを選択する
5. 右カラムを編集可能状態にする
6. 入力開始後、自動保存により `PUT /api/notes/:id` を呼ぶ

### 6.3 既存メモ編集フロー

1. 一覧からメモを選択する
2. `GET /api/notes/:id` で詳細を取得する
3. タイトルまたは本文を編集する
4. debounce 後に保存する
5. 保存成功後、一覧の更新日時と抜粋を更新する

### 6.4 検索・絞り込みフロー

1. 検索語を入力する
2. 必要に応じてタグを選択する
3. `GET /api/notes?q=...&tag=...&sort=...` を呼ぶ
4. 一覧のみ更新する
5. 現在選択中メモが結果セット外になっても、編集中であれば編集は維持する

## 7. エディタ詳細仕様

### 7.1 エディタの基本方針

本アプリのコア体験は Notion ライクな編集体験とする。

方針:

- 単純な `textarea + preview` は採用しない
- 表示と編集を分断せず、その場で編集できる体験を優先する
- Markdown ライクな入力を受け付ける
- 永続化は Markdown ベースで行う
- Tiptap の内部表現は UI レイヤに閉じ込める

### 7.2 表示状態と編集状態

本エディタは「完全な閲覧モード」と「完全な編集モード」を明確に分けない。

挙動:

- 通常時も本文は整形された状態で見える
- 本文クリックでカーソルを置いた位置から編集できる
- 編集開始時にプレーンテキスト全体へ戻さない
- ノード単位でリッチ表示のまま編集できる

### 7.3 段落

- デフォルトブロックは段落
- Enter で新しい段落を作る
- 空段落は高さを保ち、クリックしやすくする

### 7.4 見出し

サポート:

- Heading 1
- Heading 2
- Heading 3

変換ルール:

- 行頭で `# ` 入力時に H1
- 行頭で `## ` 入力時に H2
- 行頭で `### ` 入力時に H3

MVP では H4 以降は扱わない。

### 7.5 箇条書きリスト

変換ルール:

- 行頭で `- ` 入力時に箇条書き化
- Enter で次の箇条書き項目を作る
- 空項目で Enter するとリストを抜けて段落に戻る

### 7.6 番号付きリスト

変換ルール:

- 行頭で `1. ` 入力時に番号付きリスト化
- Enter で次番号を自動生成する
- 空項目で Enter するとリストを抜ける

### 7.7 タスク リスト

MVP では非対応とする。

将来拡張方針:

- エディタ構成は後から `TaskList` 系 extension を追加しやすい形に保つ
- 追加時は `- [ ]` / `- [x]` 形式との相互変換を前提に検討する

### 7.8 コードブロック

変換ルール:

- 行頭で ``` ``` 入力時にコードブロックへ変換する
- コードブロック内では Markdown 記法による自動変換をしない
- `Code Block` ボタンでも切り替えられる
- コードブロック選択中は言語選択 UI を表示する

現在の実装:

- `CodeBlockLowlight` を利用する
- `plaintext`, `python`, `javascript`, `typescript`, `json`, `bash`, `html`, `css` を選択可能
- シンタックスハイライトを適用する
- 保存時は fenced code block と言語名を Markdown に保持する

### 7.9 引用

変換ルール:

- 行頭で `> ` 入力時に引用ブロック化

### 7.10 区切り線

変換ルール:

- 行頭で `---` 入力後 Enter で区切り線へ変換する

### 7.11 インライン装飾

MVP でサポートする装飾:

- `**bold**`
- `*italic*`
- `` `inline code` ``
- リンク

挙動:

- Markdown ライク入力から変換できることが望ましい
- ショートカットやツールバーは MVP では必須ではない

### 7.12 Enter / Backspace / Tab の挙動

- Enter:
  - 段落では新しい段落を作る
  - リストでは次項目を作る
  - 空リスト項目ではリストを抜ける
- Backspace:
  - 行頭で見出しやリスト記法が空になった場合は段落へ戻す
  - 空ブロックで前ブロックと自然に結合できること
- Tab:
  - リストではネストは MVP では未対応とする
  - コードブロック内の厳密な Tab 挙動は Tiptap 標準挙動をベースとする

### 7.13 Markdown ライク入力ルール

MVP の対象:

- `#`, `##`, `###`
- `- `
- `1. `
- `> `
- `---`
- ` ``` `

変換タイミング:

- 行頭記法は `space` または `Enter` を契機に変換する
- 変換後は Markdown 記号自体は表示から消え、整形済みブロックとして見せる

### 7.14 プレーンテキスト化と永続化ルール

原則:

- UI では Tiptap の editor state を使う
- 保存時には Markdown へ変換して `content_md` に格納する
- 検索用にプレーンテキストを抽出し `content_plain` に保持する

補足:

- 永続化の正本は `content_md`
- Tiptap の JSON を DB 正本にはしない
- これにより将来 Go バックエンドへ移行しやすくする

### 7.15 対応しない表現

MVP では以下を非対応とする。

- 画像埋め込み
- 数式
- テーブル
- タスクリスト
- ネストの深いリスト
- Notion のデータベースブロック
- ページ内リンク

## 8. メモ一覧と管理機能の仕様

### 8.1 一覧表示項目

一覧 1 行あたり以下を表示する。

- タイトル
- 本文抜粋 1 行
- 更新日時
- タグ 1 件を補助表示してよい
- タグ未設定時は `untagged` を表示してよい

### 8.2 並び順

初期値:

- `updated_desc`

バックエンドで対応するソート:

- `updated_desc`
- `updated_asc`
- `created_desc`
- `title_asc`

現状 UI で公開するソート:

- `updated_desc`
- `updated_asc`
- `title_asc`

### 8.3 検索仕様

仕様:

- 部分一致検索
- 大文字小文字は区別しない
- 対象はタイトル、本文プレーンテキスト、タグ名
- AND 条件は MVP では導入しない
- 検索語は単一文字列として扱う

### 8.4 タグ仕様

仕様:

- タグは文字列ベースで入力する
- 同名タグは再利用する
- 前後空白は trim する
- 大文字小文字差異は同一タグとして正規化してもよい
- 1 メモに同一タグを重複付与できない

現状の UI:

- タグはピル形式で表示する
- 付与済みタグは `x` ボタンで外せる
- 入力欄 + `タグを追加` ボタンで新規タグを追加する
- 入力中は既存タグ候補をサジェスト表示する
- 既に付与済みのタグは候補から除外する
- `Enter` は常に入力文字列を新規追加する
- `Tab` または候補クリックで既存タグを再利用する
- `ArrowUp / ArrowDown` で候補を移動できる
- `Esc` で候補一覧を閉じる

推奨制約:

- タグ名最大長は 30 文字
- 1 メモあたり最大 10 タグ

### 8.5 削除仕様

MVP では物理削除とする。

理由:

- アーカイブやゴミ箱機能をまだ持たないため
- 実装を単純化するため

UI:

- 削除前に確認ダイアログを表示する
- メッセージ例:
  - `このメモを削除しますか？`

### 8.6 アーカイブの扱い

`is_archived` カラムは将来拡張用に保持してもよいが、MVP の UI では使用しない。

## 9. API 詳細仕様

### 9.1 API 共通ルール

- Base URL: `/api`
- Content-Type: `application/json`
- 成功レスポンスは JSON
- 失敗レスポンスも JSON
- 日時は ISO 8601 文字列
- 文字コードは UTF-8

### 9.2 `GET /api/health`

目的:

- ローカル API サーバーの生存確認

成功レスポンス:

```json
{
  "status": "ok"
}
```

### 9.3 `GET /api/notes`

目的:

- 一覧取得

クエリパラメータ:

- `q`: string, optional
- `tag`: string, optional
- `sort`: string, optional

成功レスポンス:

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Untitled",
      "excerpt": "first line",
      "tags": ["daily"],
      "createdAt": "2026-03-21T10:00:00.000Z",
      "updatedAt": "2026-03-21T12:00:00.000Z"
    }
  ]
}
```

備考:

- `excerpt` は `content_plain` 先頭 120 文字程度
- `sort` が未指定なら `updated_desc`

### 9.4 `GET /api/notes/:id`

目的:

- 詳細取得

成功レスポンス:

```json
{
  "id": "uuid",
  "title": "",
  "contentMd": "# title",
  "tags": ["daily", "work"],
  "createdAt": "2026-03-21T10:00:00.000Z",
  "updatedAt": "2026-03-21T12:00:00.000Z"
}
```

404 条件:

- 対象 ID が存在しない

### 9.5 `POST /api/notes`

目的:

- 新規メモ作成

リクエスト:

```json
{
  "title": "",
  "contentMd": "",
  "tags": []
}
```

成功レスポンス:

```json
{
  "id": "uuid",
  "title": "",
  "contentMd": "",
  "tags": [],
  "createdAt": "2026-03-21T10:00:00.000Z",
  "updatedAt": "2026-03-21T10:00:00.000Z"
}
```

### 9.6 `PUT /api/notes/:id`

目的:

- 既存メモ更新

リクエスト:

```json
{
  "title": "updated title",
  "contentMd": "# heading",
  "tags": ["daily"]
}
```

ルール:

- title は空文字を許可
- contentMd は空文字を許可
- tags は配列全置換

成功レスポンス:

```json
{
  "id": "uuid",
  "title": "updated title",
  "contentMd": "# heading",
  "tags": ["daily"],
  "createdAt": "2026-03-21T10:00:00.000Z",
  "updatedAt": "2026-03-21T12:30:00.000Z"
}
```

### 9.7 `DELETE /api/notes/:id`

目的:

- 物理削除

成功レスポンス:

```json
{
  "ok": true
}
```

### 9.8 `GET /api/tags`

目的:

- タグ一覧取得
- 現状実装では、少なくとも 1 件のメモに紐づいているタグのみ返す

成功レスポンス:

```json
{
  "items": [
    { "id": "uuid-1", "name": "daily" },
    { "id": "uuid-2", "name": "work" }
  ]
}
```

### 9.9 エラーレスポンス仕様

形式:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "title is too long"
  }
}
```

主な code:

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `INTERNAL_ERROR`
- `DB_ERROR`
- `AI_CONNECTION_FAILED`
- `AI_STORAGE_UNSUPPORTED`

### 9.10 `GET /api/ai/settings`

目的:

- AI provider 設定取得

レスポンス方針:

- active provider を返す
- provider ごとの endpoint / model / `hasApiKey` を返す
- API キーそのものは返さない
- 保存方式の補助情報を返して UI に注記表示できるようにする

### 9.11 `PUT /api/ai/settings`

目的:

- AI provider 設定保存

ルール:

- `apiKey` を送ったときだけ保存済みキーを更新する
- `clearApiKey=true` で保存済みキーを削除する
- macOS は Keychain、Windows は DPAPI 保護を利用する
- OpenAI / Gemini は UI 上で既定 endpoint を初期表示してよい
- Azure OpenAI はユーザー環境依存のため endpoint 手入力前提とする

### 9.12 `POST /api/ai/settings/test`

目的:

- provider ごとの接続テスト

ルール:

- `apiKey` 未指定時は保存済みキーを利用してよい
- provider 側の 4xx / 5xx は `AI_CONNECTION_FAILED` として包んで返す
- 現フェーズでは接続テストの土台のみ実装し、要約や抽出処理は次フェーズで扱う

### 9.13 `GET /api/notes/:id/ai-outputs`

目的:

- 対象メモに紐づく AI 出力履歴を取得する

ルール:

- created_at の降順で返す
- 各履歴は provider / action / model / content を持つ

### 9.14 `POST /api/notes/:id/ai/run`

目的:

- メモ内容を文脈に AI を実行する

サポート action:

- `summary`
- `structure`
- `extract_action_items`
- `quick_prompt`

ルール:

- active provider 設定を利用する
- 実行成功時は `ai_outputs` に保存する
- `quick_prompt` は追加の user prompt を要求する

### 9.15 `POST /api/notes/:id/ai/task-candidates`

目的:

- メモ全文から AI にタスク候補を抽出させる

ルール:

- 内部的には `extract_action_items` 相当の AI 実行を行う
- 実行成功時は `ai_outputs` に保存する
- レスポンスには Markdown 出力本体と task candidate 配列を含める
- 重複候補は除外する
- チェックリスト / 箇条書き / 番号付き以外の説明文は候補に含めない

### 9.16 `GET /api/tasks`

目的:

- タスクリスト全件取得

ルール:

- `open` を先、`done` を後ろに並べる
- 各タスクは source note 情報を含んでよい
- 各タスクは tags 配列を含む

### 9.17 `POST /api/tasks`

目的:

- タスク作成

ルール:

- `sourceNoteId` は null を許容する
- `createdBy` は `manual` / `ai`
- `tags` は任意指定できる
- `sourceNoteId` があり `tags` 未指定なら、元メモのタグを初期値として引き継ぐ

### 9.18 `POST /api/tasks/bulk`

目的:

- 複数タスクを一括保存する

ルール:

- Phase 14 では AI 候補保存用に利用する
- 最大 50 件まで保存可能とする
- 各 item は単体 `POST /api/tasks` と同等の validation を行う
- AI 候補保存時は `createdBy=ai` を付与する

### 9.19 `PUT /api/tasks/:id`

目的:

- タスク title / status 更新

ルール:

- `tags` の全置換更新を許容する

### 9.20 `DELETE /api/tasks/:id`

目的:

- タスク削除

## 10. DB 詳細設計

### 10.1 テーブル一覧

- `notes`
- `tags`
- `note_tags`
- `ai_settings`
- `ai_provider_configs`
- `ai_outputs`
- `tasks`
- `task_tags`

### 10.2 `notes` テーブル

カラム:

- `id TEXT PRIMARY KEY`
- `title TEXT NOT NULL DEFAULT ''`
- `content_md TEXT NOT NULL DEFAULT ''`
- `content_plain TEXT NOT NULL DEFAULT ''`
- `is_archived INTEGER NOT NULL DEFAULT 0`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

### 10.3 `tags` テーブル

カラム:

- `id TEXT PRIMARY KEY`
- `name TEXT NOT NULL`
- `normalized_name TEXT NOT NULL`
- `created_at TEXT NOT NULL`

### 10.4 `note_tags` テーブル

カラム:

- `note_id TEXT NOT NULL`
- `tag_id TEXT NOT NULL`

### 10.5 インデックス

- `CREATE INDEX idx_notes_updated_at ON notes(updated_at DESC);`
- `CREATE INDEX idx_notes_title ON notes(title);`
- `CREATE INDEX idx_tags_normalized_name ON tags(normalized_name);`
- `CREATE UNIQUE INDEX idx_note_tags_unique ON note_tags(note_id, tag_id);`

### 10.6 制約

- `tags.normalized_name` は一意
- `note_tags.note_id` は `notes.id` を参照
- `note_tags.tag_id` は `tags.id` を参照
- `is_archived` は `0` または `1`

### 10.7 初期マイグレーション

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content_md TEXT NOT NULL DEFAULT '',
  content_plain TEXT NOT NULL DEFAULT '',
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE note_tags (
  note_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX idx_notes_updated_at ON notes(updated_at DESC);
CREATE INDEX idx_notes_title ON notes(title);
CREATE INDEX idx_tags_normalized_name ON tags(normalized_name);
```

追加マイグレーション:

```sql
CREATE TABLE ai_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_provider TEXT NOT NULL DEFAULT 'openai_compatible',
  updated_at TEXT NOT NULL
);

CREATE TABLE ai_provider_configs (
  provider TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  secret_storage TEXT NOT NULL DEFAULT '',
  secret_ref TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
```

補足:

- API キー平文は DB に保存しない
- DB には secret 保存方式と参照情報のみ保存する

AI 出力履歴テーブル:

```sql
CREATE TABLE ai_outputs (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  action TEXT NOT NULL,
  model TEXT NOT NULL,
  content_md TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);
```

タスクリストテーブル:

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'done')),
  source_note_id TEXT,
  source_selection_text TEXT,
  created_by TEXT NOT NULL CHECK (created_by IN ('manual', 'ai')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE SET NULL
);

CREATE TABLE task_tags (
  task_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (task_id, tag_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

Phase 13 の現状:

- 選択テキスト自体は task 作成時に `source_selection_text` として保存する
- 選択範囲の厳密な位置情報はまだ保存しない
- 元メモから手動追加した task には、元メモと同じ tags を初期設定する

Phase 14 の現状:

- AI 抽出で保存した task には、元メモと同じ tags を初期設定する
- task の tags は notes と同じ `tags` テーブルを共有する

## 11. フロントエンド詳細設計

### 11.1 ディレクトリ構成

```text
frontend/
  src/
    components/
      AiSettingsModal.tsx
    lib/
      api.ts
    App.tsx
    App.css
    index.css
```

### 11.2 コンポーネント構成

現状の主な構成:

- `App`
- `AiAssistantModal`
- `AiSettingsModal`
- `TasksModal`
- `RichTextEditor`
- `SaveStatus`
- `EmptyState`

補足:

- 現状は `App.tsx` に一覧、詳細、検索、タグ編集のロジックが集約されている
- 今後必要に応じて `Sidebar`, `NoteList`, `TagEditor` などへ分割する

### 11.3 ルーティング方針

現状:

- `/` のみで内部 state により選択メモを管理する

将来拡張案:

- `/notes/:id` を持ち、選択メモ ID を URL に反映する

### 11.4 状態管理方針

- サーバー同期 state:
  - note list
  - note detail
  - tag list
- ローカル UI state:
  - 検索入力中文字列
  - 並び替え条件
  - タグフィルタ
  - タグ入力欄
  - AI 設定モーダルの開閉状態
  - AIアシスタント モーダルの開閉状態
  - AI task candidate review モーダルの開閉状態
  - タスク モーダルの開閉状態
  - 保存状態
  - エディタ内部 state

現状:

- サーバー同期 state もローカル UI state も React state と `useEffect` ベースで管理する
- API 呼び出しは共通 `request` ヘルパー経由で行う

### 11.5 データ取得方針

- 初回表示時に `GET /api/tags` を取得する
- 一覧は検索語、ソート、タグフィルタ変更時に debounce 付きで再取得する
- 詳細は選択 ID 変更時に取得する
- 保存成功後は詳細データと一覧データを同期更新する
- タグ変更後はタグ一覧も再取得する

### 11.6 バリデーション方針

- タイトル最大長は 200 文字
- タグ名最大長は 30 文字
- タグ数最大は 10
- 現状のフロントエンドは最小限の重複除外のみ行う
- ただし最終バリデーションは API 側で行う

## 12. バックエンド詳細設計

### 12.1 ディレクトリ構成

```text
backend/
  src/
    ai/
    index.ts
    app.ts
    config.ts
    routes/
    services/
    repositories/
    db/
    utils/
    types.ts
  migrations/
```

### 12.2 モジュール分割

- `routes`: Express などのルーティング定義
- `services`: 業務ルール
- `repositories`: SQLite アクセス
- `ai`: provider adapter と秘密情報保存抽象化
- `db`: 接続とマイグレーション
- `utils`: コンテンツ整形、タグ正規化、HTTP エラー共通化

### 12.3 ルーティング構成

- `GET /api/health`
- `GET /api/notes`
- `GET /api/notes/:id`
- `POST /api/notes`
- `PUT /api/notes/:id`
- `DELETE /api/notes/:id`
- `GET /api/tags`
- `GET /api/ai/settings`
- `PUT /api/ai/settings`
- `POST /api/ai/settings/test`
- `GET /api/notes/:id/ai-outputs`
- `POST /api/notes/:id/ai/run`
- `POST /api/notes/:id/ai/task-candidates`
- `GET /api/tasks`
- `POST /api/tasks`
- `POST /api/tasks/bulk`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `POST /api/app/shutdown`

### 12.4 Repository / Service の責務分離

- Repository:
  - SQL 発行
  - DB 行とドメインモデルの変換
- Service:
  - タグ正規化
  - 更新日時管理
  - 検索条件組み立て
  - 一覧用抜粋生成
  - AI provider 設定保存
  - 秘密情報の Keychain / DPAPI 連携
  - provider 接続テスト
  - `prompt-templates.ts` による action ごとの prompt テンプレート管理
  - AI 実行結果の保存
  - タスク作成 / 更新 / 削除
  - source note 整合性確認

### 12.5 SQLite 接続方針

- アプリ起動時に 1 接続を初期化する
- マイグレーションは起動時に実行する
- 現状実装では `better-sqlite3` を利用する

### 12.6 将来の Go 移行を見据えた疎結合方針

- フロントエンドは HTTP API 以外でバックエンドに触れない
- レスポンス形式はドメイン依存に寄せる
- DB スキーマを直接 UI へ露出しない
- バックエンド内部のサービス層で業務ロジックを完結させる
- Electron/Tauri 固有 API に依存しない

## 13. 保存・自動保存仕様

### 13.1 保存タイミング

- タイトル変更時
- 本文変更時
- タグ変更時

いずれも即時送信ではなく debounce を入れる。

### 13.2 自動保存の debounce ルール

推奨値:

- 800ms

ルール:

- 最後の入力から 800ms 経過で保存
- 連続入力中は保存しない
- 詳細ロード直後の初回同期では自動保存を発火させない
- 現状実装では画面離脱時の即時保存は未対応

### 13.3 保存中表示

- 保存リクエスト送信中は `保存中...`
- 成功時は `保存完了`
- 失敗時は `保存失敗`
- 安定状態では `準備完了`

### 13.4 保存失敗時の扱い

- 入力内容は破棄しない
- 再編集または再保存を可能にする
- 保存失敗後、次回編集時に再試行してよい

### 13.5 競合時の扱い

MVP では単一ユーザー利用前提のため、厳密な競合制御は行わない。

## 14. エラー処理と空状態

### 14.1 メモが 0 件のとき

- 一覧に 0 件状態のメッセージを表示する
- 右カラムに作成導線を表示する

### 14.2 検索結果 0 件のとき

- 一覧に `一致するメモはありません`
- 入力条件は保持する

### 14.3 API エラー時

- 現状実装ではインラインのエラーバナーで表示する
- 一時的エラーでも入力内容は保持する

### 14.4 DB エラー時

- `DB_ERROR` として API から返す
- UI では技術詳細を出しすぎず、保存失敗を伝える

### 14.5 起動失敗時

- サーバー起動失敗時はコンソールとログに出力する
- Chrome が見つからない場合も起動失敗として扱う
- ランチャーが使える場合はダイアログまたは標準出力で通知する

## 15. セキュリティとローカル実行方針

### 15.1 `127.0.0.1` bind

- `0.0.0.0` では待ち受けない
- 外部ネットワークからアクセスできないことを前提とする

### 15.2 CORS 方針

- 開発時は Vite dev server の origin のみ許可
- 配布時は同一 origin 想定

### 15.3 Markdown / HTML サニタイズ

- HTML 埋め込みは MVP ではサポートしない
- 表示時は危険な HTML を無効化または除去する

### 15.4 ローカル保存先

推奨:

- macOS: `~/Library/Application Support/memo4me/`
- Windows: `%AppData%/memo4me/`

DB は上記配下に `app.db` として保存する。

## 16. 配布と起動仕様

### 16.1 開発時の起動方法

- `frontend` で Vite を起動
- `backend` で Node.js API サーバーを起動
- ブラウザで開発 URL を開く
- 補助的にルートの `dev.sh` から一括起動できる

### 16.2 配布時の起動方法

MVP では以下のいずれかを採用する。

- 起動スクリプトで backend を起動し、ブラウザを開く
- まとめ用ランチャーで backend と静的フロントを起動する

現状実装:

- `node scripts/build-app.mjs` で frontend / backend の本番ビルドを作成する
- `node scripts/start-app.mjs` で backend の起動、静的フロント配信、Chrome 起動をまとめて行う
- `node scripts/install-app.mjs` で初回セットアップ確認を行う
- macOS / Windows には薄いランチャーを置き、本体ロジックは Node スクリプトに寄せる

起動仕様:

1. ローカル API サーバーを起動する
2. ローカルで Google Chrome の実行パスを探索する
3. Chrome が見つかった場合のみアプリ URL を Chrome で開く
4. Chrome が見つからない場合は起動失敗として終了する

Chrome 実行パス探索ルール:

- 固定パス候補を優先する
- 最初に見つかった実行可能ファイルを採用する
- 見つけたパスはログ出力してよい
- フォールバックで既定ブラウザは開かない
- 現状実装では共有スクリプト `scripts/chrome-launcher.mjs` に探索ロジックを集約する

Windows 探索順:

1. `%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe`
2. `%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe`
3. `%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe`
4. `where chrome.exe`

macOS 探索順:

1. `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
2. `~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
3. `mdfind "kMDItemCFBundleIdentifier == 'com.google.Chrome'"` で `.app` を探索し、実体パスを解決

補足:

- macOS の `which google-chrome` は通常インストールでは当てにならないため、MVP では必須探索手段に含めない
- Windows / macOS ともに、探索に失敗した場合は `Chrome is required but was not found` 相当の文言で通知する

### 16.3 Windows 社用 PC 向け考慮点

- npm が既に入っている前提を活かす
- 依存インストール手順は README に明記する
- Chrome 前提で起動導線を整える
- Chrome の標準インストール先と実行パス探索順を定義する
- 将来的にはワンクリック実行に寄せる

### 16.4 GitHub Releases 想定

初期案:

- ソースコード配布
- 起動用スクリプト配布
- `install-*` / `start-*` ランチャー配布

README または配布資料には以下を明記する。

- Google Chrome がインストール済みであること
- Chrome が見つからない場合は起動しないこと
- 現状は Node.js / npm が必要であること

将来案:

- Node ランタイム同梱版、または Go 移行後の単体バイナリ配布

## 17. 受け入れ条件

### 17.1 MVP 受け入れ条件

- 新規メモ作成ができる
- 既存メモの閲覧と編集ができる
- 削除ができる
- タグを付与できる
- タイトル、本文、タグで検索できる
- タグで絞り込みできる
- 更新日順で並び替えできる
- 再起動後もデータが残る

### 17.2 エディタ体験の受け入れ条件

- 本文は常に整形済み表示で見える
- クリックした位置からそのまま編集できる
- `# `、`- `、`1. ` などの Markdown ライク入力で見た目が変わる
- Enter で Notion ライクに次ブロックへ進める
- 保存後に再表示しても概ね同じ見た目が再現される
- コードブロックで言語選択とシンタックスハイライトが使える

### 17.3 配布・起動の受け入れ条件

- ローカル API が `127.0.0.1` のみで待ち受ける
- 社用 PC を含む Windows 環境で起動手順が成立する
- Chrome が存在する環境では自動で Chrome が開く
- Chrome が存在しない環境では起動失敗として明確に通知される
- README を見れば導入できる

## 18. 実装タスク分解

実行順の詳細は [tasklist.md](./tasklist.md) を正本とする。

本書では要点のみ整理する。

### 18.1 実装済みの主な領域

- 開発基盤と 2 カラム UI
- SQLite と notes/tags API
- NoteList と詳細の API 接続
- Tiptap ベースの本文編集
- Markdown 保存 / 復元
- コードブロックの言語指定とシンタックスハイライト
- 自動保存、検索、タグフィルタ、並び替え、削除確認
- AI provider 設定モーダル
- AI 設定保存 API
- macOS Keychain / Windows DPAPI を前提にしたキー保存基盤
- AIアシスタント モーダル
- 要約 / 構造化 / アクション抽出 / quick prompt 実行
- AI 出力履歴保存
- AI 出力履歴の action filter
- AI 実行失敗時の案内改善
- Action items からの AI task candidate review
- タスクリストモーダル
- tasks CRUD API
- source note 付きタスク管理
- Header の電源ボタン `⏻` と app shutdown API

### 18.2 現在の未完了タスク

- Windows 社用 PC での実機起動確認
- GitHub Releases の実運用確認
- 配布物ダウンロードからの導入確認
- 更新版の再配布と差し替え導入確認
- 範囲選択位置情報の永続化

## 19. 要確認事項

現時点で大きな方針は確定している。

今後ユーザー確認があると望ましい項目:

- タグサジェスト UI の最終挙動
- 配布時の Node ランタイム同梱方針
- 将来拡張としてのゴミ箱機能の定義
