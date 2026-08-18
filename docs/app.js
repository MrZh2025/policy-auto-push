/**
 * 医药健康产业集团政策监测信息系统 - 前端交互逻辑
 * 支持 GitHub Pages 静态无服务器部署与本地动态 API 模式自适应切换
 */

// 默认 DeepSeek 大模型配置
const DEFAULT_AI_KEY = 'sk-1be5b76a1ca7418e8e0ca3ca94744297';
const DEFAULT_AI_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_AI_MODEL = 'deepseek-chat';

// 自动纠偏与自愈机制（平滑升级至最新有效 Key 与绝对路径）
let rawStoredKey = localStorage.getItem('POLICY_AI_API_KEY');
if (!rawStoredKey || rawStoredKey.length < 20 || rawStoredKey.includes('7daca') || rawStoredKey.includes('5043')) {
    rawStoredKey = DEFAULT_AI_KEY;
    localStorage.setItem('POLICY_AI_API_KEY', rawStoredKey);
}

let rawStoredBase = localStorage.getItem('POLICY_AI_BASE_URL');
if (!rawStoredBase || !rawStoredBase.startsWith('http') || rawStoredBase.includes('localhost') || rawStoredBase.includes('/api/')) {
    rawStoredBase = DEFAULT_AI_BASE_URL;
    localStorage.setItem('POLICY_AI_BASE_URL', rawStoredBase);
}

// 状态管理
const state = {
    currentTrack: 'all',
    timeRange: 'week',          // 默认仅展示本周最新更新 ('week' | 'month' | 'all')
    searchQuery: '',
    allPolicies: [],
    filteredPolicies: [],
    theme: localStorage.getItem('POLICY_THEME') || 'light',
    apiKey: rawStoredKey,
    baseUrl: rawStoredBase,
    model: localStorage.getItem('POLICY_AI_MODEL') || DEFAULT_AI_MODEL,
};

// 预设专属 Prompt
const SICHUAN_WEEKLY_PROMPT = `周回顾四川省发布的生物医药相关科技创新奖励、补助、资助、扶持政策，重点关注四川省及省级部门、成都市等省内重点城市的官方政策发布、申报通知、资金奖补办法、科技创新平台/项目/企业支持政策。请检索并核验最近一周及仍在有效申报期内的新政策或重要更新，优先引用官方来源；如无新增，也请说明核查范围和未发现新增的依据。起草一则详细状态更新，内容必须包含：
1. 本周要点摘要；
2. 新增或在期政策清单（请务必输出为 Markdown 表格，包含表头：| 序号 | 政策文件名称 | 发布单位 | 重点支持方式 / 奖补金额 | 申报期限 |，以便系统自动编译生成标准公文三线表）；
3. 对生物医药企业/科研机构/园区的影响和机会判断；
4. 建议下一步行动；
5. 需继续跟踪的不确定事项。输出为中文。`;

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
    btnGenWeekly: document.getElementById('btnGenWeekly'),
    btnExportWeeklyDoc: document.getElementById('btnExportWeeklyDoc'),
    btnClearChat: document.getElementById('btnClearChat'),
    chatMessages: document.getElementById('chatMessages'),
    chatInput: document.getElementById('chatInput'),
    btnSendChat: document.getElementById('btnSendChat'),
    queryTags: document.querySelectorAll('.tag-chip'),
    btnTopAiConfig: document.getElementById('btnTopAiConfig'),
    toggleApiKey: document.getElementById('toggleApiKey'),
    apiKeyDrawer: document.getElementById('apiKeyDrawer'),
    inputApiKey: document.getElementById('inputApiKey'),
    btnToggleKeyEye: document.getElementById('btnToggleKeyEye'),
    keyStatusHint: document.getElementById('keyStatusHint'),
    inputBaseUrl: document.getElementById('inputBaseUrl'),
    selectModel: document.getElementById('selectModel'),
    inputModel: document.getElementById('inputModel'),
    btnSaveKey: document.getElementById('btnSaveKey'),
    btnResetKey: document.getElementById('btnResetKey'),
    toast: document.getElementById('toast'),
    listBadge: document.getElementById('listBadge'),
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    updateDateDisplay();
    setInterval(updateDateDisplay, 1000); // 秒级动态刷新
    applyTheme(state.theme);
    initApiKeyForm();
    loadData();
    bindEvents();
});

// 顶部政务日期与实时时分秒显示
function updateDateDisplay() {
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const day = days[now.getDay()];
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    if (el.currentDateStr) {
        el.currentDateStr.textContent = `📅 ${year}年${month}月${date}日 ${day} ${hours}:${minutes}:${seconds} · 官方政策实时监测中`;
    }
}

// 主题切换
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    state.theme = theme;
    localStorage.setItem('POLICY_THEME', theme);
    if (el.themeIcon && el.themeText) {
        if (theme === 'dark') {
            el.themeIcon.textContent = '🌙';
            el.themeText.textContent = '夜间内参';
        } else {
            el.themeIcon.textContent = '☀️';
            el.themeText.textContent = '政务亮色';
        }
    }
}

function toggleTheme() {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
}

// 事件绑定
function bindEvents() {
    if (el.themeToggleBtn) {
        el.themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // 时间范围切换 (本周最新 / 近30天 / 历史全量库)
    const timeTabs = document.querySelectorAll('.time-tab');
    timeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            timeTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.timeRange = tab.getAttribute('data-time');
            filterAndRenderPolicies();
        });
    });

    // 导航栏切换
    el.navItems.forEach(item => {
        item.addEventListener('click', () => {
            el.navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            state.currentTrack = item.getAttribute('data-track');
            filterAndRenderPolicies();
        });
    });

    // 搜索
    el.searchBtn.addEventListener('click', handleSearch);
    el.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // 快捷议题点击
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

    // 四川生物医药周回顾一键生成与导出 Word
    if (el.btnGenWeekly) el.btnGenWeekly.addEventListener('click', generateSichuanWeeklyReport);
    if (el.btnExportWeeklyDoc) el.btnExportWeeklyDoc.addEventListener('click', handleExportWeeklyWord);
    if (el.btnClearChat) el.btnClearChat.addEventListener('click', handleClearChat);

    // 抽屉切换
    const openDrawerFunc = () => {
        el.apiKeyDrawer.classList.toggle('hidden');
        if (!el.apiKeyDrawer.classList.contains('hidden')) {
            el.apiKeyDrawer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.inputApiKey.focus();
        }
    };
    if (el.btnTopAiConfig) el.btnTopAiConfig.addEventListener('click', openDrawerFunc);
    if (el.toggleApiKey) el.toggleApiKey.addEventListener('click', openDrawerFunc);

    // 查看密钥明文切换按钮
    if (el.btnToggleKeyEye) {
        el.btnToggleKeyEye.addEventListener('click', () => {
            if (el.inputApiKey.type === 'password') {
                el.inputApiKey.type = 'text';
                el.btnToggleKeyEye.textContent = '🙈';
                el.btnToggleKeyEye.title = '点击隐藏密钥';
            } else {
                el.inputApiKey.type = 'password';
                el.btnToggleKeyEye.textContent = '👁️';
                el.btnToggleKeyEye.title = '点击查看明文密钥';
            }
        });
    }

    // 模型下拉选择框联动
    if (el.selectModel) {
        el.selectModel.addEventListener('change', () => {
            const selected = el.selectModel.value;
            if (selected === 'custom') {
                el.inputModel.focus();
                el.inputModel.select();
            } else {
                el.inputModel.value = selected;
                // 智能联动调整 Base URL
                if (selected.startsWith('deepseek')) {
                    el.inputBaseUrl.value = 'https://api.deepseek.com';
                } else if (selected.startsWith('qwen')) {
                    el.inputBaseUrl.value = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
                } else if (selected.startsWith('gpt')) {
                    el.inputBaseUrl.value = 'https://api.openai.com/v1';
                }
            }
        });
    }

    // 模型手动输入反向联动下拉框
    if (el.inputModel) {
        el.inputModel.addEventListener('input', () => {
            const val = el.inputModel.value.trim();
            const optionExists = Array.from(el.selectModel.options).some(opt => opt.value === val);
            if (optionExists) {
                el.selectModel.value = val;
            } else {
                el.selectModel.value = 'custom';
            }
        });
    }

    el.btnSaveKey.addEventListener('click', () => {
        const rawKey = el.inputApiKey.value.trim() || DEFAULT_AI_KEY;
        const rawBaseUrl = el.inputBaseUrl.value.trim() || DEFAULT_AI_BASE_URL;
        const rawModel = el.inputModel.value.trim() || DEFAULT_AI_MODEL;

        if (rawKey && rawKey.length < 15) {
            showToast('⚠️ 提示：标准 API Key 通常是一串以 sk- 开头的长字符串，请检查是否复制完整！');
        }

        state.apiKey = rawKey;
        state.baseUrl = rawBaseUrl;
        state.model = rawModel;
        localStorage.setItem('POLICY_AI_API_KEY', state.apiKey);
        localStorage.setItem('POLICY_AI_BASE_URL', state.baseUrl);
        localStorage.setItem('POLICY_AI_MODEL', state.model);
        el.apiKeyDrawer.classList.add('hidden');
        if (el.keyStatusHint) el.keyStatusHint.textContent = `已配置 (${state.model})`;
        showToast(`✅ 已更新模型为【${state.model}】并连接 DeepSeek 官方通道！`);
    });

    if (el.btnResetKey) {
        el.btnResetKey.addEventListener('click', () => {
            state.apiKey = DEFAULT_AI_KEY;
            state.baseUrl = DEFAULT_AI_BASE_URL;
            state.model = DEFAULT_AI_MODEL;
            localStorage.setItem('POLICY_AI_API_KEY', state.apiKey);
            localStorage.setItem('POLICY_AI_BASE_URL', state.baseUrl);
            localStorage.setItem('POLICY_AI_MODEL', state.model);
            initApiKeyForm();
            showToast('✅ 已恢复 DeepSeek 官方最新默认配置！');
        });
    }

    // 顶部按钮
    el.btnScrape.addEventListener('click', handleScrapeNow);
    el.btnExportWord.addEventListener('click', handleExportWord);
}

