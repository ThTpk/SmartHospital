/* =====================================================================
 * SmartHospital — UI controller
 * ===================================================================== */
(function () {
  'use strict';
  const H = window.HOSP, L = window.LAYOUT, Q = window.QUEUE;
  const $ = s => document.querySelector(s);
  const CFG_KEY = 'smarthospital.cfg.v2';
  const stName = id => H.STATIONS.find(s => s.id === id).name;
  const stShort = id => H.STATIONS.find(s => s.id === id).short;

  /* ---------- formatting ---------- */
  const f1 = x => (isFinite(x) ? x.toFixed(1) : '∞');
  const f2 = x => (isFinite(x) ? x.toFixed(2) : '∞');
  const pct = x => (isFinite(x) ? Math.round(x * 100) + '%' : '∞');
  function fmtMin(m) {
    if (!isFinite(m)) return '∞';
    if (m < 1) return '<1 นาที';
    if (m < 60) return Math.round(m) + ' นาที';
    const h = Math.floor(m / 60), r = Math.round(m % 60);
    return `${h} ชม.${r ? ' ' + r + ' นาที' : ''}`;
  }
  const clock = t => { const m = 8 * 60 + Math.floor(t); const d = Math.floor(m / 1440); const hh = Math.floor((m % 1440) / 60), mm = m % 60; return `${d ? 'วัน+' + d + ' ' : ''}${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
  const STATUS_TH = { ok: 'ปกติ', warn: 'เฝ้าระวัง', critical: 'คอขวด', idle: 'ไม่มีผู้ใช้' };
  const badge = s => `<span class="badge ${s}">${STATUS_TH[s]}</span>`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- config ---------- */
  function defaults() {
    const c = { stations: {}, processes: {}, load: 1, hours: 8, targetWq: 15, rhoMax: 0.85, closeAfter: false };
    H.STATIONS.forEach(s => c.stations[s.id] = { svc: s.svc, c: s.c, max: s.max, dist: s.dist || 'exp' });
    H.PROCESSES.forEach(p => c.processes[p.id] = { lambda: p.lambda });
    return c;
  }
  function loadCfg() {
    const d = defaults();
    try {
      const s = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
      if (s) {
        Object.keys(d.stations).forEach(k => Object.assign(d.stations[k], s.stations?.[k] || {}));
        Object.keys(d.processes).forEach(k => Object.assign(d.processes[k], s.processes?.[k] || {}));
        ['load', 'hours', 'targetWq', 'rhoMax', 'closeAfter'].forEach(k => { if (s[k] !== undefined) d[k] = s[k]; });
      }
    } catch (e) { /* ignore */ }
    return d;
  }
  function saveCfg() { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ } }

  /* ---------- scenario: ก่อน / หลังปรับปรุงตามคำแนะนำ ---------- */
  function scenarioValues(kind) {
    const o = {};
    H.STATIONS.forEach(s => { const b = kind === 'before' && s.before ? s.before : s; o[s.id] = { svc: b.svc, c: b.c }; });
    return o;
  }
  function scenarioCfg(kind) {
    const c = JSON.parse(JSON.stringify(cfg));
    const v = scenarioValues(kind);
    Object.keys(v).forEach(id => { c.stations[id].svc = v[id].svc; c.stations[id].c = v[id].c; c.stations[id].max = Math.max(c.stations[id].max, v[id].c); });
    return c;
  }
  function currentScenario() {
    for (const k of ['after', 'before']) { const v = scenarioValues(k); if (H.STATIONS.every(s => cfg.stations[s.id].svc === v[s.id].svc && cfg.stations[s.id].c === v[s.id].c)) return k; }
    return 'custom';
  }
  function applyScenario(kind) {
    const v = scenarioValues(kind);
    H.STATIONS.forEach(s => { const c = cfg.stations[s.id]; c.svc = v[s.id].svc; c.c = v[s.id].c; c.max = Math.max(c.max, c.c); sim.setServers(s.id, c.c); });
    changed();
  }

  let cfg, sim, view, analysis, suggestions;
  let selected = 'OPD', playing = true, speed = 1, tracked = null, followCam = true;

  function recompute() {
    analysis = Q.analyze(H, cfg);
    suggestions = Q.suggest(H, cfg, analysis);
    saveCfg();
  }

  /* =================== INIT =================== */

  function init() {
    cfg = loadCfg();
    recompute();
    sim = new window.HospitalSim(H, cfg, { onEvent: onTrackedEvent, seed: 7 });
    view = new window.Hospital3D($('#three'), H, L);
    window.SH = { sim, view, get cfg() { return cfg; }, get analysis() { return analysis; }, renderQueue, updateHud: () => updateHud(sim.stats()) }; // debug handle

    // tabs
    document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === b));
      document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + b.dataset.page));
      if (b.dataset.page === 'sim') view.resize();
      if (b.dataset.page === 'queue') renderQueue();
    });
    document.querySelectorAll('[data-wf]').forEach(b => b.onclick = () => { $('#wf').src = b.dataset.wf; });

    buildSimControls();
    renderProcList();
    selectProcess(selected);
    buildQueueControls();
    renderQueue();
    renderCatalog();
    renderEditor();
    $('#procDetail').addEventListener('focusout', () => setTimeout(() => { if (pendingDetail) renderProcDetail(); }, 0));
    view.onPick = id => { view.follow(null); view.focusStation(id); editStation(id); };

    let last = performance.now(), hudT = 0;
    function frame(now) {
      const dt = Math.min(0.25, (now - last) / 1000); last = now;
      if (playing) sim.step(dt * speed);
      const stats = sim.stats();
      view.update(sim, analysis, stats);
      if (now - hudT > 300) { hudT = now; updateHud(stats); updateJourney(); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    setInterval(() => { if ($('#page-queue').classList.contains('active')) updateDesCells(sim.stats()); }, 1000);
  }

  /* =================== SIM PAGE =================== */
  function buildSimControls() {
    $('#play').onclick = () => { playing = !playing; $('#play').textContent = playing ? '⏸ หยุด' : '▶ เล่น'; };
    $('#speed').onchange = e => speed = +e.target.value;
    const ls = $('#loadSim'); ls.value = cfg.load; $('#loadSimV').textContent = pct(cfg.load);
    ls.oninput = () => setLoad(+ls.value);
    $('#bg').onchange = e => sim.setBackground(e.target.checked);
    $('#reset').onclick = () => { sim.reset(Math.floor(Math.random() * 1e6)); sim.setBackground($('#bg').checked); tracked = null; renderProcDetail(); $('#journey').classList.remove('show'); };
    $('#overview').onclick = () => { view.follow(null); view.overview(); };
  }

  function setLoad(v) {
    cfg.load = v;
    $('#loadSim').value = v; $('#loadSimV').textContent = pct(v);
    $('#load').value = v; $('#loadV').textContent = pct(v);
    recompute(); sim.ratesChanged(); renderQueue(); renderProcList(); renderProcDetail();
  }

  function renderProcList() {
    $('#procList').innerHTML = H.PROCESSES.map(p => {
      const r = analysis.processes[p.id];
      return `<button class="proc ${p.id === selected ? 'sel' : ''}" data-p="${p.id}">
        <span class="ic">${p.icon}</span><span class="nm">${esc(p.name)}</span>
        <span class="t">${fmtMin(r.total)}</span><span class="dot" style="background:${p.color}"></span></button>`;
    }).join('');
    document.querySelectorAll('.proc').forEach(b => b.onclick = () => selectProcess(b.dataset.p));
  }

  function selectProcess(id) {
    selected = id;
    document.querySelectorAll('.proc').forEach(b => b.classList.toggle('sel', b.dataset.p === id));
    view.showRoute(H.PROCESSES.find(p => p.id === id));
    renderProcDetail();
  }

  let pendingDetail = false;
  function renderProcDetail() {
    const ae = document.activeElement;
    if (ae && ae.tagName === 'INPUT' && ae.closest('#procDetail')) { pendingDetail = true; return; }
    pendingDetail = false;
    const p = H.PROCESSES.find(x => x.id === selected);
    const r = analysis.processes[p.id];
    const tr = tracked && tracked.pid === p.id ? tracked : null;
    const logs = tr ? tr.log : [];
    const curIdx = tr ? (tr.state === 'gone' ? p.route.length : tr.idx) : -1;
    const items = p.route.map((sid, i) => {
      const st = r.steps[i]; const lg = logs[i];
      const cls = tr ? (i < curIdx ? 'past' : i === curIdx ? 'cur' : '') : '';
      const obs = lg ? `<div class="obs">จริง: รอ ${fmtMin(lg.wait)}${lg.tEnd != null ? ' · รับบริการ ' + fmtMin(lg.tEnd - lg.tStart) : ' · กำลังรับบริการ'}</div>` : '';
      return `<li class="${cls}"><div class="sn" data-s="${sid}">${esc(stName(sid))} ${badge(st.status)}</div>
        <div class="meta">รอคิว≈${fmtMin(st.Wq)} · บริการ <input class="svc-in" type="number" min="0.5" step="0.5" data-stsvc="${sid}" value="${cfg.stations[sid].svc}" title="ระยะเวลาให้บริการเฉลี่ย (นาที/ราย)"> นาที · ${cfg.stations[sid].c} slot</div>${obs}</li>`;
    }).join('');
    $('#procDetail').innerHTML = `
      <p class="eyebrow">ขั้นที่ 2 · ลำดับการเข้ารับบริการ</p>
      <h3>${p.icon} ${esc(p.name)}</h3>
      <p class="sub" style="color:var(--soft);font-size:12px;margin-bottom:10px">${esc(p.desc)} · ทางเข้า: ${p.entry === 'er' ? 'ประตูฉุกเฉิน' : 'ทางเข้าหลัก'}</p>
      <ol class="steps">${items}<li><div class="sn">${p.exit === 'ward' ? '🛏️ เข้าพักที่หอผู้ป่วย' : '🏠 กลับบ้าน / นัดครั้งถัดไป'}</div></li></ol>
      <div class="total"><span>เวลารวมโดยประมาณ (ทฤษฎีคิว)</span><b>${fmtMin(r.total)}</b></div>
      <div class="total" style="margin-top:6px"><span>เวลารอคิวรวม / เวลารับบริการรวม</span><b>${fmtMin(r.wait)} / ${fmtMin(r.svc)}</b></div>
      <p class="eyebrow" style="margin-top:16px">ขั้นที่ 3 · จำลองการเดินทางของผู้ป่วย</p>
      <div class="row-btns" style="margin-top:8px">
        <button class="accent-btn" id="send">▶ ส่งผู้ป่วยตัวอย่างเข้าระบบ</button>
        <label style="font-size:12px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="follow" ${followCam ? 'checked' : ''}> กล้องติดตาม</label>
      </div>
      <p style="font-size:12px;color:var(--soft);margin-top:8px">ปิด “ผู้ป่วยอื่นในระบบ” เพื่อดูผู้ป่วยรายเดียวในโรงพยาบาลว่าง หรือเปิดไว้เพื่อดูการรอคิวท่ามกลาง load จริง</p>`;
    $('#send').onclick = () => {
      tracked = sim.spawn(selected, true);
      if (followCam) { view.follow(tracked.id); }
      renderProcDetail(); updateJourney();
    };
    $('#follow').onchange = e => { followCam = e.target.checked; view.follow(followCam && tracked && tracked.state !== 'gone' ? tracked.id : null); };
    document.querySelectorAll('#procDetail .sn[data-s]').forEach(el => el.onclick = () => { view.follow(null); view.focusStation(el.dataset.s); editStation(el.dataset.s); });
    document.querySelectorAll('#procDetail [data-stsvc]').forEach(i => i.onchange = () => { setSvc(i.dataset.stsvc, +i.value); });
  }

  function onTrackedEvent(type, p) {
    if (type === 'exit') view.follow(null);
    renderProcDetail();
  }

  function updateJourney() {
    const el = $('#journey');
    if (!tracked) { el.classList.remove('show'); return; }
    el.classList.add('show');
    const p = tracked, proc = p.proc, now = sim.time;
    const cur = p.state === 'gone' ? proc.route.length : p.idx;
    let status;
    if (p.state === 'gone' || p.state === 'admitted') {
      const tot = (p.tOut ?? now) - p.tIn, wait = p.log.reduce((a, r) => a + r.wait, 0);
      status = `✅ เสร็จสิ้น — ใช้เวลารวม <b>${fmtMin(tot)}</b> (รอคิว ${fmtMin(wait)} · ${Math.round(wait / Math.max(1e-6, tot) * 100)}% ของเวลาทั้งหมด)`;
    } else if (p.state === 'walk') status = `🚶 กำลังเดินไป <b>${esc(p.station ? stName(p.station) : 'ทางออก')}</b>`;
    else if (p.state === 'wait') { const st = sim.st[p.station]; status = `🪑 นั่งรอที่หน้า <b>${esc(stName(p.station))}</b> · คิวที่ ${st.queue.indexOf(p) + 1} จาก ${st.queue.length} · รอมาแล้ว ${fmtMin(now - p.qArrive)}`; }
    else if (p.state === 'serve') status = `🩺 กำลังรับบริการที่ <b>${esc(stName(p.station))}</b>`;
    const segs = proc.route.map((sid, i) => {
      const lg = p.log[i];
      const cls = i < cur ? 'past' : i === cur ? 'cur' : '';
      return `<div class="seg ${cls}" title="${esc(stName(sid))}">${i + 1}. ${esc(stShort(sid))}${lg ? ' · รอ ' + Math.round(lg.wait) + "'" : ''}</div>`;
    }).join('');
    el.innerHTML = `<div class="head"><span>ผู้ป่วยติดตาม #${p.id} · ${proc.icon} ${esc(proc.name)}</span><span>${status}</span><span class="mono">เข้าระบบ ${clock(p.tIn)} · ผ่านไป ${fmtMin((p.tOut ?? now) - p.tIn)}</span></div><div class="bar">${segs}</div>`;
  }

  function updateHud(stats) {
    $('#clock').textContent = clock(sim.time);
    const recent = sim.done.slice(-300);
    const avg = recent.length ? recent.reduce((a, d) => a + (d.tOut - d.tIn), 0) / recent.length : 0;
    const totalQ = Object.values(stats).reduce((a, s) => a + s.queue, 0);
    const open = sim.arrivalsOpen() ? '' : ' · <b style="color:var(--crit)">ปิดรับผู้ป่วยแล้ว</b>';
    $('#kpi').innerHTML = `ในระบบ <b>${sim.patients.size}</b> · รอคิว <b>${totalQ}</b> · เสร็จแล้ว <b>${sim.done.length}</b> · เวลาเฉลี่ย/ราย <b>${fmtMin(avg)}</b>${open}`;
    const rows = H.STATIONS.map(s => ({ s, st: stats[s.id], a: analysis.stations[s.id] }))
      .filter(r => r.a.lambdaH > 0 || r.st.queue > 0)
      .sort((x, y) => (y.st.queue - x.st.queue) || (y.a.rho - x.a.rho));
    $('#live').innerHTML = `<h4>คิวหน้าห้อง ณ ขณะนี้</h4><table><tr><td></td><td class="n">คิว</td><td class="n">รอนานสุด</td><td class="n">ρ</td></tr>` +
      rows.map(r => `<tr data-s="${r.s.id}"><td>${esc(r.s.short)}</td><td class="n" style="color:${r.st.queue > L.seatCount(r.s) ? 'var(--crit)' : 'inherit'}">${r.st.queue}</td><td class="n">${Math.round(r.st.oldestWait)}'</td><td class="n">${badgeRho(r.a)}</td></tr>`).join('') + '</table>';
    document.querySelectorAll('#live tr[data-s]').forEach(tr => tr.onclick = () => { view.follow(null); view.focusStation(tr.dataset.s); });
  }
  const badgeRho = a => `<span class="badge ${a.status}">${pct(a.rho)}</span>`;

  /* =================== QUEUE PAGE =================== */
  function buildQueueControls() {
    $('#load').value = cfg.load; $('#loadV').textContent = pct(cfg.load);
    $('#load').oninput = e => setLoad(+e.target.value);
    $('#hours').value = cfg.hours; $('#target').value = cfg.targetWq; $('#rhoMax').value = cfg.rhoMax; $('#closeAfter').checked = cfg.closeAfter;
    $('#hours').onchange = e => { cfg.hours = Math.max(1, +e.target.value || 8); changed(); };
    $('#target').onchange = e => { cfg.targetWq = Math.max(1, +e.target.value || 15); changed(); };
    $('#rhoMax').onchange = e => { cfg.rhoMax = Math.min(0.99, Math.max(0.5, +e.target.value || 0.85)); changed(); };
    $('#distAll').onchange = e => { if (!e.target.value) return; H.STATIONS.forEach(s => cfg.stations[s.id].dist = e.target.value); e.target.value = ''; changed(); };
    document.querySelectorAll('[data-scn]').forEach(b => b.onclick = () => applyScenario(b.dataset.scn));
    $('#closeAfter').onchange = e => { cfg.closeAfter = e.target.checked; saveCfg(); };
    $('#resetCfg').onclick = () => {
      const d = defaults(); Object.assign(cfg, d);
      H.STATIONS.forEach(s => sim.setServers(s.id, cfg.stations[s.id].c));
      buildQueueControls(); setLoad(1); renderEditor();
    };
    $('#applyAll').onclick = () => {
      suggestions.filter(s => s.kind === 'add').forEach(s => { cfg.stations[s.id].c = s.newC; sim.setServers(s.id, s.newC); });
      changed();
    };
  }

  function changed() { recompute(); sim.ratesChanged(); renderQueue(); renderProcList(); renderProcDetail(); renderEditor(); }

  function setSvc(id, v) { cfg.stations[id].svc = Math.max(0.5, Math.round((+v || 1) * 10) / 10); changed(); }
  function setSlots(id, n) {
    const c = cfg.stations[id]; c.c = Math.max(1, Math.round(n)); if (c.c > c.max) c.max = c.c;
    sim.setServers(id, c.c); changed();
  }

  /* =================== ตั้งค่าระยะเวลาให้บริการ (sidebar editor) =================== */
  let editing = 'PHA';
  function editStation(id) { editing = id; renderEditor(); const el = $('#stEditor'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  function editorMetrics() {
    const a = analysis.stations[editing], c = cfg.stations[editing];
    return `<div class="em"><span>λ <b>${f1(a.lambdaH)}</b>/ชม.</span><span>รองรับ <b>${f1(a.capH)}</b>/ชม.</span><span>ρ <b>${pct(a.rho)}</b></span>
      <span>รอเฉลี่ย <b>${fmtMin(a.Wq)}</b></span><span>คิว P95 <b>${a.q95}</b> คน</span><span>${badge(a.status)}</span></div>
      <p class="hint">capacity = ${c.c} slot × 60 / ${f1(c.svc)} นาที = ${f1(c.c * 60 / c.svc)} ราย/ชม.</p>`;
  }
  function renderEditor() {
    const el = $('#stEditor'); if (!el || !analysis) return;
    const ae = document.activeElement;
    if (ae && ae.closest && ae.closest('#stEditor') && ae.type === 'number') { $('#emBox').innerHTML = editorMetrics(); return; }
    const s = H.STATIONS.find(x => x.id === editing), c = cfg.stations[editing];
    const maxSlider = Math.max(30, Math.ceil(c.svc * 3 / 5) * 5, s.svc * 2);
    const bf = s.before ? `<p class="hint">ก่อนปรับปรุง: ${s.before.c} slot × ${s.before.svc} นาที — ${esc(s.before.note || '')}</p>` : '';
    el.innerHTML = `
      <p class="eyebrow">ขั้นที่ 4 · ตั้งค่าหน่วยบริการ</p>
      <h3>ระยะเวลาการให้บริการ</h3>
      <select id="edSel" class="ed-sel">${H.STATIONS.map(x => `<option value="${x.id}" ${x.id === editing ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <label class="ed-row">Service time เฉลี่ย (นาที/ราย)
        <span class="ed-svc"><input type="range" id="edSvcR" min="0.5" max="${maxSlider}" step="0.5" value="${c.svc}"><input type="number" id="edSvc" min="0.5" step="0.1" value="${c.svc}"></span></label>
      <label class="ed-row">ความแปรปรวนของเวลาให้บริการ
        <select id="edDist">${Object.entries(Q.DIST_TH).map(([k, v]) => `<option value="${k}" ${c.dist === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <div class="ed-row">จำนวน service slot (สูงสุด ${c.max})
        <span class="ed-slot"><button class="ghost" id="edMinus" aria-label="ลด slot">−</button><b class="mono">${c.c}</b><button class="ghost" id="edPlus" aria-label="เพิ่ม slot">+</button></span></div>
      <div id="emBox">${editorMetrics()}</div>${bf}
      <p class="hint">คลิกห้องในแผนผัง 3D หรือชื่อขั้นตอนด้านบน เพื่อเลือกหน่วยที่จะตั้งค่า</p>`;
    $('#edSel').onchange = e => { editing = e.target.value; renderEditor(); view.follow(null); view.focusStation(editing); };
    const live = v => { cfg.stations[editing].svc = Math.max(0.5, +v); $('#edSvc').value = cfg.stations[editing].svc; recompute(); $('#emBox').innerHTML = editorMetrics(); };
    $('#edSvcR').oninput = e => live(e.target.value);
    $('#edSvcR').onchange = () => setSvc(editing, cfg.stations[editing].svc);
    $('#edSvc').onchange = e => { e.target.blur(); setSvc(editing, e.target.value); };
    $('#edDist').onchange = e => { cfg.stations[editing].dist = e.target.value; changed(); };
    $('#edMinus').onclick = () => setSlots(editing, cfg.stations[editing].c - 1);
    $('#edPlus').onclick = () => { if (cfg.stations[editing].c < cfg.stations[editing].max) setSlots(editing, cfg.stations[editing].c + 1); };
  }

  function rhoBar(a) {
    const w = Math.min(1.2, a.rho) / 1.2 * 100;
    const col = { ok: 'var(--ok)', warn: 'var(--warn)', critical: 'var(--crit)', idle: '#ccc' }[a.status];
    return `<div class="rho"><div class="track"><div class="fill" style="width:${w}%;background:${col}"></div><div class="mark" style="left:${100 / 1.2}%"></div></div><span class="mono" style="width:42px;text-align:right">${pct(a.rho)}</span></div>`;
  }

  function renderQueue() {
    if (!analysis) return;
    const A = analysis.stations;
    // bottleneck
    const bn = analysis.bottleneck; const b = A[bn];
    const crit = H.STATIONS.filter(s => A[s.id].status === 'critical').map(s => s.short);
    $('#bnCallout').innerHTML = `<div class="callout">คอขวดหลัก: <b>${esc(stName(bn))}</b> — ρ = ${pct(b.rho)}, λ = ${f1(b.lambdaH)} ราย/ชม. เทียบกับ capacity ${f1(b.capH)} ราย/ชม.
      ${b.stable ? `· รอเฉลี่ย ${fmtMin(b.Wq)} · คิว P95 ≈ ${b.q95} คน` : `· <b>คิวยาวขึ้น ${f1(b.growH)} คน/ชม.</b> → สิ้นวันคิวค้าง ≈ ${Math.round(b.qEnd)} คน`}
      ${crit.length > 1 ? `<br>หน่วยที่ล้นความสามารถ (ρ ≥ 100%): ${crit.map(esc).join(', ')}` : ''}</div>`;
    const sorted = H.STATIONS.filter(s => A[s.id].lambdaH > 0).sort((x, y) => A[y.id].rho - A[x.id].rho);
    $('#bars').innerHTML = sorted.map(s => {
      const a = A[s.id]; const w = Math.min(1.3, a.rho) / 1.3 * 100;
      const col = { ok: 'var(--ok)', warn: 'var(--warn)', critical: 'var(--crit)' }[a.status];
      return `<div class="b"><span>${esc(s.short)}</span><div class="track"><div class="fill" style="width:${w}%;background:${col}"></div>
        <div class="line85" style="left:${cfg.rhoMax / 1.3 * 100}%"></div><div class="line100" style="left:${100 / 1.3}%"></div></div><span class="mono">${pct(a.rho)}</span></div>`;
    }).join('');

    // process table
    $('#procTable').innerHTML = `<tr><th>บริการ</th><th class="n">λ ราย/ชม.</th><th class="n">× load</th><th class="n">เวลารวม</th><th class="n">รอคิวรวม</th></tr>` +
      H.PROCESSES.map(p => { const r = analysis.processes[p.id];
        return `<tr><td>${p.icon} ${esc(p.name)}</td><td class="n"><input type="number" min="0" step="0.5" data-lam="${p.id}" value="${cfg.processes[p.id].lambda}"></td>
        <td class="n">${f1(r.lambdaH)}</td><td class="n">${fmtMin(r.total)}</td><td class="n">${fmtMin(r.wait)}</td></tr>`; }).join('');
    document.querySelectorAll('[data-lam]').forEach(i => i.onchange = () => { cfg.processes[i.dataset.lam].lambda = Math.max(0, +i.value || 0); changed(); });

    // station table
    $('#stTable').innerHTML = `<tr><th>หน่วยบริการ</th><th class="n">service time (นาที)</th><th>ความแปรปรวน</th><th class="n">slot (c)</th><th class="n">slot สูงสุด</th>
      <th class="n">λ ราย/ชม.</th><th class="n">capacity</th><th>ρ (utilization)</th><th class="n">P(ต้องรอ)</th><th class="n">Lq</th><th class="n">Wq</th><th class="n">W รวม</th><th class="n">คิว P95</th><th class="n">รอ P95</th><th>สถานะ</th>
      <th class="n">DES: รอเฉลี่ย</th><th class="n">DES: คิวสูงสุด</th><th class="n">DES: util</th></tr>` +
      H.STATIONS.map(s => { const a = A[s.id], c = cfg.stations[s.id];
        return `<tr class="${s.id === bn ? 'bn' : ''}"><td>${esc(s.name)}${a.throttled ? ' <span class="chip" title="ผู้ป่วยถูกจำกัดโดยคอขวดต้นทาง">ถูกบีบ ' + f1(a.rawLambdaH) + '</span>' : ''}</td>
        <td class="n"><input type="number" min="0.5" step="0.1" data-svc="${s.id}" value="${c.svc}"></td>
        <td><select data-dist="${s.id}">${Object.entries(Q.DIST_TH).map(([k, v]) => `<option value="${k}" ${c.dist === k ? 'selected' : ''}>${v.split(' (')[0]}</option>`).join('')}</select></td>
        <td class="n"><input type="number" min="1" step="1" data-c="${s.id}" value="${c.c}"></td>
        <td class="n"><input type="number" min="1" step="1" data-max="${s.id}" value="${c.max}"></td>
        <td class="n">${f1(a.lambdaH)}</td><td class="n">${f1(a.capH)}</td><td>${rhoBar(a)}</td>
        <td class="n">${a.stable ? pct(a.Pw) : '100%'}</td><td class="n">${f1(a.Lq)}</td><td class="n">${fmtMin(a.Wq)}</td><td class="n">${fmtMin(a.W)}</td>
        <td class="n">${a.q95}</td><td class="n">${fmtMin(a.wq95)}</td><td>${badge(a.status)}</td>
        <td class="n" id="des-w-${s.id}">-</td><td class="n" id="des-q-${s.id}">-</td><td class="n" id="des-u-${s.id}">-</td></tr>`; }).join('');
    document.querySelectorAll('[data-svc]').forEach(i => i.onchange = () => setSvc(i.dataset.svc, i.value));
    document.querySelectorAll('[data-dist]').forEach(i => i.onchange = () => { cfg.stations[i.dataset.dist].dist = i.value; changed(); });
    document.querySelectorAll('[data-c]').forEach(i => i.onchange = () => { const v = Math.max(1, Math.round(+i.value || 1)); cfg.stations[i.dataset.c].c = v; if (v > cfg.stations[i.dataset.c].max) cfg.stations[i.dataset.c].max = v; sim.setServers(i.dataset.c, v); changed(); });
    document.querySelectorAll('[data-max]').forEach(i => i.onchange = () => { cfg.stations[i.dataset.max].max = Math.max(cfg.stations[i.dataset.max].c, Math.round(+i.value || 1)); changed(); });
    updateDesCells(sim.stats());
    renderSuggestions();
    renderImprove();
  }

  /* ---------- สรุปผลการปรับปรุงตามคำแนะนำ ---------- */
  function renderImprove() {
    const el = $('#improve'); if (!el) return;
    const cur = currentScenario();
    document.querySelectorAll('[data-scn]').forEach(b => b.classList.toggle('on', b.dataset.scn === cur));
    $('#scnState').textContent = { after: 'กำลังใช้: หลังปรับปรุงตามคำแนะนำ', before: 'กำลังใช้: ก่อนปรับปรุง', custom: 'กำลังใช้: ค่าที่กำหนดเอง' }[cur];
    const A0 = Q.analyze(H, scenarioCfg('before')), A1 = Q.analyze(H, scenarioCfg('after'));
    const rows = H.STATIONS.filter(s => s.before).map(s => { const a = A0.stations[s.id], b = A1.stations[s.id];
      return `<tr><td>${esc(s.name)}</td><td class="n">${s.before.c} → <b>${s.c}</b></td><td class="n">${s.before.svc} → <b>${s.svc}</b></td>
        <td>${badge(a.status)} → ${badge(b.status)}</td><td class="n">${pct(a.rho)} → <b>${pct(b.rho)}</b></td><td class="n">${fmtMin(a.Wq)} → <b>${fmtMin(b.Wq)}</b></td><td style="white-space:normal;min-width:220px">${esc(s.before.note || '')}</td></tr>`; }).join('');
    const prow = H.PROCESSES.map(p => { const a = A0.processes[p.id].total, b = A1.processes[p.id].total; const d = a - b;
      return `<tr><td>${p.icon} ${esc(p.name)}</td><td class="n">${fmtMin(a)}</td><td class="n"><b>${fmtMin(b)}</b></td><td class="n" style="color:${d > 0.5 ? 'var(--ok)' : 'var(--soft)'}">${d > 0.5 ? '−' + fmtMin(d) : '–'}</td></tr>`; }).join('');
    const bad = A => H.STATIONS.filter(s => ['warn', 'critical'].includes(A.stations[s.id].status)).length;
    el.innerHTML = `<p class="sub">คำนวณที่ load ${pct(cfg.load)}, ${cfg.hours} ชม., เป้ารอ ≤ ${cfg.targetWq} นาที — หน่วยคอขวด/เฝ้าระวัง <b>${bad(A0)} → ${bad(A1)}</b> หน่วย · คอขวดหลัก ${esc(stShort(A0.bottleneck))} ρ ${pct(A0.stations[A0.bottleneck].rho)} → ${esc(stShort(A1.bottleneck))} ρ ${pct(A1.stations[A1.bottleneck].rho)}</p>
      <div class="grid2" style="gap:16px"><div class="scroll"><table class="t"><tr><th>หน่วยที่ปรับ</th><th class="n">slot</th><th class="n">service time</th><th>สถานะ</th><th class="n">ρ</th><th class="n">Wq</th><th>สิ่งที่ทำ</th></tr>${rows}</table></div>
      <div class="scroll"><table class="t"><tr><th>บริการ</th><th class="n">เวลารวม ก่อน</th><th class="n">หลัง</th><th class="n">ลดลง</th></tr>${prow}</table></div></div>`;
  }

  function updateDesCells(st) {
    H.STATIONS.forEach(s => {
      const d = st[s.id]; const w = $('#des-w-' + s.id); if (!w) return;
      w.textContent = d.served ? fmtMin(d.avgWq) : '-';
      $('#des-q-' + s.id).textContent = d.served ? d.maxQ : '-';
      $('#des-u-' + s.id).textContent = d.served ? pct(d.util) : '-';
    });
  }

  function renderSuggestions() {
    const el = $('#sugg');
    if (!suggestions.length) { el.innerHTML = `<div class="empty">✓ ทุกหน่วยบริการอยู่ในเกณฑ์ (ρ ≤ ${pct(cfg.rhoMax)} และรอคิว ≤ ${cfg.targetWq} นาที) — ไม่ต้องปรับเพิ่ม</div>`; return; }
    el.innerHTML = suggestions.map(s => {
      const n = s.now, u = s.unfixed;
      const unfixedTxt = u.stable
        ? `คิวเฉลี่ย <b>${f1(u.Lq)}</b> คน · คิวสูงสุด (P95) <b>${u.q95}</b> คน · รอนานสุด (P95) <b>${fmtMin(u.wq95)}</b> · ควรมีเก้าอี้รอ ≥ <b>${Math.ceil(u.q95 * 1.5)}</b> ที่ (รวมญาติ ×1.5)`
        : `ไม่เสถียร: คิวเพิ่มขึ้น <b>${f1(u.growH)}</b> คน/ชม. → ครบ ${cfg.hours} ชม. คิวสูงสุด ≈ <b>${Math.round(u.qEnd)}</b> คน · ผู้ป่วยคนสุดท้ายรอ ≈ <b>${fmtMin(u.wEnd)}</b>`;
      let body;
      if (s.kind === 'add') {
        const a = s.after;
        body = `<p>✅ <b>เพิ่ม service slot จาก ${s.c} → ${s.newC} (+${s.newC - s.c})</b> ภายในขีดจำกัด ${s.max} slot</p>
          <div class="cmp"><div>ρ ปัจจุบัน → หลังปรับ<b>${pct(n.rho)} → ${pct(a.rho)}</b></div><div>เวลารอเฉลี่ย Wq<b>${fmtMin(s.unfixed.Wq)} → ${fmtMin(a.Wq)}</b></div><div>คิวสูงสุด (P95)<b>${u.q95} → ${a.q95} คน</b></div></div>
          <p style="font-size:12px;color:var(--soft)">ถ้ายังไม่ปรับ: ${unfixedTxt}</p>
          <div class="act"><button class="accent-btn" data-apply="${s.id}" data-c="${s.newC}">ใช้คำแนะนำนี้</button></div>`;
      } else {
        const m = s.atMax;
        body = `<p>⛔ <b>เพิ่ม slot ไม่พอ</b> — ต้องใช้มากกว่าขีดจำกัด ${s.max} slot (พื้นที่/บุคลากร)</p>
          <div class="cmp">
            <div>แถวคอยสูงสุดถ้าแก้ไขไม่ได้ (c=${s.c})<b>${u.stable ? u.q95 + ' คน (P95)' : '≈ ' + Math.round(u.qEnd) + ' คน สิ้นวัน'}</b></div>
            <div>ถ้าใช้ slot เต็ม ${s.max} slot<b>ρ ${pct(m.rho)} · รอ ${fmtMin(m.Wq)}</b></div>
            <div>รองรับได้ที่ ρ ${pct(cfg.rhoMax)}<b>${f1(s.maxSustainH)} ราย/ชม.</b></div>
          </div>
          <p>📏 <b>ถ้าแก้ไขไม่ได้:</b> ${unfixedTxt}</p>
          ${s.svcNeeded ? `<p>⏱ ทางเลือก: ลด service time จาก ${f1(s.svc)} → <b>${f1(s.svcNeeded)} นาที</b> (−${Math.round((1 - s.svcNeeded / s.svc) * 100)}%) ร่วมกับเพิ่มเป็น ${s.max} slot</p>` : ''}
          ${s.shiftH > 0.05 ? `<p>📅 หรือกระจายนัด/ย้ายผู้ป่วยออกจากช่วงพีค ≈ <b>${f1(s.shiftH)} ราย/ชม.</b></p>` : ''}
          <div class="act">${s.max > s.c ? `<button class="accent-btn" data-apply="${s.id}" data-c="${s.max}">เพิ่มเป็น ${s.max} slot (สูงสุด)</button>` : ''}
          ${s.svcNeeded ? `<button class="ghost" data-svcapply="${s.id}" data-v="${(Math.floor(s.svcNeeded * 10) / 10).toFixed(1)}" data-c="${s.max}">ลอง: ${s.max} slot + ${f1(s.svcNeeded)} นาที</button>` : ''}</div>`;
      }
      return `<div class="sg ${n.status}"><h4>${esc(s.name)} ${badge(n.status)} <span class="mono" style="font-size:12px;color:var(--soft)">λ ${f1(s.lambdaH)}/ชม. · ${s.c} slot · ${f1(s.svc)} นาที/ราย · ρ ${pct(n.rho)}</span></h4>${body}
        ${s.ideas.length ? `<div><span style="font-size:12px;color:var(--muted)">แนวทางเร่งความเร็วการให้บริการ:</span><ul>${s.ideas.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>` : ''}</div>`;
    }).join('');
    el.querySelectorAll('[data-apply]').forEach(b => b.onclick = () => { const id = b.dataset.apply, c = +b.dataset.c; cfg.stations[id].c = c; sim.setServers(id, c); changed(); });
    el.querySelectorAll('[data-svcapply]').forEach(b => b.onclick = () => { const id = b.dataset.svcapply; cfg.stations[id].c = +b.dataset.c; cfg.stations[id].svc = +b.dataset.v; sim.setServers(id, +b.dataset.c); changed(); });
  }

  /* =================== CATALOG =================== */
  function renderCatalog() {
    $('#catalog').innerHTML = H.CATALOG.map(g => `<div class="card grp" style="border-top-color:${g.color}"><h3>${esc(g.group)}</h3>` +
      g.units.map(u => `<div class="u"><div class="nm"><span>${esc(u.name)}</span>${u.station ? `<span class="chip q">QUEUE · ${u.station}</span>` : '<span class="chip">ไม่จำลองคิว</span>'}</div><div class="ds">${esc(u.desc)}</div></div>`).join('') + '</div>').join('');
    const used = H.STATIONS.filter(s => H.PROCESSES.some(p => p.route.includes(s.id)));
    $('#matrix').innerHTML = `<tr><th style="text-align:left!important">Process</th>${used.map(s => `<th title="${esc(s.name)}">${esc(s.short)}</th>`).join('')}</tr>` +
      H.PROCESSES.map(p => `<tr><td style="text-align:left!important">${p.icon} ${esc(p.name)}</td>${used.map(s => { const idx = p.route.map((r, i) => r === s.id ? i + 1 : 0).filter(Boolean); return `<td class="${idx.length ? 'y' : ''}">${idx.join(',')}</td>`; }).join('')}</tr>`).join('');
  }

  init(); // เรียกหลังประกาศตัวแปรทั้งหมดแล้ว
})();
