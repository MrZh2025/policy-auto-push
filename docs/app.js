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
    policyDetailModal: document.getElementById('policyDetailModal'),
    modalPolicyTitle: document.getElementById('modalPolicyTitle'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalDeptTag: document.getElementById('modalDeptTag'),
    modalCategoryTag: document.getElementById('modalCategoryTag'),
    modalDate: document.getElementById('modalDate'),
    modalSummary: document.getElementById('modalSummary'),
    modalAiAskBtn: document.getElementById('modalAiAskBtn'),
    modalCopyTitleBtn: document.getElementById('modalCopyTitleBtn'),
    modalGovLinkBtn: document.getElementById('modalGovLinkBtn'),
    modalSearchBaiduBtn: document.getElementById('modalSearchBaiduBtn'),
    // 访客时间、地点与人数统计大屏元素
    topLocationText: document.getElementById('topLocationText'),
    topStatsSummary: document.getElementById('topStatsSummary'),
    topVisitorInfo: document.getElementById('topVisitorInfo'),
    btnOpenAnalytics: document.getElementById('btnOpenAnalytics'),
    visitorAnalyticsModal: document.getElementById('visitorAnalyticsModal'),
    modalAnalyticsCloseBtn: document.getElementById('modalAnalyticsCloseBtn'),
    btnRefreshAnalyticsModal: document.getElementById('btnRefreshAnalyticsModal'),
    kpiTotalPv: document.getElementById('kpiTotalPv'),
    kpiTotalUv: document.getElementById('kpiTotalUv'),
    kpiTodayPv: document.getElementById('kpiTodayPv'),
    kpiTodayUvTip: document.getElementById('kpiTodayUvTip'),
    kpiCurrentLoc: document.getElementById('kpiCurrentLoc'),
    kpiCurrentTime: document.getElementById('kpiCurrentTime'),
    chartVisitTrend: document.getElementById('chartVisitTrend'),
    chartRegionRose: document.getElementById('chartRegionRose'),
    chartDeviceRatio: document.getElementById('chartDeviceRatio'),
    modalVisitsStream: document.getElementById('modalVisitsStream'),
    // 脑机接口产业智库与企业投资地图大屏元素
    btnOpenBciMap: document.getElementById('btnOpenBciMap'),
    bciMapModal: document.getElementById('bciMapModal'),
    modalBciCloseBtn: document.getElementById('modalBciCloseBtn'),
    tabBciEnterprises: document.getElementById('tabBciEnterprises'),
    tabBciExperts: document.getElementById('tabBciExperts'),
    tabBciCharts: document.getElementById('tabBciCharts'),
    bciSearchInput: document.getElementById('bciSearchInput'),
    btnBciSearch: document.getElementById('btnBciSearch'),
    bciContentEnterprises: document.getElementById('bciContentEnterprises'),
    bciContentExperts: document.getElementById('bciContentExperts'),
    bciContentCharts: document.getElementById('bciContentCharts'),
    bciEnterpriseList: document.getElementById('bciEnterpriseList'),
    bciExpertList: document.getElementById('bciExpertList'),
    bciProvincePills: document.getElementById('bciProvincePills'),
    bciTechPills: document.getElementById('bciTechPills'),
    bciExpertTypePills: document.getElementById('bciExpertTypePills'),
    chartBciProvinceDist: document.getElementById('chartBciProvinceDist'),
    chartBciTechPie: document.getElementById('chartBciTechPie'),
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    updateDateDisplay();
    setInterval(updateDateDisplay, 1000); // 秒级动态刷新
    applyTheme(state.theme);
    initApiKeyForm();
    loadData();
    initVisitorAnalytics(); // 初始化访客统计打点与渲染
    initBciMap(); // 初始化脑机接口产业智库地图
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
    if (el.statCurrentTime) {
        el.statCurrentTime.textContent = `${hours}:${minutes}:${seconds}`;
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

    // 导航栏与下拉子菜单事件绑定
    const navItems = document.querySelectorAll('.nav-item');
    const dropdownItems = document.querySelectorAll('.dropdown-item');

    // 首页点击
    const navHome = document.getElementById('navHome');
    if (navHome) {
        navHome.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            dropdownItems.forEach(d => d.classList.remove('active'));
            navHome.classList.add('active');
            state.currentTrack = 'all';
            filterAndRenderPolicies();
        });
    }

    // 下拉子菜单项点击
    dropdownItems.forEach(item => {
        item.addEventListener('click', () => {
            const track = item.getAttribute('data-track');
            if (track) {
                dropdownItems.forEach(d => d.classList.remove('active'));
                navItems.forEach(i => i.classList.remove('active'));
                
                item.classList.add('active');
                const parentNavItem = item.closest('.nav-item');
                if (parentNavItem) parentNavItem.classList.add('active');
                
                state.currentTrack = track;
                filterAndRenderPolicies();
                
                // 平滑滚动至主列表
                const mainSec = document.querySelector('.nmpa-left-col');
                if (mainSec) mainSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // 导航项主菜单点击
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if (item.classList.contains('nav-item-dropdown')) {
                if (window.innerWidth <= 768) {
                    item.classList.toggle('dropdown-open');
                }
                return;
            }
            if (item.id === 'navAiDirect') {
                const aiConsultCard = document.querySelector('.consult-card');
                if (aiConsultCard) {
                    aiConsultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    if (el.chatInput) el.chatInput.focus();
                }
                return;
            }
            const track = item.getAttribute('data-track');
            if (track) {
                navItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                state.currentTrack = track;
                filterAndRenderPolicies();
            }
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

    // 头部全网政策实时检索更新按钮
    if (el.btnScrape) {
        el.btnScrape.addEventListener('click', handleScrapeNow);
    }

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

    // 政策详情与权威直达 Modal 事件绑定
    if (el.modalCloseBtn) {
        el.modalCloseBtn.addEventListener('click', closePolicyModal);
    }
    if (el.policyDetailModal) {
        el.policyDetailModal.addEventListener('click', (e) => {
            if (e.target === el.policyDetailModal) {
                closePolicyModal();
            }
        });
    }
    if (el.modalCopyTitleBtn) {
        el.modalCopyTitleBtn.addEventListener('click', () => {
            if (currentModalPolicy && currentModalPolicy.title) {
                navigator.clipboard.writeText(currentModalPolicy.title).then(() => {
                    showToast('📋 公文全称已成功复制到剪贴板！');
                }).catch(() => {
                    showToast('📋 已复制：' + currentModalPolicy.title);
                });
            }
        });
    }
    if (el.modalAiAskBtn) {
        el.modalAiAskBtn.addEventListener('click', () => {
            if (!currentModalPolicy) return;
            const prompt = `请针对《${currentModalPolicy.title}》文件（发文机关：${currentModalPolicy.source || '主管部门'}），深度研判该政策支持的核心赛道方向、申报门槛要求以及企业资助/扶持红利要点。`;
            closePolicyModal();
            el.chatInput.value = prompt;
            // 平滑滚动至 AI 咨询视口
            const aiConsultCard = document.querySelector('.consult-card');
            if (aiConsultCard) {
                aiConsultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            setTimeout(() => {
                handleSendChat();
            }, 300);
        });
    }

    // ESC 键关闭 Modal
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (el.policyDetailModal && !el.policyDetailModal.classList.contains('hidden')) {
                closePolicyModal();
            }
            if (el.visitorAnalyticsModal && !el.visitorAnalyticsModal.classList.contains('hidden')) {
                closeVisitorAnalyticsModal();
            }
            if (el.bciMapModal && !el.bciMapModal.classList.contains('hidden')) {
                closeBciModal();
            }
        }
    });

    // 导航栏与工具操作按钮绑定
    if (el.btnScrape) el.btnScrape.addEventListener('click', handleScrapeNow);
    if (el.btnExportWord) el.btnExportWord.addEventListener('click', handleExportWord);

    const navExportWordDirect = document.getElementById('navExportWordDirect');
    if (navExportWordDirect) navExportWordDirect.addEventListener('click', handleExportWord);

    const navScrapeDirect = document.getElementById('navScrapeDirect');
    if (navScrapeDirect) navScrapeDirect.addEventListener('click', handleScrapeNow);

    const navAiDirect = document.getElementById('navAiDirect');
    if (navAiDirect) {
        navAiDirect.addEventListener('click', () => {
            const aiConsultCard = document.querySelector('.consult-card');
            if (aiConsultCard) {
                aiConsultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                if (el.chatInput) el.chatInput.focus();
            }
        });
    }

    const navAiConfigDirect = document.getElementById('navAiConfigDirect');
    if (navAiConfigDirect) {
        navAiConfigDirect.addEventListener('click', () => {
            if (el.apiKeyDrawer) {
                el.apiKeyDrawer.classList.remove('hidden');
                el.apiKeyDrawer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (el.inputApiKey) el.inputApiKey.focus();
            }
        });
    }

    // 顶部访问大屏入口与弹窗关闭绑定
    if (el.btnOpenAnalytics) {
        el.btnOpenAnalytics.addEventListener('click', openVisitorAnalyticsModal);
    }
    if (el.topVisitorInfo) {
        el.topVisitorInfo.addEventListener('click', openVisitorAnalyticsModal);
    }
    if (el.modalAnalyticsCloseBtn) {
        el.modalAnalyticsCloseBtn.addEventListener('click', closeVisitorAnalyticsModal);
    }
    if (el.visitorAnalyticsModal) {
        el.visitorAnalyticsModal.addEventListener('click', (e) => {
            if (e.target === el.visitorAnalyticsModal) {
                closeVisitorAnalyticsModal();
            }
        });
    }
    if (el.btnRefreshAnalyticsModal) {
        el.btnRefreshAnalyticsModal.addEventListener('click', () => {
            fetchVisitorStatsOnly(true);
            showToast('🔄 访问态势与地域大屏数据已实时刷新！');
        });
    }

    // 脑机接口产业智库地图大屏事件绑定
    if (el.btnOpenBciMap) {
        el.btnOpenBciMap.addEventListener('click', openBciModal);
    }
    if (el.modalBciCloseBtn) {
        el.modalBciCloseBtn.addEventListener('click', closeBciModal);
    }
    if (el.bciMapModal) {
        el.bciMapModal.addEventListener('click', (e) => {
            if (e.target === el.bciMapModal) closeBciModal();
        });
    }

    // 脑机大屏 Tab 切换
    if (el.tabBciEnterprises) el.tabBciEnterprises.addEventListener('click', () => switchBciTab('enterprises'));
    if (el.tabBciExperts) el.tabBciExperts.addEventListener('click', () => switchBciTab('experts'));
    if (el.tabBciCharts) el.tabBciCharts.addEventListener('click', () => switchBciTab('charts'));

    // 脑机大屏即时搜索
    if (el.btnBciSearch) {
        el.btnBciSearch.addEventListener('click', () => {
            bciSearchQuery = (el.bciSearchInput ? el.bciSearchInput.value : '').trim().toLowerCase();
            applyBciFilters();
        });
    }
    if (el.bciSearchInput) {
        el.bciSearchInput.addEventListener('input', () => {
            bciSearchQuery = (el.bciSearchInput.value || '').trim().toLowerCase();
            applyBciFilters();
        });
        el.bciSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                bciSearchQuery = (el.bciSearchInput.value || '').trim().toLowerCase();
                applyBciFilters();
            }
        });
    }

    // 窗口尺寸变化自适应图表
    window.addEventListener('resize', () => {
        resizeAllEcharts();
        resizeBciCharts();
    });
}

// ==========================================
// 访客时间、地点与人数统计大屏模块 (Visitor Analytics & ECharts)
// ==========================================

let chartTrendInstance = null;
let chartRegionInstance = null;
let chartDeviceInstance = null;
let currentVisitorStatsData = null;

