const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const W = 540, H = 960, GY = 600, HX = 130, EX = 385, BD = .45, WALK = 2.2; // ground y, hero x, enemy x, block time, walk time
const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
const IM = {};
function img(p) { return IM[p] || (IM[p] = Object.assign(new Image(), { src: 'assets/' + p })); }
function draw(p, x, y, w, h) { const i = img(p); if (i.complete && i.naturalWidth) ctx.drawImage(i, x, y, w, h); }
const SFX = n => { try { const a = new Audio('assets/sfx/sfx_' + n + '.ogg'); a.volume = .35; a.play().catch(() => {}); } catch (e) {} };

// ---------- save ----------
let S; try { S = JSON.parse(localStorage.getItem('wanderblade_save2')); } catch (e) {}
S = S || { coins: 0, scrap: 0, best: 0, up: { atk: 0, hp: 0, def: 0 } };
const save = () => { try { localStorage.setItem('wanderblade_save2', JSON.stringify(S)); } catch (e) {} };
const base = () => ({ atk: 12 + S.up.atk * 2, hp: 100 + S.up.hp * 10, def: 1 + S.up.def * .5 });
const upCost = k => Math.floor(25 * Math.pow(1.35, S.up[k]));

// ---------- menu ----------
function renderMenu() {
  const b = base(), up = (k, nm, v) => `<button onclick="upStat('${k}')" ${S.coins < upCost(k) ? 'disabled' : ''}>${nm} ${v}<br><small>Lv ${S.up[k]} - ${upCost(k)} coins</small></button>`;
  $('menu').innerHTML = `<h1>WANDER<br>BLADE</h1>
  <div class="row"><span>Coins ${S.coins}</span><span>Scrap ${S.scrap}</span><span>Best: Stage ${S.best + 1}</span></div>
  <div class="row">${up('atk', 'Attack', Math.round(b.atk))}${up('hp', 'Health', Math.round(b.hp))}${up('def', 'Defense', b.def.toFixed(1))}</div>
  <button class="go" onclick="startRun()">START</button>
  <p class="hint">The hero walks on its own and fights automatically.<br><b>BLOCK</b> when the red "!" appears for a PERFECT block and counter. <b>SKILL</b> hits everything. Scrap lets you reroll cards.</p>`;
}
function upStat(k) { if (S.coins >= upCost(k)) { S.coins -= upCost(k); S.up[k]++; save(); SFX('select'); renderMenu(); } }

