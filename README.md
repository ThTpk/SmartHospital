# SmartHospital: ระบบจำลองการไหลของผู้ป่วย

เว็บสำหรับจำลองการใช้บริการในโรงพยาบาลแบบ 3D และวิเคราะห์คอขวดด้วยทฤษฎีแถวคอย (M/M/c)

## วิธีเปิดใช้งาน

เปิดออนไลน์ได้ที่ <https://thtpk.github.io/SmartHospital/> (GitHub Pages) หรือรันในเครื่อง:

```bash
python -m http.server 8765 --directory web
```

จากนั้นเปิด <http://localhost:8765>
(ถ้าดับเบิลคลิกเปิด `web/index.html` โดยตรงก็ใช้งานได้ แต่ต้องต่ออินเทอร์เน็ตเพื่อโหลด three.js และฟอนต์)

## โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `web/index.html` | แอปหลัก มี 4 แท็บ: จำลอง 3D, วิเคราะห์คิว, บริการ/ฝ่าย, Swimlane |
| `web/js/data.js` | ข้อมูลบริการ/ฝ่าย, หน่วยที่มีคิว (service time, slot), process และเส้นทาง |
| `web/js/queue.js` | วิเคราะห์ M/M/c (Erlang-C, Lq, Wq, คิว P95), จำกัดการไหลจากคอขวดต้นทาง และสร้างคำแนะนำ |
| `web/js/profile.js` | โปรไฟล์ผู้รับบริการ: ตัวอย่าง 6 แบบ, สัดส่วนผู้ป่วยแต่ละประเภท และจำนวนผู้มาใช้บริการรายชั่วโมง |
| `web/js/sim.js` | Discrete-event simulation ของผู้ป่วยแต่ละราย (อัตรามาถึงเปลี่ยนตามชั่วโมงด้วยวิธี thinning) |
| `web/js/layout.js` | แผนผังห้อง ทางเดิน เก้าอี้รอ และจุดให้บริการ |
| `web/js/scene3d.js` | ฉาก 3D (three.js r147) |
| `web/js/main.js` | ควบคุม UI |
| `web/diagrams/swimlane-*.html` | Swimlane workflow 4 แผ่น ครอบคลุมทั้ง 11 process: OPD, OPD เฉพาะทาง, ผ่าตัด/Admit, ฉุกเฉิน แบบ interactive (pan/zoom, ค้นหา, ไล่เส้นทาง, ธีมสว่าง/มืด, export) สร้างด้วย [Archify](https://github.com/tt-a1i/archify) จาก `tools/archify/*.workflow.json` → รัน `sh tools/archify/build.sh` |
| `docs/hospital-services.md` | รายการบริการ ค่าพารามิเตอร์ และเส้นทางของแต่ละ process |