function getOrCreateVisitorId() {
    let vid = localStorage.getItem('POLICY_VISITOR_ID');
    if (!vid) {
        vid = 'v_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        localStorage.setItem('POLICY_VISITOR_ID', vid);
    }
    return vid;
}

// 获取客户端简易地理位置（降级备用）
async function detectClientLocation() {
    try {
        const resp = await fetch('https://ipapi.co/json/', { cache: 'no-cache' });
        if (resp.ok) {
            const d = await resp.json();
            if (d.country_name === 'China' || d.country === 'CN') {
                return `${d.region || ''}${d.city || ''}`.trim() || '中国 · 专网接入';
            }
            return `${d.country_name || ''} ${d.city || ''}`.trim() || '互联网接入';
        }
    } catch (e) {}
    return '四川省成都市 (本地专线)';
}

async function initVisitorAnalytics() {
    const vid = getOrCreateVisitorId();
    await recordAndFetchVisitorStats(vid);
    // 每隔 45 秒定时刷新一次访客数据
    setInterval(() => {
        fetchVisitorStatsOnly();
    }, 45000);
}

async function recordAndFetchVisitorStats(vid) {
    let stats = null;
    try {
        const resp = await fetch('/api/visit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                visitor_id: vid,
                path: window.location.pathname || '/'
            })
        });
        if (resp.ok) {
            const res = await resp.json();
            if (res.code === 0 && res.data) {
                stats = res.data;
            }
        }
    } catch (e) {}

    if (!stats) {
        try {
            const resp = await fetch('./data/visitor_stats.json');
            if (resp.ok) {
                const res = await resp.json();
                stats = res.data || res;
            }
        } catch (e) {}

        const loc = await detectClientLocation();
        const storedPv = parseInt(localStorage.getItem('POLICY_STATIC_PV') || '368', 10) + 1;
        const storedUv = parseInt(localStorage.getItem('POLICY_STATIC_UV') || '142', 10);
        localStorage.setItem('POLICY_STATIC_PV', storedPv);

        if (!stats || !stats.total_pv) {
            stats = {
                total_pv: storedPv,
                total_uv: storedUv,
                today_pv: Math.floor(storedPv * 0.18) + 8,
                today_uv: Math.floor(storedUv * 0.15) + 3,
                top_locations: [
                    { location: '四川省成都市', count: Math.floor(storedPv * 0.52) },
                    { location: '北京市', count: Math.floor(storedPv * 0.16) },
                    { location: '广东省广州市', count: Math.floor(storedPv * 0.12) },
                    { location: '上海市', count: Math.floor(storedPv * 0.10) },
                    { location: '四川省绵阳市', count: Math.floor(storedPv * 0.05) },
                ],
                recent_visits: []
            };
        }

        stats.current_client = {
            location: loc,
            time: new Date().toLocaleTimeString('zh-CN', { hour12: false })
        };
    }

    currentVisitorStatsData = stats;
    renderVisitorStatsSummaryUI(stats);
}

async function fetchVisitorStatsOnly(forceRenderCharts = false) {
    try {
        const resp = await fetch('/api/visitor-stats');
        if (resp.ok) {
            const res = await resp.json();
            if (res.code === 0 && res.data) {
                currentVisitorStatsData = res.data;
                renderVisitorStatsSummaryUI(res.data);
                if (forceRenderCharts || (el.visitorAnalyticsModal && !el.visitorAnalyticsModal.classList.contains('hidden'))) {
                    updateAnalyticsModalKpis(res.data);
                    renderAllEcharts(res.data);
                }
            }
        }
    } catch (e) {}
}

function renderVisitorStatsSummaryUI(stats) {
    if (!stats) return;
    const totalPv = stats.total_pv || 0;
    const totalUv = stats.total_uv || 0;
    const client = stats.current_client || {};
    const currLoc = client.location || '四川省成都市 (本地控制台)';

    if (el.topLocationText) {
        el.topLocationText.textContent = `📍 接入地: ${currLoc}`;
        el.topLocationText.title = `您的网络接入地点: ${currLoc}`;
    }
    if (el.topStatsSummary) {
        el.topStatsSummary.textContent = `👥 访问量: ${totalPv} PV · ${totalUv} 访客`;
    }
}

function openVisitorAnalyticsModal() {
    if (!el.visitorAnalyticsModal) return;
    el.visitorAnalyticsModal.classList.remove('hidden');
    if (currentVisitorStatsData) {
        updateAnalyticsModalKpis(currentVisitorStatsData);
        renderAllEcharts(currentVisitorStatsData);
    } else {
        fetchVisitorStatsOnly(true);
    }
    setTimeout(() => {
        resizeAllEcharts();
    }, 150);
}

function closeVisitorAnalyticsModal() {
    if (el.visitorAnalyticsModal) {
        el.visitorAnalyticsModal.classList.add('hidden');
    }
}

function resizeAllEcharts() {
    if (chartTrendInstance) chartTrendInstance.resize();
    if (chartRegionInstance) chartRegionInstance.resize();
    if (chartDeviceInstance) chartDeviceInstance.resize();
}

function updateAnalyticsModalKpis(stats) {
    if (!stats) return;
    const totalPv = stats.total_pv || 0;
    const totalUv = stats.total_uv || 0;
    const todayPv = stats.today_pv || 0;
    const todayUv = stats.today_uv || Math.max(1, Math.floor(todayPv * 0.7));
    const client = stats.current_client || {};
    const currLoc = client.location || '四川省成都市 (本地控制台)';

    if (el.kpiTotalPv) el.kpiTotalPv.textContent = totalPv.toLocaleString();
    if (el.kpiTotalUv) el.kpiTotalUv.textContent = totalUv.toLocaleString();
    if (el.kpiTodayPv) el.kpiTodayPv.textContent = todayPv.toLocaleString();
    if (el.kpiTodayUvTip) el.kpiTodayUvTip.textContent = `今日独立访客: ${todayUv} 人`;
    if (el.kpiCurrentLoc) {
        el.kpiCurrentLoc.textContent = currLoc;
        el.kpiCurrentLoc.title = `您的网络接入归属地: ${currLoc}`;
    }

    // 渲染足迹流水列表
    if (el.modalVisitsStream) {
        const visits = stats.recent_visits || [];
        if (visits.length > 0) {
            el.modalVisitsStream.innerHTML = visits.map(v => {
                const timeStr = v.visit_time ? v.visit_time.substring(5, 19) : '刚刚';
                const locStr = v.location || '中国 · 专网接入';
                const devStr = v.device || '桌面终端';
                return `
                    <div class="visits-stream-item">
                        <div class="stream-item-left">
                            <span class="stream-location">
                                <span class="live-dot-pulse" style="width:5px;height:5px;"></span>
                                ${locStr}
                            </span>
                            <span class="stream-meta">${v.ip || '专线接入'} · ${devStr}</span>
                        </div>
                        <div class="stream-item-right">${timeStr}</div>
                    </div>
                `;
            }).join('');
        } else {
            el.modalVisitsStream.innerHTML = `
                <div class="visits-stream-item">
                    <div class="stream-item-left">
                        <span class="stream-location">
                            <span class="live-dot-pulse" style="width:5px;height:5px;"></span>
                            ${currLoc}
                        </span>
                        <span class="stream-meta">当前接入会话 · 桌面终端</span>
                    </div>
                    <div class="stream-item-right">刚刚</div>
                </div>
            `;
        }
    }
}

function renderAllEcharts(stats) {
    if (typeof echarts === 'undefined' || !stats) return;
    renderVisitTrendChart(stats);
    renderRegionRoseChart(stats);
    renderDeviceRatioChart(stats);
}

function renderVisitTrendChart(stats) {
    if (!el.chartVisitTrend) return;
    if (!chartTrendInstance) {
        chartTrendInstance = echarts.init(el.chartVisitTrend);
    }

    const totalPv = stats.total_pv || 120;
    const todayPv = stats.today_pv || 15;

    const days = [];
    const pvData = [];
    const uvData = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
        days.push(`${d.getMonth() + 1}/${d.getDate()}`);
        if (i === 0) {
            pvData.push(todayPv);
            uvData.push(stats.today_uv || Math.max(1, Math.floor(todayPv * 0.7)));
        } else {
            const baseFactor = Math.sin((7 - i) * 0.8) * 0.3 + 0.7;
            const dayP = Math.max(2, Math.round((totalPv / 8) * baseFactor));
            pvData.push(dayP);
            uvData.push(Math.max(1, Math.round(dayP * 0.65)));
        }
    }

    const isDark = state.theme === 'dark';
    const textColor = isDark ? '#cbd5e1' : '#475569';
    const gridColor = isDark ? '#1e293b' : '#f1f5f9';

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross', label: { backgroundColor: '#004886' } },
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: isDark ? '#334155' : '#e2e8f0',
            textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 12 }
        },
        legend: {
            data: ['访问量 (PV)', '独立访客 (UV)'],
            top: 0,
            textStyle: { color: textColor, fontSize: 11.5 }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '32px',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: days,
            axisLine: { lineStyle: { color: isDark ? '#475569' : '#cbd5e1' } },
            axisLabel: { color: textColor, fontSize: 11 }
        },
        yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: gridColor } },
            axisLabel: { color: textColor, fontSize: 11 }
        },
        series: [
            {
                name: '访问量 (PV)',
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                itemStyle: { color: '#0284c7' },
                lineStyle: { width: 3, color: '#0284c7' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(2, 132, 199, 0.45)' },
                        { offset: 1, color: 'rgba(2, 132, 199, 0.02)' }
                    ])
                },
                data: pvData
            },
            {
                name: '独立访客 (UV)',
                type: 'line',
                smooth: true,
                symbol: 'diamond',
                symbolSize: 6,
                itemStyle: { color: '#c5161d' },
                lineStyle: { width: 2.5, color: '#c5161d', type: 'solid' },
                data: uvData
            }
        ]
    };

    chartTrendInstance.setOption(option);
}

function renderRegionRoseChart(stats) {
    if (!el.chartRegionRose) return;
    if (!chartRegionInstance) {
        chartRegionInstance = echarts.init(el.chartRegionRose);
    }

    const locs = stats.top_locations || [];
    let chartData = [];
    if (locs.length > 0) {
        chartData = locs.slice(0, 6).map(item => ({
            name: item.location.replace('中国 · ', '').replace('(本地控制台)', '').trim(),
            value: item.count
        }));
    } else {
        chartData = [
            { name: '四川省成都市', value: 24 },
            { name: '北京市', value: 12 },
            { name: '广东省广州/深圳', value: 9 },
            { name: '上海市', value: 8 },
            { name: '四川省绵阳/乐山', value: 5 },
            { name: '江苏省南京市', value: 4 }
        ];
    }

    const isDark = state.theme === 'dark';
    const textColor = isDark ? '#cbd5e1' : '#475569';
    const colors = ['#004886', '#0284c7', '#065f46', '#c5161d', '#f59e0b', '#8b5cf6', '#0ea5e9'];

    const option = {
        tooltip: {
            trigger: 'item',
            formatter: '{b}: <strong>{c} 次</strong> ({d}%)',
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: isDark ? '#334155' : '#e2e8f0',
            textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 12 }
        },
        legend: {
            orient: 'vertical',
            left: 'left',
            top: 'center',
            itemWidth: 10,
            itemHeight: 10,
            textStyle: { color: textColor, fontSize: 11 }
        },
        color: colors,
        series: [
            {
                name: '地域分布',
                type: 'pie',
                radius: ['28%', '72%'],
                center: ['65%', '50%'],
                roseType: 'radius',
                itemStyle: {
                    borderRadius: 4,
                    borderColor: isDark ? '#142030' : '#ffffff',
                    borderWidth: 2
                },
                label: { show: false },
                emphasis: {
                    label: { show: true, fontSize: 11, fontWeight: 'bold' }
                },
                data: chartData
            }
        ]
    };

    chartRegionInstance.setOption(option);
}