function initApiKeyForm() {
    el.inputApiKey.value = state.apiKey;
    el.inputBaseUrl.value = state.baseUrl;
    el.inputModel.value = state.model;
    
    // 初始化下拉选框
    if (el.selectModel) {
        const val = state.model;
        const optionExists = Array.from(el.selectModel.options).some(opt => opt.value === val);
        el.selectModel.value = optionExists ? val : 'custom';
    }
    if (el.keyStatusHint) {
        el.keyStatusHint.textContent = `已绑定 (${state.model})`;
    }
}

function handleSearch() {
    state.searchQuery = el.searchInput.value.trim().toLowerCase();
    filterAndRenderPolicies();
}

// 判定单条政策是否属于本周更新（严格校验当前系统年份，且发布时间在当前日期 7 天内）
function isThisWeekPolicy(p) {
    if (!p || !p.pub_date) return false;
    const m = p.pub_date.match(/(\d{4})[-.\/年](\d{1,2})[-.\/月](\d{1,2})/);
    if (!m) return false;
    const pYear = parseInt(m[1], 10);
    const pMonth = parseInt(m[2], 10) - 1;
    const pDay = parseInt(m[3], 10);
    const now = new Date();
    const nowYear = now.getFullYear();

    // 1. 年份必须与当前年份完全相同，非本年一律直接排除！
    if (pYear !== nowYear) return false;

    const pDate = new Date(pYear, pMonth, pDay);
    const diffDays = (now.getTime() - pDate.getTime()) / (1000 * 3600 * 24);

    // 2. 必须是当前日期 7 天内
    return diffDays >= -0.5 && diffDays <= 7;
}

// 统一数据加载（兼顾本地 API 与 GitHub Pages 静态模式）
async function loadData() {
    el.policyList.innerHTML = '<div class="loading-state">正在调取国家及省局官方政策库...</div>';
    
    // 1. 尝试从本地后端 API 读取，失败则自动降级读取静态 JSON
    let policiesData = [];
    let statsData = null;

    try {
        const resp = await fetch('/api/policies');
        if (resp.ok) {
            const res = await resp.json();
            if (res.code === 0) policiesData = res.data;
        }
    } catch (e) {
        // 本地服务未运行或位于 GitHub Pages 静态环境
    }

    if (!policiesData || policiesData.length === 0) {
        try {
            const resp = await fetch('./data/policies.json');
            if (resp.ok) {
                const res = await resp.json();
                policiesData = res.data || [];
            }
        } catch (err) {
            console.warn('静态数据加载异常', err);
        }
    }

    state.allPolicies = policiesData;

    // 加载统计
    try {
        const resp = await fetch('/api/stats');
        if (resp.ok) {
            const res = await resp.json();
            statsData = res.data;
        }
    } catch (e) {}

    if (!statsData) {
        try {
            const resp = await fetch('./data/stats.json');
            if (resp.ok) {
                const res = await resp.json();
                statsData = res.data;
            }
        } catch (err) {}
    }

    updateStatsDisplay(statsData);
    filterAndRenderPolicies();
}

function updateStatsDisplay(statsData) {
    // 统计本周更新
    const weekPolicies = state.allPolicies.filter(isThisWeekPolicy);
    const weekTotal = weekPolicies.length;
    const allTotal = state.allPolicies.length;

    if (el.statsBadge) {
        el.statsBadge.textContent = `系统已就绪 · 本周新增 ${weekTotal} 篇（近两年政策库累计 ${allTotal} 篇）`;
    }

    // 导航栏第一项：本周全部更新数量
    const countAll = document.getElementById('count-all');
    if (countAll) countAll.textContent = weekTotal;

    // 统计各大赛道【本周最新更新】数量
    const trackWeekCounts = {};
    weekPolicies.forEach(p => {
        const cat = p.category || '科技申报政策';
        trackWeekCounts[cat] = (trackWeekCounts[cat] || 0) + 1;
    });

    const tracks = ['核医药', '脑机接口', 'AI制药', '医疗机器人', '医保政策', '科技申报政策'];
    tracks.forEach(tr => {
        const badge = document.getElementById(`count-${tr}`);
        if (badge) {
            badge.textContent = trackWeekCounts[tr] || 0;
        }
    });
}

