@echo off
chcp 65001 > nul
echo ====================================
echo デモサイト - 起動中...
echo ====================================
echo.

cd /d "%~dp0"

echo データベース（PostgreSQL）を起動しています...
echo これには少し時間がかかる場合があります（初回はイメージのダウンロードが行われます）。
docker-compose up -d
if errorlevel 1 (
    echo エラー: データベースの起動に失敗しました。Docker Desktopが起動しているか確認してください。
    pause
    exit /b 1
)

echo.
echo サーバーを起動しています...
echo ブラウザが自動的に開きます（数秒お待ちください）
echo.
echo サーバーを停止するには、このウィンドウで Ctrl+C を押し、
echo その後 [ docker-compose down ] を実行してデータベースを停止してください。
echo.

start /min cmd /c "timeout /t 3 /nobreak > nul && start http://localhost:5000"

python app\server.py