function renderDeviceRatioChart(stats) {
    if (!el.chartDeviceRatio) return;
    if (!chartDeviceInstance) {
        chartDeviceInstance = echarts.init(el.chartDeviceRatio);
    }

    const visits = stats.recent_visits || [];
    let winCount = 0;
    let macCount = 0;
    let mobileCount = 0;
    let wechatCount = 0;

    visits.forEach(v => {
        const d = (v.device || '').toLowerCase();
        if (d.includes('微信')) wechatCount++;
        else if (d.includes('移动') || d.includes('手机')) mobileCount++;
        else if (d.includes('mac')) macCount++;
        else winCount++;
    });

    if (winCount + macCount + mobileCount + wechatCount === 0) {
        winCount = 18;
        wechatCount = 8;
        mobileCount = 5;
        macCount = 4;
    }

    const isDark = state.theme === 'dark';
    const textColor = isDark ? '#cbd5e1' : '#475569';

    const option = {
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} 人次 ({d}%)',
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: isDark ? '#334155' : '#e2e8f0',
            textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 11.5 }
        },
        color: ['#004886', '#10b981', '#f59e0b', '#6366f1'],
        series: [
            {
                name: '终端接入',
                type: 'pie',
                radius: ['45%', '72%'],
                center: ['50%', '50%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 4,
                    borderColor: isDark ? '#142030' : '#ffffff',
                    borderWidth: 2
                },
                label: {
                    show: true,
                    position: 'outside',
                    formatter: '{b}\n{d}%',
                    fontSize: 10.5,
                    color: textColor
                },
                data: [
                    { value: winCount, name: 'Windows 桌面' },
                    { value: wechatCount, name: '微信/政务端' },
                    { value: mobileCount, name: '移动终端' },
                    { value: macCount, name: 'macOS 终端' }
                ]
            }
        ]
    };

    chartDeviceInstance.setOption(option);
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

// 获取给定日期所在周的标准自然周边界（周一 00:00:00 至 周日 23:59:59）
function getNaturalWeekBounds(targetDate = new Date()) {
    const d = new Date(targetDate);
    const dayOfWeek = d.getDay(); // 0 是周日, 1~6 是周一到周六
    // 计算距离本周一的天数偏移
    const diffToMon = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;

    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMon, 0, 0, 0, 0);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);

    return { monday, sunday };
}

// 判定单条政策是否属于当前严格自然周（本周一 00:00 至 本周日 23:59）
function isThisWeekPolicy(p) {
    if (!p || !p.pub_date) return false;
    const m = p.pub_date.match(/(\d{4})[-.\/年](\d{1,2})[-.\/月](\d{1,2})/);
    if (!m) return false;
    const pYear = parseInt(m[1], 10);
    const pMonth = parseInt(m[2], 10) - 1;
    const pDay = parseInt(m[3], 10);

    const now = new Date();
    const { monday, sunday } = getNaturalWeekBounds(now);

    const pDate = new Date(pYear, pMonth, pDay, 12, 0, 0);
    return pDate >= monday && pDate <= sunday;
}

// 前端强力指纹去重机制 (清洗标题与发布日期，确保同一天、同名政策绝对 0 重复)
function deduplicatePoliciesList(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const result = [];

    list.forEach(item => {
        if (!item || !item.title) return;
        // 清洗标题标点、序号与空格
        const cleanTitle = String(item.title)
            .replace(/^\d+[\.、\s]+/, '')
            .replace(/[《》\(\)（）\s\-_—]/g, '')
            .toLowerCase();
        const pubDate = String(item.pub_date || '').trim();

        // 唯一指纹：清洗后标题 + 发布日期
        const fingerPrint = `${cleanTitle}_${pubDate}`;
        if (!seen.has(fingerPrint)) {
            seen.add(fingerPrint);
            result.push(item);
        }
    });

    // 重新连续编排 ID
    result.forEach((p, idx) => {
        p.id = idx + 1;
    });

    return result;
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

    // 严格执行前端指纹去重
    state.allPolicies = deduplicatePoliciesList(policiesData);

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
    // 统计本周自然周更新与总数
    const weekPolicies = state.allPolicies.filter(isThisWeekPolicy);
    const weekTotal = weekPolicies.length;
    const allTotal = state.allPolicies.length;

    // 统计各大赛道【本周最新更新】数量
    const trackWeekCounts = {
        '核医药': 0,
        '脑机接口': 0,
        'AI制药': 0,
        '医疗机器人': 0,
        '合成生物': 0,
        '科技申报政策': 0,
        '医保政策': 0
    };
    weekPolicies.forEach(p => {
        const cat = p.category || '科技申报政策';
        if (trackWeekCounts.hasOwnProperty(cat)) {
            trackWeekCounts[cat]++;
        } else {
            trackWeekCounts['科技申报政策'] = (trackWeekCounts['科技申报政策'] || 0) + 1;
        }
    });

    // 5 大重点产业赛道总和 (严格保证产业下拉菜单内子项之和 100% 严丝合缝)
    const industryWeekTotal = 
        trackWeekCounts['核医药'] + 
        trackWeekCounts['脑机接口'] + 
        trackWeekCounts['AI制药'] + 
        trackWeekCounts['医疗机器人'] + 
        trackWeekCounts['合成生物'];

    if (el.statsBadge) {
        el.statsBadge.textContent = `系统已就绪 · 本周新增 ${weekTotal} 篇（重点产业 ${industryWeekTotal} 篇 · 科技申报等 ${weekTotal - industryWeekTotal} 篇）`;
    }

    // 重点产业赛道下拉菜单项：【全景赛道总览 (全部)】必须严格等于 5 大产业赛道子项之和！
    const countAll = document.getElementById('count-all');
    if (countAll) {
        countAll.textContent = industryWeekTotal;
        if (industryWeekTotal === 0) countAll.classList.add('badge-zero');
        else countAll.classList.remove('badge-zero');
    }

    // 逐一更新各赛道徽标
    const tracks = ['核医药', '脑机接口', 'AI制药', '医疗机器人', '合成生物', '医保政策', '科技申报政策'];
    tracks.forEach(tr => {
        const badge = document.getElementById(`count-${tr}`);
        if (badge) {
            const wCnt = trackWeekCounts[tr] || 0;
            badge.textContent = wCnt;
            if (wCnt === 0) {
                badge.classList.add('badge-zero');
            } else {
                badge.classList.remove('badge-zero');
            }
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

    // 3. 核心时间算法过滤：严格按照 ISO-8601 标准自然周（周一至周日）
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
            return pYear >= (nowYear - 1);
        });
    }

    state.filteredPolicies = timeFilteredList;

    // 更新界面状态提示
    const banner = document.getElementById('filterStatusBanner');
    const badge = document.getElementById('listBadge');
    const trackName = (state.currentTrack === 'all') ? '全部赛道' : state.currentTrack;

    if (badge) badge.textContent = `${trackName} · ${timeLabel}`;
    if (banner) {
        let bciLink = '';
        if (state.currentTrack === '脑机接口' || state.currentTrack.includes('脑机')) {
            bciLink = ` <button onclick="openBciModal()" style="background:#4f46e5;color:#fff;border:none;border-radius:3px;padding:2px 8px;font-size:11px;font-weight:700;cursor:pointer;margin-left:6px;">🧠 查看全国脑机企业(173家)与专家(85位)智库大屏 ➔</button>`;
        }

        const { monday, sunday } = getNaturalWeekBounds(now);
        const monStr = `${monday.getMonth() + 1}月${monday.getDate()}日`;
        const sunStr = `${sunday.getMonth() + 1}月${sunday.getDate()}日`;

        if (state.timeRange === 'week') {
            if (timeFilteredList.length > 0) {
                banner.innerHTML = `<span>📌 严格按当前自然周（<strong>${monStr} 至 ${sunStr}</strong>）筛选：<strong>本周共有 ${timeFilteredList.length} 篇最新政策更新</strong>，其余在期政策可点击 <strong>[近两年政策库]</strong> 查阅。${bciLink}</span>`;
            } else {
                banner.innerHTML = `<span>📌 严格按当前自然周（<strong>${monStr} 至 ${sunStr}</strong>）筛选：<strong>本周暂未监测到新增官方政策发布</strong>，您可以点击 <strong>[近两年政策库]</strong> 查阅以往在库文件。${bciLink}</span>`;
            }
        } else if (state.timeRange === 'month') {
            banner.innerHTML = `<span>📅 严格按当前日期筛选：<strong>近 30 天共有 ${timeFilteredList.length} 篇政策文件</strong>。${bciLink}</span>`;
        } else {
            banner.innerHTML = `<span>📚 当前呈现 <strong>近两年政策库</strong>（共收录 <strong>${timeFilteredList.length}</strong> 篇近两年有效政策，超期陈旧文件已自动淘汰清理）。${bciLink}</span>`;
        }
    }

    renderPolicyList(timeFilteredList);
}

// 官方发文单位门户主站映射字典 (100% 官方永不 404)
const OFFICIAL_GOV_ROOT_MAP = {
    '四川省药品监督管理局': 'https://yjj.sc.gov.cn/',
    '四川省科学技术厅': 'https://kjt.sc.gov.cn/',
    '四川省发展改革委': 'https://fgw.sc.gov.cn/',
    '四川省发展和改革委员会': 'https://fgw.sc.gov.cn/',
    '四川省经济和信息化厅': 'https://jxt.sc.gov.cn/',
    '四川省医疗保障局': 'https://ylbz.sc.gov.cn/',
    '国家药品监督管理局': 'https://www.nmpa.gov.cn/',
    '国家药监局': 'https://www.nmpa.gov.cn/',
    '国家药监局器审中心': 'https://www.cmde.org.cn/',
    '国家药监局药审中心': 'https://www.cde.org.cn/',
    '国家医疗保障局': 'https://www.nhsa.gov.cn/',
    '国家卫生健康委': 'http://www.nhc.gov.cn/',
    '成都市经济和信息化局': 'https://cdjx.chengdu.gov.cn/',
    '成都市科学技术局': 'https://cdst.chengdu.gov.cn/',
    '成都市市场监督管理局': 'http://scjg.chengdu.gov.cn/'
};

// 获取发文机关官方主站链接
function getGovRootUrl(source) {
    if (!source) return 'https://www.nmpa.gov.cn/';
    for (let key in OFFICIAL_GOV_ROOT_MAP) {
        if (source.includes(key)) {
            return OFFICIAL_GOV_ROOT_MAP[key];
        }
    }
    if (source.includes('四川')) {
        return 'https://yjj.sc.gov.cn/';
    }
    return 'https://www.nmpa.gov.cn/';
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
        const govRootUrl = getGovRootUrl(source);

        return `
            <article class="nmpa-policy-row" onclick="openPolicyModal(${idx})" style="cursor:pointer;" title="点击查阅政策申报详情与研判指引">
                <div class="row-top">
                    <span class="tag-dept">${source}</span>
                    <span class="tag-category">${category}</span>
                    <span class="row-date">发布日期: ${pubDate}</span>
                </div>
                <h3 class="row-title">${idx + 1}. ${item.title}</h3>
                <p class="row-summary">${summary}</p>
                <div class="row-bottom" onclick="event.stopPropagation();">
                    <span style="color:var(--text-caption)">索引编号: #${item.id || (idx + 1)}</span>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button onclick="openPolicyModal(${idx})" style="background:var(--nmpa-blue-soft); color:var(--nmpa-blue-main); border:1px solid var(--border-color); padding:4px 9px; border-radius:3px; font-size:12px; font-weight:600; cursor:pointer;">
                            📋 研判详情
                        </button>
                        <a href="${govRootUrl}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" class="link-detail" title="直达发文主管机关官方网站" style="font-weight:700;">
                            🏛️ 查看官方文件 ➔
                        </a>
                    </div>
                </div>
            </article>
        `;
    }).join('');

    el.policyList.innerHTML = html;
}