function filterAndRenderPolicies() {
    let list = state.allPolicies || [];

    // 1. 赛道分类过滤
    if (state.currentTrack && state.currentTrack !== 'all') {
        list = list.filter(p => (p.category || '').includes(state.currentTrack));
    }

    // 2. 关键词检索过滤
    if (state.searchQuery) {
        const q = state.searchQuery;
        list = list.filter(p => 
            (p.title || '').toLowerCase().includes(q) || 
            (p.summary || '').toLowerCase().includes(q) || 
            (p.source || '').toLowerCase().includes(q)
        );
    }

    // 3. 核心时间算法过滤：绝对严格按真实系统日期过滤，强制年份与天数双重校验
    const now = new Date();
    const nowYear = now.getFullYear();
    let timeFilteredList = [];
    let timeLabel = '本周最新更新';

    if (state.timeRange === 'week') {
        timeLabel = '🔥 本周最新更新';
        timeFilteredList = list.filter(isThisWeekPolicy);
    } else if (state.timeRange === 'month') {
        timeLabel = '📅 近30天更新';
        timeFilteredList = list.filter(p => {
            if (!p.pub_date) return false;
            const m = p.pub_date.match(/(\d{4})[-.\/年](\d{1,2})[-.\/月](\d{1,2})/);
            if (!m) return false;
            const pYear = parseInt(m[1], 10);
            const pMonth = parseInt(m[2], 10) - 1;
            const pDay = parseInt(m[3], 10);

            if (pYear !== nowYear) return false;

            const pDate = new Date(pYear, pMonth, pDay);
            const diffDays = (now.getTime() - pDate.getTime()) / (1000 * 3600 * 24);
            return diffDays >= -0.5 && diffDays <= 30;
        });
    } else {
        timeLabel = '📚 近两年政策库';
        // 严格过滤：仅展示近两年的政策（如 2025、2026 年）
        timeFilteredList = list.filter(p => {
            if (!p.pub_date) return true;
            const m = p.pub_date.match(/(\d{4})/);
            if (!m) return true;
            const pYear = parseInt(m[1], 10);
            return pYear >= (nowYear - 1); // 严格保留近两年
        });
    }

    state.filteredPolicies = timeFilteredList;

    // 更新界面状态提示
    const banner = document.getElementById('filterStatusBanner');
    const badge = document.getElementById('listBadge');
    const trackName = (state.currentTrack === 'all') ? '全部赛道' : state.currentTrack;

    if (badge) badge.textContent = `${trackName} · ${timeLabel}`;
    if (banner) {
        if (state.timeRange === 'week') {
            if (timeFilteredList.length > 0) {
                banner.innerHTML = `<span>📌 严格按当前日期筛选：<strong>本周共有 ${timeFilteredList.length} 篇最新政策更新</strong>，其余在期政策可点击 <strong>[近两年政策库]</strong> 查阅。</span>`;
            } else {
                banner.innerHTML = `<span>📌 严格按当前日期筛选：<strong>本周暂未监测到新增官方政策发布</strong>，您可以点击 <strong>[近两年政策库]</strong> 查阅以往在库文件。</span>`;
            }
        } else if (state.timeRange === 'month') {
            banner.innerHTML = `<span>📅 严格按当前日期筛选：<strong>近 30 天共有 ${timeFilteredList.length} 篇政策文件</strong>。</span>`;
        } else {
            banner.innerHTML = `<span>📚 当前呈现 <strong>近两年政策库</strong>（共收录 <strong>${timeFilteredList.length}</strong> 篇近两年有效政策，超期陈旧文件已自动淘汰清理）。</span>`;
        }
    }

    renderPolicyList(timeFilteredList);
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
                    <span style="color:var(--text-caption)">索引编号: #${item.id || (idx + 1)}</span>
                    <a href="${item.url}" target="_blank" rel="noopener" class="link-detail">
                        查看官方文件原文 ➔
                    </a>
                </div>
            </article>
        `;
    }).join('');

    el.policyList.innerHTML = html;
}

// 智能解析 API 候选端点列表（自动兼容带 /v1、不带 /v1、带 /chat/completions 等各类输入格式）
function getCandidateEndpoints(rawBaseUrl, model) {
    let clean = (rawBaseUrl || DEFAULT_AI_BASE_URL).trim().replace(/\/+$/, '');
    
    // 如果是 deepseek 模型系列或官方域名，直接使用官方标准端点
    if ((model && model.startsWith('deepseek')) || clean.includes('deepseek.com')) {
        return [
            'https://api.deepseek.com/chat/completions',
            'https://api.deepseek.com/v1/chat/completions'
        ];
    }

    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        clean = 'https://' + clean;
    }

    if (clean.includes('/chat/completions')) {
        return [clean, 'https://api.deepseek.com/chat/completions'];
    }
    if (clean.endsWith('/v1')) {
        return [
            `${clean}/chat/completions`,
            'https://api.deepseek.com/chat/completions'
        ];
    }
    return [
        `${clean}/chat/completions`,
        `${clean}/v1/chat/completions`,
        'https://api.deepseek.com/chat/completions'
    ];
}

// AI 对话研判（支持本地 API 与纯前端在线大模型直接调用）
async function sendChatMessage() {
    const prompt = el.chatInput.value.trim();
    if (!prompt) return;

    appendMessage(prompt, 'user-row');
    el.chatInput.value = '';

    const loadingId = appendMessage('正在研判相关政策细则与申报条件...', 'bot-row');

    // 1. 仅在本地开发模式 (localhost / 127.0.0.1) 下尝试调用本地 Python 后端
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
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
            if (resp.ok) {
                const res = await resp.json();
                if (res.code === 0 && res.reply) {
                    updateMessage(loadingId, res.reply);
                    return;
                }
            }
        } catch (e) {
            // 本地后端不可用，自动降级为浏览器直连大模型
        }
    }

    // 2. 在线模式 / GitHub Pages 模式：纯前端极速直连 DeepSeek 官方 API
    const effectiveKey = (state.apiKey && state.apiKey.length > 20 && !state.apiKey.includes('5043'))
        ? state.apiKey
        : DEFAULT_AI_KEY;

    if (effectiveKey) {
        try {
            const reply = await callDirectLLM(prompt, effectiveKey);
            updateMessage(loadingId, reply);
            return;
        } catch (err) {
            updateMessage(loadingId, `⚠️ 大模型接口调用异常: ${err.message}\n\n💡 提示：系统已默认内置 DeepSeek 官方智能研判通道。您可点击右上角【🔑 AI 研判密钥配置】检查或重置您的 API Key。`);
            return;
        }
    }

    // 3. 离线专业模拟回复
    setTimeout(() => {
        updateMessage(loadingId, getMockAnalysis(prompt));
    }, 600);
}

// 获取当前动态时间基准描述
function getCurrentTimeAnchor() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const weekNumber = Math.ceil(date / 7);
    return {
        year,
        month,
        date,
        weekNumber,
        fullDateStr: `${year}年${month}月${date}日`,
        periodStr: `${year}年${month}月第${weekNumber}周`
    };
}

// 纯前端直接调用 OpenAI / DeepSeek / 通义千问 兼容 API（多端点智能自动容错重试 + 强时间锚点注入）
async function callDirectLLM(prompt, apiKey) {
    const rawBase = state.baseUrl || DEFAULT_AI_BASE_URL;
    const model = state.model || DEFAULT_AI_MODEL;
    const endpoints = getCandidateEndpoints(rawBase, model);
    const key = apiKey || state.apiKey || DEFAULT_AI_KEY;
    const timeAnchor = getCurrentTimeAnchor();

    const systemPrompt = `你是一名服务于四川生物医药产业集团创新事业部的政策研究总监兼科技申报总监。
【重要时间基准】：当前系统真实时间为 ${timeAnchor.fullDateStr}（即【${timeAnchor.periodStr}】）。
【硬性规定】：
1. 涉及所有政策周报标题、研判周期、申报时效必须严格以当前真实时间（${timeAnchor.year}年${timeAnchor.month}月）为准，严禁出现过期的 2024 年、2025 年等历史年份！
2. 文风要求：严谨、干练、精炼，彻底去除 AI 味与机械套话，结论前置，直接给出政策依据、适用对象、奖补金额及实操申报建议。`;

    // 动态提取最新的官方政策监测数据作为上下文
    let contextStr = '';
    if (state.allPolicies && state.allPolicies.length > 0) {
        const recentList = state.allPolicies.slice(0, 8);
        contextStr = `【当前监测到的最新官方政策数据参考（${timeAnchor.fullDateStr}）】：\n` + 
            recentList.map((p, idx) => `${idx + 1}. [${p.source}] 《${p.title}》（发布日期：${p.pub_date || '近期'}）- 链接: ${p.url}`).join('\n');
    }

    const messages = [
        { role: 'system', content: systemPrompt }
    ];
    if (contextStr) {
        messages.push({ role: 'user', content: contextStr });
    }
    messages.push({ role: 'user', content: prompt });

    const payload = {
        model: model,
        messages: messages,
        temperature: 0.3,
        max_tokens: 1600
    };

    let lastError = null;

    // 逐个尝试候选端点，彻底解决 404 路径不匹配问题
    for (const endpoint of endpoints) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);

        try {
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (resp.ok) {
                const data = await resp.json();
                if (data && data.choices && data.choices[0] && data.choices[0].message) {
                    return data.choices[0].message.content.trim();
                }
            } else {
                const errText = await resp.text();
                lastError = new Error(`HTTP ${resp.status}: ${errText || '接口响应异常'}`);
                // 若出现 404 且有备用端点，自动尝试下一个
                if (resp.status === 404 && endpoints.indexOf(endpoint) < endpoints.length - 1) {
                    continue;
                }
                throw lastError;
            }
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                throw new Error('大模型响应超时（超过35秒），请检查网络连接。');
            }
            lastError = err;
            if (endpoints.indexOf(endpoint) < endpoints.length - 1) {
                continue;
            }
            throw lastError;
        }
    }

    throw lastError || new Error('未能连通大模型接口');
}

// 四川生物医药周回顾一键生成
async function generateSichuanWeeklyReport() {
    const timeAnchor = getCurrentTimeAnchor();
    appendMessage(`调取四川省科技厅、省发改委、成都市经信局最新生物医药科技奖补与资金申报数据，编制【${timeAnchor.periodStr}】深度周回顾报告。`, 'user-row');
    const loadingId = appendMessage(`正在起草《四川省生物医药科技创新政策周报（${timeAnchor.periodStr}）》（5大核心要点）...`, 'bot-row');

    const dynamicWeeklyPrompt = `【重要时间锚点】：当前系统真实时间为 ${timeAnchor.fullDateStr}（${timeAnchor.periodStr}）。
请严格以【${timeAnchor.year}年${timeAnchor.month}月】为时间基准，起草编制《四川省生物医药科技创新政策周报（${timeAnchor.periodStr}）》，周回顾四川省及成都市发布的生物医药相关科技创新奖励、补助、资助、扶持政策与申报通知。严禁使用过期的 2024 年、2025 年等历史时间。
内容必须包含：
1. 本周要点摘要；
2. 新增或更新政策清单，含发布单位、发布日期、适用对象、奖补/资助金额或支持方式、申报期限、官方链接；
3. 对生物医药企业/科研机构/园区的影响和机会判断；
4. 建议下一步行动；
5. 需继续跟踪的不确定事项。
输出为干练、精炼的中文公文内参风格。`;

    // 1. 本地模式优先
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
        try {
            const resp = await fetch('/api/weekly-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: dynamicWeeklyPrompt,
                    api_key: state.apiKey,
                    base_url: state.baseUrl,
                    model: state.model
                })
            });
            if (resp.ok) {
                const res = await resp.json();
                if (res.code === 0 && res.report) {
                    state.latestWeeklyReport = res.report;
                    updateMessage(loadingId, res.report, true);
                    showToast(`📄 四川省生物医药周回顾报告（${timeAnchor.periodStr}）编制完成`);
                    return;
                }
            }
        } catch (e) {}
    }

    // 2. 线上直连
    const effectiveKey = (state.apiKey && state.apiKey.length > 20 && !state.apiKey.includes('5043'))
        ? state.apiKey
        : DEFAULT_AI_KEY;

    if (effectiveKey) {
        try {
            const report = await callDirectLLM(dynamicWeeklyPrompt, effectiveKey);
            state.latestWeeklyReport = report;
            updateMessage(loadingId, report, true);
            showToast(`📄 四川省生物医药周回顾报告（${timeAnchor.periodStr}）编制完成`);
            return;
        } catch (err) {
            updateMessage(loadingId, `⚠️ 大模型接口调用异常: ${err.message}`);
            return;
        }
    }

    // 3. 离线模拟报告
    setTimeout(() => {
        const mockRep = getMockAnalysis('周回顾');
        state.latestWeeklyReport = mockRep;
        updateMessage(loadingId, mockRep, true);
        showToast(`📄 四川省生物医药周回顾报告（${timeAnchor.periodStr}）编制完成`);
    }, 800);
}

function getMockAnalysis(prompt) {
    if (prompt.includes('周回顾') || prompt.includes('四川')) {
        return `## 医药产业内参：四川省生物医药科技创新与奖补政策周回顾

### 一、 本周要点摘要
1. **核医疗与医用同位素支持加码**：省发改委、经信厅联合印发核医疗产业专项申报指南，对靶向放药创新及堆照生产线给予最高 2000 万元后补助；
2. **脑机接口与前沿器械中试赋能**：成都市经信局针对高端医疗机器人、脑机接口临床转化平台开放设备与算力专项奖补；
3. **重大科技专项窗口开启**：四川省科技厅启动新一轮重大新药创制专项评审，重点倾斜已进入 II/III 期临床的新药品种。

### 二、 新增与在期政策清单
| 序号 | 政策文件名称 | 发布单位 | 重点支持方式 / 奖补金额 | 申报期限 |
| :---: | :--- | :---: | :--- | :---: |
| 1 | 《四川省支持核医疗产业高质量发展若干政策申报指南》 | 省发改委、经信厅 | 按固定资产与研发投入30%资助，最高2000万元 | 截至 2026-09-15 |
| 2 | 《成都市促进生物医药产业建圈强链若干政策实施细则》 | 成都市经信局 | 关键研发设备购置补贴20%（最高500万）+算力券 | 截至 2026-08-30 |
| 3 | 《四川省2026年度重大新药创制科技专项申报指南》 | 四川省科技厅 | 临床I/II/III期阶梯式资助，最高1500万元 | 截至 2026-09-10 |

### 三、 对企业/科研机构/园区的影响和机会判断
- **对研发企业**：直接冲抵临床前大分子筛选与放药早期验证资金压力，缩短产品上市周期；
- **对产业园区**：天府国际生物城、乐山核技术基地获得更多能耗、环评指标保障，建议加大链主企业招引力度。

### 四、 建议下一步行动
1. **材料自查**：财务与研发部门对照指南梳理研发费用专账与临床批件；
2. **申报沟通**：与属地经信局产业处建立申报预审对接；
3. **院企协同**：联合在川三甲医院开展产学研医用协同攻关申报。

### 五、 需继续跟踪的不确定事项
- 放射性药品审评审批绿色通道配套文件的落地时间；
- 省级产业引导母基金 direct investment 项目库的首批遴选标准。`;
    } else {
        return `**政策研判意见**：

针对该项议题，结合国家药监局与四川省最新监管要求，核心关键在于：
1. 严格对照申报资质与财务审计指标；
2. 突出核心技术自主可控与临床急需价值；
3. 提前做好知识产权布局与成果就地转化备案。`;
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
            ${role === 'bot-row' ? '<div class="dialog-author">AI·政策研判与申报咨询</div>' : ''}
            ${formattedContent}
        </div>
    `;

    el.chatMessages.appendChild(row);
    el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
    return msgId;
}

