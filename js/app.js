// Step 1: shell (tabs, layout, fullscreen). Adventure logic lives in adventure.js, the scene in scene.js.
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


// the game frame must never scroll (focus/scrollIntoView could shift the whole UI)
$('wrap').addEventListener('scroll', e => { e.target.scrollTop = 0; e.target.scrollLeft = 0; });
document.querySelectorAll('.page').forEach(p => p.addEventListener('scroll', () => { if (p.id === 'p-adv') p.scrollTop = 0; }));
