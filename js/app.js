// Step 1: shell (tabs, layout). Step 2: adventure scene states, pause, end run. Gameplay arrives in Step 3.
const $ = id => document.getElementById(id);
const SFX = n => { try { const a = new Audio('assets/sfx/ui_' + n + '.ogg'); a.volume = .4; a.play().catch(() => {}); } catch (e) {} };
function fit() { const w = $('wrap'); w.style.fontSize = w.clientWidth / 28 + 'px'; }
addEventListener('resize', fit); addEventListener('orientationchange', fit);
document.addEventListener('fullscreenchange', fit); document.addEventListener('webkitfullscreenchange', fit); fit();
// Browsers only allow fullscreen after a user tap, so enter it on the very first touch/click anywhere.
function goFullscreen() {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) return;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return; // iPhone Safari has no fullscreen API: use "Add to Home Screen" instead
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('portrait').catch(() => {})).catch(() => {});
  } catch (e) {}
}
addEventListener('pointerdown', goFullscreen);
addEventListener('touchend', goFullscreen);
document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.id === 'p-' + t.dataset.p)); SFX('click_001');
});
$('grid').innerHTML = '<div></div>'.repeat(20);
// switching back to Adventure: re-measure the canvas
document.querySelector('.tab[data-p="adv"]').addEventListener('click', () => requestAnimationFrame(Scene.resize));

// ===== Step 2: adventure screen states (idle -> running), pause, end run =====
const GROUND_IDLE = .62, GROUND_RUN = .5;              // where the road's bottom edge sits on the page
const hero = { lv:1, hp:100, maxhp:100, atk:12, def:1 }; // placeholder stats until Step 3/5
let running = false, paused = false, day = 1, steps = 0;
$('stageName').textContent = '1. ' + STAGES[0].name;

function showStats() {
  $('sLv').textContent = hero.lv; $('sAtk').textContent = hero.atk; $('sDef').textContent = hero.def;
  $('sHp').textContent = hero.hp + '/' + hero.maxhp; $('sHpBar').style.width = (100 * hero.hp / hero.maxhp) + '%';
}
function log(text, cls) {
  const p = document.createElement('p'); p.textContent = text; if (cls) p.className = cls;
  const L = $('log'); L.appendChild(p); while (L.children.length > 60) L.firstChild.remove(); L.scrollTop = L.scrollHeight;
}
// keep the panel's top edge glued to the bottom of the road while it slides
(function glue() { $('panel').style.top = (Scene.ground * 100) + '%'; requestAnimationFrame(glue); })();

function startRun() {
  if (running) return; running = true; paused = false; day = 1; steps = 0;
  document.body.classList.add('run'); Scene.setGround(GROUND_RUN); Scene.setWalking(true);
  $('day').textContent = day; $('log').innerHTML = ''; showStats();
  log('You set out down ' + STAGES[0].name + '.'); log('Tap CONTINUE for the next encounter.', 'muted'); SFX('open_001');
}
function endRun() {
  running = false; paused = false; Scene.setPaused(false); Scene.setWalking(false); Scene.setGround(GROUND_IDLE);
  document.body.classList.remove('run'); SFX('close_001');
}
// Placeholder encounters so the layout can be tested. Real encounters arrive in Step 3.
const pick = a => a[Math.floor(Math.random() * a.length)];
function nextStep() {
  if (!running || paused) return; steps++; SFX('select_001');
  const r = Math.random();
  if (r < .5) { const e = ENEMIES[pick(STAGES[0].pool)]; log(pick(e.intro)); }
  else log(pick(EVENTS[pick(Object.keys(EVENTS))]));
  if (steps % 6 === 0) { day++; $('day').textContent = day; log('A new day begins.', 'muted'); }
}
$('start').onclick = startRun;
$('next').onclick = nextStep;

// pause (top-left)
function setPause(on) { if (!running) return; paused = on; Scene.setPaused(on); $('pauseOv').classList.toggle('on', on); SFX(on ? 'open_001' : 'close_001'); }
$('pauseBtn').onclick = () => setPause(!paused);
$('resume').onclick = () => setPause(false);

// End run: two confirmations so it can't happen by accident
let confirmStage = 0;
function askEnd(stage) {
  confirmStage = stage;
  $('cTitle').textContent = stage === 1 ? 'End run?' : 'Are you sure?';
  $('cMsg').textContent = stage === 1 ? 'Your hero will stop and go back to the start.' : 'Skills from this run will be lost. Coins, junk and equipment are kept.';
  $('cYes').textContent = stage === 1 ? 'Yes' : 'End run';
  $('confirmOv').classList.add('on'); Scene.setPaused(true); SFX('open_001');
}
$('end').onclick = () => { if (running) askEnd(1); };
$('cNo').onclick = () => { $('confirmOv').classList.remove('on'); Scene.setPaused(paused); confirmStage = 0; SFX('back_001'); };
$('cYes').onclick = () => { if (confirmStage === 1) return askEnd(2); $('confirmOv').classList.remove('on'); confirmStage = 0; endRun(); };
