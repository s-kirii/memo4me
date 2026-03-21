# memo4me AI Provider 設定ガイド

## 1. 目的

このドキュメントは、`memo4me` の `AI Settings` に入力する値を、各 AI provider でどう取得するかをまとめたものです。

対象:

- `OpenAI-compatible`
- `Azure OpenAI`
- `Gemini`

補足:

- 画面や名称は provider 側で変わることがあります
- 詳細な最新手順は必ず公式ドキュメントも確認してください
- API キーは機密情報です。Git やソースコードに入れないでください

## 2. memo4me で入力する項目

`memo4me` の `AI Settings` では、provider ごとに主に次を入力します。

- `Provider`
- `Endpoint` または `Base URL`
- `Model`
- `API key`

`memo4me` 側の対応:

- `OpenAI-compatible`
  - 既定 `Base URL`: `https://api.openai.com/v1`
- `Azure OpenAI`
  - endpoint はユーザー環境依存
- `Gemini`
  - 既定 `Base URL`: `https://generativelanguage.googleapis.com/v1beta`

## 3. OpenAI-compatible

### 3.1 memo4me での設定例

- `Provider`: `OpenAI-compatible`
- `Base URL`: `https://api.openai.com/v1`
- `Model`: 例 `gpt-5.4-nano`
- `API key`: OpenAI Platform で作成した API key

### 3.2 取得するもの

- OpenAI API key
- 利用したい model 名

### 3.3 API key の取得方法

1. OpenAI Platform にログインします
2. `API Keys` ページを開きます
3. 新しい secret key を作成します
4. 表示された key を控えます

補足:

- project / organization の権限によっては、作成場所や権限設定が異なることがあります
- `memo4me` では key の再表示は不要なので、作成時に控えるのが安全です

### 3.4 Model の決め方

`memo4me` では、OpenAI の model 名をそのまま入力します。

例:

- `gpt-5.4-nano`
- `gpt-5.4-mini`

### 3.5 よくある注意点

- `ChatGPT` の契約と `OpenAI API` の billing は別の場合があります
- `You exceeded your current quota` は key 形式の問題ではなく、billing / usage 上限の可能性が高いです

公式:

- https://platform.openai.com/docs/api-reference/authentication
- https://help.openai.com/en/articles/4936850-how-to-create-and-use-an-api-key
- https://help.openai.com/en/articles/8867743-assign-api-key-permissions

## 4. Azure OpenAI

### 4.1 memo4me での設定例

- `Provider`: `Azure OpenAI`
- `Endpoint`: 例 `https://your-resource.openai.azure.com/openai/v1`
- `Model`: Azure 上の deployment 名
- `API key`: Azure resource の key

### 4.2 取得するもの

- Azure OpenAI resource の endpoint
- Azure OpenAI resource の API key
- 利用したい deployment 名

### 4.3 Endpoint と API key の取得方法

1. Azure portal または Azure AI Foundry で対象 resource を開きます
2. `Keys and Endpoint` を開きます
3. `Endpoint` を控えます
4. `KEY1` または `KEY2` を控えます

### 4.4 Model 欄に入れる値

`memo4me` の `Model` には、Azure OpenAI の underlying model 名ではなく、通常は deployment 名を入れます。

例:

- deployment 名が `gpt-5p4n-prod` なら、そのまま `gpt-5p4n-prod`

### 4.5 よくある注意点

- OpenAI 公式 API と違って、Azure では endpoint が固定ではありません
- model 名ではなく deployment 名を入れるのがポイントです
- endpoint の末尾は `.../openai/v1` の形にそろえると `memo4me` の今の実装と整合しやすいです

公式:

- https://learn.microsoft.com/en-us/azure/ai-services/openai/gpt-v-quickstart
- https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/switching-endpoints

## 5. Gemini

### 5.1 memo4me での設定例

- `Provider`: `Gemini`
- `Base URL`: `https://generativelanguage.googleapis.com/v1beta`
- `Model`: 例 `gemini-2.5-flash`
- `API key`: Google AI Studio で作成した key

### 5.2 取得するもの

- Gemini API key
- 利用したい model 名

### 5.3 API key の取得方法

1. Google AI Studio にログインします
2. `API Keys` ページを開きます
3. 必要なら project を作成または import します
4. API key を作成します
5. 表示された key を控えます

### 5.4 Model の決め方

`memo4me` では Gemini の model 名をそのまま入力します。

例:

- `gemini-2.5-flash`
- `gemini-2.5-pro`

### 5.5 よくある注意点

- project を import しないと key が見えない場合があります
- Google AI Studio 側の project と key は紐づいています
- 本番利用では key の制限や定期的な見直しも検討してください

公式:

- https://ai.google.dev/gemini-api/docs/api-key
- https://ai.google.dev/api
- https://ai.google.dev/aistudio

## 6. 設定後の確認手順

1. `memo4me` の `AI Settings` を開きます
2. provider を選びます
3. `Endpoint/Base URL`, `Model`, `API key` を入力します
4. `Test connection` を押します
5. 成功したら `Save AI settings` を押します

確認の優先順:

- まず `Test connection`
- 次に `Summary`
- 次に `Action items`

## 7. よくある入力ミス

### OpenAI-compatible

- ChatGPT 用の契約だけで API が使えると思ってしまう
- billing 未設定で `quota` エラーになる
- model 名の typo

### Azure OpenAI

- endpoint を Azure resource 固有の値にしていない
- `Model` に model 名を入れて、deployment 名を入れていない
- key は合っているが resource が違う

### Gemini

- project / key の作成先を間違える
- model 名の typo
- API key を別サービス用の key と混同する

## 8. セキュリティメモ

- API キーは他人に見せない
- スクリーンショット共有時は key を隠す
- ソースコードや `.env` に平文で残さない
- 不要になった key は provider 側で削除または rotate する
