// ===== Step 3: idle adventure loop =====
// Turn-based fights (you -> enemy -> you ...), encounters, EXP + card picks, hunger, resting (also offline), losing, arcs.
// All tuning numbers live in T so balancing is easy.
const T = {
  NODES_PER_DAY: 7,
  HUNGER_STEP: 5,          // hunger used per CONTINUE (100 = full)
  STARVE_HP: .08,          // HP lost per step when starving (share of max HP); starving never kills (stops at 1 HP)
  REST_HUNGER_SEC: 8,      // resting: +1 hunger every N seconds
  REST_HP_SEC: 10,         // resting: +1% max HP every N seconds
  REST_EVENT_SEC: 45,      // resting: a small event finds you every N seconds (app open)
  OFFLINE_EVENT_SEC: 300,  // ...and every N seconds while the app is closed
  OFFLINE_CAP_H: 8,        // resting while the app is closed counts up to N hours
  TURN_MS: 420,            // pause between turns in a fight
  DEF_K: 60,               // damage reduction = DEF / (DEF + DEF_K)
  GROUND_IDLE: .62, GROUND_RUN: .47,
};
const daysInArc = a => 3 + a;                 // arcs get longer
const xpNeed = lv => 15 + lv * 10;
const stage = a => STAGES[a % STAGES.length];
const tier = a => Math.floor(a / STAGES.length); // after the last arc the list loops, tougher
const rnd = (a, b) => a + Math.random() * (b - a);
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
const GSFX = n => { try { const a = new Audio('assets/sfx/sfx_' + n + '.ogg'); a.volume = .35; a.play().catch(() => {}); } catch (e) {} };
const CARD_BY_ID = Object.fromEntries(CARD_POOL.map(c => [c.id, c]));

// ---------- save ----------
const SAVE_KEY = 'wanderblade_v3';
let S = null; try { S = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) {}
S = S || { coins: 0, junk: 0, arc: 0, run: null, t: Date.now() };
function save() { S.t = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }

let run = S.run, mode = 'idle', paused = false, busy = false;

// ---------- hero stats for this run (base + cards + temporary event effects) ----------
function stats() {
  const p = Object.assign({}, HERO_BASE);
  if (run) {
    for (const id in run.cards) for (let i = 0; i < run.cards[id]; i++) CARD_BY_ID[id].f(p);
    for (const e of run.effects) p[e.stat] *= e.mult;
  }
  p.maxhp = Math.round(p.maxhp); return p;
}
const heal = (amt, p = stats()) => { run.hp = Math.min(p.maxhp, run.hp + amt); };

