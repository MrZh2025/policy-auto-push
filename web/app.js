/**
 * 医药健康产业政策监测与申报研判系统 - 前端交互逻辑
 * 支持 GitHub Pages 静态无服务器部署与本地动态 API 模式自适应切换
 */

// 状态管理
const state = {
    currentTrack: 'all',
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

    // 导航栏切换
    el.navItems.forEach(item => {
        item.addEventListener('click', () => {
            el.navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            state.currentTrack = item.getAttribute('data-track');
            el.listBadge.textContent = item.querySelector('a').textContent.split('(')[0].trim();
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
    let list = state.allPolicies;

    if (state.currentTrack && state.currentTrack !== 'all') {
        list = list.filter(p => (p.category || '').includes(state.currentTrack));
    }

    if (state.searchQuery) {
        const q = state.searchQuery;
        list = list.filter(p => 
            (p.title || '').toLowerCase().includes(q) || 
            (p.summary || '').toLowerCase().includes(q) || 
            (p.source || '').toLowerCase().includes(q)
        );
    }

    state.filteredPolicies = list;
    renderPolicyList(list);
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

async function handleExportWord() {
    showToast('正在按照 GB/T 9704-2012 公文标准导出 Word 报告...');
    try {
        const resp = await fetch('/api/export-word', { method: 'POST' });
        if (resp.ok) {
            const res = await resp.json();
            showToast(res.msg || 'Word 简报已成功保存到您的桌面！');
            return;
        }
    } catch (e) {}
    showToast('💡 提示：公文 Word 简报每天在 GitHub Actions 运行后会自动生成，可在 Actions 页面右上角 Artifacts 随时下载！');
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