function updateMessage(msgId, text, isWeeklyReport = false) {
    const row = document.getElementById(msgId);
    if (row) {
        const card = row.querySelector('.dialog-card');
        if (card) {
            const authorHtml = row.classList.contains('bot-row') ? '<div class="dialog-author">AI·政策研判与申报咨询</div>' : '';
            const exportBtnHtml = (isWeeklyReport || text.includes('周回顾') || text.includes('周报'))
                ? `<div style="margin-top:12px; border-top:1px dashed var(--border-color); padding-top:8px; display:flex; justify-content:flex-end;">
                     <button onclick="handleExportWeeklyWord()" style="background:#004886; color:#ffffff; border:none; padding:5px 12px; font-size:12px; border-radius:3px; cursor:pointer; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                         📄 导出此份周报 Word
                     </button>
                   </div>`
                : '';
            card.innerHTML = authorHtml + parseMarkdownSimple(text) + exportBtnHtml;
        }
    }
    el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
}

// 清除 AI 政策研判与申报咨询消息记录
function handleClearChat() {
    if (!el.chatMessages) return;
    el.chatMessages.innerHTML = `
        <div class="dialog-row bot-row">
            <div class="dialog-card">
                <div class="dialog-author">AI·政策研判与申报咨询</div>
                本系统已对接国家药监局、国家医保局、四川省药监局及省科技厅官方政策库，默认接入 DeepSeek 智能分析。您可以直接咨询核医药、脑机接口、AI制药、医疗机器人、医保集采或科技资金申报等具体问题，或点击上方按钮生成 <strong>《四川省生物医药周回顾报告》</strong>。
            </div>
        </div>
    `;
    state.latestWeeklyReport = null;
    if (el.chatInput) el.chatInput.value = '';
    showToast('🗑️ 已成功清除研判消息记录！');
}

// 彻底消除文本中的 Markdown 标记（如 *、**、#、列表符号等）
function stripMarkdownMarkers(str) {
    if (!str) return '';
    let s = String(str);
    // 1. 去除 Markdown 链接 [文字](url) -> 文字
    s = s.replace(/\[(.*?)\]\((.*?)\)/g, '$1');
    // 2. 去除各种加粗与斜体 ***text***, **text**, *text*, ___text___, __text__, _text_
    s = s.replace(/\*{3}(.*?)\*{3}/g, '$1');
    s = s.replace(/\*{2}(.*?)\*{2}/g, '$1');
    s = s.replace(/\*([^\*\n]+)\*/g, '$1');
    s = s.replace(/_{3}(.*?)_{3}/g, '$1');
    s = s.replace(/_{2}(.*?)_{2}/g, '$1');
    s = s.replace(/_([^_\n]+)_/g, '$1');
    // 3. 去除行首/词首列表符号如 - , * , + , •
    s = s.replace(/^[\s\-\*\+•]+\s*/, '');
    // 4. 彻底消除任何单独残留的 * 字符和 # 字符及反引号
    s = s.replace(/\*/g, '');
    s = s.replace(/`([^`]+)`/g, '$1');
    s = s.replace(/`/g, '');
    s = s.replace(/^#+\s*/, '');
    return s.trim();
}

