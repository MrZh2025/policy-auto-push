# GitHub Actions 云端免服务器自动化部署指南

> 通过 GitHub Actions 提供的免费云端服务器，实现**电脑无需开机、工作日每天早晨 08:30 自动搜集政策并推送到您的个人微信**。

---

## 🌟 为什么选择 GitHub Actions 部署？

- **0 元免费**：利用 GitHub 官方赠送的免费 Actions 计算额度，不需要购买任何云服务器。
- **免本地电脑开机**：由 GitHub 位于全球的云端服务器每天准时自动唤醒执行。
- **自动去重**：每次执行后会自动持久化 SQLite 数据库，确保绝不重复推送。

---

## 🚀 3 步完成 GitHub Actions 云端部署

### 第一步：在 GitHub 上新建一个私有仓库
1. 浏览器打开 [GitHub.com](https://github.com/) 登录您的账号。
2. 点击右上角 **`+`** ➔ **`New repository`**：
   - **Repository name**：填写 `policy-auto-push`（或其他任意名字）
   - **Visibility**：选择 **`Private`（私有仓库）**（保护您的 Token 与推送记录）
3. 点击 **`Create repository`** 创建完成。

---

### 第二步：将本项目代码推送到您的 GitHub 仓库
在本项目所在目录（`f:\2026年\梦见2026年\四川发展学习资料\政策自动化-医药集团`）的命令行中依次执行：

```bash
# 1. 初始化本地 Git 仓库并提交
git init
git add .
git commit -m "feat: 医药政策自动化采集与微信推送系统"

# 2. 关联您的 GitHub 远程仓库 (替换为您自己的仓库地址)
git branch -M main
git remote add origin https://github.com/您的用户名/policy-auto-push.git

# 3. 推送代码到 GitHub
git push -u origin main
```

---

### 第三步：配置 GitHub Secrets（环境变量加密）
为了保护您的微信推送 Token：
1. 打开您刚创建的 GitHub 仓库页面，点击顶部 **`Settings`** 标签。
2. 在左侧菜单点击 **`Secrets and variables`** ➔ **`Actions`**。
3. 点击 **`New repository secret`**：
   - **Name**：`PUSHPLUS_TOKEN`
   - **Secret**：`be87fdcbcef94066ab9132f5e8575005`
4. 点击 **`Add secret`** 保存。

*(可选：如果您以后有企业微信 Webhook 或 AI Key，也可以添加 `WECHAT_WORK_WEBHOOK` 或 `AI_API_KEY`)*

---

## ⏰ 自动定时调度规则

我们在 `.github/workflows/policy_push.yml` 中已为您预设好调度规则：
- **早报推送**：每周一至周五 **北京时间 08:30**
- **晚报速递**：每周一至周五 **北京时间 17:30**
- **手动测试**：在 GitHub 仓库点击 **`Actions`** ➔ 点击左侧 **`医药政策每日自动化监控与微信推送`** ➔ 点击右侧 **`Run workflow`**，即可立即在云端触发一次抓取与推送测试！