// ---------- UI ----------
const ICON = {
  '?': '?', event: '!',
  fight: '<svg viewBox="0 0 20 20"><path d="M3 2l2 0 8 8-2 2-8-8zM17 2h-2l-8 8 2 2 8-8zM4 14l2 2-2 2-2-2zM16 14l-2 2 2 2 2-2z"/></svg>',
  loot:  '<svg viewBox="0 0 20 20"><path d="M2 8a8 5 0 0116 0zM2 9h16v8H2z"/></svg>',
  boss:  '<svg viewBox="0 0 20 20"><path d="M10 2a7 7 0 00-7 7c0 2.5 1.3 4.2 3 5v3h8v-3c1.7-.8 3-2.5 3-5a7 7 0 00-7-7zM7 8.5a1.6 1.6 0 110 3.2 1.6 1.6 0 010-3.2zm6 0a1.6 1.6 0 110 3.2 1.6 1.6 0 010-3.2z"/></svg>',
};
ICON.elite = ICON.boss;
const kindIcon = r => r === 'fight' || r === 'elite' || r === 'boss' ? r : r === 'loot' ? 'loot' : 'event';
function drawTrack() {
  if (!run) return; const p = stats();
  $('tDay').textContent = run.day; $('day').textContent = run.day;
  $('nodes').innerHTML = run.plan.map((n, i) => {
    const show = n.t === '?' && p.scout ? kindIcon(n.real) : n.t;
    return `<span class="node ${n.t === 'boss' ? 'boss' : n.t === 'elite' ? 'elite' : ''} ${i < run.node ? 'done' : i === run.node ? 'cur' : ''}">${ICON[show]}</span>`;
  }).join('');
}
function showStats() {
  const p = stats(), r = run;
  if (r) r.hp = Math.min(r.hp, p.maxhp);
  const hp = r ? Math.max(0, Math.ceil(r.hp)) : p.maxhp;
  $('sLv').textContent = r ? r.lv : 1; $('sXp').style.width = r ? (100 * r.xp / xpNeed(r.lv)) + '%' : '0%';
  $('sAtk').textContent = Math.round(p.atk * (r && r.hp < p.maxhp * .5 ? 1 + p.berserk : 1)); $('sDef').textContent = Math.round(p.def);
  $('sHp').textContent = hp + '/' + p.maxhp; $('sHpBar').style.width = (100 * hp / p.maxhp) + '%';
  const hu = r ? r.hunger : 100;
  $('rHunger').style.width = hu + '%'; $('rHunger').classList.toggle('empty', hu <= 0);
  $('rCoins').textContent = r ? r.coins : 0; $('rJunk').textContent = r ? r.junk : 0;
  $('hunger').style.width = hu + '%'; $('coins').textContent = S.coins; $('junk').textContent = S.junk;
  $('stats').innerHTML = `<span>HP ${HERO_BASE.maxhp}</span><span>ATK ${HERO_BASE.atk}</span><span>DEF ${HERO_BASE.def}</span>`;
}
function log(text, cls) {
  const p = document.createElement('p'); p.textContent = text; if (cls) p.className = cls;
  const L = $('log'); L.appendChild(p); while (L.children.length > 80) L.firstChild.remove(); L.scrollTop = L.scrollHeight;
}
(function glue() { $('panel').style.top = (Scene.ground * 100) + '%'; requestAnimationFrame(glue); })();
function setBusy(b) { busy = b; $('next').disabled = b; $('rest').disabled = b; }
function setTitle() { $('stageName').textContent = (S.arc + 1) + '. ' + stage(S.arc).name; }

function setMode(m) {
  mode = m; document.body.classList.toggle('run', m === 'run'); document.body.classList.toggle('rest', m === 'rest');
  Scene.setWalking(m === 'run' && !busy); Scene.setGround(m === 'run' ? T.GROUND_RUN : T.GROUND_IDLE);
  $('start').textContent = m === 'rest' ? 'CONTINUE · DAY ' + run.day : 'START';
  if (m === 'run') {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.dataset.p === 'adv'));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.id === 'p-adv'));
  }
  if (m === 'rest') $('restNote').textContent = 'Resting... events still find you, just slower.';
  setTitle(); showStats(); drawTrack();
}

// ---------- dialogs ----------
function ask(title, msg, yes) {
  return new Promise(res => {
    $('cTitle').textContent = title; $('cMsg').textContent = msg; $('cYes').textContent = yes || 'Yes';
    $('confirmOv').classList.add('on'); SFX('open_001');
    $('cYes').onclick = () => { $('confirmOv').classList.remove('on'); res(true); };
    $('cNo').onclick = () => { $('confirmOv').classList.remove('on'); SFX('back_001'); res(false); };
  });
}
function message(title, msg, ok) {
  return new Promise(res => {
    $('mTitle').textContent = title; $('mMsg').innerHTML = msg; $('mOk').textContent = ok || 'OK';
    $('msgOv').classList.add('on'); $('mOk').onclick = () => { $('msgOv').classList.remove('on'); SFX('click_001'); res(); };
  });
}
// waits that respect pause and stop instantly if the run is abandoned/lost
function wait(ms) {
  const id = run && run.id;
  return new Promise((res, rej) => {
    let t = 0; const iv = setInterval(() => {
      if (!run || run.id !== id) { clearInterval(iv); rej('abort'); return; }
      if (!paused) t += 50; if (t >= ms) { clearInterval(iv); res(); }
    }, 50);
  });
}

