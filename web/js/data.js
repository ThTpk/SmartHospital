/* =====================================================================
 * SmartHospital — ข้อมูลหลักของโรงพยาบาล (single source of truth)
 *  - CATALOG   : บริการ/ฝ่ายทั้งหมดของโรงพยาบาล (ข้อ 1)
 *  - STATIONS  : หน่วยบริการที่ผู้ป่วยต้องไปเข้าคิว (service time, slot, ตำแหน่ง 3D)
 *  - PROCESSES : กระบวนการเข้ารับบริการ + ลำดับหน่วยที่ต้องไป (ข้อ 5)
 * ===================================================================== */
(function (root) {
  'use strict';

  /* ---------- 1. บริการ/ฝ่ายทั้งหมดของโรงพยาบาล ---------- */
  const CATALOG = [
    {
      group: 'ส่วนหน้า (Front Office)', color: '#2e5aa8', units: [
        { name: 'ประชาสัมพันธ์ / จุดคัดแยกผู้ป่วยหน้าโรงพยาบาล', desc: 'ให้ข้อมูล คัดแยกผู้ป่วยทั่วไป/ฉุกเฉิน แจกบัตรคิว', station: null },
        { name: 'เวชระเบียน / ลงทะเบียน', desc: 'ลงทะเบียนผู้ป่วยใหม่-เก่า ค้นแฟ้ม (HN) ออกบัตรคิว', station: 'REG' },
        { name: 'ตรวจสอบสิทธิการรักษา', desc: 'บัตรทอง ประกันสังคม ข้าราชการ ประกันเอกชน (รวมกับจุดลงทะเบียน)', station: 'REG' },
        { name: 'ศูนย์นัดหมาย / Call center', desc: 'นัดหมายล่วงหน้า เลื่อนนัด แจ้งเตือนผ่านแอป', station: null }
      ]
    },
    {
      group: 'บริการผู้ป่วยนอก (OPD)', color: '#4f5d75', units: [
        { name: 'จุดคัดกรอง / ซักประวัติ', desc: 'วัดสัญญาณชีพ น้ำหนัก ความดัน ซักประวัติโดยพยาบาล', station: 'TRI' },
        { name: 'ห้องตรวจแพทย์ (คลินิกเฉพาะทาง)', desc: 'อายุรกรรม ศัลยกรรม กุมารเวช สูติ-นรีเวช ออร์โธปิดิกส์ ตา หู คอ จมูก ผิวหนัง จิตเวช', station: 'DOC' },
        { name: 'ห้องหัตถการ / ทำแผล / ฉีดยา / วัคซีน', desc: 'ทำแผล ฉีดยา ให้วัคซีน ให้น้ำเกลือระยะสั้น', station: 'PRC' },
        { name: 'ทันตกรรม', desc: 'ขูดหินปูน อุดฟัน ถอนฟัน รักษารากฟัน', station: 'DEN' },
        { name: 'เวชศาสตร์ฟื้นฟู / กายภาพบำบัด', desc: 'กายภาพบำบัด กิจกรรมบำบัด ฟื้นฟูหลังผ่าตัด', station: 'PT' },
        { name: 'ศูนย์ตรวจสุขภาพ (Check-up)', desc: 'ตรวจสุขภาพประจำปี/ก่อนเข้างาน ใช้ Lab + X-ray + EKG', station: null }
      ]
    },
    {
      group: 'อุบัติเหตุและฉุกเฉิน (ER)', color: '#eb6c36', units: [
        { name: 'จุดคัดแยกฉุกเฉิน (ER Triage)', desc: 'คัดแยกระดับความรุนแรง ESI 1–5', station: 'ERT' },
        { name: 'ห้องฉุกเฉิน (Emergency Room)', desc: 'กู้ชีพ ทำหัตถการเร่งด่วน สังเกตอาการ', station: 'ER' },
        { name: 'หน่วยรถพยาบาล / EMS 1669', desc: 'รับผู้ป่วยนอกโรงพยาบาล ส่งต่อระหว่างโรงพยาบาล', station: null }
      ]
    },
    {
      group: 'ตรวจวินิจฉัย (Diagnostics)', color: '#7c8f6f', units: [
        { name: 'ห้องปฏิบัติการ / จุดเจาะเลือด', desc: 'เจาะเลือด เก็บปัสสาวะ ตรวจเคมีคลินิก โลหิตวิทยา จุลชีววิทยา', station: 'LAB' },
        { name: 'รังสีวิทยา (X-ray / CT / MRI / Ultrasound)', desc: 'ถ่ายภาพรังสีและภาพทางการแพทย์', station: 'XRY' },
        { name: 'ตรวจคลื่นไฟฟ้าหัวใจ (EKG / Echo)', desc: 'ตรวจคลื่นไฟฟ้าหัวใจ ตรวจหัวใจด้วยคลื่นเสียง', station: 'EKG' }
      ]
    },
    {
      group: 'ผ่าตัดและผู้ป่วยใน (Surgery & IPD)', color: '#9c6b50', units: [
        { name: 'คลินิกวิสัญญี / เตรียมก่อนผ่าตัด', desc: 'ประเมินความพร้อมก่อนผ่าตัด ให้คำแนะนำ งดน้ำงดอาหาร', station: 'ANE' },
        { name: 'ห้องผ่าตัด (Operating Room)', desc: 'ผ่าตัดใหญ่/เล็ก ผ่าตัดแบบวันเดียวกลับ', station: 'OR' },
        { name: 'ห้องพักฟื้น (PACU)', desc: 'เฝ้าระวังหลังผ่าตัดก่อนกลับหอหรือกลับบ้าน', station: 'PACU' },
        { name: 'แผนกรับผู้ป่วยใน (Admission)', desc: 'จัดเตียง ทำเอกสารนอนโรงพยาบาล ประเมินค่าใช้จ่าย', station: 'ADM' },
        { name: 'หอผู้ป่วยใน (Ward)', desc: 'อายุรกรรม ศัลยกรรม สูติกรรม กุมารเวช ห้องพิเศษ', station: 'WARD' },
        { name: 'หอผู้ป่วยวิกฤต (ICU / CCU / NICU)', desc: 'ดูแลผู้ป่วยวิกฤต (นอกขอบเขตการจำลองคิว)', station: null },
        { name: 'ห้องคลอด (Labor Room)', desc: 'ดูแลการคลอด (นอกขอบเขตการจำลองคิว)', station: null }
      ]
    },
    {
      group: 'การเงินและเภสัชกรรม (Billing & Pharmacy)', color: '#b8915a', units: [
        { name: 'การเงิน / ชำระเงิน', desc: 'คิดค่าใช้จ่าย เบิกจ่ายตามสิทธิ ชำระเงิน QR/บัตร', station: 'CSH' },
        { name: 'เภสัชกรรม / ห้องจ่ายยา', desc: 'ตรวจสอบใบสั่งยา จัดยา จ่ายยาพร้อมให้คำแนะนำ', station: 'PHA' }
      ]
    },
    {
      group: 'สนับสนุน (Support)', color: '#6e6479', units: [
        { name: 'สังคมสงเคราะห์', desc: 'ช่วยเหลือผู้ป่วยด้านค่าใช้จ่ายและสังคม', station: null },
        { name: 'โภชนาการ', desc: 'อาหารผู้ป่วยใน ให้คำปรึกษาด้านโภชนาการ', station: null },
        { name: 'ศูนย์เครื่องมือแพทย์ปลอดเชื้อ (CSSD)', desc: 'ทำให้เครื่องมือปราศจากเชื้อ', station: null },
        { name: 'เวรเปล / ขนส่งผู้ป่วย', desc: 'เคลื่อนย้ายผู้ป่วยระหว่างหน่วย', station: null },
        { name: 'เทคโนโลยีสารสนเทศ (HIS)', desc: 'ระบบสารสนเทศโรงพยาบาล ระบบคิว', station: null }
      ]
    }
  ];

  /* ---------- 2. หน่วยบริการที่มีคิว ----------
   * svc  = service time เฉลี่ย (นาที/ราย)
   * c    = จำนวน service slot (เคาน์เตอร์/ห้อง/เตียง) ปัจจุบัน
   * max  = slot สูงสุดที่เพิ่มได้ตามพื้นที่/บุคลากร (ใช้ตัดสินว่า "แก้ไขได้หรือไม่")
   * dist = การกระจายของ service time: exp (แปรปรวนสูง, CV=1) | erlang4 (CV=0.5) | det (คงที่, CV=0)
   * before = ค่าก่อนปรับปรุงตามคำแนะนำ (ใช้เปรียบเทียบ scenario "ก่อนปรับปรุง")
   * row  = แถวในแผนผัง F=หน้า, M=กลาง, B=หลัง ; x,w = ตำแหน่ง/ความกว้างห้อง (หน่วยเมตรในฉาก 3D)
   */
  const STATIONS = [
    { id: 'REG',  name: 'เวชระเบียน/ลงทะเบียน', short: 'ลงทะเบียน', svc: 2.5, c: 4, max: 6,  row: 'F', x: -28, w: 12, color: '#2e5aa8', dist: 'exp' },
    { id: 'TRI',  name: 'คัดกรอง/ซักประวัติ',   short: 'คัดกรอง',   svc: 5, c: 7, max: 8,  row: 'F', x: -14, w: 12, color: '#4f5d75', dist: 'exp', before: { svc: 5, c: 6, note: 'เพิ่มจุดคัดกรอง 1 จุด (6 → 7)' } },
    { id: 'CSH',  name: 'การเงิน',               short: 'การเงิน',   svc: 2.5, c: 4, max: 5,  row: 'F', x: 10,  w: 10, color: '#b8915a', dist: 'exp' },
    { id: 'PHA',  name: 'เภสัชกรรม/จ่ายยา',      short: 'ห้องยา',    svc: 5.8, c: 7, max: 7,  row: 'F', x: 22,  w: 12, color: '#b8915a', dist: 'exp', before: { svc: 6.5, c: 6, note: 'เพิ่มช่องจ่ายยาเต็มพื้นที่ (6 → 7) + จัดยาล่วงหน้า (pre-packing) ลดเวลาจ่ายยา 6.5 → 5.8 นาที' } },
    { id: 'ERT',  name: 'คัดแยกฉุกเฉิน (Triage)', short: 'ER Triage', svc: 4,  c: 1, max: 2,  row: 'F', x: 35,  w: 8,  color: '#eb6c36', dist: 'exp' },
    { id: 'DOC',  name: 'ห้องตรวจแพทย์ OPD',     short: 'ห้องตรวจ',  svc: 10, c: 14, max: 16, row: 'M', x: -26, w: 20, color: '#4f5d75', dist: 'exp', before: { svc: 10, c: 13, note: 'เปิดห้องตรวจเพิ่ม 1 ห้อง (13 → 14)' } },
    { id: 'LAB',  name: 'ห้องปฏิบัติการ/เจาะเลือด', short: 'Lab',    svc: 5, c: 3, max: 5,  row: 'M', x: -9,  w: 10, color: '#7c8f6f', dist: 'exp' },
    { id: 'XRY',  name: 'รังสีวิทยา (X-ray)',     short: 'X-ray',     svc: 10, c: 4, max: 4,  row: 'M', x: 7,   w: 10, color: '#7c8f6f', dist: 'exp', before: { svc: 10, c: 3, note: 'เพิ่มเครื่อง X-ray 1 เครื่อง (3 → 4)' } },
    { id: 'EKG',  name: 'ตรวจคลื่นหัวใจ (EKG)',   short: 'EKG',       svc: 10, c: 2, max: 2,  row: 'M', x: 16,  w: 6,  color: '#7c8f6f', dist: 'exp', before: { svc: 10, c: 1, note: 'เพิ่มเครื่อง EKG 1 เครื่อง (1 → 2)' } },
    { id: 'PRC',  name: 'ห้องหัตถการ/ฉีดยา',      short: 'หัตถการ',   svc: 8,  c: 2, max: 4,  row: 'M', x: 23,  w: 8,  color: '#4f5d75', dist: 'exp' },
    { id: 'ER',   name: 'ห้องฉุกเฉิน (ER)',       short: 'ER',        svc: 25, c: 5, max: 6,  row: 'M', x: 35,  w: 12, color: '#eb6c36', dist: 'exp', before: { svc: 25, c: 4, note: 'เพิ่มเตียง/ทีมแพทย์ ER 1 ชุด (4 → 5)' } },
    { id: 'DEN',  name: 'ทันตกรรม',               short: 'ทันตกรรม',  svc: 30, c: 3, max: 4,  row: 'B', x: -30, w: 10, color: '#4f5d75', dist: 'exp' },
    { id: 'PT',   name: 'กายภาพบำบัด',            short: 'กายภาพ',    svc: 40, c: 4, max: 6,  row: 'B', x: -18, w: 12, color: '#4f5d75', dist: 'exp' },
    { id: 'ANE',  name: 'คลินิกวิสัญญี/เตรียมผ่าตัด', short: 'เตรียมผ่าตัด', svc: 20, c: 1, max: 2, row: 'B', x: -6, w: 8, color: '#9c6b50', dist: 'exp' },
    { id: 'OR',   name: 'ห้องผ่าตัด (OR)',         short: 'ห้องผ่าตัด', svc: 90, c: 3, max: 4, row: 'B', x: 6,   w: 14, color: '#9c6b50', dist: 'exp' },
    { id: 'PACU', name: 'ห้องพักฟื้น (PACU)',      short: 'พักฟื้น',   svc: 60, c: 4, max: 6,  row: 'B', x: 19,  w: 10, color: '#9c6b50', dist: 'exp' },
    { id: 'ADM',  name: 'แผนกรับผู้ป่วยใน',        short: 'Admit',     svc: 15, c: 1, max: 3,  row: 'B', x: 29,  w: 8,  color: '#9c6b50', dist: 'exp' },
    { id: 'WARD', name: 'หอผู้ป่วยใน (รับเข้าหอ)', short: 'Ward',      svc: 30, c: 2, max: 4,  row: 'B', x: 39,  w: 10, color: '#9c6b50', dist: 'exp' }
  ];

  /* ---------- 3. กระบวนการเข้ารับบริการ ----------
   * lambda = ผู้ป่วยเข้ามาเฉลี่ย (ราย/ชั่วโมง)  ; route = ลำดับหน่วยบริการ
   * entry  = ทางเข้า (main / er)                ; exit = ทางออก (main / er / ward)
   */
  const PROCESSES = [
    { id: 'OPD',     name: 'ตรวจโรคทั่วไป (OPD)',            icon: '🩺', lambda: 24, color: '#2e5aa8', entry: 'main', exit: 'main',
      route: ['REG', 'TRI', 'DOC', 'CSH', 'PHA'],
      desc: 'ผู้ป่วยนอกทั่วไป พบแพทย์ รับยา กลับบ้าน' },
    { id: 'OPD_LAB', name: 'ตรวจโรค + ตรวจเลือด',             icon: '🧪', lambda: 15, color: '#5e7a9b', entry: 'main', exit: 'main',
      route: ['REG', 'TRI', 'LAB', 'DOC', 'CSH', 'PHA'],
      desc: 'ผู้ป่วยโรคเรื้อรัง (เบาหวาน ความดัน) เจาะเลือดก่อนพบแพทย์' },
    { id: 'OPD_XRY', name: 'ตรวจโรค + เอกซเรย์',              icon: '🩻', lambda: 8, color: '#7c8f6f', entry: 'main', exit: 'main',
      route: ['REG', 'TRI', 'DOC', 'XRY', 'DOC', 'CSH', 'PHA'],
      desc: 'แพทย์ส่งเอกซเรย์ แล้วกลับมาพบแพทย์เพื่อฟังผล' },
    { id: 'PROC',    name: 'ทำแผล / ฉีดยา',                   icon: '💉', lambda: 5,  color: '#6e6479', entry: 'main', exit: 'main',
      route: ['REG', 'TRI', 'DOC', 'PRC', 'CSH', 'PHA'],
      desc: 'พบแพทย์แล้วทำหัตถการที่ห้องหัตถการ' },
    { id: 'VACC',    name: 'ฉีดวัคซีน',                       icon: '🛡️', lambda: 5,  color: '#8d8298', entry: 'main', exit: 'main',
      route: ['REG', 'TRI', 'PRC', 'CSH'],
      desc: 'ไม่ต้องพบแพทย์ คัดกรองแล้วฉีดวัคซีน' },
    { id: 'CHECKUP', name: 'ตรวจสุขภาพประจำปี',               icon: '📋', lambda: 4,  color: '#b8915a', entry: 'main', exit: 'main',
      route: ['REG', 'TRI', 'LAB', 'XRY', 'EKG', 'DOC', 'CSH'],
      desc: 'Lab + X-ray ปอด + EKG แล้วพบแพทย์สรุปผล' },
    { id: 'DENTAL',  name: 'ทันตกรรม',                        icon: '🦷', lambda: 4,  color: '#9caf8f', entry: 'main', exit: 'main',
      route: ['REG', 'DEN', 'CSH', 'PHA'],
      desc: 'นัดทันตกรรมโดยตรง' },
    { id: 'REHAB',   name: 'กายภาพบำบัด',                     icon: '🦵', lambda: 3,  color: '#82a0c0', entry: 'main', exit: 'main',
      route: ['REG', 'DOC', 'PT', 'CSH'],
      desc: 'แพทย์เวชศาสตร์ฟื้นฟูประเมิน แล้วทำกายภาพ' },
    { id: 'ER',      name: 'ฉุกเฉิน (ER)',                    icon: '🚑', lambda: 4,  color: '#eb6c36', entry: 'er', exit: 'er',
      route: ['ERT', 'ER', 'LAB', 'XRY', 'ER', 'CSH', 'PHA'],
      desc: 'เข้าทางประตูฉุกเฉิน ตรวจ Lab/X-ray แล้วกลับ ER เพื่อรักษาต่อ' },
    { id: 'ADMIT',   name: 'นอนโรงพยาบาล (Admit)',            icon: '🛏️', lambda: 2,  color: '#9c6b50', entry: 'main', exit: 'ward',
      route: ['REG', 'TRI', 'DOC', 'LAB', 'ADM', 'WARD'],
      desc: 'แพทย์สั่ง Admit ทำเอกสารแล้วย้ายเข้าหอผู้ป่วย' },
    { id: 'SURGERY', name: 'ผ่าตัดแบบวันเดียวกลับ',           icon: '🔪', lambda: 1, color: '#b88670', entry: 'main', exit: 'main',
      route: ['REG', 'ANE', 'LAB', 'OR', 'PACU', 'CSH', 'PHA'],
      desc: 'Day surgery: เตรียมผ่าตัด → ผ่าตัด → พักฟื้น → กลับบ้าน' }
  ];

  /* ---------- 4. แนวทางลด service time เฉพาะหน่วย (ใช้ในคำแนะนำ ข้อ 7) ---------- */
  const IDEAS = {
    REG:  ['ลงทะเบียนล่วงหน้าผ่านแอป/LINE', 'ตู้ Kiosk ยืนยันตัวตนด้วยบัตรประชาชน', 'แยกช่องผู้ป่วยเก่า/ผู้ป่วยใหม่'],
    TRI:  ['เครื่องวัดความดัน/ชั่งน้ำหนักอัตโนมัติ (self-service)', 'ส่งค่าสัญญาณชีพเข้า HIS อัตโนมัติ', 'ให้ผู้ช่วยพยาบาลวัด vital แยกจากพยาบาลซักประวัติ'],
    DOC:  ['ระบบนัดหมายแบบแบ่งช่วงเวลา (time-slot)', 'e-Prescription / Order set สำเร็จรูป', 'Telemedicine สำหรับผู้ป่วยติดตามอาการ', 'เปิดคลินิกนอกเวลา'],
    LAB:  ['เจาะเลือดล่วงหน้า / จุดเจาะเลือดนอกอาคาร', 'Barcode ติดหลอดเลือดอัตโนมัติ', 'ท่อลมส่งสิ่งส่งตรวจ (pneumatic tube)'],
    XRY:  ['Digital X-ray (DR) ลดเวลาล้างฟิล์ม', 'นัดคิวเอกซเรย์ล่วงหน้า', 'แยกคิว ER ออกจาก OPD'],
    EKG:  ['เครื่อง EKG แบบพกพาเพิ่มที่จุดตรวจสุขภาพ', 'ให้เจ้าหน้าที่เตรียมผู้ป่วยระหว่างรอ'],
    PRC:  ['ชุดหัตถการสำเร็จรูป (procedure kit)', 'แยกเตียงวัคซีนออกจากทำแผล'],
    ER:   ['Fast track สำหรับผู้ป่วย ESI 4–5', 'ส่งผู้ป่วยไม่ฉุกเฉินไป OPD', 'Point-of-care lab ใน ER'],
    ERT:  ['เพิ่มพยาบาลคัดแยกช่วงพีค', 'ใช้แบบฟอร์ม ESI ดิจิทัล'],
    DEN:  ['นัดหมายแบบ time-slot', 'แยกงานขูดหินปูนให้ทันตาภิบาล'],
    PT:   ['กายภาพแบบกลุ่ม', 'สอนท่าบริหารให้ทำที่บ้าน + ติดตามออนไลน์'],
    ANE:  ['ประเมินก่อนผ่าตัดทางออนไลน์', 'Checklist สำเร็จรูป'],
    OR:   ['ลดเวลา turnover ระหว่างเคส', 'จัดตารางผ่าตัดตามระยะเวลาเคสจริง'],
    PACU: ['เกณฑ์ส่งกลับ (discharge criteria) ชัดเจน', 'พยาบาลประจำเตียงพักฟื้นตามสัดส่วน'],
    ADM:  ['จองเตียงล่วงหน้าจาก OPD', 'เอกสาร Admit อิเล็กทรอนิกส์'],
    WARD: ['เตรียมเตียงล่วงหน้า (bed management board)', 'จำหน่ายผู้ป่วยก่อน 11:00'],
    CSH:  ['ชำระเงินผ่าน QR / Mobile banking', 'ตัดสิทธิอัตโนมัติ (ไม่ต้องรอที่การเงิน)', 'ตู้ชำระเงินอัตโนมัติ'],
    PHA:  ['จัดยาล่วงหน้าตั้งแต่แพทย์สั่ง (pre-packing)', 'ตู้จ่ายยาอัตโนมัติ / ส่งยาทางไปรษณีย์', 'แยกช่องรับยาเดิม/ยาใหม่']
  };

  const api = { CATALOG, STATIONS, PROCESSES, IDEAS };
  root.HOSP = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
