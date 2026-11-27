// Step 1: shell only (tabs, layout, start/stop). Gameplay arrives in the next steps.
const $ = id => document.getElementById(id);
const SFX = n => { try { const a = new Audio('assets/sfx/ui_' + n + '.ogg'); a.volume = .4; a.play().catch(() => {}); } catch (e) {} };
function fit() { const w = $('wrap'); w.style.fontSize = w.clientWidth / 28 + 'px'; }
addEventListener('resize', fit); fit();
document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.id === 'p-' + t.dataset.p)); SFX('click_001');
});
$('grid').innerHTML = '<div></div>'.repeat(20);
let running = false;
function setRun(on) { running = on; $('go').style.display = on ? 'none' : ''; $('stop').style.display = on ? 'block' : 'none'; $('log').style.display = on ? 'block' : 'none';
  $('scene').querySelector('.sub').textContent = on ? 'Adventuring...' : 'Tap START to begin your adventure'; $('log').textContent = on ? 'You set out down the road.' : ''; SFX(on ? 'open_001' : 'close_001'); }
$('go').onclick = () => setRun(true); $('stop').onclick = () => setRun(false);