// ---------- day plan ----------
function planDay() {
  const last = run.day >= daysInArc(S.arc), pool = ['fight', 'fight', 'fight', '?', '?', 'loot', 'event'];
  run.plan = [];
  for (let i = 0; i < T.NODES_PER_DAY - 1; i++) {
    const t = i === 0 ? 'fight' : pick(pool);
    const real = t === '?' ? pick(['fight', 'loot', 'berries', 'trap', 'traveler', 'nothing']) : t === 'event' ? pick(['berries', 'trap', 'traveler']) : t;
    run.plan.push({ t, real });
  }
  run.plan.push(last ? { t: 'boss', real: 'boss' } : { t: 'elite', real: 'elite' });  // each day ends with a tough fight, the arc's last day with its boss
}

// ---------- fights ----------
function makeEnemy(key, kind) {
  const d = ENEMIES[key], a = S.arc, day = run.day, el = kind === 'elite', tr = 1 + .8 * tier(a);
  const hm = (1 + .1 * (day - 1)) * (el ? 1.5 : 1) * tr, am = (1 + .06 * (day - 1)) * (el ? 1.25 : 1) * tr;
  return { name: (el ? 'Big ' : '') + key[0].toUpperCase() + key.slice(1), spr: d.spr, hp: Math.round(d.hp * hm), maxhp: Math.round(d.hp * hm),
    atk: d.atk * am, def: (d.def || 0) * tr, combo: d.combo || 0, xp: Math.round(d.xp * (el ? 2 : 1) * tr), coin: d.coin * (el ? 2 : 1) * tr,
    intro: (el ? 'A big one! ' : '') + pick(d.intro), boss: false };
}
function makeBoss() {
  const b = stage(S.arc).boss, tr = 1 + .8 * tier(S.arc);
  return { name: b.name, spr: b.spr, hp: Math.round(b.hp * tr), maxhp: Math.round(b.hp * tr), atk: b.atk * tr, def: (b.def || 0) * tr, combo: b.combo || 0,
    xp: Math.round(b.xp * tr), coin: b.coin * tr, intro: b.name + ' blocks the road!', boss: true };
}
const reduce = (atk, def, pen) => { const d = Math.max(0, def * (1 - pen)); return atk * (1 - d / (d + T.DEF_K)); };

