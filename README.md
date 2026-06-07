# 韓国語リピート練習

韓国語の単語と例文を、単発再生と連続再生で練習する静的サイトです。

## 公開フロー

`main` または `master` に push すると、GitHub Actions がテスト、型検査、ビルドを実行し、GitHub Pages に公開します。

リポジトリの Settings で Pages の Source を `GitHub Actions` にしてください。

## CI で実行するコマンド

```powershell
npm ci
npm test
npm run typecheck
npm run build
```

## データ追加

正本は `content/korean-practice.md` です。今後の教材も同じ形式で追記します。

- 単語は `# 登場単語一覧` の下に `## カテゴリ名` と2列テーブルを追加する
- 例文は `# 15. タイトル` のように番号付き見出しを追加する
- 必要なら `## 人セット` のような小見出しでグループを分ける
- テーブルは必ず `韓国語` / `日本語` の2列にする

編集後は `npm run generate:data` で `src/generated/practice-content.json` を再生成できます。`npm run build` の前にも自動で再生成されます。