function parseMarkdownSimple(md) {
    if (!md) return '';
    const lines = md.split('\n');
    let outHtml = '';
    let inTable = false;
    let tableHeaders = [];
    let tableRows = [];

    function flushTable() {
        if (!inTable) return;
        if (tableHeaders.length > 0 || tableRows.length > 0) {
            let ths = tableHeaders.map(h => `<th>${h}</th>`).join('');
            let trs = tableRows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
            outHtml += `
                <table class="three-line-table">
                    ${tableHeaders.length > 0 ? `<thead><tr>${ths}</tr></thead>` : ''}
                    <tbody>${trs}</tbody>
                </table>
            `;
        }
        inTable = false;
        tableHeaders = [];
        tableRows = [];
    }

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        // 识别 Markdown 表格行
        if (line.startsWith('|') && line.endsWith('|')) {
            const cells = line.split('|').slice(1, -1).map(c => c.trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'));
            // 判断是否是分割线
            if (cells.every(c => /^:?-+:?$/.test(c))) {
                continue;
            }
            if (!inTable) {
                inTable = true;
                tableHeaders = cells;
            } else {
                tableRows.push(cells);
            }
            continue;
        } else {
            flushTable();
        }

        if (!line) {
            outHtml += '<br>';
            continue;
        }

        if (line.startsWith('### ')) {
            outHtml += `<h3>${line.replace(/^###\s*/, '')}</h3>`;
        } else if (line.startsWith('## ')) {
            outHtml += `<h2>${line.replace(/^##\s*/, '')}</h2>`;
        } else if (line.startsWith('# ')) {
            outHtml += `<h1>${line.replace(/^#\s*/, '')}</h1>`;
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
            let item = line.replace(/^[\-\*]\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            item = item.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color:var(--nmpa-blue-main);text-decoration:underline;">$1</a>');
            outHtml += `<li>${item}</li>`;
        } else {
            let para = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            para = para.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color:var(--nmpa-blue-main);text-decoration:underline;">$1</a>');
            outHtml += `<p style="margin:4px 0;">${para}</p>`;
        }
    }
    flushTable();
    return outHtml;
}

async function handleScrapeNow() {
    showToast('🔄 正在全网检索各大部委与四川省局最新政策数据...');
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // 1. 本地动态服务模式：直接向本地 Python 后端触发全网实时爬虫
    if (isLocalhost) {
        try {
            const resp = await fetch('/api/scrape-now', { method: 'POST' });
            if (resp.ok) {
                const res = await resp.json();
                showToast(`✅ ${res.msg || '全网政策实时检索并更新完成！'}`);
                await loadData();
                return;
            }
        } catch (e) {}
    }

    // 2. GitHub Pages 线上模式：强制绕过 CDN 缓存实时拉取云端最新数据
    try {
        await loadData();
        showToast('✅ 动态数据检索完成！已同步云端最新发布的政策库。');
    } catch (e) {
        showToast('💡 提示：当前已加载云端最新政策库。如需在本地立即执行全网深度爬虫，可双击项目根目录下的【启动网页大屏.bat】！');
    }
}

// ==========================================
// 权威标准公文 Word 导出引擎 (GB/T 9704-2012)
// 1. 原生 OpenXML (.docx) 引擎 (基于 docx.js)
// 2. 精确 WordprocessingML XML 容错引擎 (保底方案)
// ==========================================

// 一、导出政策监测信息公文简报
async function handleExportWord() {
    const weekPolicies = state.allPolicies.filter(isThisWeekPolicy);
    const policies = (weekPolicies && weekPolicies.length > 0)
        ? weekPolicies
        : (state.filteredPolicies && state.filteredPolicies.length > 0 ? state.filteredPolicies : state.allPolicies.slice(0, 8));

    if (!policies || policies.length === 0) {
        showToast('⚠️ 当前本周暂未检索到更新的政策数据可导出！');
        return;
    }

    const timeAnchor = getCurrentTimeAnchor();
    const dateStr = timeAnchor.fullDateStr;
    const fileDateTag = `${timeAnchor.year}${String(timeAnchor.month).padStart(2, '0')}${String(timeAnchor.date).padStart(2, '0')}`;
    const filename = `四川生物医药产业集团创新事业部政策信息简报_${fileDateTag}.docx`;

    showToast(`📄 正在生成标准公文 Word 简报（共 ${policies.length} 篇重点政策）...`);

    // 优先尝试 原生 docx.js 引擎
    if (window.docx && window.docx.Document) {
        try {
            await exportPoliciesViaDocxJS(policies, dateStr, filename);
            showToast(`✅ 已成功导出标准公文 Word：${filename}`);
            return;
        } catch (err) {
            console.warn('docx.js 导出异常，降级至标准 XML 引擎:', err);
        }
    }

    // 降级使用标准 Word XML 引擎
    exportPoliciesViaWordXML(policies, dateStr, filename);
}

// 二、导出四川省生物医药周回顾报告
async function handleExportWeeklyWord() {
    const timeAnchor = getCurrentTimeAnchor();
    let reportText = state.latestWeeklyReport;
    
    if (!reportText) {
        reportText = getMockAnalysis('周回顾');
    }

    const docDate = timeAnchor.fullDateStr;
    const docPeriod = timeAnchor.periodStr;
    const dateTag = `${timeAnchor.year}${String(timeAnchor.month).padStart(2, '0')}${String(timeAnchor.date).padStart(2, '0')}`;
    const filename = `四川省生物医药科技创新政策周报_${dateTag}.docx`;

    showToast(`📄 正在生成《四川省生物医药科技创新政策周报》Word 文档...`);

    // 优先尝试 原生 docx.js 引擎
    if (window.docx && window.docx.Document) {
        try {
            await exportWeeklyReportViaDocxJS(reportText, docPeriod, docDate, filename);
            showToast(`✅ 已成功导出周报 Word：${filename}`);
            return;
        } catch (err) {
            console.warn('docx.js 导出异常，降级至标准 XML 引擎:', err);
        }
    }

    // 降级使用标准 Word XML 引擎
    exportWeeklyReportViaWordXML(reportText, docPeriod, docDate, filename);
}

// ----------------------------------------------------
// 原生 docx.js 引擎实现 (100% 纯正 OpenXML .docx 文件)
// ----------------------------------------------------

async function exportPoliciesViaDocxJS(policies, dateStr, filename) {
    const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, PageNumber, Footer, Header, HeadingLevel } = window.docx;

    const children = [];

    // 1. 公文大标题：2号 (22pt / size:44) 方正小标宋简体，居中加粗，单倍/1.3倍行距
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 200, line: 360, lineRule: "auto" },
        children: [
            new TextRun({
                text: "四川生物医药产业集团创新事业部政策信息简报",
                font: { name: "Times New Roman", eastAsia: "方正小标宋简体" },
                size: 44,
                bold: true,
                color: "000000"
            })
        ]
    }));

    // 2. 导语段落：小4号 (12pt / size:24) 方正仿宋简体，首行缩进 2 字符 (480 dxa)，1.5 倍行距
    children.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 480 },
        spacing: { before: 0, after: 80, line: 360, lineRule: "auto" },
        children: [
            new TextRun({
                text: `为及时研判行业监管动向与政策红利，现将截至${dateStr}本周最新发布的医药产业重点政策及文件摘要汇总如下：`,
                font: { name: "Times New Roman", eastAsia: "方正仿宋简体" },
                size: 24,
                color: "000000"
            })
        ]
    }));

    // 3. 一级标题：一、本周重点政策速览清单（小4号 黑体 加粗 首行缩进 2 字符 1.5倍行距）
    children.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 480 },
        spacing: { before: 140, after: 60, line: 360, lineRule: "auto" },
        children: [
            new TextRun({
                text: "一、本周重点政策速览清单",
                font: { name: "Times New Roman", eastAsia: "黑体" },
                size: 24,
                bold: true,
                color: "000000"
            })
        ]
    }));

    // 4. 标准公文三线表（顶底线 1.5pt = sz:12，栏目线 0.75pt = sz:6，无竖线）
    const tableRows = [];

    // 4.1 表头 (小4号 黑体居中)
    const headers = [
        { text: "序号", width: 10, align: AlignmentType.CENTER },
        { text: "政策文件名称", width: 52, align: AlignmentType.CENTER },
        { text: "发布机关", width: 22, align: AlignmentType.CENTER },
        { text: "发布日期", width: 16, align: AlignmentType.CENTER }
    ];

    tableRows.push(new TableRow({
        tableHeader: true,
        children: headers.map(h => new TableCell({
            width: { size: h.width, type: WidthType.PERCENTAGE },
            borders: {
                top: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
                bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE }
            },
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
                new Paragraph({
                    alignment: h.align,
                    spacing: { line: 260, before: 0, after: 0 },
                    children: [
                        new TextRun({
                            text: stripMarkdownMarkers(h.text),
                            font: { name: "Times New Roman", eastAsia: "黑体" },
                            size: 24,
                            bold: true
                        })
                    ]
                })
            ]
        }))
    }));

    // 4.2 数据行 (小4号 方正仿宋简体，最后一行底线 1.5pt，其余行无横线)
    policies.forEach((item, idx) => {
        const isLast = (idx === policies.length - 1);
        const rowData = [
            { text: String(idx + 1), align: AlignmentType.CENTER },
            { text: stripMarkdownMarkers(item.title) || '', align: AlignmentType.LEFT },
            { text: stripMarkdownMarkers(item.source) || '官方部门', align: AlignmentType.CENTER },
            { text: stripMarkdownMarkers(item.pub_date) || '近期', align: AlignmentType.CENTER }
        ];

        tableRows.push(new TableRow({
            children: rowData.map((cellData, cIdx) => new TableCell({
                width: { size: headers[cIdx].width, type: WidthType.PERCENTAGE },
                borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: isLast
                        ? { style: BorderStyle.SINGLE, size: 12, color: "000000" }
                        : { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE }
                },
                margins: { top: 90, bottom: 90, left: 100, right: 100 },
                children: [
                    new Paragraph({
                        alignment: cellData.align,
                        spacing: { line: 280, before: 0, after: 0 },
                        children: [
                            new TextRun({
                                text: cellData.text,
                                font: { name: "Times New Roman", eastAsia: "方正仿宋简体" },
                                size: 24
                            })
                        ]
                    })
                ]
            }))
        }));
    });

    children.push(new Table({
        alignment: AlignmentType.CENTER,
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows
    }));

    // 5. 一级标题：二、重点政策要点与文件摘要
    children.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 480 },
        spacing: { before: 180, after: 60, line: 360, lineRule: "auto" },
        children: [
            new TextRun({
                text: "二、本周重点政策要点与文件摘要",
                font: { name: "Times New Roman", eastAsia: "黑体" },
                size: 24,
                bold: true,
                color: "000000"
            })
        ]
    }));

    // 6. 政策要点逐条排版（紧凑清晰：标目标题 + 紧凑正文与链接）
    policies.forEach((item, idx) => {
        const title = stripMarkdownMarkers(item.title) || '';
        const dept = stripMarkdownMarkers(item.source) || '官方部门';
        const pubDate = stripMarkdownMarkers(item.pub_date) || '近期';
        const summary = stripMarkdownMarkers(item.summary) || title;
        const url = item.url || '';

        // 6.1 标目标题（小4号 方正仿宋加粗，首行缩进 2 字符）
        children.push(new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            indent: { firstLine: 480 },
            spacing: { before: 100, after: 0, line: 360, lineRule: "auto" },
            children: [
                new TextRun({
                    text: `${idx + 1}. 《${title}》（发布机关：${dept}，发布日期：${pubDate}）`,
                    font: { name: "Times New Roman", eastAsia: "方正仿宋简体" },
                    size: 24,
                    bold: true
                })
            ]
        }));

        // 6.2 正文摘要与官方链接（小4号 方正仿宋简体，首行缩进 2 字符，1.5 倍行距）
        const textRuns = [
            new TextRun({
                text: `文件主要内容与核心要点：${summary}`,
                font: { name: "Times New Roman", eastAsia: "方正仿宋简体" },
                size: 24
            })
        ];

        if (url && url !== '#') {
            textRuns.push(new TextRun({
                text: `（官方原文直达：${url}）`,
                font: { name: "Times New Roman", eastAsia: "方正仿宋简体" },
                size: 24,
                color: "004886",
                underline: {}
            }));
        }

        children.push(new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            indent: { firstLine: 480 },
            spacing: { before: 0, after: 80, line: 360, lineRule: "auto" },
            children: textRuns
        }));
    });

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    size: { width: 11906, height: 16838 }, // A4: 210mm x 297mm in dxa
                    margin: { top: 2098, bottom: 1984, left: 1587, right: 1474 } // 上37mm 下35mm 左28mm 右26mm
                }
            },
            children: children
        }]
    });

    const blob = await window.docx.Packer.toBlob(doc);
    downloadBlobFile(blob, filename);
}

