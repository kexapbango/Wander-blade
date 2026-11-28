// Step 2: looping side-scrolling adventure scene (canvas).
// All sizes are in "design units": the screen is 1080 units wide, like the art.
const Scene = (() => {
  const VIEW = 1080, PATH_H = 458, SPEED = 190;        // units per second while walking
  const STREET_LEN = 12960;                            // 12 screens before the street repeats (~68s)
  const SRC = { path:'path.jpg', strip:'ground_strip.png', bottom:'bottom_ground.png', trees:'trees.png',
    houseA:'house_a.png', houseB:'house_b.png', fence:'fences.png', sign:'sign.png', grass:'grass.png',
    crates:'crates.png', barrels:'barrels.png' };
  const IMG = {}; let loaded = 0; const total = Object.keys(SRC).length + 4;
  const CHAR = {};
  const load = (key, url, into) => { const i = new Image(); i.onload = () => { loaded++; if (loaded === total) build(); }; i.src = url; into[key] = i; };
  for (const k in SRC) load(k, 'assets/scene/' + SRC[k], IMG);
  ['idle', 'walk_a', 'walk_b', 'hit'].forEach(f => load(f, 'assets/chars/character_beige_' + f + '.png', CHAR));

  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  let W = 0, H = 0, k = 1, camX = 0, vel = 0, walking = false, paused = false, gb = .62, gbTarget = .62, animT = 0, last = 0;
  let street = [], backRow = [], backTint = null;
  // fight visuals
  const EIMG = {}; const eimg = n => EIMG[n] || (EIMG[n] = Object.assign(new Image(), { src: 'assets/enemies/' + n + '.png' }));
  let enemy = null, heroLunge = 0, heroHurt = 0, shake = 0; const floats = [];
  const HERO_X = .3, ENEMY_X = .7, FEET = 300;

  // ---- fixed street: generated once from a fixed seed, so it is the same every time ----
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // base = how far above the path top the item's feet sit (units). layer: 0 trees, 1 houses, 2 small props
  const KIND = {
    trees:  { s:.66, base:58, layer:0 }, houseA:{ s:1.52, base:48, layer:1 }, houseB:{ s:1.52, base:48, layer:1 },
    fence:  { s:.86, base:20, layer:2 }, sign:  { s:.9,  base:34, layer:2 }, grass: { s:.6,  base:44, layer:2 },
    crates: { s:1,   base:40, layer:2 }, barrels:{ s:.9, base:40, layer:2 },
  };
  function build() {
    const r = rng(20261128); street = [];
    const put = (kind, x, opt = {}) => { const K = KIND[kind], im = IMG[kind];
      const s = K.s * (opt.sc || 1), w = im.width * s; street.push({ kind, im, x, w, h: im.height * s, base: K.base, layer: K.layer, flip: !!opt.flip }); return w; };
    let x = 160, prev = '';
    while (x < STREET_LEN - 900) {
      const pick = r(); let type = pick < .35 ? 'town' : pick < .75 ? 'forest' : 'meadow';
      if (type === prev) type = type === 'forest' ? 'town' : 'forest'; prev = type;
      if (type === 'town') {
        const w = put(r() < .5 ? 'houseA' : 'houseB', x);
        if (r() < .7) put(r() < .5 ? 'crates' : 'barrels', x + w - 40);
        if (r() < .5) put('crates', x + w + 70);
        x += w + 160 + r() * 140;
      } else if (type === 'forest') {
        const n = 1 + (r() < .5 ? 1 : 0); let fx = x;
        for (let i = 0; i < n; i++) fx += put('trees', fx, { sc: .85 + r() * .25, flip: r() < .5 }) * .62;
        put('grass', x + 120 + r() * 300);
        if (r() < .6) { put('fence', x + 380); put('sign', x + 520); put('fence', x + 640); }
        x = fx + 400 + r() * 120;
      } else {
        const n = 2 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) put('fence', x + i * 160);
        put('grass', x + n * 160 + 40, { flip: r() < .5 });
        if (r() < .6) put('barrels', x + n * 160 + 160);
        x += n * 160 + 380 + r() * 160;
      }
    }
    street.sort((a, b) => a.layer - b.layer || a.x - b.x);
    // back row of darker, smaller trees (moves slower)
    backRow = []; let bx = 0; while (bx < 5200) { const s = .36 + r() * .14; backRow.push({ x: bx, s, flip: r() < .5 }); bx += 1280 * s * (.45 + r() * .3); }
    const t = IMG.trees, c = document.createElement('canvas'); c.width = t.width / 2; c.height = t.height / 2;
    const g = c.getContext('2d'); g.drawImage(t, 0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(28,110,150,.5)'; g.fillRect(0, 0, c.width, c.height);
    backTint = c;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3), r = cv.getBoundingClientRect();
    if (!r.width) return; W = Math.round(r.width * dpr); H = Math.round(r.height * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    k = W / VIEW;
  }
  addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(cv);   // page grows when the tabs hide

  const mod = (a, n) => ((a % n) + n) % n;
  // draw something that repeats every `period` units, at world x `wx`, moving with parallax factor `p`
  function each(wx, w, period, p, fn) {
    const sx = mod(wx - camX * p, period);
    for (let x = sx - period; x < VIEW; x += period) if (x + w > 0) fn(x * k);
  }
  function img(im, x, y, w, h, flip) {
    if (!flip) return ctx.drawImage(im, x, y, w, h);
    ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, w, h); ctx.restore();
  }
  function hills(base, amp, p, color, f1, f2) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, base);
    for (let sx = 0; sx <= W + 8; sx += 8) {
      const wx = sx / k + camX * p;
      ctx.lineTo(sx, base - k * amp * (1 + .55 * Math.sin(wx * f1) + .3 * Math.sin(wx * f2 + 1.7)));
    }
    ctx.lineTo(W, base); ctx.closePath(); ctx.fill();
  }

  function draw() {
    const pathBottom = H * gb, pathTop = pathBottom - PATH_H * k, stripTop = pathTop - 112 * k;
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, stripTop); sky.addColorStop(0, '#2fc6f7'); sky.addColorStop(1, '#6fdcfb');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, stripTop + 2);
    if (loaded < total) { ctx.fillStyle = '#86b97c'; ctx.fillRect(0, stripTop, W, H); return; }
    // far background (drawn in code): pale clouds + two hill layers
    ctx.fillStyle = '#d9f5fb';
    each(0, 2200, 2200, .04, x => { for (const [cx, cy, cr] of [[120,-190,120],[260,-230,150],[420,-180,110],[1300,-210,140],[1460,-250,170],[1640,-190,120]])
      { ctx.beginPath(); ctx.arc(x + cx * k, stripTop + cy * k, cr * k, 0, 7); ctx.fill(); } });
    hills(stripTop + 40 * k, 120, .08, '#b4ece9', .0021, .0057);
    hills(stripTop + 40 * k, 70, .16, '#86d3cf', .0034, .0081);
    // back row of tinted trees
    for (const t of backRow) { const w = backTint.width * 2 * t.s, h = backTint.height * 2 * t.s;
      each(t.x, w, 5200, .38, x => img(backTint, x, stripTop + 40 * k - h * k, w * k, h * k, t.flip)); }
    // ground strip (+ solid fill so its wavy bottom edge never shows a gap)
    ctx.fillStyle = '#88bb7f'; ctx.fillRect(0, stripTop + 60 * k, W, pathTop - stripTop);
    each(0, VIEW, VIEW, 1, x => ctx.drawImage(IMG.strip, x, stripTop, VIEW * k + 1, IMG.strip.height * k));
    // street props
    for (const o of street) each(o.x, o.w, STREET_LEN, 1, x => img(o.im, x, pathTop - (o.base + o.h) * k, o.w * k, o.h * k, o.flip));
    // road + bottom grass
    each(0, VIEW, VIEW, 1, x => ctx.drawImage(IMG.path, x, pathTop, VIEW * k + 1, PATH_H * k));
    const bw = VIEW, bh = VIEW; // bottom tile stretched to one screen width
    each(0, bw, bw, 1, x => ctx.drawImage(IMG.bottom, x, pathBottom - 3 * k, bw * k + 1, bh * k));
    if (pathBottom + bh * k < H) { ctx.fillStyle = '#88b97c'; ctx.fillRect(0, pathBottom + bh * k - 2, W, H); }
    // hero
    const lunge = heroLunge > 0 ? Math.sin(heroLunge / .22 * Math.PI) * 70 * k : 0;
    const frame = heroHurt > 0 ? CHAR.hit : vel > 5 ? (Math.floor(animT / .14) % 2 ? CHAR.walk_a : CHAR.walk_b) : CHAR.idle;
    const cs = 128 * 2.3 * k, bob = vel > 5 ? Math.abs(Math.sin(animT * 11)) * -6 * k : 0, hx = W * HERO_X + lunge, feet = pathTop + FEET * k;
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.ellipse(hx, feet, cs * .26, cs * .06, 0, 0, 7); ctx.fill();
    ctx.drawImage(frame, hx - cs / 2, feet - cs * .97 + bob, cs, cs);
    // enemy (faces left, toward the hero)
    if (enemy) {
      const e = enemy, es = 128 * (e.boss ? 3 : 1.9) * k, el = e.lunge > 0 ? -Math.sin(e.lunge / .22 * Math.PI) * 70 * k : 0;
      const ex = W * e.x + el, im = eimg(e.spr + (Math.floor(animT * 4) % 2 ? '_a' : '_b'));
      ctx.globalAlpha = e.alpha;
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.ellipse(ex, feet, es * .3, es * .06, 0, 0, 7); ctx.fill();
      if (im.complete && im.naturalWidth) {
        ctx.drawImage(im, ex - es / 2, feet - es * .95 + e.drop * k, es, es);
        if (e.hit > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = e.alpha * e.hit / .15 * .6; ctx.drawImage(im, ex - es / 2, feet - es * .95, es, es); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = e.alpha; }
      }
      if (e.alpha > .5) { // hp bar
        const bw = es * .7, by = feet - es * .95 - 26 * k;
        ctx.fillStyle = '#2b1d14'; ctx.fillRect(ex - bw / 2 - 3 * k, by - 3 * k, bw + 6 * k, 22 * k);
        ctx.fillStyle = '#5a3d27'; ctx.fillRect(ex - bw / 2, by, bw, 16 * k);
        ctx.fillStyle = e.boss ? '#ff5a5a' : '#ff8a5a'; ctx.fillRect(ex - bw / 2, by, bw * Math.max(0, e.hp), 16 * k);
      }
      ctx.globalAlpha = 1;
    }
    // floating numbers / texts
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (const f of floats) {
      const fx = W * (f.who === 'hero' ? HERO_X : enemy ? enemy.x : ENEMY_X), fy = feet - cs * 1.0 - f.t * 80 * k + f.dy * k;
      ctx.globalAlpha = Math.min(1, 2.2 - f.t * 2); ctx.font = `${Math.round((f.big ? 62 : 48) * k)}px KF, sans-serif`;
      ctx.lineWidth = 10 * k; ctx.strokeStyle = '#2b1d14'; ctx.strokeText(f.text, fx + f.dx * k, fy); ctx.fillStyle = f.color; ctx.fillText(f.text, fx + f.dx * k, fy);
    }
    ctx.globalAlpha = 1;
  }

  function tick(t) {
    const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
    if (cv.offsetParent) {                      // only work while the Adventure page is visible
      if (!W) resize();
      if (!paused) {
        vel += ((walking ? SPEED : 0) - vel) * Math.min(1, dt * 4);
        camX += vel * dt; animT += dt;
        heroLunge = Math.max(0, heroLunge - dt); heroHurt = Math.max(0, heroHurt - dt); shake = Math.max(0, shake - dt);
        if (enemy) { const e = enemy; e.lunge = Math.max(0, e.lunge - dt); e.hit = Math.max(0, e.hit - dt);
          e.x += (e.tx - e.x) * Math.min(1, dt * 3.2); if (e.dying) { e.alpha = Math.max(0, e.alpha - dt * 2.5); e.drop += dt * 60; if (!e.alpha) enemy = null; } }
        for (const f of floats) f.t += dt; while (floats.length && floats[0].t > 1.1) floats.shift();
      }
      gb += (gbTarget - gb) * Math.min(1, dt * 7);
      if (shake > 0) { ctx.save(); ctx.translate((Math.random() - .5) * 14 * k, (Math.random() - .5) * 14 * k); draw(); ctx.restore(); } else draw();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return {
    setWalking(on) { walking = on; },
    setPaused(on) { paused = on; },
    setGround(frac) { gbTarget = frac; },          // where the bottom edge of the road sits (0..1 of the page height)
    get ground() { return gb; },
    // ---- fight visuals ----
    showEnemy(spr, boss) { enemy = { spr, boss: !!boss, x: 1.25, tx: ENEMY_X, hp: 1, alpha: 1, lunge: 0, hit: 0, drop: 0, dying: false }; },
    enemyHp(r) { if (enemy) enemy.hp = r; },
    killEnemy() { if (enemy) enemy.dying = true; },
    clearEnemy() { enemy = null; },
    lunge(who) { if (who === 'hero') heroLunge = .22; else if (enemy) enemy.lunge = .22; },
    hurt(who, big) { if (who === 'hero') heroHurt = .25; else if (enemy) enemy.hit = .15; if (big) shake = .2; },
    float(text, color, who, big) { floats.push({ text, color, who, big, t: 0, dx: (Math.random() - .5) * 60, dy: -floats.filter(f => f.t < .3 && f.who === who).length * 36 }); },
    _skip(units) { camX += units; },                // testing helper: jump along the street
    resize,
  };
})();
