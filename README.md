# 資産形成シミュレータ

[DiscoverRoutes.jp の資産形成シミュレータ](https://discoverroutes.jp/retirement-simulator/)を、WordPress から独立した静的サイトとして動かせるように整理したソースです。

## 起動方法

`index.html` をブラウザで開いてください。ローカルサーバーを使う場合は、ディレクトリ内で次のように起動できます。

```bash
python -m http.server 8000
```

その後 `http://localhost:8000/` を開きます。

## 構成

- `index.html` — ページ本体
- `styles.css` — レイアウトとデザイン
- `app.js` — 入力同期、計算、ローカル保存、グラフ描画

グラフ描画には Chart.js 4.4.1 を CDN から読み込みます。入力値はブラウザの `localStorage` のみに保存されます。

## GitHub Pages

リポジトリの Settings → Pages で、`main` ブランチのルートを公開元に指定すると、そのまま公開できます。

## 注意

掲載内容・ブランド・ソースコードを公開する権利があることを確認してから利用してください。
