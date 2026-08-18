import os
import sys
import io
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

# 保证 UTF-8 输出
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

logger = logging.getLogger(__name__)

class PolicyDocExporter:
    """政策 Word 简报导出器"""

    @staticmethod
    def get_desktop_path() -> str:
        """获取当前系统 Windows 桌面路径"""
        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        if os.path.exists(desktop):
            return desktop
        # 兼容 OneDrive 桌面路径
        onedrive_desktop = os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop")
        if os.path.exists(onedrive_desktop):
            return onedrive_desktop
        return os.path.expanduser("~")

    @classmethod
    def export(cls, policies: List[Dict[str, Any]], custom_filename: Optional[str] = None) -> List[str]:
        """
        导出政策为 Word 文档
        :param policies: 政策列表
        :param custom_filename: 自定义文件名
        :return: 生成的文件路径列表
        """
        if not policies:
            logger.info("暂无新增政策，跳过 Word 简报导出。")
            return []

        doc = Document()

        # 1. 设置页面边距 (A4 标规：上下 2.54cm, 左右 2.8cm)
        for section in doc.sections:
            section.top_margin = Inches(1.0)
            section.bottom_margin = Inches(1.0)
            section.left_margin = Inches(1.1)
            section.right_margin = Inches(1.1)

        today_str = datetime.now().strftime("%Y年%m月%d日")
        date_tag = datetime.now().strftime("%Y%m%d")

        # 2. 文档大标题
        title_p = doc.add_paragraph()
        title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        title_run = title_p.add_run("医药产业政策每日监测与分析简报")
        title_run.font.name = "黑体"
        title_run.font.size = Pt(20)
        title_run.font.bold = True
        title_run.font.color.rgb = RGBColor(31, 78, 121)  # 深蓝商务风

        # 3. 简报元数据卡片表格
        meta_table = doc.add_table(rows=2, cols=4)
        meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        meta_table.autofit = False

        headers = [
            ("编制日期", today_str),
            ("收录数量", f"{len(policies)} 条最新政策"),
            ("编制部门", "医药集团政策研究室"),
            ("监测范围", "国家药监/医保/卫健/国务院")
        ]

        cells = meta_table._cells
        for i, (k, v) in enumerate(headers):
            row_idx = i // 2
            col_k = (i % 2) * 2
            col_v = col_k + 1

            cell_k = meta_table.cell(row_idx, col_k)
            cell_v = meta_table.cell(row_idx, col_v)

            cell_k.text = k
            cell_v.text = v

            # 样式设置
            for cell, is_header in [(cell_k, True), (cell_v, False)]:
                tcPr = cell._tc.get_or_add_tcPr()
                if is_header:
                    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="EBF1F5"/>')
                else:
                    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="FFFFFF"/>')
                tcPr.append(shd)

                for p in cell.paragraphs:
                    p.paragraph_format.space_before = Pt(4)
                    p.paragraph_format.space_after = Pt(4)
                    for run in p.runs:
                        run.font.name = "宋体"
                        run.font.size = Pt(10.5)
                        if is_header:
                            run.font.bold = True

        doc.add_paragraph().paragraph_format.space_after = Pt(8)

        # 4. 政策速览表格（三线表）
        h2 = doc.add_paragraph()
        r2 = h2.add_run("一、 政策速览清单")
        r2.font.name = "黑体"
        r2.font.size = Pt(14)
        r2.font.bold = True
        r2.font.color.rgb = RGBColor(31, 78, 121)

        summary_table = doc.add_table(rows=len(policies) + 1, cols=4)
        summary_table.alignment = WD_TABLE_ALIGNMENT.CENTER

        # 表头
        col_names = ["序号", "政策文件标题", "发布机构", "发布日期"]
        for col_idx, col_name in enumerate(col_names):
            c = summary_table.cell(0, col_idx)
            c.text = col_name
            tcPr = c._tc.get_or_add_tcPr()
            tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="1F4E79"/>'))
            for p in c.paragraphs:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                for run in p.runs:
                    run.font.name = "黑体"
                    run.font.size = Pt(10.5)
                    run.font.bold = True
                    run.font.color.rgb = RGBColor(255, 255, 255)

        # 数据行
        for idx, item in enumerate(policies, 1):
            row_cells = summary_table.rows[idx].cells
            row_cells[0].text = str(idx)
            row_cells[1].text = item.get("title", "")
            row_cells[2].text = item.get("source", "")
            row_cells[3].text = item.get("pub_date", "") or "近期"

            for c_idx, c in enumerate(row_cells):
                for p in c.paragraphs:
                    p.paragraph_format.space_before = Pt(3)
                    p.paragraph_format.space_after = Pt(3)
                    if c_idx in [0, 3]:
                        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    for run in p.runs:
                        run.font.name = "宋体"
                        run.font.size = Pt(10)

        doc.add_paragraph().paragraph_format.space_after = Pt(14)

        # 5. 政策详细解读正文
        h3 = doc.add_paragraph()
        r3 = h3.add_run("二、 重点政策详细内容与链接直达")
        r3.font.name = "黑体"
        r3.font.size = Pt(14)
        r3.font.bold = True
        r3.font.color.rgb = RGBColor(31, 78, 121)

        for idx, item in enumerate(policies, 1):
            # 政策标题
            p_title = doc.add_paragraph()
            p_title.paragraph_format.space_before = Pt(8)
            p_title.paragraph_format.space_after = Pt(2)
            run_idx = p_title.add_run(f"【政策 {idx}】 {item.get('title')}\n")
            run_idx.font.name = "黑体"
            run_idx.font.size = Pt(12)
            run_idx.font.bold = True
            run_idx.font.color.rgb = RGBColor(38, 38, 38)

            # 元信息
            p_meta = doc.add_paragraph()
            p_meta.paragraph_format.space_after = Pt(4)
            r_meta = p_meta.add_run(
                f"• 发布部门：{item.get('source')}    • 发布日期：{item.get('pub_date') or '近期'}    • 政策分类：{item.get('category') or '政策法规'}"
            )
            r_meta.font.name = "楷体"
            r_meta.font.size = Pt(10)
            r_meta.font.color.rgb = RGBColor(100, 100, 100)

            # 摘要内容
            summary_text = item.get("summary", "") or item.get("title")
            p_summary = doc.add_paragraph()
            p_summary.paragraph_format.space_after = Pt(4)
            p_summary.paragraph_format.first_line_indent = Inches(0.25)
            r_sum = p_summary.add_run(f"内容要点：{summary_text}")
            r_sum.font.name = "仿宋"
            r_sum.font.size = Pt(11)

            # 原文链接
            url = item.get("url", "#")
            p_link = doc.add_paragraph()
            p_link.paragraph_format.space_after = Pt(10)
            r_link_label = p_link.add_run("• 原文直达链接：")
            r_link_label.font.name = "宋体"
            r_link_label.font.size = Pt(10)
            
            r_link = p_link.add_run(url)
            r_link.font.name = "Calibri"
            r_link.font.size = Pt(10)
            r_link.font.color.rgb = RGBColor(0, 102, 204)
            r_link.font.underline = True

            # 分割线
            p_div = doc.add_paragraph()
            p_div.paragraph_format.space_after = Pt(8)
            r_div = p_div.add_run("─" * 45)
            r_div.font.color.rgb = RGBColor(200, 200, 200)

        # 6. 保存文档
        filename = custom_filename or f"医药产业政策监测早报_{date_tag}.docx"
        saved_paths = []

        # 6.1 保存到 Windows 桌面
        desktop_dir = cls.get_desktop_path()
        desktop_file = os.path.join(desktop_dir, filename)
        try:
            doc.save(desktop_file)
            saved_paths.append(desktop_file)
            logger.info(f"📄 [Word已保存到桌面] {desktop_file}")
        except Exception as e:
            logger.warning(f"保存到桌面失败: {e}")

        # 6.2 在项目内 reports/ 目录保存归档
        project_reports_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reports")
        os.makedirs(project_reports_dir, exist_ok=True)
        report_file = os.path.join(project_reports_dir, filename)
        try:
            doc.save(report_file)
            saved_paths.append(report_file)
            logger.info(f"📁 [Word已归档到项目目录] {report_file}")
        except Exception as e:
            logger.warning(f"保存到 reports/ 失败: {e}")

        return saved_paths


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    # 测试导出功能
    from database import PolicyDatabase
    db = PolicyDatabase()
    policies = db.get_unpushed_policies(limit=6)
    if not policies:
        with db._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM policies ORDER BY id DESC LIMIT 6")
            policies = [dict(row) for row in cursor.fetchall()]

    paths = PolicyDocExporter.export(policies)
    print("✅ 导出完成，文件路径:")
    for p in paths:
        print(" ->", p)