async function heroAttack(e, p, st) {
  st.attacks++;
  let atk = p.atk * (run.hp < p.maxhp * .5 ? 1 + p.berserk : 1);
  if (p.triple && st.attacks % 3 === 0) atk *= 1 + p.triple;
  const crit = Math.random() < p.crit; if (crit) atk *= p.critDmg;
  const dmg = Math.max(1, Math.round(reduce(atk * rnd(.9, 1.1), e.def, p.pen)));
  Scene.lunge('hero'); await wait(150);
  e.hp -= dmg; Scene.hurt('enemy', crit); Scene.enemyHp(e.hp / e.maxhp); GSFX('bump');
  Scene.float(dmg + (crit ? '!' : ''), crit ? '#ffd23f' : '#ffffff', 'enemy', crit);
  if (p.steal) { heal(dmg * p.steal, p); showStats(); }
}
async function enemyAttack(e, p, st) {
  Scene.lunge('enemy'); await wait(150);
  let dmg = reduce(e.atk * rnd(.9, 1.1), p.def, 0) * p.dmgTaken;
  if (!st.hitTaken && p.ironSkin) dmg *= 1 - p.ironSkin; st.hitTaken = true;
  dmg = Math.max(1, Math.round(dmg)); run.hp -= dmg;
  Scene.hurt('hero', dmg > p.maxhp * .15); Scene.float('-' + dmg, '#ff6b6b', 'hero'); GSFX('hurt');
  if (p.thorns && e.hp > 0) { const r = Math.max(1, Math.round(dmg * p.thorns)); e.hp -= r; Scene.enemyHp(e.hp / e.maxhp); Scene.float(r, '#d9a8ff', 'enemy'); }
  showStats();
}
async function fight(e) {
  Scene.setWalking(false); Scene.showEnemy(e.spr, e.boss); log(e.intro, e.boss ? 'boss' : '');
  await wait(1100);
  const p = stats(), st = { attacks: 0, hitTaken: false };
  for (let turn = 0; turn < 300; turn++) {
    // your turn: normal hits, each can start a combo chain
    for (let h = 0; h < p.hits && e.hp > 0; h++) {
      await heroAttack(e, p, st);
      for (let c = 0; e.hp > 0 && c < p.comboMax && Math.random() < p.combo; c++) { await wait(200); Scene.float('Combo!', '#7fd8ff', 'hero'); await heroAttack(e, p, st); }
      if (h < p.hits - 1) await wait(220);
    }
    if (e.hp <= 0) break;
    await wait(T.TURN_MS);
    // enemy turn (some enemies combo too)
    await enemyAttack(e, p, st);
    if (run.hp > 0 && e.hp > 0 && Math.random() < e.combo) { await wait(200); Scene.float('Combo!', '#ffb27f', 'enemy'); await enemyAttack(e, p, st); }
    if (run.hp <= 0 || e.hp <= 0) break;
    await wait(T.TURN_MS);
  }
  if (run.hp <= 0) return false;
  // win
  Scene.killEnemy(); GSFX('coin');
  const coins = Math.max(1, Math.round(e.coin * p.coinMul * rnd(.8, 1.2))), junk = e.boss ? 6 : Math.random() < p.junkChance ? 1 + (Math.random() < .3 ? 1 : 0) : 0;
  gain(coins, junk); Scene.float('+' + coins, '#ffd23f', 'enemy');
  if (p.killHeal) heal(p.maxhp * p.killHeal, p);
  run.effects = run.effects.filter(x => --x.fights > 0);       // temporary buffs/nerfs count down per fight
  log(`You defeated ${e.name}! +${coins} coins${junk ? ', +' + junk + ' junk' : ''}, +${e.xp} EXP`);
  showStats(); await wait(700);
  await gainXp(e.xp);
  if (run.hp < stats().maxhp * .3) log('Your HP is low. Resting would heal you.', 'warn');
  return true;
}
function gain(c, j) { run.coins += c; run.junk += j; S.coins += c; S.junk += j; }   // loot is banked right away, so losing keeps it

