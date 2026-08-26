import sys
import os
import json
import sqlite3

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# 地方省份与真实重点产业映射（穿透政策表象，聚焦各地实体产业与园区承载）
LOCAL_PROVINCE_PROFILES = {
    "四川省": {
        "title": "四川省 · 西南核医疗与战略腹地新质策源地",
        "focus_industries": ["核医疗与医用同位素", "脑机接口与前沿器械", "高端医学影像与机器人", "中药现代化"],
        "industry_clusters": "成都天府国际生物城、成都医学城（温江）、中国绵阳科技城（核技术高地）、泸州医药产业园",
        "real_intent": "依托全国独一无二的核堆与堆照同位素资源攻坚放药国产化；以《川药监39号文》开辟全生命周期审评绿色通道，做强西部战略腹地生物医药制造。",
        "future_outlook": "打通放射性药品院内制剂跨省调剂转化，建设国家级核医疗健康产业高地与创新器械转化首选地。"
    },
    "上海市": {
        "title": "上海市 · 具身智能医疗机器人与AI制药全球创新极",
        "focus_industries": ["具身智能医疗机器人", "AI制药与前沿大模型", "脑机接口产业化", "CGT细胞基因治疗"],
        "industry_clusters": "张江药谷、临港新片区生命蓝湾、徐汇AI大模型产业集聚区",
        "real_intent": "将生物医药列为三大先导产业之首，重点攻坚“AI+机器人+生物医药”跨界融合，打造全球创新药械出海与高端智造中枢。",
        "future_outlook": "加速微创手术机器人进三甲医院，建立全球领先的定量药理学与AIDD算力平台。"
    },
    "广东省": {
        "title": "广东省 · 粤港澳微创器械智造与超大规模商业化枢纽",
        "focus_industries": ["微创手术机器人制造", "医用耗材高端替代", "数字医疗与智能穿戴", "大湾区创新药械通"],
        "industry_clusters": "深圳坪山生物医药产业基地、广州国际生物岛、珠海金湾生物医药基地",
        "real_intent": "依托完备的电子信息与精密机械产业链，将手术机器人做成具有国际成本竞争力的优势产业；以大湾区集采大盘撬动国产替代。",
        "future_outlook": "以“大湾区药械通”加速国际前沿产品落地，构建全国最大的高端耗材智造出口基地。"
    },
    "江苏省": {
        "title": "江苏省 · 全国创新药械集聚第一大省与全链条研发极",
        "focus_industries": ["创新抗体与小分子新药", "高值植介入耗材", "生物医药CXO供应链", "核酸与偶联药物"],
        "industry_clusters": "苏州工业园区（BioBAY）、南京生物医药谷、连云港新医药产业基地",
        "real_intent": "坐拥全国最密集的 Biotech 创新药企群，在医保限价挂网与价格动态联动下，倒逼企业向差异化原始创新与高附加值器械转型。",
        "future_outlook": "保持创新药获批数量与高值耗材挂网规模全国第一，打造世界级生物医药产业集群。"
    },
    "浙江省": {
        "title": "浙江省 · 数字医疗与生命健康智能制造新高地",
        "focus_industries": ["AI数字医疗与远程诊疗", "高端医疗装备制造", "智能康复外骨骼", "合成生物学"],
        "industry_clusters": "杭州医药港小镇（下沙）、余杭未来科技城生物医药区、绍兴滨海生命健康产业园",
        "real_intent": "发挥数字经济与电商物流龙头优势，重点发展“数字医保+互联网医院+智能诊疗器械”，布局合成生物学前沿底盘。",
        "future_outlook": "推动智能康复与医疗大数据场景化应用，建设全国数字健康第一省。"
    },
    "辽宁省": {
        "title": "辽宁省 · 东北亚自贸区研发要素跨境免通关试验区",
        "focus_industries": ["研发物品保税研发", "生物制品与血液制品", "重特大仿制药智造", "省际集采联动"],
        "industry_clusters": "大连金普新区生物医药产业园、沈阳本溪药都、自贸试验区大连片区",
        "real_intent": "通过自贸试验区率先试点研发用物品“白名单”免通关单绿色验放，攻克跨国研发物料进出口堵点，打造东北亚保税研发枢纽。",
        "future_outlook": "吸引全球 CRO/CDMO 研发机构集聚，降低生物医药研发制度性交易成本。"
    },
    "山东省": {
        "title": "山东省 · 海洋生物医药与高品质原料药/耗材生产大省",
        "focus_industries": ["海洋生物医药", "高品质原料药与制剂", "骨科与医用高分子耗材", "现代中药"],
        "industry_clusters": "威海医疗器械产业园（威高基地）、青岛蓝色药谷、烟台牟平国际生物药谷",
        "real_intent": "依托强大的化工与重工制造基础，向高附加值海洋生物制品与高端医用耗材（骨科/血液净化）全面升级。",
        "future_outlook": "建设全球最大的海洋药物与医用高分子耗材智能化制造基地。"
    },
    "湖北省": {
        "title": "湖北省 · 华中前沿生物技术与光电医疗装备策源地",
        "focus_industries": ["光电医疗器械与激光医疗", "新型疫苗与抗体药物", "AI医学影像", "生物育种与合成生物"],
        "industry_clusters": "武汉国家生物产业基地（光谷生物城）、宜昌生物医药产业园",
        "real_intent": "依托华中科研院所与光电技术优势，打造“光电+医疗器械”特色长板，构筑内陆创新药械中枢。",
        "future_outlook": "巩固光谷生物城研发领先地位，辐射带动长江中游城市群医疗器械转化。"
    }
}

