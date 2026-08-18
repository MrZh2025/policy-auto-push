@echo off
chcp 65001 >nul
title GitHub 自动化仓库初始化与推送工具

echo ========================================================
echo   医药政策自动化监控系统 - GitHub Actions 云端部署助手
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] 正在初始化本地 Git 仓库并打包文件...
git init
git add .
git commit -m "feat: 医药政策自动化采集与微信推送系统"

echo.
echo ========================================================
echo 请在上方完成 GitHub 仓库创建（建议设为 Private 私有仓库）
echo ========================================================
set /p REPO_URL=请输入您的 GitHub 仓库 HTTPS 地址 (如 https://github.com/xxx/policy-auto-push.git): 

if "%REPO_URL%"=="" (
    echo 未输入仓库地址，退出。
    pause
    exit /b
)

echo.
echo [2/3] 正在关联远程 GitHub 仓库...
git branch -M main
git remote remove origin >nul 2>nul
git remote add origin %REPO_URL%

echo [3/3] 正在推送代码到 GitHub...
git push -u origin main

echo.
echo ========================================================
echo 代码推送完成！请按照 GITHUB_DEPLOY.md 添加 PUSHPLUS_TOKEN。
echo 以后每天早上 08:30 GitHub 将自动帮您抓取政策发到微信！
echo ========================================================
pause