// ---------- run ----------
let g = null;
const stg = () => STAGES[g.stage % STAGES.length];
function say(s) { g.lines.push(s); if (g.lines.length > 3) g.lines.shift(); $('log').innerHTML = g.lines.map((l, i) => `<p class="${i === g.lines.length - 1 ? 'new' : ''}">${l}</p>`).join(''); }
function genScenes() {
  const n = stg().scenes, a = [];
  for (let i = 0; i < n - 1; i++) { const r = Math.random(); a.push({ t: i === 0 ? 'fight' : r < .5 ? 'fight' : r < .65 ? 'ambush' : r < .78 ? 'treasure' : r < .9 ? 'berries' : 'trap' }); }
  a.push({ t: 'boss' }); return a;
}
function startRun() {
  const b = base();
  g = { p: { maxhp: b.hp, hp: b.hp, atk: b.atk, def: b.def, as: 1, crit: .05, steal: 0, coin: 1, perf: .2, counter: 1, skCd: 9, skM: 3, blockHeal: 0, regen: 0, lv: 1, xp: 0 },
    stage: 0, idx: 0, scenes: [], enemies: [], texts: [], t: 0, scroll: 0, phase: 'walk', phT: 0, atkT: 0, blockT: 0, blockCD: 0, sk: 0,
    coins: 0, scrap: 0, kills: 0, pause: false, over: false, swing: 0, hurt: 0, shake: 0, perfFx: 0, fx: 0, lines: [], prop: null, trap: null };
  g.scenes = genScenes(); prepare();
  $('menu').style.display = $('over').style.display = 'none'; $('ctl').style.display = 'flex'; $('log').style.display = 'block';
  say('You set out down ' + stg().name + '.'); SFX('select');
}
function prepare() { // set up what waits at the end of the next stretch of road
  const sc = g.scenes[g.idx], st = stg(), hm = 1 + .5 * g.stage + .06 * g.idx, am = 1 + .3 * g.stage + .04 * g.idx;
  g.enemies = []; g.prop = null; g.trap = null; g.phase = 'walk'; g.phT = 0;
  const mk = (d, sx, big) => g.enemies.push({ d, tx: sx, x: W + 120, hp: d.hp * hm, mhp: d.hp * hm, atk: d.atk * am, sc: big ? 1.9 : 1, wind: -1, cd: rnd(.5, 1.2), boss: !!big, an: Math.random() * 3 });
  if (sc.t === 'boss') mk(st.boss, EX, true);
  else if (sc.t === 'fight') mk(ENEMIES[pick(st.pool)], EX);
  else if (sc.t === 'ambush') { mk(ENEMIES[pick(st.pool)], EX); mk(ENEMIES[pick(st.pool)], EX + 95); }
  else g.prop = { t: sc.t, tx: EX, x: W + 120 };
}
function arrive() {
  const sc = g.scenes[g.idx]; g.phT = 0;
  if (sc.t === 'boss') { g.phase = 'fight'; say(stg().boss.name + ' blocks the way!'); }
  else if (sc.t === 'fight' || sc.t === 'ambush') { g.phase = 'fight'; say(pick(g.enemies[0].d.intro) + (sc.t === 'ambush' ? ' And a friend!' : '')); }
  else { g.phase = 'event'; say(pick(EVENTS[sc.t]));
    if (sc.t === 'treasure') { const c = Math.round(rnd(10, 22) * (1 + g.stage * .5) * g.p.coin), s = 1 + Math.floor(Math.random() * 3); g.coins += c; g.scrap += s; txt(EX, GY - 120, '+' + c + ' coins', '#ffd23f'); txt(EX, GY - 90, '+' + s + ' scrap', '#9ee'); SFX('gem'); }
    if (sc.t === 'berries') { const h = Math.round(g.p.maxhp * .3); g.p.hp = Math.min(g.p.maxhp, g.p.hp + h); txt(HX, GY - 170, '+' + h + ' HP', '#7be07b'); SFX('magic'); }
    if (sc.t === 'trap') g.trap = { w: 1.1 };
  }
}
function next() { g.idx++; if (g.idx >= g.scenes.length) g.idx = g.scenes.length - 1; prepare(); }
function txt(x, y, s, c) { g.texts.push({ x, y, s, c: c || '#fff', t: 0 }); }
function hurtE(e, dm, crit) {
  e.hp -= dm; txt(e.x, GY - 130 * e.sc, Math.round(dm) + (crit ? '!' : ''), crit ? '#ffd23f' : '#fff');
  if (g.p.steal) g.p.hp = Math.min(g.p.maxhp, g.p.hp + dm * g.p.steal);
  if (e.hp <= 0) kill(e);
}
function kill(e) {
  g.enemies.splice(g.enemies.indexOf(e), 1); g.kills++; const p = g.p;
  const c = Math.round(e.d.coin * p.coin * (1 + .15 * g.stage)); g.coins += c; txt(e.x, GY - 60, '+' + c, '#ffd23f'); SFX('coin');
  if (Math.random() < (e.boss ? 1 : .3)) { const s = e.boss ? 6 : 1 + Math.floor(Math.random() * 2); g.scrap += s; txt(e.x + 30, GY - 100, '+' + s + ' scrap', '#9ee'); }
  p.xp += e.d.xp * (1 + .1 * g.stage);
  if (!g.enemies.length) { if (e.boss) g.pending = 'boss'; else { g.phase = 'clear'; g.phT = 0; } }
  checkLevel();
}
function checkLevel() {
  const p = g.p, need = 20 + p.lv * 14;
  if (p.xp >= need) { p.xp -= need; p.lv++; offer(false); }
  else if (g.pending === 'boss') { g.pending = null; offer(true); }
}
function offer(boss) {
  g.pause = true; g._boss = boss;
  const pool = CARDS.filter(c => boss ? c.r !== 'c' : c.r !== 'e'), pk = [];
  while (pk.length < 3) { const c = pick(pool); if (!pk.includes(c)) pk.push(c); }
  $('cardT').textContent = boss ? 'BOSS DEFEATED! Choose a reward' : 'LEVEL UP ' + g.p.lv + '! Choose a card';
  $('cards').innerHTML = pk.map(c => `<div class="card" style="border-color:${RAR[c.r][1]}" onclick="takeCard(${CARDS.indexOf(c)})"><small style="color:${RAR[c.r][1]}">${RAR[c.r][0]}</small><b>${c.n}</b><span>${c.d}</span></div>`).join('');
  $('reroll').textContent = 'Reroll (2 scrap) - you have ' + g.scrap; $('reroll').disabled = g.scrap < 2;
  $('pick').style.display = 'flex';
}
function reroll() { if (g.scrap >= 2) { g.scrap -= 2; offer(g._boss); SFX('select'); } }
function takeCard(i) {
  CARDS[i].f(g.p); $('pick').style.display = 'none'; g.pause = false; SFX('magic');
  if (g._boss) {
    g.stage++; g.idx = 0; S.best = Math.max(S.best, g.stage); g.p.hp = Math.min(g.p.maxhp, g.p.hp + g.p.maxhp * .3);
    g._boss = false; g.scenes = genScenes(); prepare(); say('Stage cleared! Now entering ' + stg().name + '.');
  }
  checkLevel();
}
function block() { if (g && !g.pause && !g.over && g.blockCD <= 0 && g.blockT <= 0) { g.blockT = BD; g.blockCD = .9; } }
function skill() {
  if (!g || g.pause || g.over || g.sk > 0 || g.phase !== 'fight') return;
  g.sk = g.p.skCd; g.swing = .5; g.shake = .25; g.fx = .35; SFX('magic');
  for (const e of [...g.enemies]) hurtE(e, g.p.atk * g.p.skM, true);
}
function damage(dm, sx) { // damage to the hero, with block logic
  const p = g.p;
  if (g.blockT > 0 && BD - g.blockT <= p.perf) { g.perfFx = .4; txt(HX, GY - 190, 'PERFECT!', '#ffd23f'); SFX('bump'); g.sk = Math.max(0, g.sk - 2); p.hp = Math.min(p.maxhp, p.hp + p.blockHeal); return true; }
  if (g.blockT > 0) { dm *= .3; txt(HX, GY - 170, 'Blocked ' + Math.round(dm), '#8cf'); }
  else { dm *= .8; txt(HX, GY - 170, '-' + Math.round(dm), '#ff6b6b'); g.hurt = .25; g.shake = .15; SFX('hurt'); }
  p.hp -= dm; if (p.hp <= 0) end(); return false;
}
function end() {
  g.over = true; S.coins += g.coins; S.scrap += g.scrap; S.best = Math.max(S.best, g.stage); save();
  $('ctl').style.display = $('log').style.display = 'none';
  $('over').innerHTML = `<h2>You fell on ${stg().name}</h2><p>Stage ${g.stage + 1}, encounter ${g.idx + 1}<br>${g.kills} defeated - Level ${g.p.lv}</p><p>+${g.coins} coins, +${g.scrap} scrap</p><button class="go" onclick="toMenu()">CONTINUE</button>`;
  $('over').style.display = 'flex';
}
function toMenu() { g = null; $('over').style.display = 'none'; $('menu').style.display = 'flex'; renderMenu(); }