# 重点产业赛道
LOCAL_INDUSTRY_TRACKS = {
    "核医疗与放药监管": {
        "icon": "⚛️",
        "color": "#e11d48",
        "desc": "医用同位素自研自产、177Lu/225Ac靶向PRRT核药、院内制剂跨省转化",
        "future": "2026-2028年迎来治疗性核药仿制申报高峰，四川凭借绵阳与成都堆产资源成为全国核心承载区。"
    },
    "脑机接口与前沿器械": {
        "icon": "🧠",
        "color": "#8b5cf6",
        "desc": "侵入/非侵入运动代偿、神经调控、智能康复电极、临床试验要点",
        "future": "上海与四川率先在全生命周期监管中推进BCI前置服务，2028年前形成区域临床试验集聚。"
    },
    "AI制药与算法模型": {
        "icon": "🧬",
        "color": "#0284c7",
        "desc": "模型引导药物研发(MIDD)、AIDD靶点发现、计算生物学、大模型算力",
        "future": "上海张江与江苏BioBAY依托顶尖算法生态，推动AI从虚拟筛选进入临床试验设计与监管审评决策。"
    },
    "医疗机器人与智能装备": {
        "icon": "🤖",
        "color": "#f59e0b",
        "desc": "微创腔镜/骨科机器人、具身智能协作装备、康复外骨骼、产用攻关",
        "future": "广东制造供应链与上海具身智能双轮驱动，国产高性价比手术机器人加速向下沉医院替代进口。"
    },
    "医保集采与价格治理": {
        "icon": "💳",
        "color": "#10b981",
        "desc": "耗材全品类集采、限价挂网增补、价格动态联动、智能监管两库",
        "future": "广东与江苏成为全国耗材价格联动的‘压舱石’，倒逼传统仿制企业向高壁垒创新药械转型。"
    },
    "自贸区研发要素免关": {
        "icon": "🚢",
        "color": "#0ea5e9",
        "desc": "生物医药研发物品免通关单白名单、跨境生物物料验放、保税研发",
        "future": "辽宁自贸区首创的白名单模式正向全国自贸区扩散，为四川自贸区天府生物城提供成熟制度样板。"
    }
}

