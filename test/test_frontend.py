"""
フロントエンド表示とコンソールエラーのテスト

実行方法:
    pytest test/test_frontend.py -v
    
または
    python -m pytest test/test_frontend.py -v
"""
import pytest
from playwright.sync_api import Page, expect


class TestFrontendDisplay:
    """フロント表示のテスト"""
    
    @pytest.fixture(scope="class", autouse=True)
    def setup_class(self):
        """テスト実行前の注意事項を表示"""
        print("\n" + "="*60)
        print("⚠️  サーバーが起動していることを確認してください")
        print("   実行: .\\start.bat")
        print("="*60 + "\n")
        yield
    
    def test_page_loads_successfully(self, page: Page):
        """ページが正常に読み込まれるかテスト"""
        # ページにアクセス
        response = page.goto("http://localhost:5000")
        
        # ステータスコードが200であることを確認
        assert response is not None, "レスポンスがNoneです"
        assert response.ok, f"ページ読み込み失敗: ステータス {response.status}"
        
        # タイトルが正しいことを確認
        expect(page).to_have_title("暗号資産取引デモサイト - テスト設計演習用")
    
    def test_main_elements_visible(self, page: Page):
        """主要な要素が表示されているかテスト"""
        page.goto("http://localhost:5000")
        
        # ヘッダーが表示されているか
        header = page.locator(".top-header")
        expect(header).to_be_visible()
        
        # タイトルが表示されているか
        title = page.locator(".header-title")
        expect(title).to_be_visible()
        expect(title).to_contain_text("暗号資産取引デモサイト")
        
        # 価格ティッカーが表示されているか
        ticker = page.locator(".price-ticker")
        expect(ticker).to_be_visible()
        
        # サイドメニューが表示されているか
        side_menu = page.locator(".side-menu")
        expect(side_menu).to_be_visible()

        # メニュー項目が存在するか
        menu_items = page.locator(".menu-item")
        expect(menu_items).to_have_count(6)
    
    def test_balance_display(self, page: Page):
        """残高が表示されているかテスト"""
        page.goto("http://localhost:5000")

        # 資産状況メニューへ移動
        page.locator(".menu-item", has_text="資産状況").click()
        
        # 合計残高ドーナツが表示されているか
        donut = page.locator(".assets-donut")
        expect(donut).to_be_visible()
        
        # テーブルヘッダーが表示されているか
        table_header = page.locator(".assets-table-header-row")
        expect(table_header).to_be_visible()
        
        # JPY行が表示されているか
        jpy_row = page.locator(".assets-table-row", has_text="JPY")
        expect(jpy_row).to_be_visible()
    
    def test_tab_switching(self, page: Page):
        """タブ切り替えが動作するかテスト"""
        page.goto("http://localhost:5000")
        
        # 各メニューをクリックして切り替え
        chart_menu = page.locator(".menu-item", has_text="チャート")
        deposit_menu = page.locator(".menu-item", has_text="入金")
        withdraw_menu = page.locator(".menu-item", has_text="出金")
        
        # チャートメニューをクリック
        chart_menu.click()
        expect(chart_menu).to_have_class("menu-item active")
        
        # 入金メニューをクリック
        deposit_menu.click()
        expect(deposit_menu).to_have_class("menu-item active")
        
        # 出金メニューをクリック
        withdraw_menu.click()
        expect(withdraw_menu).to_have_class("menu-item active")

    def test_chart_interval_1w_1m_visible(self, page: Page):
        """1W/1Mボタン押下時にチャートが表示されるかテスト"""
        page.goto("http://localhost:5000")

        chart_menu = page.locator(".menu-item", has_text="チャート")
        chart_menu.click()

        chart_root = page.locator(".tv-chart-root")
        expect(chart_root).to_be_visible()

        interval_1w = page.locator(".interval-btn", has_text="1W")
        interval_1w.click()
        expect(interval_1w).to_have_class("interval-btn active")
        expect(chart_root).to_be_visible()

        interval_1m = page.locator(".interval-btn", has_text="1M")
        interval_1m.click()
        expect(interval_1m).to_have_class("interval-btn active")
        expect(chart_root).to_be_visible()

        # Lightweight Chartsの描画キャンバスが存在すること
        canvas = page.locator(".tv-chart-root canvas").first
        expect(canvas).to_be_visible()


class TestConsoleErrors:
    """コンソールエラーのテスト"""
    
    def test_no_console_errors(self, page: Page):
        """コンソールにエラーが出ないかテスト"""
        console_messages = []
        errors = []
        
        # コンソールメッセージをキャプチャ
        def handle_console(msg):
            console_messages.append({
                'type': msg.type,
                'text': msg.text
            })
            if msg.type == 'error':
                errors.append(msg.text)
        
        page.on("console", handle_console)
        
        # ページを読み込み
        page.goto("http://localhost:5000")
        
        # Reactアプリがレンダリングされるまで少し待つ
        page.wait_for_selector(".app-container-new", timeout=5000)
        
        # エラーログを確認
        if errors:
            print("\n⚠️  コンソールエラーが検出されました:")
            for error in errors:
                print(f"  - {error}")
        
        # エラーがないことを確認
        assert len(errors) == 0, f"コンソールエラーが {len(errors)} 件検出されました: {errors}"
    
    def test_no_failed_requests(self, page: Page):
        """APIリクエストが失敗しないかテスト"""
        failed_requests = []
        
        # リクエストの失敗をキャプチャ
        def handle_response(response):
            if not response.ok and response.url.startswith("http://localhost:5000/api"):
                failed_requests.append({
                    'url': response.url,
                    'status': response.status
                })
        
        page.on("response", handle_response)
        
        # ページを読み込み
        page.goto("http://localhost:5000")
        
        # APIリクエストが完了するまで待つ
        page.wait_for_timeout(2000)
        
        # 失敗したリクエストを確認
        if failed_requests:
            print("\n⚠️  失敗したAPIリクエスト:")
            for req in failed_requests:
                print(f"  - {req['url']} (ステータス: {req['status']})")
        
        # 失敗したリクエストがないことを確認
        assert len(failed_requests) == 0, f"APIリクエストが {len(failed_requests)} 件失敗しました"
    
    def test_chart_tab_no_errors(self, page: Page):
        """チャートタブでコンソールエラーが出ないかテスト"""
        errors = []
        
        def handle_console(msg):
            if msg.type == 'error':
                errors.append(msg.text)
        
        page.on("console", handle_console)
        
        # ページを読み込み
        page.goto("http://localhost:5000")
        
        # チャートメニューをクリック
        chart_tab = page.locator(".menu-item", has_text="チャート")
        chart_tab.click()
        
        # チャートがレンダリングされるまで待つ
        page.wait_for_timeout(3000)
        
        # エラーがないことを確認（外部API由来の既知エラーは除外）
        def is_ignorable_external_error(message: str) -> bool:
            lower = message.lower()
            return (
                "chart data fetch error" in lower
                or "coingecko.com" in lower
                or ("failed to load resource" in lower and "err_failed" in lower)
            )

        critical_errors = [e for e in errors if not is_ignorable_external_error(e)]
        
        if critical_errors:
            print("\n⚠️  チャートタブでコンソールエラーが検出されました:")
            for error in critical_errors:
                print(f"  - {error}")
        
        assert len(critical_errors) == 0, f"クリティカルエラーが {len(critical_errors)} 件検出されました"
