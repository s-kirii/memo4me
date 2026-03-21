# memo4me

`memo4me` は、Notion ライクな編集体験を持つローカル完結のメモアプリです。

設計資料:

- [基本設計](/xxxxx/memo4me/doc/design.md)
- [詳細設計](/xxxxx/memo4me/doc/detail-design.md)

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

## 現在の Phase 0 完了内容

- `frontend` の初期構成作成
- `backend` の初期構成作成
- `GET /api/health` の最小実装
- 開発用 README 作成

## 次の予定

- SQLite 接続
- notes / tags API
- Tiptap 導入
- 自動保存と検索