# 构建纯地方省份产业拓扑
nodes = []
links = []
categories = [
    {"name": "地方重点省份", "itemStyle": {"color": "#004886", "borderColor": "#38bdf8", "borderWidth": 1.5}},
    {"name": "地方重点产业赛道", "itemStyle": {"color": "#0284c7", "borderColor": "#7dd3fc", "borderWidth": 1.5}},
    {"name": "核心产业集群/园区载体", "itemStyle": {"color": "#10b981", "borderColor": "#6ee7b7", "borderWidth": 1.5}},
    {"name": "省际产业竞合趋势", "itemStyle": {"color": "#f59e0b", "borderColor": "#fcd34d", "borderWidth": 1.5}}
]

node_id_set = set()

def add_node(nid, name, category_idx, symbol_size, value, extra_info=None):
    if nid not in node_id_set:
        node_id_set.add(nid)
        nodes.append({
            "id": nid,
            "name": name,
            "category": category_idx,
            "symbolSize": symbol_size,
            "value": value,
            "extra": extra_info or {}
        })

# 1. 纯地方省份节点 (15px - 18px 微圆点，避开北京)
prov_sizes = {"四川省": 18, "上海市": 17, "广东省": 17, "江苏省": 17, "浙江省": 15, "辽宁省": 15, "山东省": 15, "湖北省": 15}
for prov, sz in prov_sizes.items():
    p_info = LOCAL_PROVINCE_PROFILES[prov]
    add_node(
        nid=f"prov_{prov}",
        name=prov,
        category_idx=0,
        symbol_size=sz,
        value=len(p_info["focus_industries"]),
        extra_info={"type": "province", "desc": f"实体园区: {p_info['industry_clusters'][:28]}..."}
    )

# 2. 重点产业赛道 (14px - 16px)
for track, defn in LOCAL_INDUSTRY_TRACKS.items():
    add_node(
        nid=f"track_{track}",
        name=f"{defn['icon']} {track}",
        category_idx=1,
        symbol_size=15,
        value=len(defn["desc"]),
        extra_info={"type": "track", "desc": defn["desc"], "future": defn["future"]}
    )

# 3. 关联地方省份与主攻产业 (真实产业布局)
prov_track_links = [
    ("四川省", "核医疗与放药监管", 4),
    ("四川省", "脑机接口与前沿器械", 3),
    ("四川省", "医疗机器人与智能装备", 2),
    ("上海市", "医疗机器人与智能装备", 5),
    ("上海市", "AI制药与算法模型", 5),
    ("上海市", "脑机接口与前沿器械", 4),
    ("广东省", "医疗机器人与智能装备", 5),
    ("广东省", "医保集采与价格治理", 4),
    ("江苏省", "AI制药与算法模型", 4),
    ("江苏省", "医保集采与价格治理", 5),
    ("江苏省", "自贸区研发要素免关", 3),
    ("浙江省", "AI制药与算法模型", 3),
    ("浙江省", "医疗机器人与智能装备", 3),
    ("辽宁省", "自贸区研发要素免关", 5),
    ("辽宁省", "医保集采与价格治理", 3),
    ("山东省", "医保集采与价格治理", 3),
    ("湖北省", "AI制药与算法模型", 3),
    ("湖北省", "医疗机器人与智能装备", 3)
]

for p, t, val in prov_track_links:
    links.append({
        "source": f"prov_{p}",
        "target": f"track_{t}",
        "value": val,
        "lineStyle": {
            "width": min(2.5, max(1.0, val * 0.4)),
            "opacity": 0.55
        }
    })

# 4. 地方实体产业集群/园区载体微节点 (10px)
clusters = [
    ("cluster_sc_bio", "成都天府生物城·核医疗高地", 2, 10, "prov_四川省", "四川核医学堆产资源与转化中心"),
    ("cluster_sh_zj", "上海张江药谷·具身智能中心", 2, 10, "prov_上海市", "三大先导产业与AI大模型集聚区"),
    ("cluster_gd_sz", "深圳坪山·微创机器人智造链", 2, 10, "prov_广东省", "全国最完备的精密医疗电子制造集群"),
    ("cluster_js_bio", "苏州BioBAY·创新药集聚地", 2, 10, "prov_江苏省", "创新抗体与小分子新药研发主阵地"),
    ("cluster_ln_ftz", "辽宁自贸试验区·保税研发港", 2, 10, "prov_辽宁省", "研发用物品免通关单绿色验放闭环")
]

