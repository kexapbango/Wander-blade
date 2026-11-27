const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const W = 960, H = 540, GY = 430, HX = 210, BD = .45; // ground y, hero screen x, block duration
const rnd = (a, b) => a + Math.random() * (b - a);
const IM = {};
function img(p) { return IM[p] || (IM[p] = Object.assign(new Image(), { src: 'assets/' + p })); }
function draw(p, x, y, w, h, flip) {
  const i = img(p); if (!i.complete || !i.naturalWidth) return;
  if (flip) { ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(i, 0, 0, w, h); ctx.restore(); }
  else ctx.drawImage(i, x, y, w, h);
}
const SFX = n => { try { const a = new Audio('assets/sfx/sfx_' + n + '.ogg'); a.volume = .35; a.play().catch(() => {}); } catch (e) {} };

// ---------- save ----------
let S;
try { S = JSON.parse(localStorage.getItem('wanderblade_save')); } catch (e) {}
S = S || { coins: 0, scrap: 0, best: 0, up: { atk: 0, hp: 0, def: 0 },
  gear: { weapon: { r: 0, l: 0 }, armor: { r: 0, l: 0 }, trinket: { r: 0, l: 0 } } };
const save = () => { try { localStorage.setItem('wanderblade_save', JSON.stringify(S)); } catch (e) {} };
function base() {
  const w = S.gear.weapon, a = S.gear.armor, t = S.gear.trinket;
  return { atk: 10 + S.up.atk * 2 + 3 + 3 * w.r + 2 * w.l, hp: 100 + S.up.hp * 10 + 15 + 15 * a.r + 8 * a.l, def: S.up.def * .5 + 1 + t.r + .5 * t.l };
}
const power = () => { const b = base(); return Math.floor(b.atk * 6 + b.hp / 2 + b.def * 8); };
const upCost = k => Math.floor(25 * Math.pow(1.35, S.up[k]));
const gearCost = s => 4 + S.gear[s].l * 3;

// ---------- menu ----------
function renderMenu() {
  const b = base(), G = S.gear;
  const slot = (k, ic, stat) => { const g = G[k], c = GEAR_RAR[g.r][1];
    return `<div class="slot" style="border-color:${c}"><b style="color:${c}">${ic} ${GEAR_RAR[g.r][0]} ${k}</b><span>Lv ${g.l} - ${stat}</span>
    <button onclick="upGear('${k}')" ${S.scrap < gearCost(k) || g.l >= 20 ? 'disabled' : ''}>Upgrade ${gearCost(k)} scrap</button></div>`; };
  const up = (k, nm) => `<button onclick="upStat('${k}')" ${S.coins < upCost(k) ? 'disabled' : ''}>${nm} Lv ${S.up[k]}<br><small>${upCost(k)} coins</small></button>`;
  $('menu').innerHTML = `<h1>WANDERBLADE</h1>
  <div class="row"><span>Coins ${S.coins}</span><span>Scrap ${S.scrap}</span><span>Power ${power()}</span><span>Best: Stage ${S.best + 1}</span></div>
  <div class="row">${slot('weapon', '\u2694', '+' + (3 + 3 * G.weapon.r + 2 * G.weapon.l) + ' ATK')}${slot('armor', '\u{1F6E1}', '+' + (15 + 15 * G.armor.r + 8 * G.armor.l) + ' HP')}${slot('trinket', '\u2728', '+' + (1 + G.trinket.r + .5 * G.trinket.l) + ' DEF')}</div>
  <div class="row">${up('atk', 'Attack')}${up('hp', 'Health')}${up('def', 'Defense')}</div>
  <p class="hint">ATK ${Math.round(b.atk)} - HP ${Math.round(b.hp)} - DEF ${b.def.toFixed(1)}</p>
  <button class="go" onclick="startRun()">START</button>
  <p class="hint">Hero fights automatically. <b>Space / J</b> = Block (time it as the "!" appears for a PERFECT block + counter). <b>E / K</b> = Skill.</p>`;
}
function upStat(k) { if (S.coins >= upCost(k)) { S.coins -= upCost(k); S.up[k]++; save(); SFX('select'); renderMenu(); } }
function upGear(k) { if (S.scrap >= gearCost(k) && S.gear[k].l < 20) { S.scrap -= gearCost(k); S.gear[k].l++; save(); SFX('select'); renderMenu(); } }

