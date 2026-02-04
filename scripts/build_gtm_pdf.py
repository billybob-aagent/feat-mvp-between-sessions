#!/usr/bin/env python3

from pathlib import Path
import re

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Preformatted

ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs" / "go-to-market"
OUT_DIR = DOCS_DIR / "out"
OUT_FILE = OUT_DIR / "AER_GTM_Kit.pdf"

FILES = [
    DOCS_DIR / "README.md",
    DOCS_DIR / "STEP_1_EXTERNALIZE_AER_STANDARD.md",
    DOCS_DIR / "AER_STANDARD_OVERVIEW.md",
    DOCS_DIR / "AER_CONFORMANCE_CHECKLIST.md",
    DOCS_DIR / "STEP_2_UR_REALITY_CHECK.md",
    DOCS_DIR / "AER_UR_REVIEWER_PACKET.md",
    DOCS_DIR / "UR_REALITY_CHECK_SCRIPT.md",
    DOCS_DIR / "UR_FEEDBACK_FORM.md",
    DOCS_DIR / "STEP_3_DISTRIBUTION_PILOT.md",
    DOCS_DIR / "PILOT_30_DAY_PLAN.md",
    DOCS_DIR / "PILOT_SUCCESS_METRICS.md",
    DOCS_DIR / "PILOT_EMAIL_TEMPLATES.md",
    DOCS_DIR / "AER_AUDIT_SUBMISSION_EXAMPLE.md",
]


def escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def format_inline(text: str) -> str:
    def repl(match: re.Match) -> str:
        code = escape(match.group(1))
        return f'<font face="Courier">{code}</font>'

    return re.sub(r"`([^`]+)`", repl, text)


def read_title(path: Path) -> str:
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("#"):
            return line.lstrip("#").strip()
    return path.stem


def markdown_to_flowables(text: str, styles) -> list:
    flow = []
    in_code = False
    code_lines = []
    para_lines = []

    def flush_para():
        nonlocal para_lines
        if para_lines:
            joined = " ".join([line.strip() for line in para_lines if line.strip()])
            if joined:
                flow.append(Paragraph(format_inline(escape(joined)), styles["BodyCustom"]))
            para_lines = []

    for raw in text.splitlines():
        line = raw.rstrip("\n")
        stripped = line.strip()

        if stripped.startswith("```"):
            flush_para()
            if in_code:
                flow.append(Preformatted("\n".join(code_lines), styles["CodeCustom"]))
                code_lines = []
                in_code = False
            else:
                in_code = True
            continue

        if in_code:
            code_lines.append(line)
            continue

        if stripped == "":
            flush_para()
            flow.append(Spacer(1, 8))
            continue

        if stripped.startswith("#"):
            flush_para()
            level = len(stripped) - len(stripped.lstrip("#"))
            heading_text = stripped.lstrip("#").strip()
            style_key = (
                "H1Custom" if level == 1 else "H2Custom" if level == 2 else "H3Custom"
            )
            flow.append(Paragraph(escape(heading_text), styles[style_key]))
            continue

        if stripped.startswith("- ") or stripped.startswith("* "):
            flush_para()
            bullet_text = stripped[2:].strip()
            flow.append(Paragraph(f"* {escape(bullet_text)}", styles["BodyCustom"]))
            continue

        para_lines.append(stripped)

    if in_code and code_lines:
        flow.append(Preformatted("\n".join(code_lines), styles["CodeCustom"]))
    else:
        flush_para()

    return flow


def build_pdf():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            "TitlePage",
            parent=styles["Title"],
            alignment=TA_CENTER,
            fontSize=20,
            leading=24,
        )
    )
    styles.add(ParagraphStyle("H1Custom", parent=styles["Heading1"], spaceAfter=10))
    styles.add(ParagraphStyle("H2Custom", parent=styles["Heading2"], spaceAfter=8))
    styles.add(ParagraphStyle("H3Custom", parent=styles["Heading3"], spaceAfter=6))
    styles.add(ParagraphStyle("BodyCustom", parent=styles["BodyText"], leading=14))
    styles.add(
        ParagraphStyle(
            "CodeCustom",
            parent=styles["BodyText"],
            fontName="Courier",
            fontSize=9,
            leading=11,
            backColor=colors.whitesmoke,
        )
    )

    doc = SimpleDocTemplate(str(OUT_FILE), pagesize=LETTER, title="AER GTM Kit")
    flowables = []

    # Title page
    flowables.append(Spacer(1, 120))
    flowables.append(Paragraph("AER Go-To-Market Execution Kit", styles["TitlePage"]))
    flowables.append(Spacer(1, 12))
    flowables.append(Paragraph("Compiled documentation bundle", styles["BodyCustom"]))
    flowables.append(PageBreak())

    # Table of contents
    flowables.append(Paragraph("Table of Contents", styles["H1Custom"]))
    for idx, path in enumerate(FILES, start=1):
        title = read_title(path)
        flowables.append(Paragraph(f"{idx}. {escape(title)}", styles["BodyCustom"]))
    flowables.append(PageBreak())

    # Sections
    for path in FILES:
        content = path.read_text(encoding="utf-8")
        flowables.append(Paragraph(read_title(path), styles["H1Custom"]))
        flowables.append(Spacer(1, 6))
        flowables.extend(markdown_to_flowables(content, styles))
        flowables.append(PageBreak())

    doc.build(flowables)
    print(f"Wrote {OUT_FILE}")


if __name__ == "__main__":
    build_pdf()
