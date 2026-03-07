@echo off
chcp 65001 > nul
echo ====================================
echo デモサイト - 初回セットアップ
echo ====================================
echo.

echo Pythonのバージョン確認中...
python --version
if errorlevel 1 (
    echo エラー: Pythonがインストールされていません。
    echo Python 3.7以降をインストールしてください。
    pause
    exit /b 1
)

echo.
echo Dockerのインストール確認中...
docker compose version > nul 2>&1
if errorlevel 1 (
    echo エラー: Docker または Docker Compose がインストールされていません。
    echo Docker Desktopをインストールし、起動してから再度実行してください。
    echo ダウンロード: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

echo.
echo 必要なPythonライブラリをインストールしています...
pip install -r requirements.txt sqlalchemy psycopg2-binary apscheduler

if errorlevel 1 (
    echo エラー: Flaskのインストールに失敗しました。
    pause
    exit /b 1
)

echo.
echo ====================================
echo セットアップ完了！
echo ====================================
echo.
echo 次回からは start.bat を実行してください。
echo.
pause