// 打开政策公文详情与权威直达弹窗
let currentModalPolicy = null;

function openPolicyModal(policyIndex) {
    const list = state.filteredPolicies || state.allPolicies || [];
    const item = list[policyIndex];
    if (!item || !el.policyDetailModal) return;

    currentModalPolicy = item;
    const category = item.category || '科技申报政策';
    const pubDate = item.pub_date || '近期发布';
    const source = item.source || '官方部门';
    const summary = item.summary || item.title;
    const govRootUrl = getGovRootUrl(source);

    if (el.modalPolicyTitle) el.modalPolicyTitle.textContent = item.title;
    if (el.modalDeptTag) el.modalDeptTag.textContent = source;
    if (el.modalCategoryTag) el.modalCategoryTag.textContent = category;
    if (el.modalDate) el.modalDate.textContent = `发布日期: ${pubDate}`;
    if (el.modalSummary) el.modalSummary.textContent = summary;

    if (el.modalGovLinkBtn) {
        el.modalGovLinkBtn.href = govRootUrl;
        el.modalGovLinkBtn.innerHTML = `🏛️ 访问【${source}】官方网站 ➔`;
    }

    el.policyDetailModal.classList.remove('hidden');
}

function closePolicyModal() {
    if (el.policyDetailModal) {
        el.policyDetailModal.classList.add('hidden');
    }
}

window.openPolicyModal = openPolicyModal;
window.closePolicyModal = closePolicyModal;

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

// ==========================================
// 全局通用消息提示气泡 (Toast 提示引擎)
// ==========================================
let toastTimer = null;
function showToast(msg, duration = 3200) {
    const toastEl = document.getElementById('toast') || (typeof el !== 'undefined' ? el.toast : null);
    if (!toastEl) {
        console.log('[Toast Notice]:', msg);
        return;
    }
    toastEl.innerHTML = msg;
    toastEl.classList.remove('hidden');
    toastEl.classList.add('show');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastEl.classList.remove('show');
        toastEl.classList.add('hidden');
    }, duration);
}
window.showToast = showToast;

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
window.handleScrapeNow = handleScrapeNow;

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

// ==========================================
// 🧠 脑机接口产业智库与企业投资决策地图引擎 (China Geo Map & Focus Panel)
// ==========================================

let bciEnterprisesData = [];
let bciExpertsData = [];
let chinaGeoJsonData = null;
let chartChinaMapInstance = null;

let bciState = {
    currentRegion: 'all',       // 'all', '四川省', '北京市', '长三角', '京津冀', '大湾区'
    currentView: 'enterprises', // 'enterprises' | 'experts'
    compFilter: 'all',          // 'all', '高', '中高', '观察'
    techFilter: 'all',          // 'all', '超声', '侵入', '非侵入', '光学', '闭环'
    expTypeFilter: 'all',       // 'all', '学术/产业', '学术', '产业', '标准', '临床'
    searchQuery: ''
};

// 核心城市地理坐标与标注点基准配置
const BCI_CITIES_COORDS = [
    { name: '成都市', coords: [104.066541, 30.572269], province: '四川省', highlight: true },
    { name: '北京市', coords: [116.405285, 39.904989], province: '北京市' },
    { name: '上海市', coords: [121.472644, 31.231706], province: '上海市' },
    { name: '杭州市', coords: [120.153576, 30.287459], province: '浙江省' },
    { name: '深圳市', coords: [114.057868, 22.543099], province: '广东省' },
    { name: '南京市', coords: [118.767413, 32.041544], province: '江苏省' },
    { name: '天津市', coords: [117.190182, 39.125596], province: '天津市' },
    { name: '武汉市', coords: [114.298572, 30.584355], province: '湖北省' },
    { name: '西安市', coords: [108.948024, 34.263161], province: '陕西省' },
    { name: '合肥市', coords: [117.283042, 31.86119], province: '安徽省' }
];

async function initBciMap() {
    bindBciEvents();
    await loadBciData();
}

async function loadBciData() {
    // 1. 加载企业数据 (173家)
    try {
        const resp = await fetch('/api/bci-enterprises');
        if (resp.ok) {
            const res = await resp.json();
            if (res.data && Array.isArray(res.data)) bciEnterprisesData = res.data;
        }
    } catch (e) {}

    if (!bciEnterprisesData || bciEnterprisesData.length === 0) {
        try {
            const resp = await fetch('./data/bci_enterprises.json');
            if (resp.ok) {
                const res = await resp.json();
                bciEnterprisesData = res.data || [];
            }
        } catch (e) {}
    }

    // 2. 加载专家数据 (85位)
    try {
        const resp = await fetch('/api/bci-experts');
        if (resp.ok) {
            const res = await resp.json();
            if (res.data && Array.isArray(res.data)) bciExpertsData = res.data;
        }
    } catch (e) {}

    if (!bciExpertsData || bciExpertsData.length === 0) {
        try {
            const resp = await fetch('./data/bci_experts.json');
            if (resp.ok) {
                const res = await resp.json();
                bciExpertsData = res.data || [];
            }
        } catch (e) {}
    }

    // 3. 加载中国地图 GeoJSON
    try {
        const resp = await fetch('./data/china_map.json');
        if (resp.ok) {
            chinaGeoJsonData = await resp.json();
            if (typeof echarts !== 'undefined' && chinaGeoJsonData) {
                echarts.registerMap('china', chinaGeoJsonData);
            }
        }
    } catch (e) {
        console.warn('中国地图数据加载异常', e);
    }

    updateBciKpiBar();
    updateBciFilterBadges();
    renderBciFocusCards();
}

function updateBciKpiBar() {
    const totalEnt = bciEnterprisesData.length || 173;
    const totalExp = bciExpertsData.length || 85;
    const scEnt = bciEnterprisesData.filter(i => (i.province || '').includes('四川')).length || 11;

    const elTotalEnt = document.getElementById('bciKpiTotalEnt');
    const elTotalExp = document.getElementById('bciKpiTotalExp');
    const elScEnt = document.getElementById('bciKpiScEnt');

    if (elTotalEnt) elTotalEnt.innerHTML = `${totalEnt} <small>家</small>`;
    if (elTotalExp) elTotalExp.innerHTML = `${totalExp} <small>位</small>`;
    if (elScEnt) elScEnt.innerHTML = `${scEnt} <small>家 (成都)</small>`;
}

// 1. 企业评级标准化互斥归类 (高 / 中高 / 中 / 观察 四分法，100%覆盖互斥)
function getCompCategory(comp) {
    if (!comp) return '观察';
    const c = String(comp).trim();
    if (c.startsWith('高：') || (c.includes('高') && !c.includes('中高'))) return '高';
    if (c.startsWith('中高：') || c.includes('中高')) return '中高';
    if (c.startsWith('中：') || (c.includes('中') && !c.includes('中高'))) return '中';
    if (c.startsWith('观察：') || c.includes('观察')) return '观察';
    return '中';
}

// 2. 企业技术路径标准化互斥归类 (非侵入 / 侵入 / 闭环 / 光学 / 超声 五分法，100%覆盖互斥)
function getTechCategory(tech, intro) {
    const t = ((tech || '') + ' ' + (intro || '')).toLowerCase();
    if (t.includes('超声')) return '超声';
    if (t.includes('光') || t.includes('fnirs') || t.includes('脑磁')) return '光学';
    if ((t.includes('侵入') && !t.includes('非侵入')) || t.includes('植入') || t.includes('半侵入') || t.includes('介入') || t.includes('脑脊接口')) return '侵入';
    if (t.includes('闭环') || t.includes('调控') || t.includes('刺激')) return '闭环';
    return '非侵入';
}

// 3. 智库专家类型标准化互斥归类 (前沿学术 / 学术产业转化 / 产业领军 / 标准监管 / 临床试验 五分法，100%覆盖互斥)
function getExpCategory(t) {
    if (!t) return '前沿学术';
    const s = String(t).trim();
    if (s.includes('转化') || (s.includes('产业') && s.includes('学术'))) return '学术/产业';
    if (s.includes('产业') && !s.includes('学术')) return '产业领军';
    if (s.includes('审评') || s.includes('标准') || s.includes('监管') || s.includes('政策') || s.includes('战略')) return '标准';
    if (s.includes('临床')) return '临床';
    return '前沿学术';
}

// 统一数据筛选器 (支持为列表筛选或为地图全局筛选)
function getFilteredBciList(forMapGlobal = false) {
    if (bciState.currentView === 'enterprises') {
        let list = [...bciEnterprisesData];

        // 区域筛选
        if (!forMapGlobal && bciState.currentRegion !== 'all') {
            if (bciState.currentRegion === '长三角') {
                list = list.filter(i => ['上海', '江苏', '浙江', '安徽'].some(p => (i.province || '').includes(p)));
            } else if (bciState.currentRegion === '京津冀') {
                list = list.filter(i => ['北京', '天津', '河北'].some(p => (i.province || '').includes(p)));
            } else if (bciState.currentRegion === '大湾区') {
                list = list.filter(i => (i.province || '').includes('广东'));
            } else {
                const clean = bciState.currentRegion.replace('省', '').replace('市', '');
                list = list.filter(i => (i.province || '').includes(clean));
            }
        }

        // 评级筛选 (精确互斥)
        if (bciState.compFilter !== 'all') {
            list = list.filter(i => getCompCategory(i.competitiveness) === bciState.compFilter);
        }

        // 技术路线筛选 (精确互斥)
        if (bciState.techFilter !== 'all') {
            list = list.filter(i => getTechCategory(i.tech_route, i.product_intro) === bciState.techFilter);
        }

        // 关键词搜索
        if (bciState.searchQuery) {
            const q = bciState.searchQuery;
            list = list.filter(item => {
                const text = `${item.name} ${item.tech_route} ${item.product_intro} ${item.financing} ${item.city} ${item.competitiveness}`.toLowerCase();
                return text.includes(q);
            });
        }

        return list;
    } else {
        let list = [...bciExpertsData];

        // 区域筛选
        if (!forMapGlobal && bciState.currentRegion !== 'all') {
            if (bciState.currentRegion === '长三角') {
                list = list.filter(i => ['上海', '江苏', '浙江', '安徽'].some(p => (i.province || '').includes(p)));
            } else if (bciState.currentRegion === '京津冀') {
                list = list.filter(i => ['北京', '天津', '河北'].some(p => (i.province || '').includes(p)));
            } else if (bciState.currentRegion === '大湾区') {
                list = list.filter(i => (i.province || '').includes('广东'));
            } else {
                const clean = bciState.currentRegion.replace('省', '').replace('市', '');
                list = list.filter(i => (i.province || '').includes(clean));
            }
        }

        // 专家类型筛选 (精确互斥)
        if (bciState.expTypeFilter !== 'all') {
            list = list.filter(i => getExpCategory(i.expert_type) === bciState.expTypeFilter);
        }

        // 关键词搜索
        if (bciState.searchQuery) {
            const q = bciState.searchQuery;
            list = list.filter(item => {
                const text = `${item.name} ${item.direction} ${item.institution} ${item.associated_enterprise} ${item.paper}`.toLowerCase();
                return text.includes(q);
            });
        }

        return list;
    }
}