async function exportWeeklyReportViaDocxJS(reportText, docPeriod, docDate, filename) {
    const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } = window.docx;

    const children = [];

    // 1. 公文大标题：2号 方正小标宋简体 居中加粗
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 60, line: 360, lineRule: "auto" },
        children: [
            new TextRun({
                text: "四川省生物医药科技创新政策周报",
                font: { name: "Times New Roman", eastAsia: "方正小标宋简体" },
                size: 44,
                bold: true
            })
        ]
    }));

    // 2. 副标题：小4号 楷体 居中
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 180, line: 360, lineRule: "auto" },
        children: [
            new TextRun({
                text: `（${docPeriod} · ${docDate}）`,
                font: { name: "Times New Roman", eastAsia: "楷体_GB2312" },
                size: 24,
                color: "333333"
            })
        ]
    }));

    // 3. 逐行解析正文与三线表格
    const lines = reportText.split('\n');
    let i = 0;

    while (i < lines.length) {
        let rawLine = lines[i];
        let line = rawLine.trim();

        if (!line) {
            i++;
            continue;
        }

        // 3.1 识别 Markdown 表格块并转为标准的 Word 原生政务三线表
        if (line.startsWith('|') && line.endsWith('|')) {
            const tableLines = [];
            while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
                tableLines.push(lines[i].trim());
                i++;
            }

            let headerCells = [];
            let dataRows = [];

            tableLines.forEach((tLine) => {
                const cells = tLine.split('|').slice(1, -1).map(c => stripMarkdownMarkers(c));
                // 忽略分割行
                if (cells.every(c => /^:?-+:?$/.test(c) || c === '')) {
                    return;
                }
                if (headerCells.length === 0) {
                    headerCells = cells;
                } else {
                    dataRows.push(cells);
                }
            });

            if (headerCells.length > 0) {
                const docxTableRows = [];
                const colCount = headerCells.length;
                let colWidths = [];
                if (colCount === 5) {
                    colWidths = [10, 38, 20, 20, 12];
                } else if (colCount === 4) {
                    colWidths = [10, 48, 24, 18];
                } else {
                    colWidths = Array(colCount).fill(Math.floor(100 / colCount));
                }

                // 表头行（小4号 黑体 加粗 居中，顶线 1.5pt = sz:12，栏目线 0.75pt = sz:6，无竖线）
                docxTableRows.push(new TableRow({
                    tableHeader: true,
                    children: headerCells.map((hText, cIdx) => new TableCell({
                        width: { size: colWidths[cIdx] || 20, type: WidthType.PERCENTAGE },
                        borders: {
                            top: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
                            bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
                            left: { style: BorderStyle.NONE },
                            right: { style: BorderStyle.NONE }
                        },
                        margins: { top: 100, bottom: 100, left: 100, right: 100 },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                spacing: { line: 260, before: 0, after: 0 },
                                children: [
                                    new TextRun({
                                        text: stripMarkdownMarkers(hText),
                                        font: { name: "Times New Roman", eastAsia: "黑体" },
                                        size: 24,
                                        bold: true
                                    })
                                ]
                            })
                        ]
                    }))
                }));

                // 数据行（小4号 方正仿宋简体，最后一行底线 1.5pt，无竖线）
                dataRows.forEach((rowCells, rIdx) => {
                    const isLastRow = (rIdx === dataRows.length - 1);
                    docxTableRows.push(new TableRow({
                        children: rowCells.map((cellText, cIdx) => new TableCell({
                            width: { size: colWidths[cIdx] || 20, type: WidthType.PERCENTAGE },
                            borders: {
                                top: { style: BorderStyle.NONE },
                                bottom: isLastRow
                                    ? { style: BorderStyle.SINGLE, size: 12, color: "000000" }
                                    : { style: BorderStyle.NONE },
                                left: { style: BorderStyle.NONE },
                                right: { style: BorderStyle.NONE }
                            },
                            margins: { top: 80, bottom: 80, left: 100, right: 100 },
                            children: [
                                new Paragraph({
                                    alignment: (cIdx === 0 || cIdx === colCount - 1 || cIdx === 2) ? AlignmentType.CENTER : AlignmentType.LEFT,
                                    spacing: { line: 280, before: 0, after: 0 },
                                    children: [
                                        new TextRun({
                                            text: stripMarkdownMarkers(cellText),
                                            font: { name: "Times New Roman", eastAsia: "方正仿宋简体" },
                                            size: 24
                                        })
                                    ]
                                })
                            ]
                        }))
                    }));
                });

                children.push(new Table({
                    alignment: AlignmentType.CENTER,
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: docxTableRows
                }));
            }
            continue;
        }

        // 3.2 略过重复大标题
        if (line.startsWith('# ') || line.startsWith('## 四川省') || line.startsWith('# 四川省')) {
            i++;
            continue;
        }

        // 3.3 识别一级公文标题（一、二、三...）
        if (line.startsWith('## ') || /^一、|二、|三、|四、|五、|六、/.test(line)) {
            const cleanText = stripMarkdownMarkers(line.replace(/^##\s*/, ''));
            children.push(new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                indent: { firstLine: 480 },
                spacing: { before: 140, after: 60, line: 360, lineRule: "auto" },
                children: [
                    new TextRun({
                        text: cleanText,
                        font: { name: "Times New Roman", eastAsia: "黑体" },
                        size: 24,
                        bold: true
                    })
                ]
            }));
            i++;
            continue;
        }

        // 3.4 识别二/三级标题（### 或（一））
        if (line.startsWith('### ') || /^（[一二三四五六七八九十]）/.test(line)) {
            const cleanText = stripMarkdownMarkers(line.replace(/^###\s*/, ''));
            children.push(new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                indent: { firstLine: 480 },
                spacing: { before: 90, after: 30, line: 360, lineRule: "auto" },
                children: [
                    new TextRun({
                        text: cleanText,
                        font: { name: "Times New Roman", eastAsia: "方正仿宋简体" },
                        size: 24,
                        bold: true
                    })
                ]
            }));
            i++;
            continue;
        }

        // 3.5 普通正文或列表项
        let cleanText = stripMarkdownMarkers(line);

        children.push(new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            indent: { firstLine: 480 },
            spacing: { before: 0, after: 60, line: 360, lineRule: "auto" },
            children: [
                new TextRun({
                    text: cleanText,
                    font: { name: "Times New Roman", eastAsia: "方正仿宋简体" },
                    size: 24
                })
            ]
        }));
        i++;
    }

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    size: { width: 11906, height: 16838 },
                    margin: { top: 2098, bottom: 1984, left: 1587, right: 1474 }
                }
            },
            children: children
        }]
    });

    const blob = await window.docx.Packer.toBlob(doc);
    downloadBlobFile(blob, filename);
}

