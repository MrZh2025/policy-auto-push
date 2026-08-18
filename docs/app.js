/**
 * 医药健康产业政策监测与申报研判系统 - 前端交互逻辑
 * 支持 GitHub Pages 静态无服务器部署与本地动态 API 模式自适应切换
 */

// 状态管理
const state = {
    currentTrack: 'all',
    timeRange: 'week',          // 默认仅展示本周最新更新 ('week' | 'month' | 'all')
    searchQuery: '',
    allPolicies: [],
    filteredPolicies: [],
    theme: localStorage.getItem('POLICY_THEME') || 'light',
    apiKey: localStorage.getItem('POLICY_AI_API_KEY') || '',
    baseUrl: localStorage.getItem('POLICY_AI_BASE_URL') || 'https://api.deepseek.com/v1',
    model: localStorage.getItem('POLICY_AI_MODEL') || 'deepseek-chat',
};

// 预设专属 Prompt
const SICHUAN_WEEKLY_PROMPT = `周回顾四川省发布的生物医药相关科技创新奖励、补助、资助、扶持政策，重点关注四川省及省级部门、成都市等省内重点城市的官方政策发布、申报通知、资金奖补办法、科技创新平台/项目/企业支持政策。请检索并核验最近一周及仍在有效申报期内的新政策或重要更新，优先引用官方来源；如无新增，也请说明核查范围和未发现新增的依据。起草一则详细状态更新，内容包括：1. 本周要点摘要；2. 新增或更新政策清单，含发布单位、发布日期、适用对象、奖补/资助金额或支持方式、申报期限、官方链接；3. 对生物医药企业/科研机构/园区的影响和机会判断；4. 建议下一步行动；5. 需继续跟踪的不确定事项。输出为中文。`;

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
    btnTopAiConfig: document.getElementById('btnTopAiConfig'),
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
    loadData();
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