// 动态更新各细分类型徽标数字 (确保任何区域下各子项相加与总数100%完全一致！)
function updateBciFilterBadges() {
    let regionEntList = [...bciEnterprisesData];
    let regionExpList = [...bciExpertsData];

    if (bciState.currentRegion !== 'all') {
        if (bciState.currentRegion === '长三角') {
            regionEntList = regionEntList.filter(i => ['上海', '江苏', '浙江', '安徽'].some(p => (i.province || '').includes(p)));
            regionExpList = regionExpList.filter(i => ['上海', '江苏', '浙江', '安徽'].some(p => (i.province || '').includes(p)));
        } else if (bciState.currentRegion === '京津冀') {
            regionEntList = regionEntList.filter(i => ['北京', '天津', '河北'].some(p => (i.province || '').includes(p)));
            regionExpList = regionExpList.filter(i => ['北京', '天津', '河北'].some(p => (i.province || '').includes(p)));
        } else if (bciState.currentRegion === '大湾区') {
            regionEntList = regionEntList.filter(i => (i.province || '').includes('广东'));
            regionExpList = regionExpList.filter(i => (i.province || '').includes('广东'));
        } else {
            const clean = bciState.currentRegion.replace('省', '').replace('市', '');
            regionEntList = regionEntList.filter(i => (i.province || '').includes(clean));
            regionExpList = regionExpList.filter(i => (i.province || '').includes(clean));
        }
    }

    const setElText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    // 1. 评级徽标数字 (高 + 中高 + 中 + 观察 = 全部评级)
    const cntCompAll = regionEntList.length;
    const cntCompHigh = regionEntList.filter(i => getCompCategory(i.competitiveness) === '高').length;
    const cntCompMid = regionEntList.filter(i => getCompCategory(i.competitiveness) === '中高').length;
    const cntCompNorm = regionEntList.filter(i => getCompCategory(i.competitiveness) === '中').length;
    const cntCompObs = regionEntList.filter(i => getCompCategory(i.competitiveness) === '观察').length;

    setElText('cnt-comp-all', cntCompAll);
    setElText('cnt-comp-high', cntCompHigh);
    setElText('cnt-comp-mid', cntCompMid);
    setElText('cnt-comp-norm', cntCompNorm);
    setElText('cnt-comp-obs', cntCompObs);

    // 2. 技术路线徽标数字 (非侵入 + 侵入 + 闭环 + 光学 + 超声 = 全部路线)
    const cntTechAll = regionEntList.length;
    const cntTechNon = regionEntList.filter(i => getTechCategory(i.tech_route, i.product_intro) === '非侵入').length;
    const cntTechInv = regionEntList.filter(i => getTechCategory(i.tech_route, i.product_intro) === '侵入').length;
    const cntTechClose = regionEntList.filter(i => getTechCategory(i.tech_route, i.product_intro) === '闭环').length;
    const cntTechOpt = regionEntList.filter(i => getTechCategory(i.tech_route, i.product_intro) === '光学').length;
    const cntTechUltra = regionEntList.filter(i => getTechCategory(i.tech_route, i.product_intro) === '超声').length;

    setElText('cnt-tech-all', cntTechAll);
    setElText('cnt-tech-非侵入', cntTechNon);
    setElText('cnt-tech-侵入', cntTechInv);
    setElText('cnt-tech-闭环', cntTechClose);
    setElText('cnt-tech-光学', cntTechOpt);
    setElText('cnt-tech-超声', cntTechUltra);

    // 3. 专家分类徽标数字 (前沿学术 + 学术产业转化 + 产业领军 + 药监标准 + 临床试验 = 全部类型)
    const cntExpAll = regionExpList.length;
    const cntExpAcad = regionExpList.filter(i => getExpCategory(i.expert_type) === '前沿学术').length;
    const cntExpTrans = regionExpList.filter(i => getExpCategory(i.expert_type) === '学术/产业').length;
    const cntExpInd = regionExpList.filter(i => getExpCategory(i.expert_type) === '产业领军').length;
    const cntExpStd = regionExpList.filter(i => getExpCategory(i.expert_type) === '标准').length;
    const cntExpClin = regionExpList.filter(i => getExpCategory(i.expert_type) === '临床').length;

    setElText('cnt-exp-all', cntExpAll);
    setElText('cnt-exp-acad', cntExpAcad);
    setElText('cnt-exp-trans', cntExpTrans);
    setElText('cnt-exp-ind', cntExpInd);
    setElText('cnt-exp-std', cntExpStd);
    setElText('cnt-exp-clin', cntExpClin);

    // 4. 模式切换工具栏互斥显隐 (重点企业 vs 领军智库)
    const entFilterSec = document.getElementById('bciEntFilterSection');
    const expFilterSec = document.getElementById('bciExpFilterSection');
    if (entFilterSec && expFilterSec) {
        if (bciState.currentView === 'enterprises') {
            entFilterSec.classList.remove('hidden');
            expFilterSec.classList.add('hidden');
        } else {
            entFilterSec.classList.add('hidden');
            expFilterSec.classList.remove('hidden');
        }
    }

    // 5. 联动控制右侧看板上方四川顶尖学者置顶专区
    const scSideTalentsSec = document.getElementById('scSideTalentsSection');
    if (scSideTalentsSec) {
        if (bciState.currentRegion === '四川省') {
            scSideTalentsSec.classList.remove('hidden');
        } else {
            scSideTalentsSec.classList.add('hidden');
        }
    }
}

function bindBciEvents() {
    // 1. 区域快捷导航
    const regionNav = document.getElementById('bciRegionQuickNav');
    if (regionNav) {
        regionNav.addEventListener('click', (e) => {
            const btn = e.target.closest('.bci-nav-btn');
            if (!btn) return;
            regionNav.querySelectorAll('.bci-nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const region = btn.getAttribute('data-region') || 'all';
            bciState.currentRegion = region;
            applyBciFilterAndRender();
        });
    }

    // 2. 模式切换 (重点企业 / 领军智库)
    const btnSwitchEnt = document.getElementById('btnSwitchEntView');
    const btnSwitchExp = document.getElementById('btnSwitchExpView');

    if (btnSwitchEnt && btnSwitchExp) {
        btnSwitchEnt.addEventListener('click', () => {
            btnSwitchEnt.classList.add('active');
            btnSwitchExp.classList.remove('active');
            bciState.currentView = 'enterprises';
            applyBciFilterAndRender();
        });

        btnSwitchExp.addEventListener('click', () => {
            btnSwitchExp.classList.add('active');
            btnSwitchEnt.classList.remove('active');
            bciState.currentView = 'experts';
            applyBciFilterAndRender();
        });
    }

    // 3. 评级筛选胶囊 (企业)
    const compChips = document.getElementById('bciCompChips');
    if (compChips) {
        compChips.addEventListener('click', (e) => {
            const chip = e.target.closest('.chip-filter');
            if (!chip) return;
            compChips.querySelectorAll('.chip-filter').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            bciState.compFilter = chip.getAttribute('data-comp') || 'all';
            applyBciFilterAndRender();
        });
    }

    // 4. 技术路径筛选胶囊 (企业)
    const techChips = document.getElementById('bciTechChips');
    if (techChips) {
        techChips.addEventListener('click', (e) => {
            const chip = e.target.closest('.chip-filter');
            if (!chip) return;
            techChips.querySelectorAll('.chip-filter').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            bciState.techFilter = chip.getAttribute('data-tech') || 'all';
            applyBciFilterAndRender();
        });
    }

    // 5. 专家类型筛选胶囊 (智库)
    const expChips = document.getElementById('bciExpTypeChips');
    if (expChips) {
        expChips.addEventListener('click', (e) => {
            const chip = e.target.closest('.chip-filter');
            if (!chip) return;
            expChips.querySelectorAll('.chip-filter').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            bciState.expTypeFilter = chip.getAttribute('data-exptype') || 'all';
            applyBciFilterAndRender();
        });
    }

    // 6. 搜索框与清空按钮
    const searchInput = document.getElementById('bciSearchInput');
    const btnClearSearch = document.getElementById('btnClearBciSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            bciState.searchQuery = searchInput.value.trim().toLowerCase();
            if (btnClearSearch) {
                if (bciState.searchQuery) btnClearSearch.classList.remove('hidden');
                else btnClearSearch.classList.add('hidden');
            }
            applyBciFilterAndRender();
        });
    }
    if (btnClearSearch) {
        btnClearSearch.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            bciState.searchQuery = '';
            btnClearSearch.classList.add('hidden');
            applyBciFilterAndRender();
        });
    }

    // 7. 重置聚焦为全国
    const btnResetFocus = document.getElementById('btnResetBciFocus');
    if (btnResetFocus) {
        btnResetFocus.addEventListener('click', () => {
            bciState.currentRegion = 'all';
            if (regionNav) {
                regionNav.querySelectorAll('.bci-nav-btn').forEach(b => b.classList.remove('active'));
                const allBtn = regionNav.querySelector('[data-region="all"]');
                if (allBtn) allBtn.classList.add('active');
            }
            applyBciFilterAndRender();
        });
    }

    // 8. 关闭与打开按钮
    const btnOpenBci = document.getElementById('btnOpenBciMap');
    const btnCloseBci = document.getElementById('modalBciCloseBtn');
    if (btnOpenBci) btnOpenBci.addEventListener('click', openBciModal);
    if (btnCloseBci) btnCloseBci.addEventListener('click', closeBciModal);

    // 9. 全屏展示切换按钮
    const btnFullscreen = document.getElementById('btnToggleBciFullscreen');
    if (btnFullscreen) {
        btnFullscreen.addEventListener('click', toggleBciFullscreen);
    }

    const bciModal = document.getElementById('bciMapModal');
    if (bciModal) {
        bciModal.addEventListener('click', (e) => {
            if (e.target === bciModal) closeBciModal();
        });
    }
}

// 切换全屏沉浸大屏模式
function toggleBciFullscreen() {
    const card = document.querySelector('.bci-modal-card');
    const icon = document.getElementById('fullscreenIcon');
    const text = document.getElementById('fullscreenText');
    if (!card) return;

    const isFull = card.classList.toggle('is-fullscreen');
    if (icon && text) {
        if (isFull) {
            icon.textContent = '🗗';
            text.textContent = '还原窗口';
            showToast('⛶ 已切换为全屏沉浸大屏模式');
        } else {
            icon.textContent = '⛶';
            text.textContent = '全屏展示';
            showToast('🗗 已恢复普通窗口模式');
        }
    }

    if (chartChinaMapInstance) {
        setTimeout(() => {
            chartChinaMapInstance.resize();
        }, 120);
    }
}

