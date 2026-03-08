# テスト設計演習 - E2Eテスト

Playwrightを使用したフロントエンドのE2Eテスト

## まず見る資料

- UI回帰の手動チェック: `test/REGRESSION-UI-CHECKLIST.md`

## セットアップ

### 1. Playwrightのインストール

```powershell
# Pythonパッケージのインストール
pip install playwright pytest pytest-playwright

# ブラウザのインストール
playwright install chromium
```

### 2. サーバーの起動

テスト実行前にデモサイトを起動してください：

```powershell
.\start.bat
```

## テスト実行

### すべてのテストを実行

```powershell
pytest test/ -v
```

### 特定のテストファイルを実行

```powershell
pytest test/test_frontend.py -v
```

### 特定のテストクラスを実行

```powershell
# フロント表示のテストのみ
pytest test/test_frontend.py::TestFrontendDisplay -v

# コンソールエラーのテストのみ
pytest test/test_frontend.py::TestConsoleErrors -v
```

### 特定のテストケースを実行

```powershell
pytest test/test_frontend.py::TestFrontendDisplay::test_page_loads_successfully -v
```

### ブラウザ表示ありで実行（デバッグ向け）

```powershell
pytest test/ -v --headed
```

### レポート付きで実行

```powershell
pytest test/ -v --html=test-report.html --self-contained-html
```

## テストケース一覧

### TestFrontendDisplay - フロント表示のテスト

| テストケース                   | 内容                         |
| ------------------------------ | ---------------------------- |
| `test_page_loads_successfully` | ページが正常に読み込まれるか |
| `test_main_elements_visible`   | 主要な要素が表示されているか |
| `test_balance_display`         | 残高が表示されているか       |
| `test_tab_switching`           | タブ切り替えが動作するか     |

### TestConsoleErrors - コンソールエラーのテスト

| テストケース               | 内容                           |
| -------------------------- | ------------------------------ |
| `test_no_console_errors`   | コンソールにエラーが出ないか   |
| `test_no_failed_requests`  | APIリクエストが失敗しないか    |
| `test_chart_tab_no_errors` | チャートタブでエラーが出ないか |

## テスト設計の観点

### 1. フロント表示確認

- ページの読み込み成功
- 主要コンポーネントの表示
- データの表示確認
- インタラクションの動作確認

### 2. コンソールエラー確認

- JavaScriptエラーの検出
- APIリクエストの成功確認
- 非同期処理のエラー検出

## トラブルシューティング

### サーバーが起動していない

```
AssertionError: レスポンスがNoneです
```

→ `.\start.bat` でサーバーを起動してください

### タイムアウトエラー

```
TimeoutError: Timeout 5000ms exceeded
```

→ サーバーの応答が遅い場合があります。数秒待ってから再実行してください

### Playwrightがインストールされていない

```
ModuleNotFoundError: No module named 'playwright'
```

→ `pip install playwright pytest-playwright` を実行してください

### ブラウザがインストールされていない

```
Executable doesn't exist
```

→ `playwright install chromium` を実行してください
