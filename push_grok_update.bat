@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在提交并推送 Grok 配置更新到 GitHub...
git add config.py ai_analyst.py web/app.js web/index.html
git commit -m "feat: 切换AI默认接口至Grok中转（grok-4.6），更新网页大屏默认配置"
git push origin main
echo.
echo 推送完成！GitHub Actions 会自动重新部署 Pages，约 1-2 分钟后刷新
echo https://mrzh2025.github.io/policy-auto-push/ 即可看到更新。
pause
