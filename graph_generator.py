"""
医药产业政策省份-赛道拓扑图谱与未来走势数据自动生成引擎
在每次政策采集与更新任务中由 main.py 自动调用，实现全自动动态自适应计算与更新
"""
import os
import json
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

PROVINCE_RULES = {
    "四川省": ["四川", "成都", "绵阳", "泸州", "川药监", "川内"],
    "北京市": ["北京", "国家药监", "工信部", "医保局", "科技部", "发改委", "卫健委", "中医药局", "海淀", "亦庄"],
    "上海市": ["上海", "张江", "徐汇", "长三角"],
    "广东省": ["广东", "广州", "深圳", "大湾区", "粤港澳"],
    "辽宁省": ["辽宁", "沈阳", "大连", "自贸试验区", "辽药监"],
    "江苏省": ["江苏", "苏州", "南京", "园区"],
    "浙江省": ["浙江", "杭州", "绍兴"],
    "陕西省": ["陕西", "西安"]
}

TRACK_DEFINITIONS = {
    "核医药与放药监管": {
        "icon": "⚛️",
        "color": "#e11d48",
        "desc": "医用同位素自给化、PRRT靶向放射性核素治疗、放药仿制与质控标准、院内制剂转化",
        "future_trend": "2026-2028将迎来镥[177Lu]、锕[225Ac]等治疗性核药仿制申报高峰，国家级放药技术审评标准全面落地，区域核医疗中心与医用同位素堆产化成为核心支撑。"
    },
    "脑机接口与前沿器械": {
        "icon": "🧠",
        "color": "#8b5cf6",
        "desc": "侵入式运动代偿器械、非侵入脑电采集、神经调控、国家产业标准体系（2026-2030）、康复装备",
        "future_trend": "到2028年制修订标准40项以上，2030年突破80项。植入式BCI医疗器械进入临床前审评要点合规阶段，偏瘫康复、癫痫治疗与人机协作加速商业化。"
    },
    "AI制药与算法模型": {
        "icon": "🧬",
        "color": "#0284c7",
        "desc": "模型引导药物研发(ICH M15)、AIDD靶点发现、计算生物学、临床试验算法设计、AI医疗影像",
        "future_trend": "定量药理学与模型引导（MIDD）全面纳入国家审评体系，AI大模型从纯虚拟筛选向临床试验设计优化、晶型预测及真实世界数据闭环渗透。"
    },
    "医疗机器人与智能装备": {
        "icon": "🤖",
        "color": "#f59e0b",
        "desc": "腔镜/骨科手术机器人、康复外骨骼、特种医疗协作装备、产用结对攻关、具身智能",
        "future_trend": "工信部深化医疗场景产用攻关推广，具备规模化优势与临床协作的国产手术机器人加速下沉三级/二级医院，具身智能与多模态机器人走进临床。"
    },
    "医保政策与集采支付": {
        "icon": "💳",
        "color": "#10b981",
        "desc": "全民医保十五五规划、耗材带量采购、省级限价挂网、DRG/DIP支付方式改革、智能监管两库",
        "future_trend": "集采常态化向耗材细分品种全覆盖，限价挂网价格联动加剧，智能监管限二线规则精细化，创新药‘绿色挂网’与快速进院机制成为政策对冲关键。"
    },
    "科技创新与资金申报": {
        "icon": "📑",
        "color": "#0ea5e9",
        "desc": "CGT先锐计划、重大新药创制专项、研发用物品进口白名单、科技奖补基金、专精特新培育",
        "future_trend": "自贸区生物医药研发物品免通关单‘白名单’在辽宁、上海等推广；CDE对细胞与基因治疗实施先锐计划前置辅导；科技资金全面向新质生产力倾斜。"
    }
}