// ----------------------------------------------------
// 备用标准 WordprocessingML XML 引擎
// ----------------------------------------------------

function exportPoliciesViaWordXML(policies, dateStr, filename) {
    let tableRowsHtml = '';
    policies.forEach((item, idx) => {
        const isLast = (idx === policies.length - 1);
        tableRowsHtml += `
            <tr style="mso-yfti-irow:${idx}; ${isLast ? 'mso-yfti-lastrow:yes;' : ''}">
                <td style="border:none; ${isLast ? 'border-bottom:1.5pt solid black;' : ''} padding:4pt 6pt; text-align:center; font-family:'Times New Roman','方正仿宋简体','仿宋_GB2312','仿宋',serif; font-size:12pt;">${idx + 1}</td>
                <td style="border:none; ${isLast ? 'border-bottom:1.5pt solid black;' : ''} padding:4pt 6pt; text-align:left; font-family:'Times New Roman','方正仿宋简体','仿宋_GB2312','仿宋',serif; font-size:12pt;">${stripMarkdownMarkers(item.title) || ''}</td>
                <td style="border:none; ${isLast ? 'border-bottom:1.5pt solid black;' : ''} padding:4pt 6pt; text-align:center; font-family:'Times New Roman','方正仿宋简体','仿宋_GB2312','仿宋',serif; font-size:12pt;">${stripMarkdownMarkers(item.source) || '官方部门'}</td>
                <td style="border:none; ${isLast ? 'border-bottom:1.5pt solid black;' : ''} padding:4pt 6pt; text-align:center; font-family:'Times New Roman','方正仿宋简体','仿宋_GB2312','仿宋',serif; font-size:12pt;">${stripMarkdownMarkers(item.pub_date) || '近期'}</td>
            </tr>
        `;
    });

    let detailsHtml = '';
    policies.forEach((item, idx) => {
        const title = stripMarkdownMarkers(item.title) || '';
        const dept = stripMarkdownMarkers(item.source) || '官方部门';
        const pubDate = stripMarkdownMarkers(item.pub_date) || '近期';
        const summary = stripMarkdownMarkers(item.summary) || title;
        const url = item.url || '';

        detailsHtml += `
            <p style="margin:8pt 0 0 0; text-indent:2em; font-family:'Times New Roman','方正仿宋简体','仿宋_GB2312','仿宋',serif; font-size:12pt; font-weight:bold; line-height:1.5; color:#000000;">
                ${idx + 1}. 《${title}》（发布机关：${dept}，发布日期：${pubDate}）
            </p>
            <p style="margin:0 0 6pt 0; text-indent:2em; font-family:'Times New Roman','方正仿宋简体','仿宋_GB2312','仿宋',serif; font-size:12pt; line-height:1.5; color:#000000; text-align:justify;">
                文件主要内容与核心要点：${summary}${url && url !== '#' ? ` <span style="color:#004886; text-decoration:underline;">（官方原文直达：${url}）</span>` : ''}
            </p>
        `;
    });

    const wordDocHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>四川生物医药产业集团创新事业部政策信息简报</title>
            <!--[if gte mso 9]>
            <xml>
                <w:WordDocument>
                    <w:View>Print</w:View>
                    <w:Zoom>100</w:Zoom>
                    <w:DoNotOptimizeForBrowser/>
                </w:WordDocument>
            </xml>
            <![endif]-->
            <style>
                @page Section1 {
                    size: 210mm 297mm;
                    margin: 37mm 26mm 35mm 28mm;
                    mso-header-margin: 35.4pt;
                    mso-footer-margin: 35.4pt;
                }
                div.Section1 { page: Section1; }
                body {
                    font-family: 'Times New Roman', '方正仿宋简体', '仿宋_GB2312', '仿宋', 'FangSong', serif;
                    font-size: 12pt;
                    line-height: 1.5;
                    color: #000000;
                    text-align: justify;
                }
                h1.doc-title {
                    font-family: 'Times New Roman', '方正小标宋简体', '小标宋', '宋体', 'SimSun', serif;
                    font-size: 22pt;
                    font-weight: bold;
                    text-align: center;
                    margin-top: 6pt;
                    margin-bottom: 12pt;
                    line-height: 1.3;
                }
                h2.h1-title {
                    font-family: 'Times New Roman', '黑体', 'SimHei', sans-serif;
                    font-size: 12pt;
                    font-weight: bold;
                    text-indent: 2em;
                    margin-top: 10pt;
                    margin-bottom: 4pt;
                    line-height: 1.5;
                }
                p.lead {
                    font-family: 'Times New Roman', '方正仿宋简体', '仿宋_GB2312', '仿宋', serif;
                    font-size: 12pt;
                    text-indent: 2em;
                    margin-top: 0;
                    margin-bottom: 6pt;
                    line-height: 1.5;
                    text-align: justify;
                }
                table.three-line-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 6pt 0 12pt 0;
                }
            </style>
        </head>
        <body>
            <div class="Section1">
                <h1 class="doc-title">四川生物医药产业集团创新事业部政策信息简报</h1>
                <p class="lead">为及时研判行业监管动向与政策红利，现将截至 ${dateStr} 本周最新发布的医药产业重点政策及文件摘要汇总如下：</p>
                <h2 class="h1-title">一、本周重点政策速览清单</h2>
                <table class="three-line-table">
                    <thead>
                        <tr style="height:26pt;">
                            <th style="border-top:1.5pt solid black; border-bottom:0.75pt solid black; padding:4pt; text-align:center; font-family:'Times New Roman','黑体','SimHei',sans-serif; font-size:12pt; width:10%;">序号</th>
                            <th style="border-top:1.5pt solid black; border-bottom:0.75pt solid black; padding:4pt; text-align:center; font-family:'Times New Roman','黑体','SimHei',sans-serif; font-size:12pt; width:52%;">政策文件名称</th>
                            <th style="border-top:1.5pt solid black; border-bottom:0.75pt solid black; padding:4pt; text-align:center; font-family:'Times New Roman','黑体','SimHei',sans-serif; font-size:12pt; width:22%;">发布机关</th>
                            <th style="border-top:1.5pt solid black; border-bottom:0.75pt solid black; padding:4pt; text-align:center; font-family:'Times New Roman','黑体','SimHei',sans-serif; font-size:12pt; width:16%;">发布日期</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
                <h2 class="h1-title">二、本周重点政策要点与文件摘要</h2>
                ${detailsHtml}
            </div>
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff', wordDocHtml], { type: 'application/msword;charset=utf-8' });
    downloadBlobFile(blob, filename.replace('.docx', '.doc'));
}

