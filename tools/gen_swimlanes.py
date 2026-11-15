"""Generate the two swimlane diagrams (diagram-design style, Thai labels).

Run:  python tools/gen_swimlanes.py
Out:  web/diagrams/swimlane-opd.html, web/diagrams/swimlane-er-ipd.html
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "web" / "diagrams"

PAPER, INK, MUTED, SOFT = "#f5f5f5", "#2d3142", "#4f5d75", "#7a8399"
ACCENT, ACCENT_TINT, RULE = "#eb6c36", "rgba(235,108,54,0.08)", "rgba(45,49,66,0.12)"
SANS = "'Geist','Noto Sans Thai',sans-serif"
MONO = "'Geist Mono','Noto Sans Thai',monospace"

W, LANE_X0, LANE_LABEL_W = 1104, 16, 128
LANE_TOP, LANE_H = 64, 96
NODE_W, NODE_H = 128, 64
COLS = [164, 320, 476, 632, 788, 944]


def lane_top(i):
    return LANE_TOP + i * LANE_H


def node_xy(col, lane):
    return COLS[col], lane_top(lane) + (LANE_H - NODE_H) // 2


STYLE = {
    "focal": (ACCENT_TINT, ACCENT, ""),
    "step": ("#ffffff", INK, ""),
    "io": ("rgba(79,93,117,0.10)", SOFT, ""),
}


def node_svg(n):
    x, y = node_xy(n["col"], n["lane"])
    fill, stroke, _ = STYLE[n.get("kind", "step")]
    cx = x + NODE_W // 2
    lines = n["name"].split("\n")
    out = [f'<rect x="{x}" y="{y}" width="{NODE_W}" height="{NODE_H}" rx="6" fill="{PAPER}"/>',
           f'<rect x="{x}" y="{y}" width="{NODE_W}" height="{NODE_H}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="1"/>']
    if n.get("tag"):
        tw = 8 + 6 * len(n["tag"])
        tw += (4 - tw % 4) % 4
        out.append(f'<rect x="{x + 8}" y="{y + 6}" width="{tw}" height="12" rx="2" fill="transparent" stroke="{stroke}" stroke-opacity="0.4" stroke-width="0.8"/>')
        out.append(f'<text x="{x + 8 + tw / 2:g}" y="{y + 15}" fill="{stroke}" fill-opacity="0.8" font-size="7" font-family="{MONO}" text-anchor="middle" letter-spacing="0.08em">{n["tag"]}</text>')
    base = y + (36 if len(lines) == 1 else 37)
    for i, ln in enumerate(lines):
        out.append(f'<text x="{cx}" y="{base + i * 14 - (7 if len(lines) > 1 else 0)}" fill="{INK}" font-size="12" font-weight="600" font-family="{SANS}" text-anchor="middle">{ln}</text>')
    if n.get("sub"):
        out.append(f'<text x="{cx}" y="{y + 56}" fill="{MUTED}" font-size="9" font-family="{MONO}" text-anchor="middle">{n["sub"]}</text>')
    return "\n    ".join(out)


def arrow_svg(a):
    color = {"default": MUTED, "accent": ACCENT}[a.get("style", "default")]
    marker = {"default": "arrow", "accent": "arrow-accent"}[a.get("style", "default")]
    dash = ' stroke-dasharray="5,4"' if a.get("dashed") else ""
    out = [f'<path d="{a["d"]}" fill="none" stroke="{color}" stroke-width="1.2"{dash} marker-end="url(#{marker})"/>']
    if a.get("label"):
        lx, ly, anchor = a["label_at"]
        text = a["label"]
        tw = 8 + 7 * len(text)
        tw += (4 - tw % 4) % 4
        rx = lx - tw / 2 if anchor == "middle" else (lx - tw if anchor == "end" else lx)
        out.append(f'<rect x="{rx:g}" y="{ly - 10}" width="{tw}" height="14" rx="2" fill="{PAPER}"/>')
        out.append(f'<text x="{lx + (-4 if anchor == "end" else 4 if anchor == "start" else 0)}" y="{ly}" fill="{SOFT}" font-size="9" font-family="{MONO}" text-anchor="{anchor}" letter-spacing="0.04em">{text}</text>')
    return "\n    ".join(out)


def lanes_svg(lanes):
    out = []
    bottom = lane_top(len(lanes))
    for i, (th, en) in enumerate(lanes):
        y = lane_top(i)
        if i % 2 == 1:
            out.append(f'<rect x="{LANE_X0}" y="{y}" width="{W - 2 * LANE_X0}" height="{LANE_H}" fill="rgba(45,49,66,0.025)"/>')
        out.append(f'<text x="{LANE_X0 + 8}" y="{y + 40}" fill="{SOFT}" font-size="8" font-family="{MONO}" letter-spacing="0.14em">{en}</text>')
        for j, part in enumerate(th.split("\n")):
            out.append(f'<text x="{LANE_X0 + 8}" y="{y + 58 + j * 16}" fill="{INK}" font-size="12" font-weight="600" font-family="{SANS}">{part}</text>')
        out.append(f'<line x1="{LANE_X0}" y1="{y}" x2="{W - LANE_X0}" y2="{y}" stroke="{RULE}" stroke-width="0.8"/>')
    out.append(f'<line x1="{LANE_X0}" y1="{bottom}" x2="{W - LANE_X0}" y2="{bottom}" stroke="{RULE}" stroke-width="0.8"/>')
    out.append(f'<line x1="{LANE_X0 + LANE_LABEL_W}" y1="{LANE_TOP}" x2="{LANE_X0 + LANE_LABEL_W}" y2="{bottom}" stroke="{RULE}" stroke-width="0.8"/>')
    return "\n    ".join(out)


def legend_svg(y, focal_text):
    items = [
        ("io", "จุดเริ่ม / สิ้นสุด"),
        ("step", "ขั้นตอนบริการ (มีคิว)"),
        ("focal", focal_text),
    ]
    out = [f'<line x1="{LANE_X0 + 16}" y1="{y - 8}" x2="{W - 32}" y2="{y - 8}" stroke="{RULE}" stroke-width="0.8"/>',
           f'<text x="{LANE_X0 + 16}" y="{y + 12}" fill="{MUTED}" font-size="8" font-family="{MONO}" letter-spacing="0.14em">LEGEND</text>']
    x = 112
    for kind, label in items:
        fill, stroke, _ = STYLE[kind]
        out.append(f'<rect x="{x}" y="{y + 2}" width="20" height="12" rx="2" fill="{fill}" stroke="{stroke}" stroke-width="1"/>')
        out.append(f'<text x="{x + 28}" y="{y + 12}" fill="{MUTED}" font-size="12" font-family="{SANS}">{label}</text>')
        x += 200
    out.append(f'<line x1="{x}" y1="{y + 8}" x2="{x + 24}" y2="{y + 8}" stroke="{MUTED}" stroke-width="1.2" stroke-dasharray="5,4"/>')
    out.append(f'<text x="{x + 32}" y="{y + 12}" fill="{MUTED}" font-size="12" font-family="{SANS}">ส่งผลกลับ (วนกลับ)</text>')
    return "\n    ".join(out)


PAGE = """<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&family=Noto+Sans+Thai:wght@400;500;600&family=Noto+Serif+Thai:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    :root {{ --paper:#f5f5f5; --ink:#2d3142; --muted:#4f5d75; --soft:#7a8399; --accent:#eb6c36; --rule:rgba(45,49,66,0.12);
      --sans:'Geist','Noto Sans Thai',system-ui,sans-serif; --serif:'Instrument Serif','Noto Serif Thai',serif; --mono:'Geist Mono','Noto Sans Thai',ui-monospace,monospace; }}
    body {{ font-family: var(--sans); background: var(--paper); color: var(--ink); padding: 2.5rem 1.5rem; }}
    .frame {{ max-width: 1180px; margin: 0 auto; }}
    .eyebrow {{ font-family: var(--mono); font-size: .66rem; font-weight: 500; letter-spacing: .18em; text-transform: uppercase; color: var(--muted); margin-bottom: .5rem; }}
    h1 {{ font-family: var(--serif); font-size: clamp(1.5rem, 2.4vw + .75rem, 2rem); font-weight: 400; letter-spacing: -.01em; line-height: 1.3; margin-bottom: .4rem; }}
    .lede {{ color: var(--muted); margin-bottom: 1.5rem; max-width: 70ch; }}
    .scroll {{ overflow-x: auto; }}
    svg {{ width: 100%; min-width: 960px; display: block; }}
    .cards {{ display: grid; grid-template-columns: 1.1fr 1fr .9fr; gap: 16px; margin-top: 1.5rem; }}
    .card {{ background: #fff; border: 1px solid var(--rule); border-radius: 6px; padding: 1.25rem; }}
    .card .eyebrow {{ font-size: .6rem; }}
    .card h3 {{ font-size: 1rem; margin: .2rem 0 .5rem; display: flex; gap: 8px; align-items: center; }}
    .dot {{ width: 7px; height: 7px; border-radius: 50%; display: inline-block; }}
    .card ul {{ padding-left: 1.1rem; color: var(--muted); font-size: .9rem; line-height: 1.7; }}
    .aside {{ font-family: var(--serif); font-style: italic; color: var(--muted); }}
    footer {{ margin-top: 2rem; padding-top: .8rem; border-top: 1px solid var(--rule); font-family: var(--mono); font-size: .7rem; color: var(--soft); }}
    @media (max-width: 800px) {{ .cards {{ grid-template-columns: 1fr; }} }}
  </style>
</head>
<body>
  <div class="frame">
    <p class="eyebrow">{eyebrow}</p>
    <h1>{h1}</h1>
    <p class="lede">{lede}</p>
    <div class="scroll">
    <svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="{slug}-title {slug}-desc">
    <title id="{slug}-title">{h1}</title>
    <desc id="{slug}-desc">{desc}</desc>
    <defs>
      <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#4f5d75"/></marker>
      <marker id="arrow-accent" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#eb6c36"/></marker>
      <marker id="arrow-link" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#2e5aa8"/></marker>
    </defs>
    <rect width="100%" height="100%" fill="#f5f5f5"/>
    <!-- lanes -->
    {lanes}
    <!-- arrows (drawn before nodes) -->
    {arrows}
    <!-- nodes -->
    {nodes}
    <!-- legend -->
    {legend}
    </svg>
    </div>
    <div class="cards">{cards}</div>
    <footer>SmartHospital · Swimlane · ค่า service time / slot ตรงกับค่าเริ่มต้นในแบบจำลองคิว (web/js/data.js)</footer>
  </div>
</body>
</html>
"""


def card(eyebrow, dot, title, items):
    lis = "".join(f"<li>{i}</li>" for i in items)
    return f'<div class="card"><p class="eyebrow">{eyebrow}</p><h3><span class="dot" style="background:{dot}"></span>{title}</h3><ul>{lis}</ul></div>'


def build(spec):
    n_lanes = len(spec["lanes"])
    legend_y = lane_top(n_lanes) + 32
    H = legend_y + 32
    html = PAGE.format(
        title=spec["title"], eyebrow=spec["eyebrow"], h1=spec["h1"], lede=spec["lede"], slug=spec["slug"], desc=spec["desc"],
        W=W, H=H,
        lanes=lanes_svg(spec["lanes"]),
        arrows="\n    ".join(arrow_svg(a) for a in spec["arrows"]),
        nodes="\n    ".join(node_svg(n) for n in spec["nodes"]),
        legend=legend_svg(legend_y, spec["focal_legend"]),
        cards="".join(card(*c) for c in spec["cards"]),
    )
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f'{spec["slug"]}.html').write_text(html, encoding="utf-8")
    print("wrote", OUT / f'{spec["slug"]}.html')


OPD = {
    "slug": "swimlane-opd",
    "title": "Swimlane OPD",
    "eyebrow": "Swimlane · ผู้ป่วยนอก (OPD)",
    "h1": "เส้นทางผู้ป่วยนอก: จากประตูโรงพยาบาลถึงรับยากลับบ้าน",
    "lede": "แต่ละแถว (lane) คือฝ่ายที่รับผิดชอบ ลูกศรข้ามแถวคือจุดส่งต่อผู้ป่วย — ทุกจุดส่งต่อคือคิวใหม่ที่ผู้ป่วยต้องนั่งรอ",
    "desc": "Swimlane ห้าแถวแสดงผู้ป่วยนอกเดินจากลงทะเบียน คัดกรอง พบแพทย์ ส่งตรวจ Lab/X-ray แล้วกลับมาพบแพทย์ ชำระเงิน และรับยา โดยห้องยาเป็นหน่วยที่มีภาระสูงสุด",
    "focal_legend": "ภาระสูงสุด (ρ ≈ 84%)",
    "lanes": [("ผู้ป่วย", "PATIENT"), ("เวชระเบียน\n& คัดกรอง", "FRONT OFFICE"), ("แพทย์ OPD", "CLINIC"),
              ("ตรวจวินิจฉัย", "DIAGNOSTICS"), ("การเงิน\n& เภสัชกรรม", "BILLING · RX")],
    "nodes": [
        {"col": 0, "lane": 0, "kind": "io", "name": "มาถึงโรงพยาบาล", "sub": "MAIN ENTRANCE"},
        {"col": 1, "lane": 1, "tag": "REG", "name": "ลงทะเบียน\nตรวจสิทธิ", "sub": "2.5 min · c=4"},
        {"col": 2, "lane": 1, "tag": "TRI", "name": "คัดกรอง\nวัดสัญญาณชีพ", "sub": "5 min · c=7"},
        {"col": 3, "lane": 2, "tag": "DOC", "name": "แพทย์ตรวจ", "sub": "10 min · c=14"},
        {"col": 3, "lane": 3, "tag": "LAB", "name": "Lab · X-ray · EKG", "sub": "5 / 10 / 10 min"},
        {"col": 4, "lane": 4, "tag": "CSH", "name": "ชำระเงิน", "sub": "2.5 min · c=4"},
        {"col": 5, "lane": 4, "tag": "PHA", "kind": "focal", "name": "รับยา\n+ คำแนะนำ", "sub": "5.8 min · c=7"},
        {"col": 5, "lane": 0, "kind": "io", "name": "กลับบ้าน / นัดต่อ", "sub": "EXIT"},
    ],
    "arrows": [
        {"d": "M228,144 V200 Q228,208 236,208 H319"},
        {"d": "M448,208 H475"},
        {"d": "M540,240 V296 Q540,304 548,304 H631"},
        {"d": "M680,336 V367", "label": "ส่งตรวจ", "label_at": (672, 356, "end")},
        {"d": "M712,368 V337", "label": "ผลตรวจ", "dashed": True, "label_at": (720, 356, "start")},
        {"d": "M760,304 H764 Q772,304 772,312 V488 Q772,496 780,496 H787", "label": "สั่งยา", "label_at": (780, 424, "start")},
        {"d": "M916,496 H943", "style": "accent"},
        {"d": "M1008,464 V145", "label": "เสร็จสิ้น", "label_at": (1016, 304, "start")},
    ],
    "cards": [
        ("ลำดับบริการ", INK, "6 จุดส่งต่อ = 6 คิว", ["ลงทะเบียน → คัดกรอง → แพทย์ → (Lab/X-ray → แพทย์) → การเงิน → ห้องยา",
                                                 "ผู้ป่วยที่ต้องตรวจเพิ่มจะกลับมาพบแพทย์อีกรอบ → ห้องตรวจรับภาระ 2 ครั้ง",
                                                 "ค่า service time และจำนวน slot (หลังปรับปรุง) แสดงใต้ชื่อแต่ละขั้น"]),
        ("ปรับปรุงแล้ว", ACCENT, "ห้องยา (PHA)", ["ก่อน: 6 slot × 6.5 นาที รองรับ 55 ราย/ชม. < ความต้องการ 61 → คิวโตไม่หยุด",
                                         "หลัง: 7 slot + pre-packing 5.8 นาที → รองรับ 72 ราย/ชม., ρ ≈ 84%",
                                         "ยังเป็นหน่วยที่ภาระสูงสุด จึงควรเฝ้าระวังช่วงพีค"]),
        ("หมายเหตุ", SOFT, "นอกแผนภาพนี้", ["ฉุกเฉิน / Admit / ผ่าตัด ดูแผนภาพที่ 2",
                                        "ทันตกรรม กายภาพ วัคซีน ใช้เส้นทางย่อยของ OPD (ดูเมทริกซ์ในเว็บ)"]),
    ],
}

ER = {
    "slug": "swimlane-er-ipd",
    "title": "Swimlane ER IPD",
    "eyebrow": "Swimlane · ฉุกเฉิน → ผ่าตัด / ผู้ป่วยใน",
    "h1": "เส้นทางผู้ป่วยฉุกเฉิน: คัดแยก รักษา ผ่าตัด และรับไว้นอนโรงพยาบาล",
    "lede": "แพทย์ ER เป็นจุดตัดสินใจหลัก — ส่งตรวจ ส่งผ่าตัด หรือรับไว้เป็นผู้ป่วยใน ทุกเส้นทางมาจบที่การจำหน่ายผู้ป่วย",
    "desc": "Swimlane ห้าแถวแสดงผู้ป่วยฉุกเฉินผ่านการคัดแยก แพทย์ ER ส่งตรวจ Lab/X-ray แล้วแยกไปผ่าตัดและพักฟื้น หรือรับไว้ในหอผู้ป่วย ก่อนจำหน่าย ชำระเงิน รับยา และกลับบ้าน",
    "focal_legend": "จุดตัดสินใจหลัก",
    "lanes": [("ผู้ป่วย / ญาติ", "PATIENT"), ("ห้องฉุกเฉิน", "EMERGENCY"), ("ตรวจวินิจฉัย", "DIAGNOSTICS"),
              ("ผ่าตัด", "SURGERY"), ("ผู้ป่วยใน\n& การเงิน", "INPATIENT · BILLING")],
    "nodes": [
        {"col": 0, "lane": 0, "kind": "io", "name": "มาถึงประตูฉุกเฉิน", "sub": "ER ENTRANCE · 24/7"},
        {"col": 0, "lane": 1, "tag": "ERT", "name": "คัดแยกความรุนแรง", "sub": "ESI 1-5 · 4 min"},
        {"col": 1, "lane": 1, "tag": "ER", "kind": "focal", "name": "แพทย์ ER\nประเมิน / รักษา", "sub": "25 min · c=5"},
        {"col": 1, "lane": 2, "tag": "LAB", "name": "Lab · X-ray", "sub": "5 / 10 min"},
        {"col": 2, "lane": 3, "tag": "OR", "name": "ห้องผ่าตัด", "sub": "90 min · c=3"},
        {"col": 3, "lane": 3, "tag": "PACU", "name": "ห้องพักฟื้น", "sub": "60 min · c=4"},
        {"col": 4, "lane": 4, "tag": "ADM", "name": "Admit\nรับเข้าหอผู้ป่วย", "sub": "15 + 30 min"},
        {"col": 5, "lane": 4, "tag": "CSH", "name": "จำหน่าย\nชำระเงิน · รับยา", "sub": "CSH · PHA"},
        {"col": 5, "lane": 0, "kind": "io", "name": "กลับบ้าน", "sub": "EXIT"},
    ],
    "arrows": [
        {"d": "M228,144 V175"},
        {"d": "M292,208 H319"},
        {"d": "M368,240 V271", "label": "ส่งตรวจ", "label_at": (360, 260, "end")},
        {"d": "M400,272 V241", "label": "ผลตรวจ", "dashed": True, "label_at": (408, 260, "start")},
        {"d": "M448,220 H532 Q540,220 540,228 V367", "label": "ต้องผ่าตัด", "label_at": (548, 304, "start")},
        {"d": "M448,196 H866 Q874,196 874,204 V463", "label": "รับไว้รักษา", "label_at": (700, 184, "middle")},
        {"d": "M604,400 H631"},
        {"d": "M760,400 H822 Q830,400 830,408 V463"},
        {"d": "M916,496 H943"},
        {"d": "M1008,464 V145", "label": "จำหน่าย", "label_at": (1016, 304, "start")},
    ],
    "cards": [
        ("ลำดับบริการ", INK, "สามทางเลือกหลังพบแพทย์ ER", ["รักษาแล้วจำหน่าย → การเงิน/ยา (process ER ในแบบจำลอง)",
                                                   "ผ่าตัด → พักฟื้น → Admit",
                                                   "รับไว้รักษาโดยตรง → Admit → หอผู้ป่วย"]),
        ("จุดตัดสินใจ", ACCENT, "แพทย์ ER", ["ผู้ป่วย ER ผ่านห้องฉุกเฉิน 2 ครั้ง → เพิ่มเป็น 5 ทีม ρ 83% → 67%",
                                          "Lab/X-ray ใช้ร่วมกับ OPD → คิว X-ray ของ OPD ส่งผลต่อ ER",
                                          "แนะนำ: แยกคิว ER ออกจาก OPD และ fast track ESI 4-5"]),
        ("หมายเหตุ", SOFT, "ระยะเวลานอนโรงพยาบาล", ["แบบจำลองคิวนับถึงการรับเข้าหอ (ไม่รวมวันนอน)",
                                               "ICU / ห้องคลอด อยู่นอกขอบเขตการจำลอง"]),
    ],
}

if __name__ == "__main__":
    build(OPD)
    build(ER)
