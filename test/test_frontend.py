"""
フロントエンド表示とコンソールエラーのテスト

実行方法:
    pytest test/test_frontend.py -v
    
または
    python -m pytest test/test_frontend.py -v
"""
import re
import pytest
from playwright.sync_api import Page, expect


BASE_URL = "http://localhost:5000"


def login_as_dev(page: Page):
    """開発者ログイン(User1)でメイン画面へ遷移する。"""
    page.goto(f"{BASE_URL}/login")
    dev_login_button = page.locator(".dev-login-btn")
    expect(dev_login_button).to_be_visible()
    dev_login_button.click()
    expect(page).to_have_url(re.compile(r".*/$"))
    expect(page.locator(".top-header")).to_be_visible()


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
        response = page.goto(f"{BASE_URL}/login")
        
        # ステータスコードが200であることを確認
        assert response is not None, "レスポンスがNoneです"
        assert response.ok, f"ページ読み込み失敗: ステータス {response.status}"
        
        # タイトルが正しいことを確認
        expect(page).to_have_title("暗号資産取引デモサイト - テスト設計演習用")
    
    def test_main_elements_visible(self, page: Page):
        """主要な要素が表示されているかテスト"""
        login_as_dev(page)
        
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
        login_as_dev(page)

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
        login_as_dev(page)
        
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

    def test_chart_interval_switch_visible(self, page: Page):
        """時間足ボタン押下時にチャートが表示されるかテスト"""
        login_as_dev(page)

        chart_menu = page.locator(".menu-item", has_text="チャート")
        chart_menu.click()

        chart_canvas = page.locator(".tv-chart-root, .price-chart-canvas").first
        expect(chart_canvas).to_be_visible()

        interval_4h = page.locator(".interval-btn", has_text="4時間")
        interval_4h.click()
        expect(interval_4h).to_have_class("interval-btn active")
        expect(chart_canvas).to_be_visible()

        interval_1d = page.locator(".interval-btn", has_text="1日")
        interval_1d.click()
        expect(interval_1d).to_have_class("interval-btn active")
        expect(chart_canvas).to_be_visible()


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
        login_as_dev(page)
        
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
        login_as_dev(page)
        
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
        login_as_dev(page)
        
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


class TestUiRegressions:
    """最近のUI不具合に対する回帰テスト"""

    def test_market_buy_then_open_history_does_not_crash(self, page: Page):
        """成行買い直後に履歴へ遷移しても画面が維持されることを確認"""
        page_errors = []
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        login_as_dev(page)

        page.locator(".menu-item", has_text="注文パネル").click()
        amount_input = page.locator('.trading-panel input[placeholder="0.00000000"]')
        amount_input.fill("0.0001")
        page.locator(".trading-panel .order-btn.buy").click()

        success_message = page.locator(".trading-panel .order-success-message")
        expect(success_message).to_be_visible()

        page.locator(".menu-item", has_text="取引履歴").click()
        expect(page.locator(".history-view")).to_be_visible()
        expect(page.locator(".history-tabs")).to_be_visible()

        assert len(page_errors) == 0, f"ページエラーが検出されました: {page_errors}"

    def test_order_success_message_under_button_and_fade_out(self, page: Page):
        """成功メッセージがボタン下に表示され、フェードアウトすることを確認"""
        login_as_dev(page)

        page.locator(".menu-item", has_text="注文パネル").click()
        amount_input = page.locator('.trading-panel input[placeholder="0.00000000"]')
        amount_input.fill("0.0001")
        page.locator(".trading-panel .order-btn.buy").click()

        success_message = page.locator(".trading-panel .order-success-message")
        expect(success_message).to_be_visible()

        is_after_buy_button = page.locator(".trading-panel").evaluate(
            """(panel) => {
                const button = panel.querySelector('.order-btn.buy');
                const message = panel.querySelector('.order-success-message');
                if (!button || !message) return false;
                return Boolean(
                  button.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING
                );
            }"""
        )
        assert is_after_buy_button, "成功メッセージが買い注文ボタンの後に配置されていません"

        page.wait_for_timeout(4700)
        expect(success_message).to_have_class(re.compile(r".*fade-out.*"))

        page.wait_for_timeout(700)
        expect(success_message).to_be_hidden()