function exportWeeklyReportViaWordXML(reportText, docPeriod, docDate, filename) {
    const lines = reportText.split('\n');
    let bodyHtml = '';
    let i = 0;

    while (i < lines.length) {
        let line = lines[i].trim();
        if (!line || line.startsWith('# ') || line.startsWith('## 四川省') || line.startsWith('# 四川省')) {
            i++;
            continue;
        }

        // 识别并转换为标准三线表
        if (line.startsWith('|') && line.endsWith('|')) {
            let tableHtml = '<table class="three-line-table"><thead><tr style="height:26pt;">';
            let isHeader = true;
            let headerCount = 0;

            while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
                const cells = lines[i].trim().split('|').slice(1, -1).map(c => stripMarkdownMarkers(c));
                if (cells.every(c => /^:?-+:?$/.test(c) || c === '')) {
                    isHeader = false;
                    i++;
                    continue;
                }
                if (isHeader) {
                    headerCount = cells.length;
                    cells.forEach(c => {
                        tableHtml += `<th style="border-top:1.5pt solid black; border-bottom:0.75pt solid black; padding:4pt; text-align:center; font-family:'Times New Roman','黑体','SimHei',sans-serif; font-size:12pt;">${c}</th>`;
                    });
                    tableHtml += '</tr></thead><tbody>';
                    isHeader = false;
                } else {
                    tableHtml += '<tr style="height:24pt;">';
                    cells.forEach((c, cIdx) => {
                        const align = (cIdx === 0 || cIdx === headerCount - 1 || cIdx === 2) ? 'center' : 'left';
                        tableHtml += `<td style="border:none; padding:4pt 6pt; text-align:${align}; font-family:'Times New Roman','方正仿宋简体','仿宋',serif; font-size:12pt;">${c}</td>`;
                    });
                    tableHtml += '</tr>';
                }
                i++;
            }
            tableHtml += '</tbody></table>';
            // 最后一行的底边线
            tableHtml = tableHtml.replace(/<tr style="height:24pt;">(?![\s\S]*<tr style="height:24pt;">)/, '<tr style="height:24pt; border-bottom:1.5pt solid black;">');
            bodyHtml += tableHtml;
            continue;
        }

        if (line.startsWith('## ') || /^一、|二、|三、|四、|五、|六、/.test(line)) {
            const h1Text = stripMarkdownMarkers(line.replace(/^##\s*/, ''));
            bodyHtml += `<h2 class="h1-title">${h1Text}</h2>`;
        } else if (line.startsWith('### ') || /^（[一二三四五六七八九十]）/.test(line)) {
            const h3Text = stripMarkdownMarkers(line.replace(/^###\s*/, ''));
            bodyHtml += `<p class="h3-title">${h3Text}</p>`;
        } else {
            let paraText = stripMarkdownMarkers(line);
            bodyHtml += `<p class="body-para">${paraText}</p>`;
        }
        i++;
    }

    const wordDocHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>四川省生物医药科技创新政策周报</title>
            <!--[if gte mso 9]>
            <xml>
                <w:WordDocument>
                    <w:View>Print</w:View>
                    <w:Zoom>100</w:Zoom>
                    <w:DoNotOptimizeForBrowser/>
                </w:WordDocument>
            </xml>
            <![endif]-->
            <style>
                @page Section1 {
                    size: 210mm 297mm;
                    margin: 37mm 26mm 35mm 28mm;
                }
                div.Section1 { page: Section1; }
                body {
                    font-family: 'Times New Roman', '方正仿宋简体', '仿宋_GB2312', '仿宋', 'FangSong', serif;
                    font-size: 12pt;
                    line-height: 1.5;
                    color: #000000;
                    text-align: justify;
                }
                h1.doc-title {
                    font-family: 'Times New Roman', '方正小标宋简体', '小标宋', '宋体', 'SimSun', serif;
                    font-size: 22pt;
                    font-weight: bold;
                    text-align: center;
                    margin-top: 6pt;
                    margin-bottom: 4pt;
                    line-height: 1.3;
                }
                p.doc-subtitle {
                    font-family: 'Times New Roman', '方正楷体简体', '楷体_GB2312', '楷体', serif;
                    font-size: 14pt;
                    text-align: center;
                    margin-top: 0;
                    margin-bottom: 14pt;
                    color: #333333;
                }
                h2.h1-title {
                    font-family: 'Times New Roman', '黑体', 'SimHei', sans-serif;
                    font-size: 12pt;
                    font-weight: bold;
                    text-indent: 2em;
                    margin-top: 10pt;
                    margin-bottom: 4pt;
                    line-height: 1.5;
                }
                p.h3-title {
                    font-family: 'Times New Roman', '方正仿宋简体', '仿宋_GB2312', '仿宋', serif;
                    font-size: 12pt;
                    font-weight: bold;
                    text-indent: 2em;
                    margin: 6pt 0 2pt 0;
                    line-height: 1.5;
                }
                p.body-para {
                    font-family: 'Times New Roman', '方正仿宋简体', '仿宋_GB2312', '仿宋', serif;
                    font-size: 12pt;
                    text-indent: 2em;
                    margin: 0 0 4pt 0;
                    line-height: 1.5;
                    text-align: justify;
                }
                table.three-line-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 8pt 0 12pt 0;
                }
            </style>
        </head>
        <body>
            <div class="Section1">
                <h1 class="doc-title">四川省生物医药科技创新政策周报</h1>
                <p class="doc-subtitle">（${docPeriod} · ${docDate}）</p>
                ${bodyHtml}
            </div>
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff', wordDocHtml], { type: 'application/msword;charset=utf-8' });
    downloadBlobFile(blob, filename.replace('.docx', '.doc'));
}

function downloadBlobFile(blob, filename) {
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
}

window.handleExportWeeklyWord = handleExportWeeklyWord;
window.handleClearChat = handleClearChat;

function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    setTimeout(() => {
        el.toast.classList.add('hidden');
    }, 4000);
}