// ---------- run ----------
let g = null;
function log(s) { const d = document.createElement('div'); d.textContent = s; $('log').prepend(d); while ($('log').children.length > 4) $('log').lastChild.remove(); setTimeout(() => d.remove(), 6000); }
function startRun() {
  const b = base();
  g = { p: { maxhp: b.hp, hp: b.hp, atk: b.atk, def: b.def, as: 1, crit: .05, steal: 0, coin: 1, perf: .2, counter: 1, skCd: 9, skM: 3, blockHeal: 0, regen: 0, lv: 1, xp: 0 },
    dist: 0, stage: 0, enemies: [], texts: [], t: 0, spawnT: 1.5, atkT: 0, blockT: 0, blockCD: 0, sk: 0, boss: null,
    coins: 0, scrap: 0, kills: 0, pause: false, over: false, swing: 0, hurt: 0, shake: 0, perfFx: 0, found: [] };
  $('menu').style.display = $('over').style.display = 'none'; $('ctl').style.display = 'flex'; $('log').innerHTML = '';
  log('You set out down ' + STAGES[0].name + '.'); SFX('select');
}
const stg = () => STAGES[g.stage % STAGES.length];
const heroX = () => g.dist + HX;
function spawn(boss) {
  const st = stg(), hm = 1 + .5 * g.stage, am = 1 + .3 * g.stage;
  let d, sc = 1, x = g.dist + W + 60;
  if (boss) { d = st.boss; sc = 2.4; x = heroX() + 420; log(d.name + ' blocks the way!'); }
  else { d = ENEMIES[st.pool[Math.floor(Math.random() * st.pool.length)]]; if (Math.random() < .4) log(d.log[Math.floor(Math.random() * d.log.length)]); }
  const e = { d, x, hp: d.hp * hm, mhp: d.hp * hm, atk: d.atk * am, sc, r: boss ? 120 : 62, wind: -1, cd: rnd(.3, 1), boss: !!boss, an: Math.random() * 3 };
  g.enemies.push(e); if (boss) g.boss = e;
}
function txt(x, y, s, c) { g.texts.push({ x, y, s, c: c || '#fff', t: 0 }); }
function hurtE(e, dm, crit) {
  e.hp -= dm; txt(e.x, GY - 90 * e.sc - 10, Math.round(dm) + (crit ? '!' : ''), crit ? '#ffd23f' : '#fff');
  if (g.p.steal) g.p.hp = Math.min(g.p.maxhp, g.p.hp + dm * g.p.steal);
  if (e.hp <= 0) kill(e);
}
function kill(e) {
  g.enemies.splice(g.enemies.indexOf(e), 1); g.kills++;
  const p = g.p, c = Math.round(e.d.coin * p.coin * (1 + .15 * g.stage)); g.coins += c; txt(e.x, GY - 40, '+' + c, '#ffd23f'); SFX('coin');
  if (Math.random() < (e.boss ? 1 : .3)) { const s = e.boss ? 6 : 1 + Math.floor(Math.random() * 2); g.scrap += s; txt(e.x + 20, GY - 70, '+' + s + ' scrap', '#9ee'); }
  if (Math.random() < (e.boss ? 1 : .05)) gearDrop(e.boss);
  p.xp += e.d.xp * (1 + .1 * g.stage);
  if (e.boss) { g.boss = null; g.pending = 'boss'; }
  checkLevel();
}
function gearDrop(boss) {
  const slots = ['weapon', 'armor', 'trinket'], s = slots[Math.floor(Math.random() * 3)], roll = Math.random() * 100 - g.stage * 3 - (boss ? 25 : 0);
  const r = roll < 3 ? 3 : roll < 15 ? 2 : roll < 45 ? 1 : 0;
  if (r > S.gear[s].r) { S.gear[s] = { r, l: 0 }; log('Found ' + GEAR_RAR[r][0] + ' ' + s + '! Equipped.'); SFX('gem'); }
  else { g.scrap += 3; log('Found a worse ' + s + '. Scrapped for 3.'); }
}
function checkLevel() {
  const p = g.p, need = 20 + p.lv * 14;
  if (p.xp >= need) { p.xp -= need; p.lv++; offer(false); }
  else if (g.pending === 'boss') { g.pending = null; offer(true); }
}
function offer(boss) {
  g.pause = true;
  const pool = CARDS.filter(c => boss ? c.r !== 'c' : c.r !== 'e'), pick = [];
  while (pick.length < 3) { const c = pool[Math.floor(Math.random() * pool.length)]; if (!pick.includes(c)) pick.push(c); }
  $('cardT').textContent = boss ? 'BOSS DEFEATED - choose a reward' : 'LEVEL UP ' + g.p.lv + ' - choose a card';
  $('cards').innerHTML = pick.map((c, i) => `<div class="card" style="border-color:${RAR[c.r][1]}" onclick="takeCard(${CARDS.indexOf(c)})"><small style="color:${RAR[c.r][1]}">${RAR[c.r][0]}</small><b>${c.n}</b><span>${c.d}</span></div>`).join('');
  $('pick').style.display = 'flex'; g._boss = boss;
}
function takeCard(i) {
  CARDS[i].f(g.p); $('pick').style.display = 'none'; g.pause = false; SFX('magic');
  if (g._boss) { // stage clear
    log('Stage cleared! On to the next road...'); g.stage++; g.dist = 0; g.enemies = []; g.p.hp = Math.min(g.p.maxhp, g.p.hp + g.p.maxhp * .3);
    S.best = Math.max(S.best, g.stage); g._boss = false; log('Now entering ' + stg().name + '.');
  }
  checkLevel();
}
function block() { if (g && !g.pause && !g.over && g.blockCD <= 0 && g.blockT <= 0) { g.blockT = BD; g.blockCD = .9; } }
function skill() {
  if (!g || g.pause || g.over || g.sk > 0) return;
  g.sk = g.p.skCd; g.swing = .5; g.shake = .25; SFX('magic');
  for (const e of [...g.enemies]) if (e.x - heroX() < 340) hurtE(e, g.p.atk * g.p.skM, true);
  g.fx = .35;
}
function enemyHit(e) {
  const p = g.p; let dm = Math.max(1, e.atk - p.def);
  if (g.blockT > 0 && BD - g.blockT <= p.perf) {
    dm = 0; g.perfFx = .4; txt(heroX(), GY - 150, 'PERFECT!', '#ffd23f'); SFX('bump');
    hurtE(e, p.atk * 1.5 * p.counter, true); g.sk = Math.max(0, g.sk - 2); p.hp = Math.min(p.maxhp, p.hp + p.blockHeal);
  } else if (g.blockT > 0) { dm *= .3; txt(heroX(), GY - 130, 'Blocked ' + Math.round(dm), '#8cf'); }
  else { dm *= .8; txt(heroX(), GY - 130, '-' + Math.round(dm), '#ff6b6b'); g.hurt = .25; g.shake = .15; SFX('hurt'); }
  p.hp -= dm;
  if (p.hp <= 0) end();
}
function end() {
  g.over = true; S.coins += g.coins; S.scrap += g.scrap; S.best = Math.max(S.best, g.stage); save();
  $('ctl').style.display = 'none';
  $('over').innerHTML = `<h2>You fell on ${stg().name}</h2><p>Stage ${g.stage + 1} - ${g.kills} defeated - Level ${g.p.lv}</p><p>+${g.coins} coins, +${g.scrap} scrap</p><button class="go" onclick="toMenu()">CONTINUE</button>`;
  $('over').style.display = 'flex';
}
function toMenu() { g = null; $('over').style.display = 'none'; $('menu').style.display = 'flex'; renderMenu(); }