// ---------- update ----------
function update(dt) {
  const p = g.p; g.t += dt; g.phT += dt;
  for (const k of ['swing', 'hurt', 'shake', 'perfFx', 'fx', 'sk', 'blockT', 'blockCD']) g[k] = Math.max(0, g[k] - dt);
  if (p.regen) p.hp = Math.min(p.maxhp, p.hp + p.regen * dt);
  for (const t of g.texts) t.t += dt; g.texts = g.texts.filter(t => t.t < 1);
  if (g.phase === 'walk') {
    g.scroll += 150 * dt; const k = Math.min(1, g.phT / WALK), e = 1 - Math.pow(1 - k, 2);
    for (const en of g.enemies) en.x = en.tx + (W + 120 - en.tx) * (1 - e);
    if (g.prop) g.prop.x = g.prop.tx + (W + 120 - g.prop.tx) * (1 - e);
    if (g.phT >= WALK) arrive();
  } else if (g.phase === 'fight') {
    g.atkT -= dt; const near = g.enemies[0];
    if (near && g.atkT <= 0) { g.atkT = 1 / p.as; g.swing = .3; const cr = Math.random() < p.crit; hurtE(near, p.atk * (cr ? 2 : 1), cr); }
    for (const e of [...g.enemies]) {
      e.an += dt;
      if (e.wind >= 0) { e.wind -= dt; if (e.wind <= 0) { e.wind = -1; e.cd = e.boss ? 1.7 : 1.4; const dm = Math.max(1, e.atk - p.def); if (damage(dm) && e.hp > 0) hurtE(e, p.atk * 1.5 * p.counter, true); } }
      else { e.cd -= dt; if (e.cd <= 0) e.wind = .7; }
    }
  } else if (g.phase === 'event') {
    if (g.trap && g.trap.w > 0) { g.trap.w -= dt; if (g.trap.w <= 0) { const dm = Math.max(1, p.maxhp * .15); if (damage(dm)) say('You dodged the rocks perfectly!'); } }
    if (g.phT > 2.2) next();
  } else if (g.phase === 'clear') { if (g.phT > 1) next(); }
}