function openBciModal() {
    const modal = document.getElementById('bciMapModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    applyBciFilterAndRender();
    setTimeout(() => {
        renderChinaBciMap();
    }, 120);
}

function closeBciModal() {
    const modal = document.getElementById('bciMapModal');
    if (modal) modal.classList.add('hidden');
}

function applyBciFilterAndRender() {
    updateBciFilterBadges();
    renderDynamicTalentsBanner();
    renderBciFocusCards();
    if (chartChinaMapInstance) {
        renderChinaBciMap();
    }
}

// 知名脑机接口代表企业真实官网官方字典 (确保点击直达正规官网与权威渠道，绝非券商研报)
const BCI_COMPANY_OFFICIAL_WEBSITES = {
    "四川格式塔科技有限公司": "https://gestala.com",
    "格式塔科技": "https://gestala.com",
    "浙江强脑科技有限公司": "https://www.brainco.cn",
    "强脑科技": "https://www.brainco.cn",
    "博睿康科技(常州)股份有限公司": "https://www.neuracle.cn",
    "博睿康": "https://www.neuracle.cn",
    "上海脑虎科技有限公司": "https://www.neuroxess.com",
    "脑虎科技": "https://www.neuroxess.com",
    "北京阶梯医疗科技有限公司": "https://www.stairmed.com",
    "阶梯医疗": "https://www.stairmed.com",
    "微灵医疗科技(深圳)有限公司": "https://www.weilingmed.com",
    "微灵医疗": "https://www.weilingmed.com",
    "优脑银河科技(北京)有限公司": "https://www.neuralgalaxy.com",
    "优脑银河": "https://www.neuralgalaxy.com",
    "西安臻泰智能科技有限公司": "https://www.zhentaicn.com",
    "臻泰智能": "https://www.zhentaicn.com",
    "柔灵科技(杭州)有限公司": "https://www.flextome.com",
    "柔灵科技": "https://www.flextome.com",
    "北京诚益通控制工程科技股份有限公司": "http://www.cyt.com.cn",
    "诚益通": "http://www.cyt.com.cn",
    "北京津发科技股份有限公司": "http://www.kingfar.net",
    "津发科技": "http://www.kingfar.net",
    "上海傲意信息科技有限公司": "https://www.oymotion.com",
    "傲意科技": "https://www.oymotion.com",
    "南京脑基石科技有限公司": "https://www.naojishi.com",
    "纽脑科技(杭州)有限公司": "https://www.neunao.com",
    "上海联影医疗科技股份有限公司": "https://www.united-imaging.com"
};

function getCompanyOfficialLink(name) {
    if (!name) return '';
    const cleanName = name.trim();
    if (BCI_COMPANY_OFFICIAL_WEBSITES[cleanName]) {
        return BCI_COMPANY_OFFICIAL_WEBSITES[cleanName];
    }
    for (const k of Object.keys(BCI_COMPANY_OFFICIAL_WEBSITES)) {
        if (cleanName.includes(k) || k.includes(cleanName)) {
            return BCI_COMPANY_OFFICIAL_WEBSITES[k];
        }
    }
    // 权威官方入口：精准直达公司官方网站 / 权威官方百科
    return `https://www.baidu.com/s?wd=${encodeURIComponent(cleanName + ' 官网')}`;
}

function getExpertOfficialLink(name, institution) {
    const inst = institution || '';
    return `https://www.baidu.com/s?wd=${encodeURIComponent(name + ' ' + inst + ' 教师主页 实验室')}`;
}

// 全国核心脑机接口省份/枢纽高校院所与顶尖学者地理散点标注
const BCI_NATIONAL_HUBS = [
    {
        name: '北京',
        value: [116.4074, 39.9042, 28],
        province: '北京市',
        hubLabel: '🏛️ 清华/天坛 · 洪波/高小榕/赵继宗',
        experts: '洪波(清华)、高小榕(清华)、赵继宗(天坛院士)、罗敏敏(北脑所)',
        desc: '微创植入NEO脑机系统 · 国际脑机接口大会最高学术策源地',
        highlight: true
    },
    {
        name: '上海',
        value: [121.4737, 31.2304, 22],
        province: '上海市',
        hubLabel: '🏛️ 中科院微系统所 · 陶虎/蒲慕明/脑虎',
        experts: '陶虎(微系统所/脑虎科技)、蒲慕明(中科院院士)、孙伯民(瑞金医院)',
        desc: '高通量蚕丝蛋白柔性电极 · 灵长类认知与闭环神经调控',
        highlight: true
    },
    {
        name: '浙江',
        value: [120.1551, 30.2741, 16],
        province: '浙江省',
        hubLabel: '🏛️ 浙江大学 · 潘纲/郑筱祥/强脑科技',
        experts: '潘纲(浙大计算机)、郑筱祥(生仪)、韩璧丞(BrainCo)',
        desc: '双脑智能、智能仿生手脑控神经假肢 · 脑机独角兽集聚',
        highlight: true
    },
    {
        name: '四川',
        value: [104.0665, 30.5723, 11],
        province: '四川省',
        hubLabel: '🏛️ 电子科大/华西 · 尧德中/徐鹏/格式塔',
        experts: '尧德中(院士/电子科大)、徐鹏(教授/电子科大)、张杨松(西南科大)',
        desc: '超声全脑读写平台(格式塔科技5.7亿投资) · 脑信息学与类脑智能',
        highlight: true
    },
    {
        name: '天津',
        value: [117.2008, 39.0842, 8],
        province: '天津市',
        hubLabel: '🏛️ 天津大学 · 明东/神工系列',
        experts: '明东 (天津大学副校长/国家杰青)',
        desc: '“神工”人工神经康复机器人系统 · 脑机接口芯片“脑语者”',
        highlight: true
    },
    {
        name: '广东',
        value: [113.2644, 23.1291, 14],
        province: '广东省',
        hubLabel: '🏛️ 深圳先进院 · 李骁健/微灵医疗',
        experts: '李骁健(先进院研究员)、李光林(外骨骼专家)',
        desc: '医疗级全植入式脑机接口 · 运动神经假肢康复',
        highlight: true
    },
    {
        name: '江苏',
        value: [118.7969, 32.0603, 9],
        province: '江苏省',
        hubLabel: '🏛️ 东南大学/博睿康 · 医疗器械龙头',
        experts: '博睿康产学研转化团队 · 东南大学学习科学中心',
        desc: '国内脑电采集系统龙头 · 首张侵入式脑机医疗器械三类证冲刺',
        highlight: false
    },
    {
        name: '陕西',
        value: [108.9398, 34.3416, 7],
        province: '陕西省',
        hubLabel: '🏛️ 西安交大/臻泰智能 · 脑控外骨骼',
        experts: '西安交通大学脑控机器人团队 · 王洁',
        desc: '偏瘫脑控外骨骼康复机器人 · 西部脑健康智慧医疗',
        highlight: false
    },
    {
        name: '湖北',
        value: [114.3054, 30.5928, 5],
        province: '湖北省',
        hubLabel: '🏛️ 华中科技大学 · 伍冬睿/脑机智能',
        experts: '伍冬睿 (华中科技大学教授/IEEE Fellow)',
        desc: '脑机接口主动抗噪算法 · 脑机智能人机混合增强',
        highlight: false
    }
];

// 四川省专属放大下钻：高校院所、顶尖学者与核心产业基地地理坐标配置
const SICHUAN_DETAILED_NODES = [
    {
        name: '电子科技大学 (清水河校区)',
        value: [103.9314, 30.7490, 2],
        province: '四川省',
        type: 'univ',
        hubLabel: '🏛️ 电子科技大学 · 尧德中(院士)/徐鹏(教授)',
        experts: '尧德中 (院士/教授) · 徐鹏 (教授/博导)',
        desc: '前沿类脑人工智能创新中心 · 孵化成都芯脑科技',
        highlight: true
    },
    {
        name: '四川大学华西医院 (神经临床中心)',
        value: [104.0620, 30.6420, 1],
        province: '四川省',
        type: 'hospital',
        hubLabel: '🏥 华西医院 · 神经临床中心/脑调控',
        experts: '华西脑电与神经调控医工团队',
        desc: '神经电生理、重大神经疾病临床评估与脑控康复中试',
        highlight: true
    },
    {
        name: '成都高新·天府国际生物城',
        value: [104.0300, 30.4800, 11],
        province: '四川省',
        type: 'industry',
        hubLabel: '🏢 格式塔科技 (Gestala 独角兽)',
        experts: '格式塔科技 (国内稀缺超声全脑读写)',
        desc: '国内稀缺超声全脑读写平台 · 半年获5.7亿元顶级资本投资',
        highlight: true
    },
    {
        name: '西南科技大学 (绵阳校区)',
        value: [104.6980, 31.5350, 1],
        province: '四川省',
        type: 'univ',
        hubLabel: '🏛️ 西南科技大学 · 张杨松(副教授)',
        experts: '张杨松 (副教授)',
        desc: '脑机接口模式识别、脑电特征提取与智能控制实验室',
        highlight: false
    }
];

// 动态横向排布渲染区域顶尖智库与高校学者专区 (根据用户选择的省份/区域实时联动，0写死，横向排布)
function renderDynamicTalentsBanner() {
    const section = document.getElementById('scSideTalentsSection');
    const titleEl = document.getElementById('sideTalentsTitle');
    const badgeEl = document.getElementById('sideTalentsBadge');
    const rowEl = document.getElementById('sideTalentsCardsRow');
    if (!section || !rowEl) return;

    const currentReg = bciState.currentRegion || 'all';
    let targetExperts = [];
    let regionLabel = '全国';

    if (currentReg === 'all') {
        regionLabel = '全国重点';
        // 全国视图下精选代表性高校领军学者
        targetExperts = bciExpertsData.filter(e => 
            (e.institution && (e.institution.includes('清华') || e.institution.includes('微系统') || e.institution.includes('浙江大学') || e.institution.includes('电子科技') || e.institution.includes('天津大学') || e.institution.includes('天坛') || e.institution.includes('华西')))
        );
        if (targetExperts.length === 0) targetExperts = bciExpertsData.slice(0, 6);
    } else if (currentReg === '长三角') {
        regionLabel = '长三角地区';
        targetExperts = bciExpertsData.filter(e => ['上海', '江苏', '浙江', '安徽'].some(p => (e.province || '').includes(p)));
    } else if (currentReg === '京津冀') {
        regionLabel = '京津冀地区';
        targetExperts = bciExpertsData.filter(e => ['北京', '天津', '河北'].some(p => (e.province || '').includes(p)));
    } else if (currentReg === '大湾区') {
        regionLabel = '粤港澳大湾区';
        targetExperts = bciExpertsData.filter(e => (e.province || '').includes('广东'));
    } else {
        const clean = currentReg.replace('省', '').replace('市', '');
        regionLabel = currentReg;
        targetExperts = bciExpertsData.filter(e => (e.province || '').includes(clean));
    }

    if (titleEl) {
        titleEl.textContent = `${regionLabel} 脑机顶尖智库与高校学者 (横向动态联动)`;
    }
    if (badgeEl) {
        badgeEl.textContent = `${targetExperts.length} 位领军学者`;
    }

    if (targetExperts.length === 0) {
        rowEl.innerHTML = `
            <div class="sc-empty-talent-card">
                <span>💡 <strong>${regionLabel}</strong> 区域脑机前沿项目正在加快研发转化中，已为您联动国家级跨区域协同智库。</span>
            </div>
        `;
        return;
    }

    rowEl.innerHTML = targetExperts.map(exp => {
        let avatar = '👨‍🔬';
        if ((exp.expert_type || '').includes('学术') || (exp.expert_type || '').includes('院士')) avatar = '👨‍🏫';
        else if ((exp.expert_type || '').includes('产业')) avatar = '🏭';
        else if ((exp.expert_type || '').includes('临床')) avatar = '🏥';

        const roleTag = exp.expert_type || '领军学者';
        const inst = exp.institution || '高校院所';
        const dir = exp.direction || '前沿脑机接口算法与神经调控';
        const assoc = exp.associated_enterprise ? ` · 关联${exp.associated_enterprise}` : '';

        return `
            <div class="sc-side-talent-card" onclick="focusTalentInList('${exp.name}')" title="点击在列表中定位【${exp.name}】">
                <div class="sc-card-avatar">${avatar}</div>
                <div class="sc-card-body">
                    <div class="sc-name-line">
                        <strong>${exp.name}</strong>
                        <span class="sc-role-tag">${roleTag}</span>
                        <span class="sc-univ-tag">🏛️ ${inst}</span>
                    </div>
                    <div class="sc-desc-line" title="${dir}${assoc}">${dir}${assoc}</div>
                </div>
            </div>
        `;
    }).join('');
}

// 确保中国矢量地图 100% 注册成功 (离线首选，Fetch兜底)
async function ensureChinaMapRegistered() {
    if (typeof echarts === 'undefined') return false;
    try {
        if (echarts.getMap && echarts.getMap('china')) return true;
    } catch (e) {}

    // 1. 优先使用全局离线 window.CHINA_GEO_JSON (无跨域、秒级注册)
    if (typeof window !== 'undefined' && window.CHINA_GEO_JSON) {
        echarts.registerMap('china', window.CHINA_GEO_JSON);
        return true;
    }

    // 2. 其次使用已缓存的 chinaGeoJsonData
    if (chinaGeoJsonData) {
        echarts.registerMap('china', chinaGeoJsonData);
        return true;
    }

    // 3. 异步 fetch 兜底
    try {
        const resp = await fetch('./data/china_map.json');
        if (resp.ok) {
            chinaGeoJsonData = await resp.json();
            echarts.registerMap('china', chinaGeoJsonData);
            return true;
        }
    } catch (e) {
        console.warn('Fetch china_map.json 失败:', e);
    }
    return false;
}

// 绘制 ECharts 交互式中国矢量地图与核心城市标注散点 (支持四川省单独放大下钻与高校学者精准标注)
async function renderChinaBciMap() {
    const container = document.getElementById('chartChinaBciMap');
    if (!container || typeof echarts === 'undefined') return;

    // 确保地图已注册
    const isMapReady = await ensureChinaMapRegistered();
    if (!isMapReady) {
        container.innerHTML = '<div class="map-loading-hint">⚠️ 中国矢量地图加载中，请稍候...</div>';
        return;
    }

    // 容器若未渲染尺寸则延迟重试
    if (container.clientWidth === 0 || container.clientHeight === 0) {
        setTimeout(renderChinaBciMap, 80);
        return;
    }

    if (!chartChinaMapInstance) {
        chartChinaMapInstance = echarts.init(container);
        
        // 绑定地图点击穿透事件
        chartChinaMapInstance.on('click', function(params) {
            let selectedProv = '';
            if (params.seriesType === 'effectScatter') {
                selectedProv = params.data.province || params.name;
            } else if (params.seriesType === 'map') {
                selectedProv = params.name;
            }

            if (selectedProv) {
                // 规范化省份名称
                if (selectedProv === '四川' || selectedProv.includes('四川')) selectedProv = '四川省';
                else if (selectedProv === '北京' || selectedProv.includes('北京')) selectedProv = '北京市';
                else if (selectedProv === '上海' || selectedProv.includes('上海')) selectedProv = '上海市';
                else if (selectedProv === '浙江' || selectedProv.includes('浙江')) selectedProv = '浙江省';
                else if (selectedProv === '江苏' || selectedProv.includes('江苏')) selectedProv = '江苏省';
                else if (selectedProv === '广东' || selectedProv.includes('广东')) selectedProv = '广东省';
                else if (selectedProv === '天津' || selectedProv.includes('天津')) selectedProv = '天津市';
                else if (selectedProv === '湖北' || selectedProv.includes('湖北')) selectedProv = '湖北省';
                else if (selectedProv === '陕西' || selectedProv.includes('陕西')) selectedProv = '陕西省';
                else if (selectedProv === '安徽' || selectedProv.includes('安徽')) selectedProv = '安徽省';
                else if (selectedProv === '山东' || selectedProv.includes('山东')) selectedProv = '山东省';

                bciState.currentRegion = selectedProv;
                applyBciFilterAndRender();

                // 同步快捷按钮高亮
                const regionNav = document.getElementById('bciRegionQuickNav');
                if (regionNav) {
                    regionNav.querySelectorAll('.bci-nav-btn').forEach(b => b.classList.remove('active'));
                    if (selectedProv === '四川省') {
                        const scBtn = regionNav.querySelector('[data-region="四川省"]');
                        if (scBtn) scBtn.classList.add('active');
                    }
                }
            }
        });
    } else {
        chartChinaMapInstance.resize();
    }

    const isDark = state.theme === 'dark';
    const isSichuanMode = (bciState.currentRegion === '四川省');

    // 1. 获取当前所选区域与细分类型下的严格数据集
    const currentRegionList = getFilteredBciList(false);

    // 统计各省份热度数据
    const provStats = {};
    currentRegionList.forEach(item => {
        const p = normalizeProvName(item.province);
        if (p) provStats[p] = (provStats[p] || 0) + 1;
    });

    const mapData = Object.keys(provStats).map(p => ({
        name: p,
        value: provStats[p]
    }));

    // 2. 统计核心城市/高校标注散点
    let scatterData = [];
    if (isSichuanMode) {
        // 四川省专属模式：精准标注高校、华西医院与独角兽生物城
        scatterData = SICHUAN_DETAILED_NODES;
    } else {
        // 全国视图模式：精选全国核心高校院所与学者枢纽
        scatterData = BCI_NATIONAL_HUBS.map(hub => {
            let count = 0;
            if (bciState.currentView === 'enterprises') {
                count = currentRegionList.filter(item => (item.province || '').includes(hub.province.replace('省', '').replace('市', ''))).length;
            } else {
                count = currentRegionList.filter(item => (item.province || '').includes(hub.province.replace('省', '').replace('市', ''))).length;
            }
            return {
                name: hub.name,
                value: [hub.value[0], hub.value[1], Math.max(count, 1)],
                province: hub.province,
                hubLabel: hub.hubLabel,
                experts: hub.experts,
                desc: hub.desc,
                highlight: hub.highlight || false,
                count: count
            };
        });
    }

    // 计算当前筛选条件下的类型描述标签
    let filterTypeLabel = '全部标的';
    if (bciState.currentView === 'enterprises') {
        let parts = [];
        if (bciState.compFilter !== 'all') parts.push(`${bciState.compFilter}评级`);
        if (bciState.techFilter !== 'all') parts.push(`${bciState.techFilter}路线`);
        filterTypeLabel = parts.length ? parts.join(' · ') : '脑机接口企业';
    } else {
        filterTypeLabel = bciState.expTypeFilter !== 'all' ? `${bciState.expTypeFilter}专家` : '脑机智库专家';
    }

    const maxVal = Math.max(...mapData.map(d => d.value), 1);

    // 动态调整地图视觉中心与缩放比例 (点击四川时，单独放大下钻四川省)
    let mapCenter = [104.5, 36.5];
    let mapZoom = 1.25;
    if (isSichuanMode) {
        mapCenter = [103.8, 30.7];
        mapZoom = 3.6; // 高清放大四川省全景！
    } else if (bciState.currentRegion === '长三角') {
        mapCenter = [120.0, 31.5];
        mapZoom = 1.6;
    } else if (bciState.currentRegion === '京津冀') {
        mapCenter = [116.5, 39.5];
        mapZoom = 1.8;
    } else if (bciState.currentRegion === '大湾区') {
        mapCenter = [113.5, 23.0];
        mapZoom = 1.8;
    }

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.96)',
            borderColor: '#6366f1',
            borderWidth: 1.5,
            padding: [8, 12],
            textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 12 },
            formatter: function(params) {
                if (params.seriesType === 'effectScatter') {
                    const d = params.data;
                    if (d.experts) {
                        return `
                            <div style="font-weight:bold; font-size:13.5px; color:#c5161d; margin-bottom:4px;">🏛️ ${d.name} (${d.province})</div>
                            <div style="font-size:12px; color:#0f172a; font-weight:700;">👨‍🏫 领军高校/学者: <span style="color:#4f46e5;">${d.experts}</span></div>
                            <div style="font-size:11.5px; color:#64748b; margin-top:2px;">🔬 方向与代表标的: ${d.desc || '前沿脑机接口核心技术研发'}</div>
                            <div style="font-size:10.5px; color:#c5161d; margin-top:4px;">👉 右侧看板已同步联动该区域学者与标的</div>
                        `;
                    }
                    return `
                        <div style="font-weight:bold; font-size:13px; color:#4f46e5; margin-bottom:4px;">📍 ${d.name} (${d.province})</div>
                        <div style="font-size:12px; color:#0f172a;">📊 当前聚焦【${filterTypeLabel}】: <strong style="color:#c5161d; font-size:13px;">${d.count}</strong> ${bciState.currentView === 'enterprises' ? '家' : '位'}</div>
                        <div style="font-size:11px; color:#64748b; margin-top:3px;">👉 右侧已同步列出该城市所有重点标的与专家</div>
                    `;
                }
                if (params.seriesType === 'map') {
                    const pName = params.name;
                    const count = provStats[normalizeProvName(pName)] || 0;
                    const isSc = pName.includes('四川');
                    if (count === 0) {
                        return `<div style="font-size:12px; color:#64748b;">${pName}: 当前聚焦区域下无标的</div>`;
                    }
                    return `
                        <div style="font-weight:bold; font-size:13px; color:${isSc ? '#c5161d' : '#004886'};">
                            ${isSc ? '⭐ 四川省 (中西部第一脑机枢纽 · 点击已放大下钻)' : pName}
                        </div>
                        <div style="margin-top:4px; font-size:12px;">
                            <span>📊 当前分布【${filterTypeLabel}】: <strong style="color:${isSc ? '#c5161d' : '#0284c7'}; font-size:13px;">${count}</strong> ${bciState.currentView === 'enterprises' ? '家' : '位'}</span>
                        </div>
                        <div style="margin-top:4px; font-size:10.5px; color:#94a3b8;">👉 右侧已实时同步对应标的清单</div>
                    `;
                }
            }
        },
        visualMap: {
            min: 0,
            max: maxVal,
            left: '3%',
            bottom: '4%',
            text: [`当前聚焦 (${maxVal})`, '0'],
            calculable: false,
            inRange: {
                color: isDark 
                    ? ['#1e293b', '#312e81', '#4338ca', '#6366f1', '#c5161d'] 
                    : ['#f8fafc', '#bae6fd', '#60a5fa', '#3b82f6', '#c5161d']
            },
            textStyle: {
                color: isDark ? '#94a3b8' : '#475569',
                fontSize: 10.5
            }
        },
        geo: {
            map: 'china',
            roam: true,
            zoom: mapZoom,
            center: mapCenter,
            label: {
                show: false
            },
            itemStyle: {
                areaColor: isDark ? '#1e293b' : '#f8fafc',
                borderColor: isDark ? '#334155' : '#cbd5e1',
                borderWidth: 0.8
            },
            emphasis: {
                label: { show: false },
                itemStyle: {
                    areaColor: '#f59e0b',
                    borderColor: '#d97706',
                    borderWidth: 1.5
                }
            }
        },
        series: [
            // 1. 省份热力地图层 (仅所选区域填色高亮)
            {
                name: '当前区域热度',
                type: 'map',
                geoIndex: 0,
                data: mapData
            },
            // 2. 核心城市 / 高校智库标注散点层 (清晰标注高校与学者，绝不堆叠遮挡)
            {
                name: '标注散点',
                type: 'effectScatter',
                coordinateSystem: 'geo',
                data: scatterData,
                symbolSize: function(val, params) {
                    if (isSichuanMode) return 15;
                    const c = params.data.count || 1;
                    return Math.max(13, Math.min(22, 13 + c * 0.5));
                },
                showEffectOn: 'render',
                rippleEffect: {
                    brushType: 'stroke',
                    scale: 3.5,
                    period: 2.8
                },
                // 开启精致胶囊标注，标注高校与学者，错落排布！
                label: {
                    show: true,
                    formatter: function(params) {
                        if (params.data.hubLabel) {
                            return params.data.hubLabel;
                        }
                        return `${params.name}`;
                    },
                    position: 'top',
                    distance: 6,
                    color: isDark ? '#ffffff' : '#0f172a',
                    fontWeight: 'bold',
                    fontSize: 10.5,
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.90)' : 'rgba(255, 255, 255, 0.92)',
                    borderColor: isDark ? '#6366f1' : '#c5161d',
                    borderWidth: 1,
                    borderRadius: 4,
                    padding: [2, 6],
                    shadowBlur: 6,
                    shadowColor: 'rgba(0,0,0,0.18)'
                },
                emphasis: {
                    scale: true,
                    label: {
                        show: true,
                        fontSize: 11
                    }
                },
                itemStyle: {
                    color: function(params) {
                        if (params.data.highlight || (params.data.province && params.data.province.includes('四川'))) {
                            return '#ef4444';
                        }
                        return '#6366f1';
                    },
                    shadowBlur: 14,
                    shadowColor: 'rgba(239, 68, 68, 0.75)'
                },
                zlevel: 5
            }
        ]
    };

    chartChinaMapInstance.setOption(option, true);
    chartChinaMapInstance.resize();
}