// ---------- update ----------
function update(dt) {
  const p = g.p, hx = heroX(), st = stg(); g.t += dt;
  g.blockT = Math.max(0, g.blockT - dt); g.blockCD = Math.max(0, g.blockCD - dt); g.sk = Math.max(0, g.sk - dt);
  g.swing = Math.max(0, g.swing - dt); g.hurt = Math.max(0, g.hurt - dt); g.shake = Math.max(0, g.shake - dt); g.perfFx = Math.max(0, g.perfFx - dt); g.fx = Math.max(0, (g.fx || 0) - dt);
  if (p.regen) p.hp = Math.min(p.maxhp, p.hp + p.regen * dt);
  if (g.dist >= st.len && !g.boss && !g.enemies.length) spawn(true);
  if (!g.boss && g.dist < st.len) { g.spawnT -= dt; if (g.spawnT <= 0 && g.enemies.length < 5) { spawn(false); g.spawnT = rnd(1.4, 3); } }
  // nearest enemy
  let near = null; for (const e of g.enemies) if (!near || e.x < near.x) near = e;
  const nd = near ? near.x - hx : 9e9;
  if (nd > 110 && !(g.dist >= st.len)) g.dist += 95 * dt;
  g.moving = nd > 110 && g.dist < st.len;
  // hero attack
  g.atkT -= dt;
  if (near && nd < 130 && g.atkT <= 0) {
    g.atkT = 1 / p.as; g.swing = .3; const crit = Math.random() < p.crit; hurtE(near, p.atk * (crit ? 2 : 1), crit);
  }
  // enemies
  for (const e of [...g.enemies]) {
    e.an += dt; const dx = e.x - hx;
    if (dx > e.r) e.x -= e.d.spd * dt;
    else if (e.wind >= 0) { e.wind -= dt; if (e.wind <= 0) { e.wind = -1; e.cd = e.boss ? 1.6 : 1.3; if (!g.over) enemyHit(e); } }
    else { e.cd -= dt; if (e.cd <= 0) e.wind = .7; }
  }
  for (const t of g.texts) t.t += dt; g.texts = g.texts.filter(t => t.t < 1);
}

