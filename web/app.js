/**
 * 医药产业政策监控与智能分析平台 - 前端主交互逻辑
 */

// 状态管理
const state = {
    currentTrack: 'all',
    searchQuery: '',
    policies: [],
    stats: {},
    apiKey: localStorage.getItem('POLICY_AI_API_KEY') || '',
    baseUrl: localStorage.getItem('POLICY_AI_BASE_URL') || 'https://api.deepseek.com/v1',
    model: localStorage.getItem('POLICY_AI_MODEL') || 'deepseek-chat',
};

// DOM 元素引用
const el = {
    policyList: document.getElementById('policyList'),
    statsBadge: document.getElementById('statsSummary'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    trackCards: document.querySelectorAll('.track-card'),
    btnScrape: document.getElementById('btnScrape'),
    btnExportWord: document.getElementById('btnExportWord'),
    btnPushWechat: document.getElementById('btnPushWechat'),
    btnGenWeekly: document.getElementById('btnGenWeekly'),
    chatMessages: document.getElementById('chatMessages'),
    chatInput: document.getElementById('chatInput'),
    btnSendChat: document.getElementById('btnSendChat'),
    promptPills: document.querySelectorAll('.pill-chip'),
    toggleApiKey: document.getElementById('toggleApiKey'),
    apiKeyDrawer: document.getElementById('apiKeyDrawer'),
    inputApiKey: document.getElementById('inputApiKey'),
    inputBaseUrl: document.getElementById('inputBaseUrl'),
    inputModel: document.getElementById('inputModel'),
    btnSaveKey: document.getElementById('btnSaveKey'),
    toast: document.getElementById('toast'),
    listBadge: document.getElementById('listBadge'),
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initApiKeyForm();
    loadStats();
    loadPolicies();
    bindEvents();
});

// 事件绑定
function bindEvents() {
    // 赛道卡片点击切换
    el.trackCards.forEach(card => {
        card.addEventListener('click', () => {
            el.trackCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            state.currentTrack = card.getAttribute('data-track');
            el.listBadge.textContent = card.querySelector('.track-title').textContent;
            loadPolicies();
        });
    });

    // 搜索
    el.searchBtn.addEventListener('click', handleSearch);
    el.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // 快捷 Prompt 点击
    el.promptPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const prompt = pill.getAttribute('data-prompt');
            el.chatInput.value = prompt;
            sendChatMessage();
        });
    });

    // 发送聊天
    el.btnSendChat.addEventListener('click', sendChatMessage);
    el.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });

    // 四川专项周回顾一键生成
    el.btnGenWeekly.addEventListener('click', generateSichuanWeeklyReport);

    // API Key 抽屉切换
    el.toggleApiKey.addEventListener('click', () => {
        el.apiKeyDrawer.classList.toggle('hidden');
    });

    // 保存 API Key
    el.btnSaveKey.addEventListener('click', () => {
        state.apiKey = el.inputApiKey.value.trim();
        state.baseUrl = el.inputBaseUrl.value.trim();
        state.model = el.inputModel.value.trim();
        localStorage.setItem('POLICY_AI_API_KEY', state.apiKey);
        localStorage.setItem('POLICY_AI_BASE_URL', state.baseUrl);
        localStorage.setItem('POLICY_AI_MODEL', state.model);
        el.apiKeyDrawer.classList.add('hidden');
        showToast('✅ API Key 与模型配置已保存！');
    });

    // 顶部按钮操作
    el.btnScrape.addEventListener('click', handleScrapeNow);
    el.btnExportWord.addEventListener('click', handleExportWord);
    el.btnPushWechat.addEventListener('click', handlePushWechat);
}

// 初始化 API Key 表单
function initApiKeyForm() {
    el.inputApiKey.value = state.apiKey;
    el.inputBaseUrl.value = state.baseUrl;
    el.inputModel.value = state.model;
}

// 搜索处理
function handleSearch() {
    state.searchQuery = el.searchInput.value.trim();
    loadPolicies();
}

// 加载统计数据
async function loadStats() {
    try {
        const resp = await fetch('/api/stats');
        const res = await resp.json();
        if (res.code === 0) {
            const stats = res.data.stats;
            const categories = res.data.categories || {};
            el.statsBadge.textContent = `系统正常运行 · 累计收录 ${stats.total} 篇政策`;

            // 更新赛道数字
            const countAll = document.getElementById('count-all');
            if (countAll) countAll.textContent = stats.total;

            const tracks = ['核医药', '脑机接口', 'AI制药', '医疗机器人', '医保政策', '科技申报政策'];
            tracks.forEach(tr => {
                const badge = document.getElementById(`count-${tr}`);
                if (badge) {
                    badge.textContent = categories[tr] || 0;
                }
            });
        }
    } catch (e) {
        console.error('加载统计失败', e);
    }
}

// 加载政策列表
async function loadPolicies() {
    el.policyList.innerHTML = '<div class="loading-spinner">正在检索政策数据...</div>';
    try {
        const url = `/api/policies?category=${encodeURIComponent(state.currentTrack)}&q=${encodeURIComponent(state.searchQuery)}`;
        const resp = await fetch(url);
        const res = await resp.json();
        if (res.code === 0) {
            state.policies = res.data;
            renderPolicyList(res.data);
        }
    } catch (e) {
        el.policyList.innerHTML = `<div class="loading-spinner" style="color:#f43f5e">加载失败: ${e.message}</div>`;
    }
}