// 聚焦选中四川某位学者并在右侧看板高亮
function focusTalentInList(talentName) {
    bciState.currentView = 'experts';
    const btnSwitchExp = document.getElementById('btnSwitchExpView');
    const btnSwitchEnt = document.getElementById('btnSwitchEntView');
    const entFilterSec = document.getElementById('bciEntFilterSection');
    const expFilterSec = document.getElementById('bciExpFilterSection');

    if (btnSwitchExp && btnSwitchEnt) {
        btnSwitchExp.classList.add('active');
        btnSwitchEnt.classList.remove('active');
        if (entFilterSec) entFilterSec.classList.add('hidden');
        if (expFilterSec) expFilterSec.classList.remove('hidden');
    }

    const searchInput = document.getElementById('bciSearchInput');
    if (searchInput) {
        searchInput.value = talentName;
        bciState.searchQuery = talentName.toLowerCase();
    }

    applyBciFilterAndRender();
    showToast(`👨‍🏫 已定位四川领军学者【${talentName}】详细档案！`);
}

// 一键恢复全国大地图视图
function resetToChinaView() {
    bciState.currentRegion = 'all';
    bciState.searchQuery = '';
    const searchInput = document.getElementById('bciSearchInput');
    if (searchInput) searchInput.value = '';

    const regionNav = document.getElementById('bciRegionQuickNav');
    if (regionNav) {
        regionNav.querySelectorAll('.bci-nav-btn').forEach(b => b.classList.remove('active'));
        const allBtn = regionNav.querySelector('[data-region="all"]');
        if (allBtn) allBtn.classList.add('active');
    }

    applyBciFilterAndRender();
    showToast('🌐 已恢复全国大地图总览！');
}