// ---------- EXP + card picks ----------
async function gainXp(x) {
  run.xp += x;
  while (run.xp >= xpNeed(run.lv)) {
    run.xp -= xpNeed(run.lv); run.lv++; GSFX('magic'); Scene.float('LEVEL UP!', '#ffd23f', 'hero', true);
    log('Level ' + run.lv + '!', 'good'); showStats(); await wait(500);
    await chooseCard();
    const p = stats(); heal(p.maxhp * .3, p);
  }
  showStats(); save();
}
function offerCards() {
  const can = c => (run.cards[c.id] || 0) < c.max;
  if (run.lv % 5 === 0) {                        // every 5 levels: all 3 choices are mythic
    const m = CARD_POOL.filter(c => c.r === 'mythic' && can(c));
    if (m.length >= 1) return m.sort(() => Math.random() - .5).slice(0, 3);
  }
  const pool = CARD_POOL.filter(c => c.r !== 'mythic' && can(c)), out = [];
  while (out.length < 3 && pool.length) {
    const tot = pool.reduce((s, c) => s + RARITY[c.r].w, 0); let r = Math.random() * tot;
    const i = pool.findIndex(c => (r -= RARITY[c.r].w) < 0); out.push(pool.splice(i < 0 ? 0 : i, 1)[0]);
  }
  return out;
}
const CICON = {
  stat: '<svg viewBox="0 0 20 20"><path d="M15 2h3v3L8 15l-3-3zM3 13l4 4-2 1-3-3z"/></svg>',
  trigger: '<svg viewBox="0 0 20 20"><path d="M11 1L3 11h6l-1 8 8-10h-6z"/></svg>',
  adventure: '<svg viewBox="0 0 20 20"><path d="M10 2c4 3 6 6 6 9a6 6 0 01-12 0c0-3 2-6 6-9z"/></svg>',
  mythic: '<svg viewBox="0 0 20 20"><path d="M10 1l2.6 6 6.4.6-4.9 4.3 1.5 6.3L10 15l-5.6 3.2 1.5-6.3L1 7.6 7.4 7z"/></svg>',
};
const ROMAN = ['', 'I', 'II', 'III', 'IV'];
function chooseCard() {
  const offer = offerCards(); if (!offer.length) return Promise.resolve();
  const mythic = offer[0].r === 'mythic';
  $('cardSub').textContent = mythic ? 'Level ' + run.lv + '! Mythic choice: pick one.' : 'Level ' + run.lv + '! Pick a skill for this run.';
  $('cardOv').classList.toggle('mythic', mythic);
  $('cardList').innerHTML = offer.map((c, i) => {
    const have = run.cards[c.id] || 0, R = RARITY[c.r];
    return `<button class="card" data-i="${i}" style="--rc:${R.color}"><span class="cic"><span class="rt">${R.name}</span>${CICON[c.kind]}</span>
      <span class="ctx"><b>${c.n}${c.max > 1 ? ` <i>${have ? ROMAN[have] + ' → ' : ''}${ROMAN[have + 1]}</i>` : ''}</b><span>${c.d}</span></span></button>`;
  }).join('');
  $('cardOv').classList.add('on'); SFX('open_001');
  return new Promise(res => {
    $('cardList').querySelectorAll('.card').forEach(b => b.onclick = () => {
      const c = offer[+b.dataset.i]; run.cards[c.id] = (run.cards[c.id] || 0) + 1;
      $('cardOv').classList.remove('on'); GSFX('select'); log('Learned ' + c.n + (c.max > 1 ? ' ' + ROMAN[run.cards[c.id]] : '') + '.', 'good');
      showStats(); drawTrack(); res();
    });
  });
}

// ---------- events ----------
const TRAVELERS = [
  { t: 'A traveling cook shares a hot meal. +20% ATK for the next 3 fights.', stat: 'atk', mult: 1.2, fights: 3 },
  { t: 'A blacksmith polishes your armor. +30% DEF for the next 3 fights.', stat: 'def', mult: 1.3, fights: 3 },
  { t: 'You step in sticky mud. -15% DEF for the next 2 fights.', stat: 'def', mult: .85, fights: 2 },
  { t: 'A bee stings your sword hand. -10% ATK for the next 2 fights.', stat: 'atk', mult: .9, fights: 2 },
];
async function event(type) {
  const p = stats(), a = S.arc;
  if (type === 'treasure') {
    const c = Math.round(rnd(8, 16) * (1 + .5 * a) * p.coinMul), j = 1 + Math.floor(Math.random() * 2);
    gain(c, j); Scene.float('+' + c, '#ffd23f', 'hero'); GSFX('gem'); log(pick(EVENTS.treasure) + ` +${c} coins, +${j} junk.`);
  } else if (type === 'berries') {
    heal(p.maxhp * .25, p); run.hunger = Math.min(100, run.hunger + 15); Scene.float('+HP', '#7be07b', 'hero'); GSFX('magic'); log(pick(EVENTS.berries) + ' (+25% HP, +15 hunger)');
  } else if (type === 'trap') {
    const d = Math.max(1, Math.round(p.maxhp * .12)); run.hp = Math.max(1, run.hp - d);
    Scene.hurt('hero', true); Scene.float('-' + d, '#ff6b6b', 'hero'); GSFX('hurt'); log(pick(EVENTS.trap) + ` -${d} HP.`, 'warn');
  } else if (type === 'traveler') {
    const t = pick(TRAVELERS); run.effects.push({ stat: t.stat, mult: t.mult, fights: t.fights }); log(t.t, t.mult > 1 ? 'good' : 'warn');
  } else log(pick(EVENTS.nothing), 'muted');
  showStats(); await wait(600);
}
async function resolve(n) {
  if (n.real === 'fight' || n.real === 'elite') return fight(makeEnemy(pick(stage(S.arc).pool), n.real));
  if (n.real === 'boss') return fight(makeBoss());
  await event(n.real === 'loot' ? 'treasure' : n.real); return true;
}

