/**
 * 医药健康产业政策监测与申报研判系统 - 前端交互
 * 参照国家药品监督管理局 (NMPA) 官方网站规范标准
 */

// 状态管理
const state = {
    currentTrack: 'all',
    searchQuery: '',
    policies: [],
    theme: localStorage.getItem('POLICY_THEME') || 'light',
    apiKey: localStorage.getItem('POLICY_AI_API_KEY') || '',
    baseUrl: localStorage.getItem('POLICY_AI_BASE_URL') || 'https://api.deepseek.com/v1',
    model: localStorage.getItem('POLICY_AI_MODEL') || 'deepseek-chat',
};

// DOM 元素引用
const el = {
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeIcon: document.getElementById('themeIcon'),
    themeText: document.getElementById('themeText'),
    policyList: document.getElementById('policyList'),
    statsBadge: document.getElementById('statsSummary'),
    currentDateStr: document.getElementById('currentDateStr'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    navItems: document.querySelectorAll('.nav-item'),
    btnScrape: document.getElementById('btnScrape'),
    btnExportWord: document.getElementById('btnExportWord'),
    btnPushWechat: document.getElementById('btnPushWechat'),
    btnGenWeekly: document.getElementById('btnGenWeekly'),
    chatMessages: document.getElementById('chatMessages'),
    chatInput: document.getElementById('chatInput'),
    btnSendChat: document.getElementById('btnSendChat'),
    queryTags: document.querySelectorAll('.tag-chip'),
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
    updateDateDisplay();
    applyTheme(state.theme);
    initApiKeyForm();
    loadStats();
    loadPolicies();
    bindEvents();
});

// 顶部政务日期显示
function updateDateDisplay() {
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const day = days[now.getDay()];
    if (el.currentDateStr) {
        el.currentDateStr.textContent = `📅 ${year}年${month}月${date}日 ${day} · 官方政策实时监测中`;
    }
}

// 主题切换 (亮色 / 深色)
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    state.theme = theme;
    localStorage.setItem('POLICY_THEME', theme);
    if (theme === 'dark') {
        el.themeIcon.textContent = '🌙';
        el.themeText.textContent = '夜间内参';
    } else {
        el.themeIcon.textContent = '☀️';
        el.themeText.textContent = '政务亮色';
    }
}

function toggleTheme() {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
}

// 事件绑定
function bindEvents() {
    el.themeToggleBtn.addEventListener('click', toggleTheme);

    // NMPA 经典蓝导航栏点击切换
    el.navItems.forEach(item => {
        item.addEventListener('click', () => {
            el.navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            state.currentTrack = item.getAttribute('data-track');
            el.listBadge.textContent = item.querySelector('a').textContent.split('(')[0].trim();
            loadPolicies();
        });
    });

    // 搜索
    el.searchBtn.addEventListener('click', handleSearch);
    el.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // 快捷议题
    el.queryTags.forEach(tag => {
        tag.addEventListener('click', () => {
            const prompt = tag.getAttribute('data-prompt');
            el.chatInput.value = prompt;
            sendChatMessage();
        });
    });

    // 发送研判
    el.btnSendChat.addEventListener('click', sendChatMessage);
    el.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });

    // 四川生物医药周回顾一键生成
    el.btnGenWeekly.addEventListener('click', generateSichuanWeeklyReport);

    // 抽屉切换
    el.toggleApiKey.addEventListener('click', () => {
        el.apiKeyDrawer.classList.toggle('hidden');
    });

    el.btnSaveKey.addEventListener('click', () => {
        state.apiKey = el.inputApiKey.value.trim();
        state.baseUrl = el.inputBaseUrl.value.trim();
        state.model = el.inputModel.value.trim();
        localStorage.setItem('POLICY_AI_API_KEY', state.apiKey);
        localStorage.setItem('POLICY_AI_BASE_URL', state.baseUrl);
        localStorage.setItem('POLICY_AI_MODEL', state.model);
        el.apiKeyDrawer.classList.add('hidden');
        showToast('✅ 模型参数与密钥已更新');
    });

    // 顶部按钮
    el.btnScrape.addEventListener('click', handleScrapeNow);
    el.btnExportWord.addEventListener('click', handleExportWord);
    el.btnPushWechat.addEventListener('click', handlePushWechat);
}

function initApiKeyForm() {
    el.inputApiKey.value = state.apiKey;
    el.inputBaseUrl.value = state.baseUrl;
    el.inputModel.value = state.model;
}

function handleSearch() {
    state.searchQuery = el.searchInput.value.trim();
    loadPolicies();
}

