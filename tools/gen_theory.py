"""Generate web/theory.html — ทฤษฎีการวิเคราะห์ workflow และ queue + ข้อมูลที่ต้องเก็บ

Diagrams follow the diagram-design skill (default skin, Thai labels):
  1. Fan-in queue / bottleneck  -> data flow : ตัวอย่าง service ห้องจ่ายยา + จุดบันทึกเวลา ①–④
  2. Stage framework with slots  -> process   : ข้อมูล → วิเคราะห์ → ผลลัพธ์ (6 ขั้น × 3 ช่อง)

Run:  python tools/gen_theory.py
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "web" / "theory.html"

PAPER, INK, MUTED, SOFT, LINK = "#f5f5f5", "#2d3142", "#4f5d75", "#7a8399", "#2e5aa8"
ACCENT, ACCENT_TINT, RULE = "#eb6c36", "rgba(235,108,54,0.08)", "rgba(45,49,66,0.12)"
SANS = "'Geist','Noto Sans Thai',sans-serif"
MONO = "'Geist Mono','Noto Sans Thai',monospace"

KIND = {
    "focal": (ACCENT_TINT, ACCENT, ""),
    "step": ("#ffffff", INK, ""),
    "io": ("rgba(79,93,117,0.10)", SOFT, ""),
    "store": ("rgba(45,49,66,0.05)", MUTED, ""),
    "opt": ("rgba(45,49,66,0.02)", "rgba(45,49,66,0.45)", ' stroke-dasharray="4,3"'),
}


def defs(p):
    return f"""<defs>
      <marker id="{p}-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#4f5d75"/></marker>
      <marker id="{p}-arrow-accent" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#eb6c36"/></marker>
      <marker id="{p}-arrow-link" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#2e5aa8"/></marker>
    </defs>"""


def box(x, y, w, h, kind="step", tag=None, title=None, subs=(), title_dy=None):
    fill, stroke, dash = KIND[kind]
    o = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{PAPER}"/>',
         f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="1"{dash}/>']
    if tag:
        tw = 8 + 6 * len(tag); tw += (4 - tw % 4) % 4
        o.append(f'<rect x="{x + 8}" y="{y + 6}" width="{tw}" height="12" rx="2" fill="transparent" stroke="{stroke}" stroke-opacity="0.4" stroke-width="0.8"/>')
        o.append(f'<text x="{x + 8 + tw / 2:g}" y="{y + 15}" fill="{stroke}" fill-opacity="0.8" font-size="7" font-family="{MONO}" text-anchor="middle" letter-spacing="0.08em">{tag}</text>')
    cx = x + w // 2
    if title:
        ty = y + (title_dy if title_dy else (h // 2 + (0 if subs else 4)))
        o.append(f'<text x="{cx}" y="{ty}" fill="{INK}" font-size="12" font-weight="600" font-family="{SANS}" text-anchor="middle">{title}</text>')
        for i, s in enumerate(subs):
            o.append(f'<text x="{cx}" y="{ty + 18 + i * 14}" fill="{MUTED}" font-size="9" font-family="{MONO}" text-anchor="middle">{s}</text>')
    return o


def arrow(p, d, style="default", dashed=False):
    color = {"default": MUTED, "accent": ACCENT, "link": LINK}[style]
    mk = {"default": "arrow", "accent": "arrow-accent", "link": "arrow-link"}[style]
    da = ' stroke-dasharray="5,4"' if dashed else ""
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="1.2"{da} marker-end="url(#{p}-{mk})"/>'


def label(x, y, text, w, anchor="middle", size=12, color=SOFT, family=SANS):
    rx = x - w / 2 if anchor == "middle" else (x - w if anchor == "end" else x)
    return [f'<rect x="{rx:g}" y="{y - size - 2}" width="{w}" height="{size + 6}" rx="2" fill="{PAPER}"/>',
            f'<text x="{x}" y="{y}" fill="{color}" font-size="{size}" font-family="{family}" text-anchor="{anchor}">{text}</text>']


def marker_dot(x, y, n, cap, cap_dy=-20):
    return [f'<circle cx="{x}" cy="{y}" r="10" fill="{LINK}" stroke="{PAPER}" stroke-width="2"/>',
            f'<text x="{x}" y="{y + 4}" fill="#ffffff" font-size="12" font-weight="600" font-family="{MONO}" text-anchor="middle">{n}</text>',
            *label(x, y + cap_dy, cap, 8 + 6 * len(cap) + 4, size=12, color=LINK, family=MONO)]


def legend(y, items, W):
    o = [f'<line x1="32" y1="{y - 8}" x2="{W - 32}" y2="{y - 8}" stroke="{RULE}" stroke-width="0.8"/>',
         f'<text x="32" y="{y + 12}" fill="{MUTED}" font-size="8" font-family="{MONO}" letter-spacing="0.14em">LEGEND</text>']
    x = 112
    for kind, text in items:
        if kind == "dot":
            o.append(f'<circle cx="{x + 10}" cy="{y + 8}" r="7" fill="{LINK}"/>')
        elif kind == "dash":
            o.append(f'<line x1="{x}" y1="{y + 8}" x2="{x + 24}" y2="{y + 8}" stroke="{MUTED}" stroke-width="1.2" stroke-dasharray="5,4"/>')
        else:
            fill, stroke, dash = KIND[kind]
            o.append(f'<rect x="{x}" y="{y + 2}" width="20" height="12" rx="2" fill="{fill}" stroke="{stroke}" stroke-width="1"{dash}/>')
        o.append(f'<text x="{x + 32}" y="{y + 12}" fill="{MUTED}" font-size="12" font-family="{SANS}">{text}</text>')
        x += 176
    return o


# ---------------------------------------------------------------- diagram 1
def diagram_service():
    W, H, p = 1104, 420, "svc"
    o = [f'<rect width="100%" height="100%" fill="{PAPER}"/>',
         f'<text x="32" y="44" fill="{SOFT}" font-size="8" font-family="{MONO}" letter-spacing="0.14em">SOURCES · λ รวม 61 / hr</text>']
    # arrows first
    o += [arrow(p, "M192,92 H224 Q232,92 232,100 V148 Q232,156 240,156 H271"),
          arrow(p, "M192,180 H271"),
          arrow(p, "M192,268 H224 Q232,268 232,260 V212 Q232,204 240,204 H271"),
          arrow(p, "M512,180 H575", "accent"),
          arrow(p, "M776,180 H863"),
          arrow(p, "M392,232 V312 Q392,320 400,320 H575", dashed=True)]
    o += label(544, 166, "เรียกคิว", 56)
    o += label(820, 166, "จ่ายยาเสร็จ", 72)
    o += label(488, 306, "รอนานเกินไป", 84)
    # nodes
    o += box(32, 64, 160, 56, "io", title="ห้องตรวจแพทย์ OPD", subs=("λ = 52 / hr",), title_dy=26)
    o += box(32, 152, 160, 56, "io", title="ทันตกรรม · ผ่าตัด", subs=("λ = 5 / hr",), title_dy=26)
    o += box(32, 240, 160, 56, "io", title="ห้องฉุกเฉิน ER", subs=("λ = 4 / hr",), title_dy=26)
    o += box(272, 128, 240, 104, "store", tag="QUEUE", title="คิวรอหน้าห้องยา", title_dy=36)
    for i in range(5):
        filled = i < 3
        o.append(f'<rect x="{304 + i * 36}" y="{176}" width="24" height="24" rx="4" fill="{"rgba(79,93,117,0.35)" if filled else "#ffffff"}" stroke="{MUTED}" stroke-width="0.8"/>')
    o.append(f'<text x="392" y="220" fill="{MUTED}" font-size="9" font-family="{MONO}" text-anchor="middle">Lq ≈ 3.1 · P95 = 15 · FIFO</text>')
    o += box(576, 128, 200, 104, "focal", tag="SERVICE", title="ห้องจ่ายยา", subs=("c = 7 slot · S = 5.8 min", "μ = 10.3 / hr / slot", "ρ = 84%"), title_dy=40)
    o += box(864, 152, 200, 56, "io", title="รับยาแล้ว · กลับบ้าน", subs=("W ≈ 8.8 min",), title_dy=26)
    o += box(576, 292, 200, 56, "opt", title="ออกก่อนได้รับบริการ", subs=("reneging / LWBS",), title_dy=26)
    # data-capture markers
    o += marker_dot(272, 128, "1", "t_arrive")
    o += marker_dot(576, 128, "2", "t_start")
    o += marker_dot(776, 128, "3", "t_end")
    o += marker_dot(776, 292, "4", "t_leave")
    o += legend(380, [("io", "ต้นทาง / ปลายทาง"), ("store", "คิวรอ"), ("focal", "หน่วยบริการที่วิเคราะห์"), ("dot", "จุดบันทึกเวลา"), ("dash", "ออกจากคิว")], W)
    title = "ตัวอย่าง service: ห้องจ่ายยาและจุดเก็บข้อมูลคิว"
    desc = "ผู้ป่วยจาก OPD ทันตกรรม/ผ่าตัด และ ER รวม 61 รายต่อชั่วโมงเข้าคิวหน้าห้องจ่ายยาที่มี 7 ช่องบริการ โดยระบุจุดบันทึกเวลามาถึง เริ่มบริการ เสร็จบริการ และออกจากคิวก่อนได้รับบริการ"
    return svg(p, W, H, title, desc, o)


# ---------------------------------------------------------------- diagram 2
STAGES = [
    ("01", "เก็บข้อมูล", "COLLECT",
     ["ตู้กดบัตรคิว / HIS", "ระบบคิวเรียกชื่อ", "ตารางเวรเจ้าหน้าที่"],
     ["บันทึกเวลา ①–④", "ทุกผู้ป่วย ทุกหน่วย", "ต่อเนื่อง 2–4 สัปดาห์", "แยกวัน / ชั่วโมง"],
     ["Event log", "case · station", "t_arrive … t_end"]),
    ("02", "เตรียมข้อมูล", "CLEAN",
     ["Event log ดิบ"],
     ["ลบค่าซ้ำ / ผิดปกติ", "Wq = ② − ①", "S = ③ − ②", "เรียงเส้นทางผู้ป่วย", "(process mining)"],
     ["ตารางเวลารอ", "และเวลาบริการ", "เส้นทาง + ความถี่"]),
    ("03", "ประมาณค่า", "ESTIMATE",
     ["ตารางเวลารอ/บริการ", "เส้นทางผู้ป่วย"],
     ["λ = มาถึง ÷ ชั่วโมง", "μ = 1 ÷ S เฉลี่ย", "CV² = Var(S) ÷ S̄²", "c = slot ที่เปิดจริง", "visit ratio ต่อหน่วย"],
     ["λ, μ, c, CV²", "รายหน่วย รายชั่วโมง"]),
    ("04", "สร้างแบบจำลอง", "MODEL",
     ["λ, μ, c, CV²", "เส้นทาง (routing)"],
     ["ρ = λ ÷ cμ", "Erlang-C → P(รอ)", "Lq, Wq (M/M/c)", "M/G/c, Jackson net", "หรือ DES"],
     ["ρ, Wq, Lq, P95", "ต่อหน่วย / process"]),
    ("05", "ตรวจสอบ", "VALIDATE",
     ["ผลแบบจำลอง", "Wq ที่วัดได้จริง"],
     ["เทียบ Wq จริง", "กับแบบจำลอง", "ตรวจ L = λW", "คลาดเคลื่อน < 15%"],
     ["แบบจำลองที่", "เชื่อถือได้"]),
    ("06", "ทดลอง what-if", "DECIDE",
     ["แบบจำลองที่", "ผ่านการตรวจ"],
     ["หา c ขั้นต่ำ", "ลด S หรือ CV²", "กระจายนัด (ลด λ)", "ประเมินคิวสูงสุด"],
     ["คอขวด, slot, เวร", "เก้าอี้รอ, เป้าเวลา"]),
]


def diagram_pipeline():
    W, H, p = 1104, 540, "pipe"
    X = [112 + i * 164 for i in range(6)]
    CW = 144
    HY, HH = 56, 56
    ROWS = [("INPUT", "ข้อมูลเข้า", 136, 88), ("METHOD", "วิธีวิเคราะห์", 240, 120), ("OUTPUT", "ผลที่ได้", 376, 72)]
    o = [f'<rect width="100%" height="100%" fill="{PAPER}"/>']
    # row bands + labels
    for i, (en, th, y, h) in enumerate(ROWS):
        if i == 1:
            o.append(f'<rect x="16" y="{y - 8}" width="{W - 32}" height="{h + 16}" fill="rgba(45,49,66,0.025)"/>')
        o.append(f'<text x="20" y="{y + 16}" fill="{SOFT}" font-size="8" font-family="{MONO}" letter-spacing="0.14em">{en}</text>')
        o.append(f'<text x="20" y="{y + 36}" fill="{INK}" font-size="12" font-weight="600" font-family="{SANS}">{th}</text>')
    # arrows (header → header) + feedback loop
    for i in range(5):
        o.append(arrow(p, f"M{X[i] + CW},{HY + 28} H{X[i + 1] - 1}", "accent" if i == 2 else "default"))
    c5, c3 = X[4] + CW // 2, X[2] + CW // 2
    o.append(arrow(p, f"M{c5},{HY} V40 Q{c5},32 {c5 - 8},32 H{c3 + 8} Q{c3},32 {c3},40 V{HY - 1}", dashed=True))
    o += label((c5 + c3) // 2, 24, "ปรับเทียบพารามิเตอร์", 132)
    # headers + cells
    for i, (num, th, en, inp, meth, out) in enumerate(STAGES):
        kind = "focal" if num == "04" else "step"
        o += box(X[i], HY, CW, HH, kind, tag=num, title=th, subs=(en,), title_dy=32)
        for (rk, _, y, h), lines in zip(ROWS, (inp, meth, out)):
            ck = "focal" if (num == "04" and rk == "METHOD") else "step"
            fill = ACCENT_TINT if ck == "focal" else "#ffffff"
            stroke = ACCENT if ck == "focal" else RULE
            o.append(f'<rect x="{X[i]}" y="{y}" width="{CW}" height="{h}" rx="6" fill="{PAPER}"/>')
            o.append(f'<rect x="{X[i]}" y="{y}" width="{CW}" height="{h}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="1"/>')
            for j, ln in enumerate(lines):
                o.append(f'<text x="{X[i] + 12}" y="{y + 24 + j * 18}" fill="{INK if rk != "INPUT" else MUTED}" font-size="12" font-family="{SANS}">{ln}</text>')
    o += legend(500, [("step", "ขั้นตอนวิเคราะห์"), ("focal", "หัวใจของการวิเคราะห์คิว"), ("dash", "วนกลับเพื่อปรับเทียบ")], W)
    title = "ขั้นตอนนำข้อมูลมาวิเคราะห์คิว"
    desc = "กระบวนการ 6 ขั้นจากการเก็บเวลาในแต่ละหน่วย เตรียมข้อมูล ประมาณค่า λ μ c สร้างแบบจำลองคิว ตรวจสอบกับข้อมูลจริง และทดลอง what-if เพื่อหาคอขวดและจำนวน slot โดยแต่ละขั้นระบุข้อมูลเข้า วิธีวิเคราะห์ และผลที่ได้"
    return svg(p, W, H, title, desc, o)


def svg(p, W, H, title, desc, body):
    inner = "\n    ".join(body)
    return f"""<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="{p}-title {p}-desc">
    <title id="{p}-title">{title}</title>
    <desc id="{p}-desc">{desc}</desc>
    {defs(p)}
    {inner}
    </svg>"""


# ---------------------------------------------------------------- page content
COMMON_FIELDS = [
    ("case_id / visit_id", "รหัสการมารับบริการ (แปลง HN เป็นรหัสนิรนามตาม PDPA)", "เชื่อมทุกเหตุการณ์ของผู้ป่วยคนเดียวกันเป็นเส้นทาง", "ทุกครั้ง"),
    ("process / ประเภทผู้ป่วย", "OPD, ER, ตรวจสุขภาพ, นัด/walk-in", "แยก λ ตามกลุ่ม หา routing ของแต่ละ process", "ทุกครั้ง"),
    ("station", "หน่วยบริการที่เกิดเหตุการณ์", "รวมข้อมูลเป็นรายหน่วย", "ทุกครั้ง"),
    ("① t_arrive", "เวลามาถึงคิว (กดบัตร / ส่งแฟ้ม / e-order ถึง)", "อัตรามาถึง λ, inter-arrival, เวลารอ", "ทุกครั้ง"),
    ("② t_start", "เวลาที่ถูกเรียกหรือเริ่มให้บริการ", "เวลารอ Wq = ② − ①", "ทุกครั้ง"),
    ("③ t_end", "เวลาเสร็จบริการ", "service time S = ③ − ②, utilization", "ทุกครั้ง"),
    ("④ t_leave", "เวลาที่ออกจากคิวก่อนได้รับบริการ (ถ้ามี)", "อัตราละทิ้งคิว (reneging / LWBS)", "ถ้าเกิด"),
    ("server_id", "เคาน์เตอร์ / ห้อง / เตียง / ผู้ให้บริการ", "นับ slot ที่ใช้จริง และความต่างระหว่างผู้ให้บริการ", "ทุกครั้ง"),
    ("priority", "ระดับความเร่งด่วน เช่น ESI 1–5, ผู้สูงอายุ", "แยกคิวตามลำดับความสำคัญ", "ถ้ามี"),
    ("จำนวน slot ที่เปิดรายชั่วโมง (c)", "จากตารางเวรหรือ log การเปิด-ปิดช่องบริการ", "capacity จริง c(t)", "ทุกวัน"),
    ("ขีดจำกัด slot / จำนวนเก้าอี้รอ", "พื้นที่ อุปกรณ์ บุคลากรสูงสุด", "ตัดสินว่าแก้ด้วยการเพิ่ม slot ได้หรือไม่", "ครั้งเดียว"),
    ("เวลาเปิด-ปิดบริการ", "ช่วงเวลาที่รับผู้ป่วย", "ประเมินคิวสะสมสิ้นวันเมื่อ ρ ≥ 1", "ครั้งเดียว"),
]

PER_SERVICE = [
    ("ลงทะเบียน / เวชระเบียน", "REG", "กดบัตรคิว", "เรียกเข้าเคาน์เตอร์", "พิมพ์ใบนำทาง", "ผู้ป่วยใหม่/เก่า, สิทธิการรักษา, นัด/walk-in", "ตู้กดบัตรคิว, HIS"),
    ("คัดกรอง / ซักประวัติ", "TRI", "แฟ้มถึงจุดคัดกรอง", "เรียกชื่อ", "บันทึก vital sign เสร็จ", "จำนวนจุดคัดกรอง, ระดับความเร่งด่วน", "HIS (nurse note)"),
    ("ห้องตรวจแพทย์", "DOC", "เข้าคิวแพทย์", "แพทย์เปิด visit", "ปิด visit / สั่ง order", "คลินิก, แพทย์, เวลาเริ่มออกตรวจจริง, รอบแรก/รอบฟังผล, no-show", "EMR, ระบบนัด"),
    ("Lab / จุดเจาะเลือด", "LAB", "order ถึงจุดเจาะ", "เริ่มเจาะ", "เจาะเสร็จ", "ชนิดการตรวจ, เวลาผลออก (turnaround time)", "LIS, barcode"),
    ("รังสีวิทยา", "XRY", "ลงทะเบียนที่รังสี", "เข้าห้องถ่ายภาพ", "ถ่ายเสร็จ", "modality, เคส ER แทรกคิว, เวลารายงานผล", "RIS / PACS"),
    ("EKG", "EKG", "ถึงห้อง EKG", "เริ่มตรวจ", "ตรวจเสร็จ", "จำนวนเครื่อง, เจ้าหน้าที่", "HIS"),
    ("หัตถการ / วัคซีน", "PRC", "ถึงห้องหัตถการ", "เริ่มทำ", "ทำเสร็จ", "ชนิดหัตถการ (เวลาต่างกันมาก ควรแยกกลุ่ม)", "HIS"),
    ("ER Triage / ห้องฉุกเฉิน", "ERT · ER", "มาถึงประตู (door)", "คัดแยกเสร็จ / พบแพทย์", "จำหน่าย / admit", "ESI 1–5, ทางมา (EMS/walk-in), กลับก่อนพบแพทย์ (LWBS)", "ER log, HIS"),
    ("ทันตกรรม / กายภาพ", "DEN · PT", "check-in", "เริ่มทำ", "ทำเสร็จ", "นัด vs walk-in, ชนิดงาน, จำนวนยูนิต/เตียง", "ระบบนัด"),
    ("เตรียมผ่าตัด / OR / PACU", "ANE · OR · PACU", "ถึงห้องผ่าตัด", "เริ่มผ่าตัด", "ออกจากห้อง", "เวลาที่จอง vs จริง, turnover, ยกเลิกเคส, เวลาเข้า/ออก PACU", "OR management"),
    ("Admit / หอผู้ป่วย", "ADM · WARD", "ขอเตียง", "ได้เตียง", "ผู้ป่วยถึงหอ", "เตียงว่างรายชั่วโมง, LOS, เวลาจำหน่าย", "ADT / bed board"),
    ("การเงิน", "CSH", "ค่าใช้จ่ายถึงการเงิน", "เรียกคิว", "ชำระเสร็จ", "สิทธิ (จ่ายเอง/เบิกได้), วิธีชำระ", "HIS billing"),
    ("ห้องจ่ายยา", "PHA", "ใบสั่งยาถึงห้องยา", "เรียกรับยา", "จ่ายยาเสร็จ", "จำนวนรายการยา, ยาเดิม/ยาใหม่, เวลาจัดยา vs ให้คำแนะนำ", "HIS pharmacy, จอเรียกคิว"),
]

ANALYSES = [
    ("A1", "ค้นหา workflow จริง (Process mining)",
     "นำ event log มาจัดกลุ่มตาม case_id เรียงตามเวลา จะได้ลำดับหน่วยที่ผู้ป่วยแต่ละคนผ่าน นับรูปแบบเส้นทาง (variant) ที่พบบ่อย แล้วคำนวณความน่าจะเป็นที่ผู้ป่วยไปต่อจากหน่วย i ไปหน่วย j",
     "p<sub>ij</sub> = จำนวนครั้ง i→j ÷ จำนวนครั้งที่ออกจาก i",
     "แผนผัง workflow (เช่น swimlane), เส้นทางของแต่ละ process, จำนวนครั้งที่ผู้ป่วยกลับมาหน่วยเดิม (เช่น พบแพทย์รอบฟังผล)"),
    ("A2", "วิเคราะห์การมาถึง (Arrival)",
     "นับจำนวน ① ในแต่ละชั่วโมงของแต่ละหน่วย หาค่าเฉลี่ยรายชั่วโมงของแต่ละวันในสัปดาห์ แล้วตรวจว่าการมาถึงเป็นแบบสุ่ม (Poisson) หรือไม่ จากระยะห่างระหว่างผู้มาถึง",
     "λ = จำนวนผู้มาถึง ÷ ชั่วโมง ; ถ้า SD ของ inter-arrival ≈ ค่าเฉลี่ย (CV ≈ 1) → Poisson",
     "λ(t) รายชั่วโมง, ชั่วโมงพีค, ความผันผวนรายวัน"),
    ("A3", "วิเคราะห์เวลาให้บริการ (Service time)",
     "คำนวณ S = ③ − ② ของทุกราย หาค่าเฉลี่ย ส่วนเบี่ยงเบนมาตรฐาน และเปอร์เซ็นไทล์ แยกตามประเภทงานหรือผู้ให้บริการ เพื่อดูว่าความแปรปรวนมาจากไหน",
     "μ = 1 ÷ S̄ ; CV² = Var(S) ÷ S̄²",
     "service time เฉลี่ย, ความแปรปรวน (เลือกแบบจำลอง M/M/c หรือ M/G/c), หน่วยที่เวลาไม่สม่ำเสมอ"),
    ("A4", "ความสามารถรองรับและ utilization",
     "เทียบภาระที่เข้ามากับความสามารถของหน่วย ถ้า ρ ≥ 1 แปลว่ารับไม่ไหว คิวจะยาวขึ้นเรื่อย ๆ หน่วยที่ ρ สูงที่สุดคือคอขวด",
     "capacity = c × 60 ÷ S̄ (ราย/ชม.) ; ρ = λ ÷ (c·μ)",
     "คอขวดของระบบ, หน่วยที่ใช้ทรัพยากรน้อยเกินไป (ρ < 50%)"),
    ("A5", "เวลารอและความยาวคิว (M/M/c)",
     "ใช้สูตร Erlang-C หาความน่าจะเป็นที่ผู้ป่วยต้องรอ แล้วคำนวณความยาวคิวและเวลารอเฉลี่ย ถ้าเวลาให้บริการไม่ใช่ exponential ให้คูณด้วย (1 + CV²) / 2",
     "L<sub>q</sub> = P<sub>wait</sub>·ρ/(1−ρ) ; W<sub>q</sub> = L<sub>q</sub>/λ ; W = W<sub>q</sub> + S̄",
     "เวลารอเฉลี่ย, จำนวนคนรอเฉลี่ย, เวลาอยู่ในหน่วยทั้งหมด"),
    ("A6", "ค่าสูงสุดที่ควรเตรียมรับ (percentile)",
     "ค่าเฉลี่ยไม่พอสำหรับวางแผนพื้นที่ จึงหาค่าที่ 95% ของเวลาจะไม่เกิน ใช้กำหนดจำนวนเก้าอี้รอและเป้าเวลารอ",
     "P(N<sub>q</sub> ≥ n) = P<sub>wait</sub>·ρ<sup>n</sup> ; P(W<sub>q</sub> > t) = P<sub>wait</sub>·e<sup>−(cμ−λ)t</sup>",
     "คิวสูงสุด (P95), เวลารอสูงสุด (P95), จำนวนเก้าอี้ ≈ คิว P95 × 1.5 (รวมญาติ)"),
    ("A7", "โครงข่ายคิวและเวลารวมของแต่ละ process",
     "แต่ละหน่วยรับผู้ป่วยจากหลาย process รวมกัน จึงต้องคำนวณ λ ของแต่ละหน่วยจากเส้นทาง แล้วรวมเวลาของทุกหน่วยตามเส้นทาง ถ้าหน่วยต้นทางรับไม่ไหว หน่วยปลายทางจะได้รับผู้ป่วยน้อยลง",
     "λ<sub>j</sub> = λ<sub>0j</sub> + Σ<sub>i</sub> λ<sub>i</sub>·p<sub>ij</sub> ; เวลารวม = Σ W ตามเส้นทาง",
     "เวลาที่ผู้ป่วยแต่ละ process อยู่ในโรงพยาบาล, process ที่สร้างภาระให้คอขวดมากที่สุด"),
    ("A8", "สภาวะล้นระบบ (ρ ≥ 1)",
     "สูตรสภาวะคงตัวใช้ไม่ได้เมื่อ ρ ≥ 1 จึงใช้การประมาณแบบของไหล (fluid) คิวจะเพิ่มขึ้นในอัตราที่ผู้มาเกินกำลังบริการตลอดช่วงเปิดให้บริการ",
     "คิว ณ เวลา T ≈ (λ − cμ) × T ; รอของคนสุดท้าย ≈ คิว ÷ (cμ)",
     "แถวคอยสูงสุดเมื่อแก้ไขไม่ได้, เวลาที่ต้องเปิดบริการเกินเวลา"),
    ("A9", "หาจำนวน slot และทางเลือกปรับปรุง (what-if)",
     "ทดลองเพิ่ม c ทีละ 1 จนกว่า W<sub>q</sub> ≤ เป้าหมาย และ ρ ≤ 85% ถ้าเกินขีดจำกัดพื้นที่ ให้หา service time ที่ต้องลดลง หรือจำนวนผู้ป่วยที่ต้องย้ายไปช่วงอื่น",
     "c ขั้นต่ำ ; กฎรากที่สอง c ≈ a + β√a (a = λ/μ) ; λ<sub>max</sub> = 0.85·c·μ",
     "จำนวน slot ที่ต้องเปิด, เป้าลดเวลาให้บริการ, จำนวนนัดที่ต้องกระจาย"),
    ("A10", "แบ่งช่วงเวลา (time-varying / SIPP)",
     "ผู้ป่วยมาไม่เท่ากันทั้งวัน จึงแบ่งวันเป็นช่วงละ 1 ชั่วโมง ใช้ λ(t) และ c(t) ของแต่ละช่วงคำนวณแยกกัน แล้วจัดเวรให้ตรงกับช่วงพีค",
     "คำนวณ M/M/c แยกทุกช่วง t ด้วย λ(t), c(t)",
     "ตารางเวรรายชั่วโมง, ชั่วโมงที่ต้องเปิดช่องเพิ่ม"),
    ("A11", "ตรวจสอบแบบจำลอง (Validation)",
     "เทียบ W<sub>q</sub> ที่วัดได้จริง (② − ①) กับค่าจากแบบจำลอง และตรวจ Little's law จากข้อมูลจริง ถ้าต่างกันมาก ให้กลับไปตรวจข้อมูลหรือสมมติฐาน เช่น มีผู้ป่วยแซงคิวหรือเปิดช่องไม่ครบ",
     "L = λ·W ; ความคลาดเคลื่อน = |W<sub>q</sub> จริง − W<sub>q</sub> แบบจำลอง| ÷ W<sub>q</sub> จริง",
     "ความเชื่อมั่นว่าแบบจำลองใช้ทำนายได้"),
    ("A12", "จำลองเหตุการณ์ไม่ต่อเนื่อง (DES)",
     "เมื่อระบบมีเงื่อนไขที่สูตรรองรับไม่ได้ เช่น คิวตามลำดับความสำคัญ ผู้ป่วยละทิ้งคิว หรือเปลี่ยนจำนวน slot ระหว่างวัน ให้จำลองผู้ป่วยทีละรายด้วยตัวเลขสุ่ม แล้ววัดผลแบบเดียวกับข้อมูลจริง",
     "สุ่ม inter-arrival ~ Exp(λ), S ~ การกระจายที่วัดได้ แล้ววัดผลซ้ำหลายรอบ",
     "ผลที่สมจริงขึ้นและภาพเคลื่อนไหว (แท็บจำลอง 3D ของระบบนี้)"),
]

QUESTIONS = [
    ("หน่วยไหนเป็นคอขวด", "A4", "หน่วยที่ ρ สูงสุด หรือ ρ ≥ 1", "ก่อนปรับ: ห้องยา ρ 110% (รับได้ 55 ราย/ชม. แต่มี 61 ราย/ชม.)"),
    ("ผู้ป่วยต้องรอนานแค่ไหน (เฉลี่ยและกรณีแย่)", "A5, A6", "W<sub>q</sub> เฉลี่ย และ W<sub>q</sub> P95", "ห้องยาหลังปรับ: เฉลี่ย 3 นาที, 95% รอไม่เกิน 13 นาที"),
    ("คิวยาวที่สุดกี่คน ต้องมีเก้าอี้กี่ตัว", "A6", "คิว P95 × 1.5", "ห้องยา: คิว P95 = 15 คน → เก้าอี้ ≈ 23 ตัว"),
    ("ต้องเปิดกี่ช่องบริการ", "A9, A10", "c ขั้นต่ำที่ทำให้ W<sub>q</sub> ≤ เป้า และ ρ ≤ 85%", "X-ray: 3 → 4 เครื่อง (รอ 24 → 3 นาที)"),
    ("ถ้าเพิ่ม slot ไม่ได้ ต้องลดเวลาให้บริการเท่าไร", "A9", "หา S ที่ผ่านเป้าด้วย c สูงสุด", "ห้องยา: 6.5 → 5.8 นาที (−11%) ร่วมกับ 7 ช่อง"),
    ("รับผู้ป่วยได้สูงสุดกี่รายต่อชั่วโมง", "A4, A9", "λ<sub>max</sub> = ρ<sub>max</sub> × c × μ", "ห้องยา 7 ช่อง: ≈ 61.6 ราย/ชม. ที่ ρ 85%"),
    ("ถ้าไม่แก้ไข คิวสิ้นวันเท่าไร", "A8", "(λ − cμ) × ชั่วโมงเปิด", "ห้องยาก่อนปรับ: +5.6 คน/ชม. → ≈ 45 คนเมื่อครบ 8 ชม."),
    ("ผู้ป่วยแต่ละ process อยู่ในโรงพยาบาลนานเท่าไร", "A7", "Σ W ตามเส้นทาง", "ตรวจโรค + เอกซเรย์: 1 ชม. 29 นาที → 58 นาที"),
    ("การลดความแปรปรวนช่วยได้แค่ไหน", "A3, A5", "W<sub>q</sub> × (1 + CV²)/2", "ห้องยา: เวลาจ่ายยาคงที่ (CV² = 0) รอ 3.0 → 1.5 นาที"),
    ("ช่วงเวลาไหนต้องเพิ่มเจ้าหน้าที่", "A2, A10", "ρ(t) รายชั่วโมง", "ใช้ λ รายชั่วโมงจากข้อมูลจริง (ระบบนี้ใช้ค่าเฉลี่ยทั้งวัน)"),
    ("หน่วยไหนมีทรัพยากรเกินจำเป็น", "A4", "ρ < 50% ต่อเนื่อง", "PACU ρ 25% → ย้ายพยาบาลไปช่วยหน่วยอื่นได้"),
    ("แบบจำลองเชื่อถือได้หรือไม่", "A11", "เทียบ W<sub>q</sub> จริงกับแบบจำลอง", "ระบบนี้เทียบสูตรกับ DES ในคอลัมน์ DES ของตาราง"),
]

CAVEATS = [
    ("ภาระเปลี่ยนตามเวลา", "ค่าเฉลี่ยทั้งวันซ่อนชั่วโมงพีค ควรวิเคราะห์รายชั่วโมง (A10)"),
    ("การมาถึงไม่สุ่ม", "ผู้ป่วยนัดมาตรงเวลา ทำให้ CV ของการมาถึงต่ำกว่า 1 และสูตร Poisson จะประเมินเวลารอสูงเกินจริง"),
    ("ลำดับความสำคัญ", "ER ใช้ ESI ไม่ใช่มาก่อนได้ก่อน ควรแยกคิวตามระดับหรือใช้ DES"),
    ("ละทิ้งคิว / กลับก่อน", "ถ้ามีผู้ป่วยกลับก่อนมาก เวลารอที่วัดได้จะต่ำกว่าความต้องการจริง ต้องเก็บ ④"),
    ("ข้อมูลไม่ครบ", "timestamp ที่บันทึกย้อนหลังหรือกดพร้อมกันหลายราย ทำให้ S ผิด ต้องตรวจในขั้นเตรียมข้อมูล"),
    ("ขนาดตัวอย่าง", "ควรมีอย่างน้อย 100–200 รายต่อหน่วยต่อช่วงเวลา และเก็บ 2–4 สัปดาห์ให้ครอบคลุมทุกวันในสัปดาห์"),
    ("ความเป็นส่วนตัว", "แปลง HN เป็นรหัสนิรนามก่อนวิเคราะห์ และเก็บเฉพาะข้อมูลที่จำเป็นตาม PDPA"),
]


def table(head, rows, cls=""):
    th = "".join(f"<th>{h}</th>" for h in head)
    tr = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'<div class="tw"><table class="{cls}"><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table></div>'


def page():
    common = table(["ข้อมูล", "ความหมาย / วิธีเก็บ", "นำไปใช้ทำอะไร", "ความถี่"],
                   [(f'<span class="mono">{a}</span>' if a[0] in "①②③④" or "_" in a else a, b, c, d) for a, b, c, d in COMMON_FIELDS])
    per = table(["Service", "รหัส", "① มาถึง", "② เริ่มบริการ", "③ เสร็จ", "ข้อมูลเพิ่มเติมเฉพาะหน่วย", "แหล่งข้อมูล"],
                [(a, f'<span class="mono">{b}</span>', c, d, e, f, g) for a, b, c, d, e, f, g in PER_SERVICE], "per")
    analyses = "".join(f"""
      <article class="an" id="{k}">
        <header><span class="k mono">{k}</span><h3>{t}</h3></header>
        <p>{how}</p>
        <p class="f">{f}</p>
        <p class="o"><b>ผลที่ได้:</b> {out}</p>
      </article>""" for k, t, how, f, out in ANALYSES)
    qs = table(["คำถามที่การวิเคราะห์ตอบได้", "การวิเคราะห์", "วิธีหาคำตอบ", "ตัวอย่างจากระบบนี้"],
               [(a, " ".join(f'<a href="#{x.strip()}">{x.strip()}</a>' for x in b.split(",")), c, d) for a, b, c, d in QUESTIONS], "qs")
    cav = "".join(f"<li><b>{a}</b> — {b}</li>" for a, b in CAVEATS)
    return f"""<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ทฤษฎีการวิเคราะห์คิว</title>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&family=Noto+Sans+Thai:wght@400;500;600&family=Noto+Serif+Thai:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    :root {{ --paper:#f5f5f5; --ink:#2d3142; --muted:#4f5d75; --soft:#7a8399; --accent:#eb6c36; --link:#2e5aa8; --rule:rgba(45,49,66,0.12);
      --sans:'Geist','Noto Sans Thai',system-ui,sans-serif; --serif:'Instrument Serif','Noto Serif Thai',serif; --mono:'Geist Mono','Noto Sans Thai',ui-monospace,monospace; }}
    body {{ font-family: var(--sans); background: var(--paper); color: var(--ink); line-height: 1.7; font-size: 15px; }}
    .top {{ position: sticky; top: 0; z-index: 5; background: rgba(245,245,245,.94); backdrop-filter: blur(6px); border-bottom: 1px solid var(--rule); }}
    .top .in {{ max-width: 1180px; margin: 0 auto; padding: 10px 24px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap; font-size: 13px; }}
    .top a {{ color: var(--muted); text-decoration: none; }} .top a:hover {{ color: var(--accent); }}
    .top .back {{ font-weight: 600; color: var(--ink); margin-right: auto; }}
    .frame {{ max-width: 1180px; margin: 0 auto; padding: 2.5rem 24px 4rem; }}
    .eyebrow {{ font-family: var(--mono); font-size: .66rem; font-weight: 500; letter-spacing: .18em; text-transform: uppercase; color: var(--muted); margin-bottom: .5rem; }}
    h1 {{ font-family: var(--serif); font-size: clamp(1.7rem, 2.6vw + .8rem, 2.4rem); font-weight: 400; line-height: 1.3; margin-bottom: .6rem; }}
    h2 {{ font-family: var(--serif); font-size: 1.6rem; font-weight: 400; margin: 3rem 0 .4rem; line-height: 1.35; }}
    h2 .n {{ font-family: var(--mono); font-size: .8rem; color: var(--accent); vertical-align: middle; margin-right: .5rem; letter-spacing: .1em; }}
    .lede {{ color: var(--muted); max-width: 75ch; }}
    p + p {{ margin-top: .6rem; }}
    .scroll {{ overflow-x: auto; margin-top: 1.25rem; }}
    svg {{ width: 100%; min-width: 960px; display: block; }}
    .cards {{ display: grid; grid-template-columns: 1.15fr 1fr .85fr; gap: 16px; margin-top: 1.25rem; }}
    .card {{ background: #fff; border: 1px solid var(--rule); border-radius: 6px; padding: 1.25rem; }}
    .card h3 {{ font-size: 1rem; margin-bottom: .4rem; display: flex; gap: 8px; align-items: center; }}
    .dot {{ width: 7px; height: 7px; border-radius: 50%; display: inline-block; }}
    .card ul, .card ol {{ padding-left: 1.2rem; color: var(--muted); font-size: .92rem; }}
    .kendall {{ font-family: var(--mono); font-size: 1.1rem; background: #fff; border: 1px solid var(--rule); border-radius: 6px; padding: .8rem 1rem; display: inline-block; margin: .6rem 0; }}
    .tw {{ overflow-x: auto; margin-top: 1rem; background: #fff; border: 1px solid var(--rule); border-radius: 6px; }}
    table {{ width: 100%; border-collapse: collapse; font-size: .9rem; }}
    th {{ text-align: left; font-weight: 600; color: var(--muted); font-size: .8rem; padding: .6rem .8rem; border-bottom: 1px solid var(--rule); background: #fafafa; white-space: nowrap; }}
    td {{ padding: .55rem .8rem; border-bottom: 1px solid var(--rule); vertical-align: top; }}
    tr:last-child td {{ border-bottom: 0; }}
    table.per td:nth-child(3), table.per td:nth-child(4), table.per td:nth-child(5) {{ color: var(--link); white-space: nowrap; }}
    table.qs td:first-child {{ font-weight: 600; }}
    table.qs a {{ font-family: var(--mono); font-size: .8rem; color: var(--accent); text-decoration: none; margin-right: 4px; }}
    .mono {{ font-family: var(--mono); font-size: .88em; }}
    .ans {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px; margin-top: 1rem; }}
    .an {{ background: #fff; border: 1px solid var(--rule); border-radius: 6px; padding: 1rem 1.1rem; scroll-margin-top: 70px; }}
    .an header {{ display: flex; gap: 10px; align-items: baseline; margin-bottom: .4rem; }}
    .an .k {{ color: var(--accent); font-weight: 600; }}
    .an h3 {{ font-size: 1rem; }}
    .an p {{ font-size: .9rem; color: var(--muted); }}
    .an .f {{ font-family: var(--mono); font-size: .82rem; background: var(--paper); border-radius: 4px; padding: .45rem .6rem; color: var(--ink); }}
    .an .o b {{ color: var(--ink); }}
    .aside {{ font-family: var(--serif); font-style: italic; color: var(--muted); font-size: 1.05rem; border-left: 2px solid var(--accent); padding-left: 1rem; margin: 1rem 0; max-width: 75ch; }}
    .ex {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 1rem; }}
    .ex div {{ background: #fff; border: 1px solid var(--rule); border-radius: 6px; padding: .7rem .9rem; font-size: .82rem; color: var(--muted); }}
    .ex b {{ display: block; font-family: var(--mono); font-size: 1.1rem; color: var(--ink); }}
    .ex .hl {{ border-color: var(--accent); }}
    ul.cav {{ padding-left: 1.2rem; color: var(--muted); max-width: 85ch; }}
    ul.cav li {{ margin: .3rem 0; }}
    ul.cav b {{ color: var(--ink); }}
    footer {{ margin-top: 3rem; padding-top: .8rem; border-top: 1px solid var(--rule); font-family: var(--mono); font-size: .7rem; color: var(--soft); }}
    @media (max-width: 860px) {{ .cards {{ grid-template-columns: 1fr; }} }}
  </style>
</head>
<body>
  <nav class="top"><div class="in">
    <a class="back" href="index.html">← กลับหน้าหลัก SmartHospital</a>
    <a href="#s1">พื้นฐาน</a><a href="#s2">ตัวอย่าง service</a><a href="#s3">ข้อมูลที่ต้องเก็บ</a><a href="#s4">ขั้นตอนวิเคราะห์</a><a href="#s5">การวิเคราะห์แต่ละแบบ</a><a href="#s6">ผลลัพธ์ที่ได้</a><a href="#s7">ข้อควรระวัง</a>
  </div></nav>
  <div class="frame">
    <p class="eyebrow">Theory · Workflow &amp; Queue analysis</p>
    <h1>ทฤษฎีการวิเคราะห์ workflow และแถวคอย<br>ต้องเก็บข้อมูลอะไร นำไปวิเคราะห์อย่างไร และได้คำตอบอะไร</h1>
    <p class="lede">ใช้ได้กับทุกระบบที่มีผู้รับบริการมารอรับบริการ เช่น โรงพยาบาล ธนาคาร ศูนย์บริการ ร้านอาหาร หรือ call center ตัวอย่างในหน้านี้ใช้ค่าจริงจากแบบจำลองโรงพยาบาลของระบบนี้</p>

    <h2 id="s1"><span class="n">01</span>พื้นฐาน: workflow กับ queue</h2>
    <p><b>Workflow analysis</b> ตอบว่าผู้รับบริการเดินผ่านหน่วยใดบ้าง เรียงลำดับอย่างไร และมีจุดส่งต่อกี่จุด <b>Queue analysis</b> ตอบว่าในแต่ละหน่วยผู้รับบริการต้องรอนานเท่าไร เพราะอะไร และต้องปรับอะไร ทุกจุดส่งต่อใน workflow คือคิวใหม่หนึ่งคิว ดังนั้นต้องวิเคราะห์ทั้งสองอย่างร่วมกัน</p>
    <p>แถวคอยหนึ่งหน่วยอธิบายด้วยสัญลักษณ์ของ Kendall</p>
    <div class="kendall">A / S / c / K / N / D</div>
    <div class="cards">
      <div class="card"><p class="eyebrow">ความหมาย</p><h3><span class="dot" style="background:var(--ink)"></span>สัญลักษณ์ Kendall</h3>
        <ul><li><b>A</b> รูปแบบการมาถึง (M = Poisson, G = ทั่วไป)</li><li><b>S</b> การกระจายของเวลาให้บริการ (M = exponential, D = คงที่, G = ทั่วไป)</li><li><b>c</b> จำนวนช่องบริการ (service slot)</li><li><b>K</b> ความจุของคิว · <b>N</b> ขนาดประชากร · <b>D</b> กฎการเรียก (FIFO, priority)</li></ul></div>
      <div class="card"><p class="eyebrow">พารามิเตอร์หลัก</p><h3><span class="dot" style="background:var(--accent)"></span>3 ค่าที่ต้องรู้</h3>
        <ul><li><b>λ</b> อัตรามาถึง (ราย/ชม.)</li><li><b>μ</b> อัตราให้บริการต่อ slot = 1 ÷ เวลาให้บริการเฉลี่ย</li><li><b>c</b> จำนวน slot ที่เปิดจริง</li><li>ได้ <b>ρ = λ ÷ (c·μ)</b> ซึ่งต้องน้อยกว่า 1</li></ul></div>
      <div class="card"><p class="eyebrow">กฎที่ใช้ได้เสมอ</p><h3><span class="dot" style="background:var(--link)"></span>Little's law</h3>
        <ul><li><b>L = λ · W</b></li><li>จำนวนคนในระบบ = อัตรามาถึง × เวลาที่อยู่ในระบบ</li><li>ใช้ได้โดยไม่ต้องสมมติการกระจาย จึงใช้ตรวจข้อมูลจริงได้</li></ul></div>
    </div>

    <h2 id="s2"><span class="n">02</span>ตัวอย่าง service: ห้องจ่ายยา</h2>
    <p>ผู้ป่วยจากหลายหน่วยไหลมารวมกันที่ห้องจ่ายยา จึงเป็นหน่วยที่มีภาระสูงสุดในโรงพยาบาลนี้ วงกลมสีน้ำเงิน ①–④ คือจุดที่ต้องบันทึกเวลาของผู้ป่วยทุกราย</p>
    <div class="scroll">{diagram_service()}</div>
    <div class="ex">
      <div>λ อัตรามาถึง<b>61 ราย/ชม.</b></div><div>S เวลาจ่ายยาเฉลี่ย<b>5.8 นาที</b></div><div>c ช่องจ่ายยา<b>7 ช่อง</b></div>
      <div class="hl">ρ = 61 ÷ (7 × 10.3)<b>84%</b></div><div>P(ต้องรอ) Erlang-C<b>58%</b></div><div>Lq คิวเฉลี่ย<b>3.1 คน</b></div><div>Wq รอเฉลี่ย<b>3.0 นาที</b></div><div>คิว P95<b>15 คน</b></div>
    </div>
    <p class="aside">เวลา 4 จุดนี้เพียงพอสำหรับคำนวณทุกค่าในหน้านี้: ① ใช้หา λ, ② − ① คือเวลารอ, ③ − ② คือเวลาให้บริการ และ ④ บอกว่ามีผู้ป่วยกี่คนที่รอไม่ไหว</p>

    <h2 id="s3"><span class="n">03</span>ข้อมูลที่ต้องเก็บ</h2>
    <p><b>ข้อมูลพื้นฐานที่ทุก service ต้องเก็บ</b> แบ่งเป็นข้อมูลต่อผู้ป่วยหนึ่งราย (event log) และข้อมูลของหน่วยบริการ</p>
    {common}
    <p style="margin-top:1.5rem"><b>ข้อมูลเฉพาะของแต่ละ service ในโรงพยาบาล</b> ระบุว่าเหตุการณ์ใดถือเป็น ①②③ ของแต่ละหน่วย และต้องเก็บอะไรเพิ่ม</p>
    {per}

    <h2 id="s4"><span class="n">04</span>นำข้อมูลมาทำอะไร: ขั้นตอนการวิเคราะห์คิว</h2>
    <p>ข้อมูลจากข้อ 03 ผ่าน 6 ขั้นตอนก่อนกลายเป็นคำแนะนำ ถ้าขั้นตรวจสอบพบว่าผลแบบจำลองไม่ตรงกับข้อมูลจริง ต้องย้อนกลับไปปรับค่าพารามิเตอร์</p>
    <div class="scroll">{diagram_pipeline()}</div>

    <h2 id="s5"><span class="n">05</span>การวิเคราะห์แต่ละแบบทำอย่างไร</h2>
    <p>แต่ละการวิเคราะห์ระบุวิธีทำ สูตร และผลที่ได้ ส่วนรหัส A1–A12 ใช้อ้างอิงในตารางผลลัพธ์ข้อ 06</p>
    <div class="ans">{analyses}</div>

    <h2 id="s6"><span class="n">06</span>ผลลัพธ์ที่การวิเคราะห์คิวหาคำตอบให้ได้</h2>
    {qs}

    <h2 id="s7"><span class="n">07</span>ข้อควรระวังและสมมติฐาน</h2>
    <ul class="cav">{cav}</ul>

    <footer>SmartHospital · Theory · ตัวเลขตัวอย่างมาจากแบบจำลองค่าเริ่มต้น (web/js/data.js) · สร้างจาก tools/gen_theory.py</footer>
  </div>
</body>
</html>
"""


STANDALONE = """<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&family=Noto+Sans+Thai:wght@400;500;600&family=Noto+Serif+Thai:wght@400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: 'Geist','Noto Sans Thai',sans-serif; background: #f5f5f5; color: #2d3142; padding: 2.5rem 1.5rem; }}
    .frame {{ max-width: 1180px; margin: 0 auto; }}
    .eyebrow {{ font-family: 'Geist Mono',monospace; font-size: .66rem; letter-spacing: .18em; text-transform: uppercase; color: #4f5d75; margin-bottom: .5rem; }}
    h1 {{ font-family: 'Instrument Serif','Noto Serif Thai',serif; font-size: 2rem; font-weight: 400; line-height: 1.3; margin-bottom: 1.5rem; }}
    .scroll {{ overflow-x: auto; }} svg {{ width: 100%; min-width: 960px; display: block; }}
  </style>
</head>
<body><div class="frame"><p class="eyebrow">{eyebrow}</p><h1>{title}</h1><div class="scroll">{svg}</div></div></body>
</html>
"""

if __name__ == "__main__":
    OUT.write_text(page(), encoding="utf-8")
    print("wrote", OUT)
    d = OUT.parent / "diagrams"
    for name, eyebrow, title, fn in [("theory-service", "Data flow · Fan-in queue", "ตัวอย่าง service: ห้องจ่ายยาและจุดเก็บข้อมูลคิว", diagram_service),
                                     ("theory-pipeline", "Process · Stage framework", "ขั้นตอนนำข้อมูลมาวิเคราะห์คิว", diagram_pipeline)]:
        (d / f"{name}.html").write_text(STANDALONE.format(title=title, eyebrow=eyebrow, svg=fn()), encoding="utf-8")
        print("wrote", d / f"{name}.html")