// ---------- run flow ----------
function newRun() {
  run = S.run = { id: Date.now(), day: 1, node: 0, lv: 1, xp: 0, hunger: 100, cards: {}, effects: [], coins: 0, junk: 0, starveOk: false, plan: [] };
  run.hp = stats().maxhp; planDay(); $('log').innerHTML = '';
  log('Day 1. You set out down ' + stage(S.arc).name + '.'); log('Tap CONTINUE for the next encounter.', 'muted'); save();
}
async function startOrContinue() {
  if (busy) return;
  if (!run) newRun();
  else {
    if (run.hunger <= 0 && !await ask('Starving!', 'You have no hunger left. Every step will cost ' + Math.round(T.STARVE_HP * 100) + '% of your max HP until you eat or rest. Go anyway?', 'Go')) return;
    run.starveOk = run.hunger <= 0; log('You get back on the road.', 'muted');
  }
  setMode('run'); SFX('open_001');
}
async function nextStep() {
  if (mode !== 'run' || busy || paused || !run) return;
  setBusy(true); SFX('select_001');
  try {
    const p = stats();
    if (run.hunger > 0) run.hunger = Math.max(0, run.hunger - T.HUNGER_STEP * p.hungerMul);
    else { const l = Math.max(1, Math.round(p.maxhp * T.STARVE_HP)); run.hp = Math.max(1, run.hp - l); log('Starving... -' + l + ' HP.', 'warn'); Scene.float('-' + l, '#ff6b6b', 'hero'); }
    showStats(); Scene.setWalking(true); await wait(700);
    const n = run.plan[run.node];
    if (!await resolve(n)) return lose();
    if (n.real === 'boss') return arcCleared();
    run.node++;
    if (run.node >= T.NODES_PER_DAY) { run.day++; run.node = 0; planDay(); log('Day ' + run.day + ' begins.', 'muted'); }
    drawTrack(); Scene.setWalking(true); save();
    if (run.hunger <= 0 && !run.starveOk) { log('Too hungry to go on. You stop to rest.', 'warn'); setBusy(false); rest(); }
  } catch (e) { if (e !== 'abort') throw e; }
  finally { setBusy(false); if (mode === 'run') Scene.setWalking(true); }
}
function rest() { if (mode !== 'run' || busy) return; log('You stop to rest.', 'muted'); run.starveOk = false; setMode('rest'); save(); SFX('close_001'); }
async function lose() {
  const d = run.day, lv = run.lv; GSFX('hurt'); Scene.hurt('hero', true); log('You fell...', 'warn');
  run = S.run = null; save();
  await message('You fell!', `Day ${d} of ${stage(S.arc).name}, level ${lv}.<br>Your run level and skills are lost.<br>Coins and junk you found are kept.`, 'Back to Day 1');
  Scene.clearEnemy(); setMode('idle');
}
async function arcCleared() {
  const name = stage(S.arc).name; GSFX('magic'); log(name + ' cleared!', 'good');
  run = S.run = null; S.arc++; save();
  await message('Arc cleared!', `You beat ${name}!<br>Next: ${stage(S.arc).name}.<br><small>(Step 4: choose a permanent arc skill here.)</small>`, 'Continue');
  Scene.clearEnemy(); setMode('idle');
}