// 渲染政策卡片
function renderPolicyList(list) {
    if (!list || list.length === 0) {
        el.policyList.innerHTML = '<div class="loading-spinner">暂未检索到相关政策文件</div>';
        return;
    }

    const html = list.map((item, idx) => {
        const category = item.category || '科技申报政策';
        const pubDate = item.pub_date || '近期发布';
        const source = item.source || '官方部门';
        const summary = item.summary || item.title;

        return `
            <div class="policy-item-card">
                <div class="policy-meta">
                    <span class="tag-pill tag-${category}">${category}</span>
                    <span class="source-tag">🏛️ ${source}</span>
                    <span class="date-tag">📅 ${pubDate}</span>
                </div>
                <h3 class="policy-title">${idx + 1}. ${item.title}</h3>
                <p class="policy-summary">${summary}</p>
                <div class="policy-footer">
                    <span style="color:#64748b">ID: #${item.id}</span>
                    <a href="${item.url}" target="_blank" rel="noopener" class="policy-link">
                        查看官方原文 ➔
                    </a>
                </div>
            </div>
        `;
    }).join('');

    el.policyList.innerHTML = html;
}

// 发送 AI 聊天
async function sendChatMessage() {
    const prompt = el.chatInput.value.trim();
    if (!prompt) return;

    // 添加用户气泡
    appendMessage(prompt, 'user');
    el.chatInput.value = '';

    // 添加 Bot 加载中气泡
    const loadingId = appendMessage('🤖 正在深度分析中，请稍候...', 'bot');

    try {
        const resp = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                api_key: state.apiKey,
                base_url: state.baseUrl,
                model: state.model
            })
        });
        const res = await resp.json();
        updateMessage(loadingId, res.reply || '无应答');
    } catch (e) {
        updateMessage(loadingId, `❌ 调用失败: ${e.message}`);
    }
}

// 一键生成四川生物医药周回顾
async function generateSichuanWeeklyReport() {
    appendMessage('⚡ 正在调取四川省科技厅、发改委、成都市经信局最新生物医药科技奖补与资金申报数据，生成深度周回顾...', 'user');
    const loadingId = appendMessage('🤖 正在起草《四川省生物医药科技创新与奖补周回顾报告》5大结构化模块...', 'bot');

    try {
        const resp = await fetch('/api/weekly-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: state.apiKey,
                base_url: state.baseUrl,
                model: state.model
            })
        });
        const res = await resp.json();
        updateMessage(loadingId, res.report || '生成完毕');
        showToast('📄 四川省生物医药周回顾报告已生成！');
    } catch (e) {
        updateMessage(loadingId, `❌ 生成失败: ${e.message}`);
    }
}

// 渲染聊天气泡辅助函数
function appendMessage(text, role) {
    const msgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${role}`;
    bubble.id = msgId;

    const formattedContent = parseMarkdownSimple(text);
    bubble.innerHTML = `<div class="bubble-content">${formattedContent}</div>`;

    el.chatMessages.appendChild(bubble);
    el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
    return msgId;
}

function updateMessage(msgId, text) {
    const bubble = document.getElementById(msgId);
    if (bubble) {
        const contentEl = bubble.querySelector('.bubble-content');
        if (contentEl) {
            contentEl.innerHTML = parseMarkdownSimple(text);
        }
    }
    el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
}

// 轻量 Markdown 转 HTML 解析器
function parseMarkdownSimple(md) {
    if (!md) return '';
    let html = md;
    // 标题
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    // 加粗
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    // 列表项
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    // 链接
    html = html.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" style="color:#38bdf8">$1</a>');
    // 换行
    html = html.replace(/\n\n/gim, '<br><br>');
    html = html.replace(/\n/gim, '<br>');
    return html;
}

// 顶部按钮操作实现
async function handleScrapeNow() {
    showToast('🔄 正在全网检索各大部委与四川省局最新政策...');
    try {
        const resp = await fetch('/api/scrape-now', { method: 'POST' });
        const res = await resp.json();
        showToast(res.msg || '全网政策采集完成！');
        loadStats();
        loadPolicies();
    } catch (e) {
        showToast('❌ 采集出错: ' + e.message);
    }
}

async function handleExportWord() {
    showToast('📄 正在导出符合 GB/T 9704-2012 公文标准的 Word 简报...');
    try {
        const resp = await fetch('/api/export-word', { method: 'POST' });
        const res = await resp.json();
        showToast(res.msg || 'Word 简报已成功保存到您的桌面！');
    } catch (e) {
        showToast('❌ 导出出错: ' + e.message);
    }
}

async function handlePushWechat() {
    showToast('📱 正在向个人微信派发最新医药政策早报...');
    try {
        const resp = await fetch('/api/push-wechat', { method: 'POST' });
        const res = await resp.json();
        showToast(res.msg || '微信推送完成！');
    } catch (e) {
        showToast('❌ 推送出错: ' + e.message);
    }
}

// 吐司通知
function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    setTimeout(() => {
        el.toast.classList.add('hidden');
    }, 3500);
}