// ---------- render ----------
function bgLayer(p, sp, y, size) { const off = -((g.dist * sp) % size); for (let x = off; x < W; x += size) draw('bg/' + p, x, y, size, size); }
function render() {
  const grd = ctx.createLinearGradient(0, 0, 0, GY); grd.addColorStop(0, '#8fd3ff'); grd.addColorStop(1, '#e4f7ff');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  ctx.save(); if (g && g.shake > 0) ctx.translate(rnd(-4, 4), rnd(-4, 4));
  const d = g ? g.dist : 0, tm = g ? g.t : 0;
  const sd = g; g = g || { dist: 0 };
  ctx.globalCompositeOperation = 'multiply'; bgLayer('background_color_hills.png', .2, GY - 300, 256 * 1.2 | 0); bgLayer('background_color_trees.png', .45, GY - 260, 256); ctx.globalCompositeOperation = 'source-over';
  // props (house at start, then bushes / fences / signs)
  for (let i = 0; i < 40; i++) { const wx = 120 + i * 260 + (i * 97 % 90), sx = wx - d; if (sx < -120 || sx > W + 20) continue;
    if (i === 0) { ctx.fillStyle = '#c9b48a'; ctx.fillRect(sx - 30, GY - 150, 190, 150); ctx.fillStyle = '#5b78c7'; ctx.fillRect(sx - 40, GY - 175, 210, 30);
      draw('tiles/door_closed_top.png', sx + 40, GY - 128, 64, 64); draw('tiles/door_closed.png', sx + 40, GY - 64, 64, 64); }
    else { const k = ['bush.png', 'fence.png', 'sign_right.png', 'bush.png'][i % 4]; draw('tiles/' + k, sx, GY - 56, 56, 56); } }
  for (let x = -((d % 64)); x < W; x += 64) { draw('tiles/terrain_grass_block_top.png', x, GY, 64, 64); for (let y = GY + 64; y < H; y += 64) draw('tiles/terrain_dirt_block_center.png', x, y, 64, 64); }
  g = sd;
  if (g) {
    const p = g.p, hx = HX, fr = g.moving ? (Math.floor(g.t * 8) % 2 ? 'walk_a' : 'walk_b') : 'idle';
    const lunge = g.swing > 0 ? 14 : 0;
    // enemies
    for (const e of g.enemies) { const sx = e.x - g.dist, s = 70 * e.sc, f = Math.floor(e.an * 5) % 2 ? '_a' : '_b';
      draw('enemies/' + e.d.spr + f + '.png', sx - s / 2, GY - s + 6, s, s, false);
      const w = 60 * e.sc; ctx.fillStyle = '#0006'; ctx.fillRect(sx - w / 2, GY - s - 8, w, 7); ctx.fillStyle = e.boss ? '#ff5a5a' : '#6bd36b'; ctx.fillRect(sx - w / 2, GY - s - 8, w * Math.max(0, e.hp / e.mhp), 7);
      if (e.wind >= 0) { ctx.fillStyle = '#ff3b3b'; ctx.font = 'bold 34px KF, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', sx, GY - s - 16); } }
    // hero
    draw('chars/character_beige_' + (g.hurt > 0 ? 'hit' : fr) + '.png', hx - 55 + lunge, GY - 106 + 8, 110, 110, false);
    ctx.save(); ctx.translate(hx + 25 + lunge, GY - 55); ctx.rotate(g.swing > 0 ? .9 - (.3 - Math.min(.3, g.swing)) * 8 : -.5); // oversized sword
    ctx.fillStyle = '#7a4b2a'; ctx.fillRect(-6, -8, 12, 34); ctx.fillStyle = '#c9a227'; ctx.fillRect(-18, -14, 36, 8);
    ctx.fillStyle = '#dfe8f2'; ctx.strokeStyle = '#34415a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.rect(-11, -100, 22, 86); ctx.fill(); ctx.stroke(); ctx.restore();
    if (g.blockT > 0 || g.perfFx > 0) { ctx.strokeStyle = g.perfFx > 0 ? '#ffd23f' : '#6fb5ff'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(hx + 34, GY - 50, 52, -1.2, 1.2); ctx.stroke(); }
    if (g.fx > 0) { ctx.fillStyle = 'rgba(255,255,255,' + g.fx + ')'; ctx.fillRect(0, 0, W, H); }
    // texts
    ctx.textAlign = 'center'; ctx.font = 'bold 22px KF, sans-serif';
    for (const t of g.texts) { ctx.globalAlpha = 1 - t.t; ctx.fillStyle = '#000'; ctx.fillText(t.s, t.x - g.dist + 1, t.y - t.t * 40 + 2); ctx.fillStyle = t.c; ctx.fillText(t.s, t.x - g.dist, t.y - t.t * 40); } ctx.globalAlpha = 1;
    ctx.restore(); hud();
  } else ctx.restore();
}
function bar(x, y, w, h, v, c) { ctx.fillStyle = '#0008'; ctx.fillRect(x, y, w, h); ctx.fillStyle = c; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, v)), h); ctx.strokeStyle = '#1b2233'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); }
function hud() {
  const p = g.p, st = stg(); ctx.textAlign = 'left'; ctx.font = '14px KF, sans-serif'; ctx.fillStyle = '#fff';
  bar(14, 14, 230, 20, p.hp / p.maxhp, '#e8484f'); ctx.fillStyle = '#fff'; ctx.fillText(Math.ceil(p.hp) + ' / ' + Math.round(p.maxhp), 22, 30);
  bar(14, 40, 230, 10, p.xp / (20 + p.lv * 14), '#4aa3ff'); ctx.fillStyle = '#1b2233'; ctx.fillText('Lv ' + p.lv, 14, 70);
  ctx.textAlign = 'center'; ctx.fillStyle = '#1b2233'; ctx.fillText('Stage ' + (g.stage + 1) + ': ' + st.name, W / 2, 24);
  bar(W / 2 - 160, 32, 320, 12, g.dist / st.len, g.boss ? '#ff5a5a' : '#ffb347');
  ctx.textAlign = 'right'; ctx.fillStyle = '#1b2233'; ctx.fillText('Coins ' + g.coins + '   Scrap ' + g.scrap, W - 14, 28);
  $('bSkill').textContent = g.sk > 0 ? 'SKILL ' + g.sk.toFixed(1) + 's' : 'SKILL (E)'; $('bSkill').classList.toggle('rdy', g.sk <= 0);
  $('bBlock').classList.toggle('rdy', g.blockCD <= 0);
}

// ---------- loop & input ----------
let last = performance.now();
function loop(n) { const dt = Math.min(.05, (n - last) / 1000); last = n; if (g && !g.pause && !g.over) update(dt); render(); requestAnimationFrame(loop); }
addEventListener('keydown', e => { if (e.repeat) return; if (e.code === 'Space' || e.code === 'KeyJ') { e.preventDefault(); block(); } if (e.code === 'KeyE' || e.code === 'KeyK') skill(); });
$('bBlock').addEventListener('pointerdown', e => { e.preventDefault(); block(); });
$('bSkill').addEventListener('pointerdown', e => { e.preventDefault(); skill(); });
['chars/character_beige_idle.png', 'chars/character_beige_walk_a.png', 'chars/character_beige_walk_b.png', 'chars/character_beige_hit.png'].forEach(img);
document.fonts.load('14px KF').finally(() => { renderMenu(); requestAnimationFrame(loop); });