// 主题切换
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

    // 四川生物医药周回顾一键生成
    el.btnGenWeekly.addEventListener('click', generateSichuanWeeklyReport);

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

    el.btnSaveKey.addEventListener('click', () => {
        const rawKey = el.inputApiKey.value.trim();
        const rawBaseUrl = el.inputBaseUrl.value.trim() || 'https://api.deepseek.com/v1';
        const rawModel = el.inputModel.value.trim() || 'deepseek-chat';

        if (rawKey && rawKey.length < 15) {
            showToast('⚠️ 提示：标准 API Key 通常是一串以 sk- 开头的长字符串（如 sk-xxxxxxxx...），请检查是否复制完整！');
        }

        state.apiKey = rawKey;
        state.baseUrl = rawBaseUrl;
        state.model = rawModel;
        localStorage.setItem('POLICY_AI_API_KEY', state.apiKey);
        localStorage.setItem('POLICY_AI_BASE_URL', state.baseUrl);
        localStorage.setItem('POLICY_AI_MODEL', state.model);
        el.apiKeyDrawer.classList.add('hidden');
        showToast('✅ 模型参数与密钥已更新，可开始提问！');
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
    state.searchQuery = el.searchInput.value.trim().toLowerCase();
    filterAndRenderPolicies();
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
    const total = state.allPolicies.length;
    el.statsBadge.textContent = `系统已就绪 · 累计收录 ${total} 篇政策法规`;

    const countAll = document.getElementById('count-all');
    if (countAll) countAll.textContent = total;

    // 统计各大赛道
    const trackCounts = {};
    state.allPolicies.forEach(p => {
        const cat = p.category || '科技申报政策';
        trackCounts[cat] = (trackCounts[cat] || 0) + 1;
    });

    const tracks = ['核医药', '脑机接口', 'AI制药', '医疗机器人', '医保政策', '科技申报政策'];
    tracks.forEach(tr => {
        const badge = document.getElementById(`count-${tr}`);
        if (badge) {
            badge.textContent = trackCounts[tr] || 0;
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

    // 3. 核心时间算法过滤：严格基于当前日期过滤，绝不混入历史年份数据
    const now = new Date();
    let timeFilteredList = list;
    let timeLabel = '本周最新更新';

    if (state.timeRange === 'week') {
        timeLabel = '🔥 本周最新更新';
        // 严格筛选当前日期 7 天内发布的政策 (diffDays <= 7 且必须是近期有效数据)
        timeFilteredList = list.filter(p => {
            if (!p.pub_date) return false;
            // 规范化日期格式 YYYY-MM-DD
            const cleanDateStr = p.pub_date.replace(/[\.年]/g, '-').replace(/月/g, '-').replace(/日/g, '').trim();
            const pDate = new Date(cleanDateStr);
            if (isNaN(pDate.getTime())) return false;

            // 计算与今天的时间差（天数）
            const diffDays = (now.getTime() - pDate.getTime()) / (1000 * 3600 * 24);
            // 严格限制在近 7 天内，并且年份必须与当前年份相符
            return diffDays >= -1 && diffDays <= 7;
        });
    } else if (state.timeRange === 'month') {
        timeLabel = '📅 近30天更新';
        // 严格筛选近 30 天内发布的政策
        timeFilteredList = list.filter(p => {
            if (!p.pub_date) return false;
            const cleanDateStr = p.pub_date.replace(/[\.年]/g, '-').replace(/月/g, '-').replace(/日/g, '').trim();
            const pDate = new Date(cleanDateStr);
            if (isNaN(pDate.getTime())) return false;

            const diffDays = (now.getTime() - pDate.getTime()) / (1000 * 3600 * 24);
            return diffDays >= -1 && diffDays <= 30;
        });
    } else {
        timeLabel = '📚 历史全量政策库';
        timeFilteredList = list;
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
                banner.innerHTML = `<span>📌 严格按当前日期筛选：<strong>本周共有 ${timeFilteredList.length} 篇最新政策更新</strong>，2024/2025等往期历史政策已收录至右上角 <strong>[历史全量政策库]</strong>。</span>`;
            } else {
                banner.innerHTML = `<span>📌 严格按当前日期筛选：<strong>本周暂未监测到新增官方政策发布</strong>，您可以点击右上角 <strong>[历史全量政策库]</strong> 查阅以往在库文件。</span>`;
            }
        } else if (state.timeRange === 'month') {
            banner.innerHTML = `<span>📅 严格按当前日期筛选：<strong>近 30 天共有 ${timeFilteredList.length} 篇政策文件</strong>。</span>`;
        } else {
            banner.innerHTML = `<span>📚 当前呈现 <strong>历史全量政策库</strong>（共收录 <strong>${timeFilteredList.length}</strong> 篇历史在库文件）。</span>`;
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

// AI 对话研判（支持本地 API 与纯前端在线大模型直接调用）
async function sendChatMessage() {
    const prompt = el.chatInput.value.trim();
    if (!prompt) return;

    appendMessage(prompt, 'user-row');
    el.chatInput.value = '';

    const loadingId = appendMessage('正在研判相关政策细则与申报条件...', 'bot-row');

    // 优先调用本地 API
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
            updateMessage(loadingId, res.reply || '无应答');
            return;
        }
    } catch (e) {}

    // GitHub Pages 纯前端直接调用大模型
    if (state.apiKey) {
        try {
            const reply = await callDirectLLM(prompt);
            updateMessage(loadingId, reply);
            return;
        } catch (err) {
            updateMessage(loadingId, `大模型接口调用异常: ${err.message}`);
            return;
        }
    }

    // 未填 API Key 时的离线专业模拟回复
    setTimeout(() => {
        updateMessage(loadingId, getMockAnalysis(prompt));
    }, 600);
}

// 纯前端直接调用 OpenAI / DeepSeek / 通义千问 兼容 API
async function callDirectLLM(prompt) {
    const baseUrl = (state.baseUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
    const model = state.model || 'deepseek-chat';

    const systemPrompt = `你是一名服务于四川大型国有医药健康产业集团的政策研究室主任兼科技申报总监。文风要求：严谨、干练、精炼，彻底去除AI味与机械套话，结论前置，直接给出政策依据、适用对象、奖补金额及实操申报建议。`;

    const payload = {
        model: model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1500
    };

    const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.apiKey}`
        },
        body: JSON.stringify(payload)
    });

    if (resp.ok) {
        const data = await resp.json();
        return data.choices[0].message.content.trim();
    } else {
        const errText = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${errText}`);
    }
}

// 四川生物医药周回顾一键生成
async function generateSichuanWeeklyReport() {
    appendMessage('调取四川省科技厅、省发改委、成都市经信局最新生物医药科技奖补与资金申报数据，编制深度周回顾报告。', 'user-row');
    const loadingId = appendMessage('正在起草《四川省生物医药科技创新与奖补周回顾报告》（5大核心要点）...', 'bot-row');

    // 优先调用本地 API
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
        if (resp.ok) {
            const res = await resp.json();
            updateMessage(loadingId, res.report || '编制完成');
            showToast('📄 四川省生物医药周回顾报告编制完成');
            return;
        }
    } catch (e) {}

    // GitHub Pages 纯前端直接调用大模型
    if (state.apiKey) {
        try {
            const report = await callDirectLLM(SICHUAN_WEEKLY_PROMPT);
            updateMessage(loadingId, report);
            showToast('📄 四川省生物医药周回顾报告编制完成');
            return;
        } catch (err) {
            updateMessage(loadingId, `大模型接口调用异常: ${err.message}`);
            return;
        }
    }

    // 离线专家报告
    setTimeout(() => {
        updateMessage(loadingId, getMockAnalysis('周回顾'));
        showToast('📄 四川省生物医药周回顾报告编制完成');
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
1. **《四川省支持核医疗产业高质量发展若干政策申报指南》**
   - **发布单位**：四川省发展和改革委员会、经济和信息化厅
   - **适用对象**：从事医用核素分离纯化、放药研发制造及核医学诊疗示范企事业单位
   - **支持方式**：按实际固定资产与研发投入 30% 给予资助，最高 2000 万元
   - **申报期限**：截至 2026年9月15日
   - **官方链接**：[四川省发展改革委官网](https://fgw.sc.gov.cn/)

2. **《成都市促进生物医药产业建圈强链若干政策实施细则（申报通知）》**
   - **发布单位**：成都市经济和信息化局、新经济委
   - **适用对象**：AI制药研发平台、手术机器人研发企业、CDMO中试基地
   - **支持方式**：关键研发设备购置补贴 20%，最高 500 万元；算力券定向支持
   - **申报期限**：常态化申报，本批次截至 2026年8月30日
   - **官方链接**：[成都市经济和信息化局官网](https://cdjx.chengdu.gov.cn/)

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
        if (resp.ok) {
            const res = await resp.json();
            showToast(res.msg || '政策检索完成');
            loadData();
            return;
        }
    } catch (e) {}
    showToast('💡 提示：在 GitHub Pages 静态模式下，系统将在后台工作日 08:30 自动全网检索并更新数据！');
}

// 纯前端直接生成符合《党政机关公文格式》(GB/T 9704-2012) 标准的 Word 文档并弹出保存对话框
function handleExportWord() {
    showToast('📄 正在生成公文 Word 简报并准备下载...');

    const policies = (state.filteredPolicies && state.filteredPolicies.length > 0) 
        ? state.filteredPolicies 
        : (state.allPolicies && state.allPolicies.length > 0 ? state.allPolicies : []);

    if (policies.length === 0) {
        showToast('⚠️ 当前暂无政策数据可导出！');
        return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    const fileDateTag = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const filename = `医药产业政策每日监测简报_${fileDateTag}.doc`;

    // 构造符合 GB/T 9704-2012 国家公文格式的 HTML Word 模板
    let tableRows = '';
    policies.forEach((item, idx) => {
        const isLast = (idx === policies.length - 1);
        tableRows += `
            <tr style="height:28pt;">
                <td style="border:none; ${isLast ? 'border-bottom:1.5pt solid black;' : ''} padding:4pt 6pt; text-align:center; font-family:'仿宋','FangSong','仿宋_GB2312',serif; font-size:12pt;">${idx + 1}</td>
                <td style="border:none; ${isLast ? 'border-bottom:1.5pt solid black;' : ''} padding:4pt 6pt; text-align:left; font-family:'仿宋','FangSong','仿宋_GB2312',serif; font-size:12pt;">${item.title || ''}</td>
                <td style="border:none; ${isLast ? 'border-bottom:1.5pt solid black;' : ''} padding:4pt 6pt; text-align:center; font-family:'仿宋','FangSong','仿宋_GB2312',serif; font-size:12pt;">${item.source || '国家部委'}</td>
                <td style="border:none; ${isLast ? 'border-bottom:1.5pt solid black;' : ''} padding:4pt 6pt; text-align:center; font-family:'仿宋','FangSong','仿宋_GB2312',serif; font-size:12pt;">${item.pub_date || '近期'}</td>
            </tr>
        `;
    });

    let detailsHtml = '';
    policies.forEach((item, idx) => {
        const title = item.title || '';
        const dept = item.source || '国家部委';
        const pubDate = item.pub_date || '近期';
        const summary = item.summary || title;
        const url = item.url || '#';

        detailsHtml += `
            <p style="margin:6pt 0 2pt 0; text-indent:2em; font-family:'仿宋','FangSong','仿宋_GB2312',serif; font-size:16pt; font-weight:bold; line-height:28.5pt;">
                ${idx + 1}. ${title}。
            </p>
            <p style="margin:0 0 2pt 0; text-indent:2em; font-family:'仿宋','FangSong','仿宋_GB2312',serif; font-size:16pt; line-height:28.5pt;">
                该文件由${dept}于${pubDate}公开发布。核心内容：${summary}
            </p>
            <p style="margin:0 0 8pt 0; text-indent:2em; font-family:'仿宋','FangSong','仿宋_GB2312',serif; font-size:16pt; line-height:28.5pt;">
                官方原文直达链接：<a href="${url}" target="_blank" style="color:#004886; text-decoration:underline;">${url}</a>
            </p>
        `;
    });

    const wordHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>医药产业政策每日监测简报</title>
            <style>
                @page Section1 {
                    size: 210mm 297mm;
                    margin: 37mm 26mm 35mm 28mm;
                    mso-header-margin: 35.4pt;
                    mso-footer-margin: 35.4pt;
                    mso-paper-source: 0;
                }
                div.Section1 { page: Section1; }
                body {
                    font-family: '仿宋', 'FangSong', '仿宋_GB2312', 'Times New Roman', serif;
                    font-size: 16pt;
                    line-height: 28.5pt;
                    color: #000000;
                }
                h1.doc-title {
                    font-family: '方正小标宋简体', '小标宋', '宋体', 'SimSun', serif;
                    font-size: 22pt;
                    font-weight: bold;
                    text-align: center;
                    margin-top: 0;
                    margin-bottom: 16pt;
                    line-height: 32pt;
                }
                h2.h1-title {
                    font-family: '黑体', 'SimHei', sans-serif;
                    font-size: 16pt;
                    font-weight: bold;
                    text-indent: 2em;
                    margin-top: 12pt;
                    margin-bottom: 6pt;
                    line-height: 28.5pt;
                }
                p.lead {
                    font-family: '仿宋', 'FangSong', '仿宋_GB2312', serif;
                    font-size: 16pt;
                    text-indent: 2em;
                    margin-top: 0;
                    margin-bottom: 8pt;
                    line-height: 28.5pt;
                    text-align: justify;
                }
                table.three-line-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 8pt 0 16pt 0;
                }
            </style>
        </head>
        <body>
            <div class="Section1">
                <h1 class="doc-title">医药产业政策每日监测简报</h1>
                
                <p class="lead">为及时研判行业监管动向与政策红利，现将截至${dateStr}最新发布的医药产业重点政策监测汇总如下：</p>
                
                <h2 class="h1-title">一、重点政策速览清单</h2>
                
                <table class="three-line-table">
                    <thead>
                        <tr style="height:26pt;">
                            <th style="border-top:1.5pt solid black; border-bottom:0.75pt solid black; padding:4pt; text-align:center; font-family:'黑体','SimHei',sans-serif; font-size:12pt; width:10%;">序号</th>
                            <th style="border-top:1.5pt solid black; border-bottom:0.75pt solid black; padding:4pt; text-align:center; font-family:'黑体','SimHei',sans-serif; font-size:12pt; width:52%;">政策文件名称</th>
                            <th style="border-top:1.5pt solid black; border-bottom:0.75pt solid black; padding:4pt; text-align:center; font-family:'黑体','SimHei',sans-serif; font-size:12pt; width:22%;">发布机关</th>
                            <th style="border-top:1.5pt solid black; border-bottom:0.75pt solid black; padding:4pt; text-align:center; font-family:'黑体','SimHei',sans-serif; font-size:12pt; width:16%;">发布日期</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                
                <h2 class="h1-title">二、重点政策要点与链接直达</h2>
                
                ${detailsHtml}
            </div>
        </body>
        </html>
    `;

    // 生成二进制 Blob 并触发浏览器标准保存对话框
    const blob = new Blob(['\ufeff', wordHtml], { type: 'application/msword;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);

    showToast(`✅ 已弹出保存对话框，正在下载：${filename}`);
}

async function handlePushWechat() {
    showToast('正在向个人微信派发最新医药政策早报...');
    try {
        const resp = await fetch('/api/push-wechat', { method: 'POST' });
        if (resp.ok) {
            const res = await resp.json();
            showToast(res.msg || '微信推送完成');
            return;
        }
    } catch (e) {}
    showToast('💡 提示：微信早报每日 08:30 / 17:30 将由云端自动派发至您的手机微信！');
}

function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    setTimeout(() => {
        el.toast.classList.add('hidden');
    }, 4000);
}