// ---------- resting (in the app and while it is closed) ----------
const REST_EVENTS = [
  r => { r.hunger = Math.min(100, r.hunger + 10); return 'You forage some berries. +10 hunger.'; },
  r => { const c = Math.round(rnd(3, 8) * (1 + .5 * S.arc) * stats().coinMul); gain(c, 0); return `A passing merchant tips you ${c} coins.`; },
  r => { gain(0, 1); return 'You find some junk near your camp. +1 junk.'; },
  r => { const t = pick(TRAVELERS.slice(0, 2)); r.effects.push({ stat: t.stat, mult: t.mult, fights: t.fights }); return t.t; },
  () => 'A deer wanders by. Peaceful.',
];
function restFor(sec, evSec = T.REST_EVENT_SEC) {   // apply `sec` seconds of resting; returns event texts
  const p = stats();
  run.hunger = Math.min(100, run.hunger + sec / T.REST_HUNGER_SEC);
  heal(p.maxhp * .01 * sec / T.REST_HP_SEC, p);
  run.restT = (run.restT || 0) + sec; const out = [];
  while (run.restT >= evSec) { run.restT -= evSec; out.push(pick(REST_EVENTS)(run)); }
  return out;
}
let restSave = 0, lastTick = Date.now();
setInterval(() => {   // uses real elapsed time, so time with the app minimised counts too
  const now = Date.now(), sec = Math.min(T.OFFLINE_CAP_H * 3600, (now - lastTick) / 1000); lastTick = now;
  if (mode !== 'rest' || !run) return;
  for (const t of restFor(sec)) { log(t); $('restNote').textContent = 'Resting... ' + t; }
  showStats(); if (++restSave % 5 === 0) save();
}, 1000);

// ---------- buttons ----------
$('start').onclick = startOrContinue;
$('next').onclick = nextStep;
$('rest').onclick = rest;
function setPause(on) { if (mode !== 'run') return; paused = on; Scene.setPaused(on); $('pauseOv').classList.toggle('on', on); SFX(on ? 'open_001' : 'close_001'); }
$('pauseBtn').onclick = () => setPause(!paused);
$('resume').onclick = () => setPause(false);
$('abandon').onclick = async () => {
  if (!await ask('Abandon run?', 'Your hero goes back to Day 1.', 'Yes')) return;
  if (!await ask('Are you sure?', 'Your run level and skills will be lost. Coins, junk and equipment are kept.', 'Abandon')) return;
  run = S.run = null; save(); paused = false; Scene.setPaused(false); $('pauseOv').classList.remove('on'); Scene.clearEnemy(); setBusy(false); setMode('idle');
};

// ---------- boot: restore a saved run as resting, and count time spent away ----------
setTitle();
if (run) {
  const away = Math.min(T.OFFLINE_CAP_H * 3600, (Date.now() - (S.t || Date.now())) / 1000);
  log('Welcome back. Day ' + run.day + '.', 'muted');
  setMode('rest');
  if (away > 60) {
    const c0 = S.coins, j0 = S.junk, h0 = run.hunger, ev = restFor(away, T.OFFLINE_EVENT_SEC);
    ev.slice(-5).forEach(t => log(t)); save(); showStats();
    const hm = Math.floor(away / 3600) + 'h ' + Math.floor(away % 3600 / 60) + 'm';
    message('While you were away', `You rested for ${hm}.<br>+${Math.round(run.hunger - h0)} hunger, +${S.coins - c0} coins, +${S.junk - j0} junk.<br>${ev.length} small events happened.`, 'Nice');
  }
} else setMode('idle');
addEventListener('pagehide', save); document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