class IndustryGraphGenerator:
    @staticmethod
    def generate(db_instance) -> Dict[str, Any]:
        """根据数据库最新全量政策动态计算并更新拓扑图谱"""
        with db_instance._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, title, source, pub_date, category, summary, url FROM policies ORDER BY pub_date DESC")
            policies = [dict(r) for r in cursor.fetchall()]

        province_track_matrix = {p: {t: [] for t in TRACK_DEFINITIONS} for p in PROVINCE_RULES}
        track_policies_map = {t: [] for t in TRACK_DEFINITIONS}

        for p in policies:
            cat = p.get("category", "")
            title = p.get("title", "")
            src = p.get("source", "")
            summary = p.get("summary", "")

            matched_track = None
            for t_key in TRACK_DEFINITIONS:
                if t_key in cat or cat in t_key or (t_key == "AI制药与算法模型" and "AI制药" in cat) or (t_key == "脑机接口与前沿器械" and "脑机接口" in cat) or (t_key == "医疗机器人与智能装备" and "医疗机器人" in cat) or (t_key == "医保政策与集采支付" and "医保" in cat) or (t_key == "科技创新与资金申报" and ("科技" in cat or "申报" in cat or "奖补" in cat)):
                    matched_track = t_key
                    break
            if not matched_track:
                matched_track = "科技创新与资金申报"

            track_policies_map[matched_track].append(p)

            assigned_provinces = []
            text_to_check = title + " " + src + " " + summary
            for prov, keywords in PROVINCE_RULES.items():
                if any(k in text_to_check for k in keywords):
                    assigned_provinces.append(prov)

            if not assigned_provinces:
                assigned_provinces = ["北京市"]

            for prov in assigned_provinces:
                province_track_matrix[prov][matched_track].append(p)

        nodes = []
        links = []
        categories = [
            {"name": "重点区域/省市", "itemStyle": {"color": "#004886", "borderColor": "#38bdf8", "borderWidth": 1.5}},
            {"name": "前沿产业赛道", "itemStyle": {"color": "#0284c7", "borderColor": "#7dd3fc", "borderWidth": 1.5}},
            {"name": "核心突破政策", "itemStyle": {"color": "#10b981", "borderColor": "#6ee7b7", "borderWidth": 1.5}},
            {"name": "未来战略趋势", "itemStyle": {"color": "#f59e0b", "borderColor": "#fcd34d", "borderWidth": 1.5}}
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

        # 1. 省份微节点 (14px - 20px)
        prov_weights = {"四川省": 20, "北京市": 18, "上海市": 16, "广东省": 16, "辽宁省": 15, "江苏省": 15, "浙江省": 14, "陕西省": 14}
        for prov, w in prov_weights.items():
            total_prov_policies = sum(len(province_track_matrix[prov][t]) for t in TRACK_DEFINITIONS)
            add_node(
                nid=f"prov_{prov}",
                name=prov,
                category_idx=0,
                symbol_size=w,
                value=total_prov_policies,
                extra_info={"type": "province", "desc": f"关联重点政策 {total_prov_policies} 篇"}
            )

        # 2. 赛道微节点 (14px - 16px)
        track_weights = {"核医药与放药监管": 15, "脑机接口与前沿器械": 16, "AI制药与算法模型": 14, "医疗机器人与智能装备": 15, "医保政策与集采支付": 15, "科技创新与资金申报": 15}
        for track, defn in TRACK_DEFINITIONS.items():
            t_cnt = len(track_policies_map[track])
            add_node(
                nid=f"track_{track}",
                name=f"{defn['icon']} {track}",
                category_idx=1,
                symbol_size=track_weights[track],
                value=t_cnt,
                extra_info={"type": "track", "desc": defn["desc"], "future": defn["future_trend"]}
            )

        # 3. 省份 <--> 赛道 连线
        for prov in PROVINCE_RULES:
            for track in TRACK_DEFINITIONS:
                cnt = len(province_track_matrix[prov][track])
                if cnt > 0:
                    links.append({
                        "source": f"prov_{prov}",
                        "target": f"track_{track}",
                        "value": cnt,
                        "lineStyle": {
                            "width": min(2.5, max(1.0, cnt * 0.3)),
                            "opacity": 0.55
                        }
                    })

        # 4. 代表性政策亮点 (微圆点 9-11px)
        key_initiatives = [
            ("policy_bci_std", "工信部《脑机接口标准指南》", 2, 10, "track_脑机接口与前沿器械", "prov_北京市", "2028年研制40项标准，2030年80项"),
            ("policy_bci_cmde", "CMDE《植入式脑机接口审评要点》", 2, 10, "track_脑机接口与前沿器械", "prov_北京市", "国家首个侵入式BCI器械审评判定标准"),
            ("policy_sc_device", "四川省《医疗器械高质量发展39号文》", 2, 11, "track_脑机接口与前沿器械", "prov_四川省", "全生命周期监管，培育脑机接口、核医疗设备"),
            ("policy_177lu", "CDE《177Lu仿制药技术要求》", 2, 10, "track_核医药与放药监管", "prov_北京市", "国内首个PRRT核素仿制药药学标准"),
            ("policy_ln_whitelist", "辽宁自贸区《生物医药进口白名单》", 2, 11, "track_科技创新与资金申报", "prov_辽宁省", "免通关单快速验放，全流程闭环可追溯"),
            ("policy_sh_155", "上海市《十五五新型工业化规划》", 2, 10, "track_医疗机器人与智能装备", "prov_上海市", "生物医药先导产业，发展脑机接口与具身机器人"),
            ("policy_gd_vessel", "广东省《3类耗材集采文件》", 2, 9, "track_医保政策与集采支付", "prov_广东省", "冠脉扩张球囊集采常态化，以量换价"),
            ("policy_cgt_sharp", "CDE《CGT药品先锐计划》", 2, 10, "track_科技创新与资金申报", "prov_北京市", "年限15个重大创新品种前置审评加速"),
            ("policy_ich_m15", "ICH《M15模型引导药物研发》", 2, 9, "track_AI制药与算法模型", "prov_北京市", "定量药理学与AI计算建模审评落地")
        ]

        for p_id, p_name, cat_idx, sz, t_target, prov_target, note in key_initiatives:
            add_node(p_id, p_name, cat_idx, sz, 1, {"type": "policy", "note": note})
            links.append({"source": t_target, "target": p_id, "value": 1, "lineStyle": {"type": "dashed", "width": 1.0, "opacity": 0.45}})
            links.append({"source": prov_target, "target": p_id, "value": 1, "lineStyle": {"type": "dotted", "width": 0.8, "opacity": 0.35}})

        # 5. 趋势节点 (微圆点 9-10px)
        trend_nodes = [
            ("trend_2028_bci", "2028脑机标准成网", 3, 10, "track_脑机接口与前沿器械", "牵头参与国际标准10项以上，覆盖超100家领军企业"),
            ("trend_prrt_boom", "PRRT放药仿制潮", 3, 10, "track_核医药与放药监管", "177Lu与225Ac靶向核药迎来研发与生产爆发期"),
            ("trend_vbp_full", "耗材集采全品类扩面", 3, 9, "track_医保政策与集采支付", "DRG/DIP深水区，价格联动与智能两库强监管"),
            ("trend_free_port", "自贸区要素零关卡", 3, 9, "track_科技创新与资金申报", "白名单机制全国多省复制，进口通关周期缩减80%")
        ]

        for tr_id, tr_name, cat_idx, sz, t_target, note in trend_nodes:
            add_node(tr_id, tr_name, cat_idx, sz, 1, {"type": "trend", "note": note})
            links.append({"source": t_target, "target": tr_id, "value": 1, "lineStyle": {"color": "#f59e0b", "width": 1.2, "type": "solid", "opacity": 0.7}})

        province_profiles = {
            "四川省": {
                "title": "四川省 · 西南生物医药新质生产力核心策源地",
                "focus_industries": ["核医疗与医用同位素", "脑机接口与前沿器械", "创新药与中药现代化", "医疗机器人"],
                "key_advantages": "依托成都医学城、天府国际生物城及中国绵阳科技城核技术优势，出台《川药监发39号文》，在审评审批绿色通道、全生命周期监管及核医药转化上走在全国前列。",
                "future_outlook": "深化川渝生物医药协同，加速放药院内制剂跨省调剂与转化，成为国家战略腹地生物医药创新高地。"
            },
            "北京市": {
                "title": "北京市 · 国家监管创新与前沿原创标准高地",
                "focus_industries": ["国家标准体系构建", "植入式脑机接口", "AI制药与计算生物", "CGT细胞基因治疗"],
                "key_advantages": "汇聚工信部、国家药监局(CDE/CMDE)、国家医保局等核心监管中枢，主导脑机接口标准指南(2026版)、CGT先锐计划及ICH M15国际接轨。",
                "future_outlook": "统领全国标准体系话语权，亦庄与海淀加速原创药物研发与高端器械转化。"
            },
            "上海市": {
                "title": "上海市 · 国际化先导产业与具身智能医药高地",
                "focus_industries": ["高端医疗器械与装备", "脑机接口产业化", "具身智能医疗机器人", "AI制药大模型"],
                "key_advantages": "《十五五新型工业化规划》将生物医药列为三大先导产业之一，张江药谷与徐汇大模型生态领先，研发物品白名单与自贸改革成熟。",
                "future_outlook": "深化AI+生物医药融合，推动脑机接口、微创手术机器人走进全省与国际医院。"
            },
            "广东省": {
                "title": "广东省 · 粤港澳大湾区集采挂网与智能装备产业高地",
                "focus_industries": ["医用耗材集中带量采购", "医疗机器人制造", "创新药挂网商业化", "大湾区药械通"],
                "key_advantages": "广东药品交易中心主导多轮耗材集采规则制定，深圳与广州在手术机器人、智能穿戴康复设备制造端产业链完备。",
                "future_outlook": "依托大湾区“药械通”加速国际创新药械引进，以超大规模市场驱动国产设备以价换量。"
            },
            "辽宁省": {
                "title": "辽宁省 · 东北亚跨境研发要素与自贸白名单先试先行区",
                "focus_industries": ["生物医药研发物品进口白名单", "省际耗材限价挂网", "医药数智化转型"],
                "key_advantages": "率先发布自贸区研发物品‘白名单’征求意见稿，建立药监/海关/商务多部门联合免通关单绿色验放机制。",
                "future_outlook": "大幅降低进出口制度性交易成本，吸引跨国 CRO 与新药研发企业在辽集聚。"
            },
            "江苏省": {
                "title": "江苏省 · 创新药械全产业链集聚与价格治理标杆",
                "focus_industries": ["创新药商业化", "耗材价格联动治理", "高端医疗器械制造"],
                "key_advantages": "苏州工业园区与南京生物医药谷产业集聚度全国领先，在价格动态联动与挂网合规管理上体系严密。",
                "future_outlook": "保持新药获批数量全国领先，推进创新药全生命周期降本增效。"
            }
        }

        trend_insights = {
            "macro_trend": "全国生物医药政策正从【单一研发资金奖补】向【全生命周期前置审评加速 + 跨境要素免通关 + 国家标准立标 + 医保商保多元支付】的系统化生态演进。",
            "track_momentum": [
                {"track": "⚛️ 核医药", "status": "爆发前夜", "summary": "177Lu仿制药标准的出台标志放药从探索期进入规模化申报期，医用同位素自主化攻坚是核心。"},
                {"track": "🧠 脑机接口", "status": "国家立标期", "summary": "工信部2026-2030标准指南与CMDE审评要点确立了国家战略地位，2028年将迎来40项标准落地。"},
                {"track": "🧬 AI制药", "status": "审评合规期", "summary": "ICH M15推动定量药理与计算模型直接用于注册审评决策，算法模型从科研玩具转向合规工具。"},
                {"track": "🤖 医疗机器人", "status": "场景下沉期", "summary": "国家部委推进产用结对攻关，具备性价比优势的微创/骨科/康复机器人加速替代进口并向二级医院下沉。"},
                {"track": "💳 医保集采", "status": "精细监管期", "summary": "十五五医保规划推进集采全覆盖，限二线知识库智能化监管收紧，创新药全流程免进院壁垒政策增强。"},
                {"track": "📑 科技申报", "status": "制度型开放", "summary": "辽宁等自贸区进口白名单、CDE先锐计划打通研发物料跨境通关与审评绿色通道。"}
            ]
        }

        result_data = {
            "nodes": nodes,
            "links": links,
            "categories": categories,
            "province_profiles": province_profiles,
            "trend_insights": trend_insights
        }

        base_dir = os.path.dirname(os.path.abspath(__file__))
        for dpath in [os.path.join(base_dir, "web", "data"), os.path.join(base_dir, "docs", "data")]:
            os.makedirs(dpath, exist_ok=True)
            with open(os.path.join(dpath, "industry_graph.json"), "w", encoding="utf-8") as f:
                json.dump({"code": 0, "data": result_data}, f, ensure_ascii=False, indent=2)

        logger.info(f"[知识图谱] 拓扑关系与发展走势已自动重算并同步！节点: {len(nodes)}, 边: {len(links)}")
        return result_data