for c_id, c_name, cat_idx, sz, p_target, note in clusters:
    add_node(c_id, c_name, cat_idx, sz, 1, {"type": "cluster", "note": note})
    links.append({"source": p_target, "target": c_id, "value": 1, "lineStyle": {"type": "dashed", "width": 1.0, "opacity": 0.45}})

# 5. 省际产业竞合趋势微节点 (9px)
trends = [
    ("trend_west_nuc", "西南核医疗转化第一极", 3, 9, "track_核医疗与放药监管", "四川依托堆产优势打造国家战略腹地放药中枢"),
    ("trend_east_ai", "长三角具身智能与AI高地", 3, 9, "track_AI制药与算法模型", "上海与江苏主导算力算法与微创器械研发"),
    ("trend_south_vbp", "大湾区规模化智造与集采", 3, 9, "track_医疗机器人与智能装备", "广东以产业链制造优势抢占集采与出口大盘"),
    ("trend_ftz_open", "自贸区研发要素免通关复制", 3, 9, "track_自贸区研发要素免关", "辽宁模式向全国自贸区推广，缩短研发周期80%")
]

for tr_id, tr_name, cat_idx, sz, t_target, note in trends:
    add_node(tr_id, tr_name, cat_idx, sz, 1, {"type": "trend", "note": note})
    links.append({"source": t_target, "target": tr_id, "value": 1, "lineStyle": {"color": "#f59e0b", "width": 1.2, "type": "solid", "opacity": 0.7}})

trend_insights = {
    "macro_trend": "【穿透政策表象，看地方产业真实发力点】：全国地方省份已从泛化的医药招商全面转向【特色长板极化】——四川主攻核医疗同位素与全周期器械服务；上海主攻具身智能与AI制药；广东做大微创机器人智造；江苏深耕创新药与价格治理；辽宁突破自贸区研发免关。",
    "track_momentum": [
        {"track": "⚛️ 四川核医疗", "status": "全国领跑", "summary": "依托绵阳堆产同位素与成都天府生物城，率先打通治疗性核药仿制与院内制剂转化。"},
        {"track": "🤖 上海/广东机器人", "status": "智造双核", "summary": "上海偏重具身智能算法与三甲临床，广东偏重精密制造与大湾区集采出口。"},
        {"track": "🧬 长三角AI制药", "status": "算力合规", "summary": "张江与BioBAY推动模型引导药物研发（MIDD）直接服务于创新药注册审评。"},
        {"track": "💳 粤苏集采大盘", "status": "以价换量", "summary": "广东药交中心与江苏医药集采网主导价格联动，倒逼企业向高附加值器械升级。"},
        {"track": "🚢 辽宁自贸免关", "status": "制度突破", "summary": "率先落地生物医药研发物品免通关单‘白名单’，大幅降低跨境研发物料时间成本。"}
    ]
}

full_graph_data = {
    "code": 0,
    "data": {
        "nodes": nodes,
        "links": links,
        "categories": categories,
        "province_profiles": LOCAL_PROVINCE_PROFILES,
        "trend_insights": trend_insights
    }
}

for d in ["web/data", "docs/data"]:
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "industry_graph.json"), "w", encoding="utf-8") as f:
        json.dump(full_graph_data, f, ensure_ascii=False, indent=2)

print(f"✅ 纯地方省份实体产业图谱数据生成完成！节点数: {len(nodes)}, 边数: {len(links)}, 覆盖地方省份: {len(LOCAL_PROVINCE_PROFILES)} 个！")