// ---------- render ----------
function layer(p, sp, y, size) { const off = -((g.scroll * sp) % size); for (let x = off; x < W; x += size) draw('bg/' + p, x, y, size, size); }
function render() {
  const sd = g, st = g ? stg() : STAGES[0]; g = g || { scroll: 0, t: 0, stage: 0, idx: 0, scenes: [], enemies: [], texts: [] };
  const grd = ctx.createLinearGradient(0, 0, 0, GY); grd.addColorStop(0, st.sky[0]); grd.addColorStop(1, st.sky[1]);
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H); ctx.save(); if (g.shake > 0) ctx.translate(rnd(-4, 4), rnd(-4, 4));
  ctx.globalCompositeOperation = 'multiply'; layer('background_color_hills.png', .2, GY - 380, 360); layer('background_color_trees.png', .45, GY - 330, 330); ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 80; i++) { const sx = 160 + i * 230 + (i * 97 % 80) - g.scroll; if (sx < -80 || sx > W + 20) continue; draw('tiles/' + ['bush.png', 'fence.png', 'sign_right.png', 'bush.png'][i % 4], sx, GY - 70, 70, 70); }
  for (let x = -(g.scroll % 64); x < W; x += 64) { draw('tiles/terrain_grass_block_top.png', x, GY, 64, 64); for (let y = GY + 64; y < H; y += 64) draw('tiles/terrain_dirt_block_center.png', x, y, 64, 64); }
  if (!sd) { g = sd; ctx.restore(); return; }
  const p = g.p, walking = g.phase === 'walk', fr = walking ? (Math.floor(g.t * 8) % 2 ? 'walk_a' : 'walk_b') : 'idle', lunge = g.swing > 0 ? 18 : 0;
  if (g.prop) { const q = g.prop; if (q.t === 'treasure') { draw('tiles/coin_gold.png', q.x - 40, GY - 90, 90, 90); } else if (q.t === 'berries') draw('tiles/bush.png', q.x - 45, GY - 90, 90, 90); else draw('tiles/sign_right.png', q.x - 40, GY - 90, 90, 90); }
  for (const e of [...g.enemies].reverse()) { const s = 120 * e.sc, f = Math.floor(e.an * 5) % 2 ? '_a' : '_b';
    draw('enemies/' + e.d.spr + f + '.png', e.x - s / 2, GY - s + 8, s, s);
    const w = 90 * e.sc; ctx.fillStyle = '#0006'; ctx.fillRect(e.x - w / 2, GY - s - 6, w, 9); ctx.fillStyle = e.boss ? '#ff5a5a' : '#6bd36b'; ctx.fillRect(e.x - w / 2, GY - s - 6, w * Math.max(0, e.hp / e.mhp), 9);
    if (e.wind >= 0) { ctx.fillStyle = '#ff3b3b'; ctx.font = 'bold 46px KF, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', e.x, GY - s - 18); } }
  if (g.trap && g.trap.w > 0) { ctx.fillStyle = '#ff3b3b'; ctx.font = 'bold 46px KF, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', HX, GY - 210);
    ctx.fillStyle = '#7b7f8a'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(HX - 50 + i * 34, GY - 330 + (1.1 - g.trap.w) * 330 + (i % 2) * 22, 16, 0, 7); ctx.fill(); } }
  draw('chars/character_beige_' + (g.hurt > 0 ? 'hit' : fr) + '.png', HX - 80 + lunge, GY - 150 + 10, 160, 160);
  ctx.save(); ctx.translate(HX + 35 + lunge, GY - 80); ctx.rotate(g.swing > 0 ? .9 - (.3 - Math.min(.3, g.swing)) * 8 : -.5);
  ctx.fillStyle = '#7a4b2a'; ctx.fillRect(-8, -10, 16, 46); ctx.fillStyle = '#c9a227'; ctx.fillRect(-26, -18, 52, 10);
  ctx.fillStyle = '#dfe8f2'; ctx.strokeStyle = '#34415a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.rect(-16, -140, 32, 122); ctx.fill(); ctx.stroke(); ctx.restore();
  if (g.blockT > 0 || g.perfFx > 0) { ctx.strokeStyle = g.perfFx > 0 ? '#ffd23f' : '#6fb5ff'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(HX + 50, GY - 75, 75, -1.2, 1.2); ctx.stroke(); }
  ctx.textAlign = 'center'; ctx.font = 'bold 28px KF, sans-serif';
  for (const t of g.texts) { ctx.globalAlpha = 1 - t.t; ctx.fillStyle = '#000'; ctx.fillText(t.s, t.x + 2, t.y - t.t * 50 + 2); ctx.fillStyle = t.c; ctx.fillText(t.s, t.x, t.y - t.t * 50); } ctx.globalAlpha = 1;
  ctx.restore(); if (g.fx > 0) { ctx.fillStyle = 'rgba(255,255,255,' + g.fx + ')'; ctx.fillRect(0, 0, W, H); }
  hud();
}
function bar(x, y, w, h, v, c) { ctx.fillStyle = '#0008'; ctx.fillRect(x, y, w, h); ctx.fillStyle = c; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, v)), h); ctx.strokeStyle = '#1b2233'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h); }
function hud() {
  const p = g.p, st = stg(); ctx.textAlign = 'left'; ctx.font = '18px KF, sans-serif';
  bar(16, 16, 330, 28, p.hp / p.maxhp, '#e8484f'); ctx.fillStyle = '#fff'; ctx.fillText(Math.ceil(p.hp) + ' / ' + Math.round(p.maxhp), 26, 37);
  bar(16, 50, 330, 12, p.xp / (20 + p.lv * 14), '#4aa3ff'); ctx.fillStyle = '#1b2233'; ctx.fillText('Lv ' + p.lv, 16, 86);
  ctx.textAlign = 'right'; ctx.fillText('Coins ' + g.coins, W - 16, 34); ctx.fillText('Scrap ' + g.scrap, W - 16, 60);
  ctx.textAlign = 'center'; ctx.fillText('Stage ' + (g.stage + 1) + ': ' + st.name, W / 2, 124);
  const n = g.scenes.length, gap = Math.min(46, (W - 80) / n); // trail of encounters
  for (let i = 0; i < n; i++) { const x = W / 2 - (n - 1) * gap / 2 + i * gap, boss = i === n - 1; ctx.beginPath(); ctx.arc(x, 156, boss ? 14 : 9, 0, 7);
    ctx.fillStyle = i < g.idx ? '#5a6275' : i === g.idx ? '#ffb347' : boss ? '#ff7a7a' : '#fff'; ctx.fill(); ctx.strokeStyle = '#1b2233'; ctx.lineWidth = 3; ctx.stroke(); }
  $('bSkill').textContent = g.sk > 0 ? 'SKILL ' + g.sk.toFixed(1) + 's' : 'SKILL'; $('bSkill').classList.toggle('rdy', g.sk <= 0 && g.phase === 'fight');
  $('bBlock').classList.toggle('rdy', g.blockCD <= 0);
}

// ---------- loop & input ----------
let last = performance.now();
function loop(n) { const dt = Math.min(.05, (n - last) / 1000); last = n; if (g && !g.pause && !g.over) update(dt); render(); requestAnimationFrame(loop); }
addEventListener('keydown', e => { if (e.repeat) return; if (e.code === 'Space' || e.code === 'KeyJ') { e.preventDefault(); block(); } if (e.code === 'KeyE' || e.code === 'KeyK') skill(); });
$('bBlock').addEventListener('pointerdown', e => { e.preventDefault(); block(); });
$('bSkill').addEventListener('pointerdown', e => { e.preventDefault(); skill(); });
function fit() { const w = $('wrap'); w.style.fontSize = w.clientWidth / 30 + 'px'; }
addEventListener('resize', fit); fit();
['chars/character_beige_idle.png', 'chars/character_beige_walk_a.png', 'chars/character_beige_walk_b.png', 'chars/character_beige_hit.png'].forEach(img);
document.fonts.load('14px KF').finally(() => { renderMenu(); requestAnimationFrame(loop); });