async function loadStats() {
    try {
        const resp = await fetch('/api/stats');
        const res = await resp.json();
        if (res.code === 0) {
            const stats = res.data.stats;
            const categories = res.data.categories || {};
            el.statsBadge.textContent = `系统已就绪 · 累计收录 ${stats.total} 篇政策法规`;

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
        console.error('统计加载失败', e);
    }
}

async function loadPolicies() {
    el.policyList.innerHTML = '<div class="loading-state">正在调取国家及省局官方政策库...</div>';
    try {
        const url = `/api/policies?category=${encodeURIComponent(state.currentTrack)}&q=${encodeURIComponent(state.searchQuery)}`;
        const resp = await fetch(url);
        const res = await resp.json();
        if (res.code === 0) {
            state.policies = res.data;
            renderPolicyList(res.data);
        }
    } catch (e) {
        el.policyList.innerHTML = `<div class="loading-state" style="color:#c5161d">检索异常: ${e.message}</div>`;
    }
}

function renderPolicyList(list) {
    if (!list || list.length === 0) {
        el.policyList.innerHTML = '<div class="loading-state">暂未检索到符合条件的官方政策文件</div>';
        return;
    }

    const html = list.map((item, idx) => {
        const category = item.category || '科技申报政策';
        const pubDate = item.pub_date || '近期发布';
        const source = item.source || '官方部门';
        const summary = item.summary || item.title;

        return `
            <article class="nmpa-policy-row">
                <div class="row-top">
                    <span class="tag-dept">${source}</span>
                    <span class="tag-category">${category}</span>
                    <span class="row-date">发布日期: ${pubDate}</span>
                </div>
                <h3 class="row-title">${idx + 1}. ${item.title}</h3>
                <p class="row-summary">${summary}</p>
                <div class="row-bottom">
                    <span style="color:var(--text-caption)">索引编号: #${item.id}</span>
                    <a href="${item.url}" target="_blank" rel="noopener" class="link-detail">
                        查看官方文件原文 ➔
                    </a>
                </div>
            </article>
        `;
    }).join('');

    el.policyList.innerHTML = html;
}

async function sendChatMessage() {
    const prompt = el.chatInput.value.trim();
    if (!prompt) return;

    appendMessage(prompt, 'user-row');
    el.chatInput.value = '';

    const loadingId = appendMessage('正在研判相关政策细则与申报条件...', 'bot-row');

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
        updateMessage(loadingId, `研判服务调用失败: ${e.message}`);
    }
}

async function generateSichuanWeeklyReport() {
    appendMessage('调取四川省科技厅、省发改委、成都市经信局最新生物医药科技奖补与资金申报数据，编制深度周回顾报告。', 'user-row');
    const loadingId = appendMessage('正在起草《四川省生物医药科技创新与奖补周回顾报告》（5大核心要点）...', 'bot-row');

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
        updateMessage(loadingId, res.report || '编制完成');
        showToast('📄 四川省生物医药周回顾报告编制完成');
    } catch (e) {
        updateMessage(loadingId, `报告编制失败: ${e.message}`);
    }
}

function appendMessage(text, role) {
    const msgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    const row = document.createElement('div');
    row.className = `dialog-row ${role}`;
    row.id = msgId;

    const formattedContent = parseMarkdownSimple(text);
    row.innerHTML = `
        <div class="dialog-card">
            ${role === 'bot-row' ? '<div class="dialog-author">政策研究室工作台</div>' : ''}
            ${formattedContent}
        </div>
    `;

    el.chatMessages.appendChild(row);
    el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
    return msgId;
}

function updateMessage(msgId, text) {
    const row = document.getElementById(msgId);
    if (row) {
        const card = row.querySelector('.dialog-card');
        if (card) {
            const authorHtml = row.classList.contains('bot-row') ? '<div class="dialog-author">政策研究室工作台</div>' : '';
            card.innerHTML = authorHtml + parseMarkdownSimple(text);
        }
    }
    el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
}

function parseMarkdownSimple(md) {
    if (!md) return '';
    let html = md;
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" style="color:var(--nmpa-blue-main);text-decoration:underline;">$1</a>');
    html = html.replace(/\n\n/gim, '<br><br>');
    html = html.replace(/\n/gim, '<br>');
    return html;
}

async function handleScrapeNow() {
    showToast('正在全网检索各大部委与四川省局最新政策...');
    try {
        const resp = await fetch('/api/scrape-now', { method: 'POST' });
        const res = await resp.json();
        showToast(res.msg || '政策检索完成');
        loadStats();
        loadPolicies();
    } catch (e) {
        showToast('检索出错: ' + e.message);
    }
}

async function handleExportWord() {
    showToast('正在按照 GB/T 9704-2012 公文标准导出 Word 报告...');
    try {
        const resp = await fetch('/api/export-word', { method: 'POST' });
        const res = await resp.json();
        showToast(res.msg || 'Word 简报已成功保存到您的桌面！');
    } catch (e) {
        showToast('导出出错: ' + e.message);
    }
}

async function handlePushWechat() {
    showToast('正在向个人微信派发最新医药政策早报...');
    try {
        const resp = await fetch('/api/push-wechat', { method: 'POST' });
        const res = await resp.json();
        showToast(res.msg || '微信推送完成');
    } catch (e) {
        showToast('推送出错: ' + e.message);
    }
}

function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    setTimeout(() => {
        el.toast.classList.add('hidden');
    }, 3500);
}