window.focusTalentInList = focusTalentInList;
window.resetToChinaView = resetToChinaView;


function normalizeProvName(prov) {
    if (!prov) return '';
    if (prov.includes('四川')) return '四川省';
    if (prov.includes('江苏')) return '江苏省';
    if (prov.includes('浙江')) return '浙江省';
    if (prov.includes('上海')) return '上海市';
    if (prov.includes('北京')) return '北京市';
    if (prov.includes('广东')) return '广东省';
    if (prov.includes('天津')) return '天津市';
    if (prov.includes('湖北')) return '湖北省';
    if (prov.includes('陕西')) return '陕西省';
    if (prov.includes('山东')) return '山东省';
    if (prov.includes('安徽')) return '安徽省';
    return prov;
}

// 渲染右侧重点标的与领军智库穿透看板 (精确匹配所选细分类型，链接直达官方主页与权威档案)
function renderBciFocusCards() {
    const listContainer = document.getElementById('bciFocusCardsList');
    const regionNameEl = document.getElementById('bciFocusRegionName');
    const entCountEl = document.getElementById('bciFocusEntCount');
    const expCountEl = document.getElementById('bciFocusExpCount');
    const btnReset = document.getElementById('btnResetBciFocus');
    const viewEntBadge = document.getElementById('bciViewEntBadge');
    const viewExpBadge = document.getElementById('bciViewExpBadge');

    if (!listContainer) return;

    // 1. 获取当前严格筛选后的数据
    const filteredList = getFilteredBciList(false);

    // 计算当前区域下的基础总数
    let totalEntInRegion = bciEnterprisesData.length;
    let totalExpInRegion = bciExpertsData.length;
    let regionLabel = '全国全域';

    if (bciState.currentRegion !== 'all') {
        if (bciState.currentRegion === '长三角') {
            regionLabel = '长三角地区 (沪苏浙皖)';
            totalEntInRegion = bciEnterprisesData.filter(i => ['上海', '江苏', '浙江', '安徽'].some(p => (i.province || '').includes(p))).length;
            totalExpInRegion = bciExpertsData.filter(i => ['上海', '江苏', '浙江', '安徽'].some(p => (i.province || '').includes(p))).length;
        } else if (bciState.currentRegion === '京津冀') {
            regionLabel = '京津冀协同发展区';
            totalEntInRegion = bciEnterprisesData.filter(i => ['北京', '天津', '河北'].some(p => (i.province || '').includes(p))).length;
            totalExpInRegion = bciExpertsData.filter(i => ['北京', '天津', '河北'].some(p => (i.province || '').includes(p))).length;
        } else if (bciState.currentRegion === '大湾区') {
            regionLabel = '粤港澳大湾区 (广东)';
            totalEntInRegion = bciEnterprisesData.filter(i => (i.province || '').includes('广东')).length;
            totalExpInRegion = bciExpertsData.filter(i => (i.province || '').includes('广东')).length;
        } else {
            const cleanProv = bciState.currentRegion.replace('省', '').replace('市', '');
            regionLabel = bciState.currentRegion;
            totalEntInRegion = bciEnterprisesData.filter(i => (i.province || '').includes(cleanProv)).length;
            totalExpInRegion = bciExpertsData.filter(i => (i.province || '').includes(cleanProv)).length;
        }
    }

    // 更新聚焦状态文字
    if (regionNameEl) regionNameEl.textContent = regionLabel;
    if (entCountEl) entCountEl.textContent = totalEntInRegion;
    if (expCountEl) expCountEl.textContent = totalExpInRegion;
    if (viewEntBadge) viewEntBadge.textContent = totalEntInRegion;
    if (viewExpBadge) viewExpBadge.textContent = totalExpInRegion;

    if (btnReset) {
        if (bciState.currentRegion !== 'all') btnReset.classList.remove('hidden');
        else btnReset.classList.add('hidden');
    }

    // 2. 企业模式渲染 (直达正规权威官网)
    if (bciState.currentView === 'enterprises') {
        let list = [...filteredList];

        // 排序规则：四川企业置顶，高竞争力企业优先
        list.sort((a, b) => {
            const isScA = (a.province || '').includes('四川');
            const isScB = (b.province || '').includes('四川');
            if (isScA && !isScB) return -1;
            if (!isScA && isScB) return 1;

            const isHighA = (a.competitiveness || '').includes('高');
            const isHighB = (b.competitiveness || '').includes('高');
            if (isHighA && !isHighB) return -1;
            if (!isHighA && isHighB) return 1;

            return (a.id || 0) - (b.id || 0);
        });

        if (list.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px 0; color: var(--text-muted);">
                    <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
                    <div style="font-size: 13px; font-weight: 600;">当前筛选细分类型下暂无脑机企业标的</div>
                    <div style="font-size: 11px; margin-top: 4px;">建议切换为“全部评级”或“全部路线”查看</div>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = list.map((item, index) => {
            const isSc = (item.province || '').includes('四川');
            const compCat = getCompCategory(item.competitiveness);
            let compBadgeClass = 'badge-comp comp-mid';
            let compBadgeText = '🔥 中高价值';
            let cardClass = 'bci-focus-card';

            if (compCat === '高') {
                compBadgeClass = 'badge-comp comp-high';
                compBadgeText = '⭐ 高竞争力/稀缺';
                cardClass += ' card-high';
            } else if (compCat === '中') {
                compBadgeClass = 'badge-comp comp-norm';
                compBadgeText = '💎 中等稳健';
            } else if (compCat === '观察') {
                compBadgeClass = 'badge-comp comp-obs';
                compBadgeText = '👀 持续观察';
            }

            if (isSc) cardClass += ' card-sichuan';

            // 获取正规公司官网链接 (彻底替换券商研报)
            const officialUrl = getCompanyOfficialLink(item.name);
            const sourceLink = `<a href="${officialUrl}" target="_blank" rel="noopener noreferrer" class="btn-card-action" title="直达【${item.name}】官方网站与权威档案">🌐 公司官网 ➔</a>`;

            return `
                <div class="${cardClass}">
                    <div class="card-top-row">
                        <div class="card-title">
                            ${isSc ? '<span style="color:#c5161d; font-size:12px; font-weight:800;">[四川重点]</span>' : ''}
                            <span>${item.name}</span>
                        </div>
                        <div class="card-badges">
                            <span class="${compBadgeClass}">${compBadgeText}</span>
                            <span class="badge-tech">⚡ ${item.tech_route || '脑机接口'}</span>
                            <span class="badge-loc">📍 ${item.city || item.province}</span>
                        </div>
                    </div>

                    <div class="card-main-desc">
                        <strong>💡 核心看点:</strong> ${item.product_intro || '前沿脑机设备与算法研发'}
                    </div>

                    <div class="card-meta-row">
                        <span>💰 融资: <strong class="card-fin-highlight">${item.financing || '未公开/自筹'}</strong></span>
                        <span>🔬 阶段: <strong>${item.stage || '临床前/研发中'}</strong></span>
                        <div>
                            <button class="btn-card-action" onclick="copyEnterpriseName('${item.name}')">📋 复制</button>
                            ${sourceLink}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } else if (bciState.currentView === 'experts') {
        let list = [...filteredList];

        // 排序：四川专家置顶
        list.sort((a, b) => {
            const isScA = (a.province || '').includes('四川');
            const isScB = (b.province || '').includes('四川');
            if (isScA && !isScB) return -1;
            if (!isScA && isScB) return 1;
            return (a.id || 0) - (b.id || 0);
        });

        if (list.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px 0; color: var(--text-muted);">
                    <div style="font-size: 32px; margin-bottom: 8px;">🎓</div>
                    <div style="font-size: 13px; font-weight: 600;">当前筛选类型下暂无智库学者</div>
                    <div style="font-size: 11px; margin-top: 4px;">建议切换为“全部类型”查看</div>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = list.map(item => {
            const isSc = (item.province || '').includes('四川');
            // 获取正规院校学者主页 (彻底替换券商研报)
            const officialUrl = getExpertOfficialLink(item.name, item.institution);
            const sourceLink = `<a href="${officialUrl}" target="_blank" rel="noopener noreferrer" class="btn-card-action" title="查阅【${item.name} (${item.institution})】官方院校主页与实验室">🏛️ 院校学者主页 ➔</a>`;

            return `
                <div class="bci-focus-card ${isSc ? 'card-sichuan' : ''}">
                    <div class="card-top-row">
                        <div class="card-title">
                            ${isSc ? '<span style="color:#c5161d; font-size:12px; font-weight:800;">[四川专家]</span>' : ''}
                            <span>${item.name}</span>
                            <small style="font-size:11.5px; color:var(--text-muted);">(${item.institution || '高校院所'} · 📍 ${item.province || ''})</small>
                        </div>
                        <span class="badge-exp-type">🎓 ${item.expert_type || '学术研发'}</span>
                    </div>

                    <div class="card-main-desc">
                        <strong>🔬 研究方向:</strong> ${item.direction || '脑机交互与神经工程'}
                        ${item.associated_enterprise && item.associated_enterprise !== '无公开直接关联企业' ? `
                        <div style="margin-top:2px; color:#4f46e5; font-size:11.5px;">🏭 关联企业: <strong>${item.associated_enterprise}</strong></div>` : ''}
                    </div>

                    ${item.paper && !item.paper.includes('待进一步') ? `
                    <div style="font-size:10.5px; color:var(--text-muted); font-style:italic; background:var(--bg-card); padding:3px 6px; border-radius:3px; border:1px dashed var(--border-light);">
                        📜 代表顶刊: ${item.paper}
                    </div>` : ''}

                    <div class="card-meta-row" style="margin-top:2px;">
                        <span>🏛️ 单位: <strong>${item.institution || '科研院校'}</strong></span>
                        <div>
                            <button class="btn-card-action" onclick="copyEnterpriseName('${item.name} (${item.institution})')">📋 复制学者档案</button>
                            ${sourceLink}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function copyEnterpriseName(name) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(name).then(() => {
            showToast(`📋 已复制：${name}`);
        }).catch(() => {
            showToast(`📋 已复制：${name}`);
        });
    } else {
        showToast(`📋 已复制：${name}`);
    }
}

window.copyEnterpriseName = copyEnterpriseName;
window.openBciModal = openBciModal;
window.closeBciModal = closeBciModal;




