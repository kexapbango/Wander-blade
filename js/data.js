// ===== EDIT ME: add stages, enemies and cards here =====
// spr = sprite base name in assets/enemies (frames: <spr>_a.png / <spr>_b.png)
const ENEMIES = {
  slime:   { spr:'slime_normal_walk', hp:30, atk:6,  spd:55, xp:8,  coin:3, log:['A hungry slime blocks the road.','Something wobbly is following you.'] },
  snail:   { spr:'snail_walk',        hp:55, atk:5,  spd:30, xp:10, coin:4, log:['A grumpy snail refuses to move.'] },
  mouse:   { spr:'mouse_walk',        hp:22, atk:8,  spd:95, xp:9,  coin:3, log:['A mouse darts out from the grass.'] },
  ladybug: { spr:'ladybug_walk',      hp:35, atk:9,  spd:70, xp:11, coin:5, log:['A ladybug the size of a dog appears.'] },
  worm:    { spr:'worm_normal_move',  hp:48, atk:10, spd:45, xp:12, coin:5, log:['The ground wriggles. A worm!'] },
  fire:    { spr:'slime_fire_walk',   hp:60, atk:13, spd:60, xp:16, coin:7, log:['A fiery slime hisses at you.'] },
};
const STAGES = [
  { name:'Meadow Road', len:3200, pool:['slime','snail','mouse'],
    boss:{ name:'Big Block Slime', spr:'slime_block_walk', hp:700, atk:16, spd:35, xp:120, coin:60 } },
  { name:'Bug Trail',   len:3800, pool:['ladybug','worm','mouse','snail'],
    boss:{ name:'Spiky King',      spr:'slime_spike_walk', hp:1100, atk:22, spd:40, xp:200, coin:100 } },
  { name:'Ember Path',  len:4200, pool:['fire','ladybug','worm'],
    boss:{ name:'Cinder Blob',     spr:'slime_fire_walk',  hp:1600, atk:30, spd:45, xp:300, coin:150 } },
]; // after the last stage the list loops with tougher enemies (endless)

// Cards: r = c(common) / u(rare) / e(epic, boss rewards only). f modifies the run's stats p.
const CARDS = [
  { n:'Sharpened Edge', d:'+20% attack',            r:'c', f:p=>p.atk*=1.2 },
  { n:'Quick Hands',    d:'+15% attack speed',      r:'c', f:p=>p.as*=1.15 },
  { n:'Thick Skin',     d:'+30 max HP and heal 30', r:'c', f:p=>{p.maxhp+=30;p.hp+=30} },
  { n:'Iron Will',      d:'+3 defense',             r:'c', f:p=>p.def+=3 },
  { n:'Lucky Coin',     d:'+25% coins',             r:'c', f:p=>p.coin*=1.25 },
  { n:'Keen Eye',       d:'+8% crit chance',        r:'c', f:p=>p.crit+=.08 },
  { n:'Leech',          d:'Heal 4% of damage dealt',r:'c', f:p=>p.steal+=.04 },
  { n:'Steady Guard',   d:'Perfect-block window +0.08s', r:'u', f:p=>p.perf+=.08 },
  { n:'Spiked Shield',  d:'Block counter +100% dmg',r:'u', f:p=>p.counter+=1 },
  { n:'Second Wind',    d:'Perfect block heals 6 HP', r:'u', f:p=>p.blockHeal+=6 },
  { n:'Skill Mastery',  d:'Skill cooldown -20%',    r:'u', f:p=>p.skCd*=.8 },
  { n:'Big Bang',       d:'Skill damage +50%',      r:'u', f:p=>p.skM*=1.5 },
  { n:'Regeneration',   d:'Regain 1.5 HP per second',r:'u', f:p=>p.regen+=1.5 },
  { n:'Titan Blow',     d:'+60% attack',            r:'e', f:p=>p.atk*=1.6 },
  { n:'Berserker',      d:'+40% attack speed, +15% crit', r:'e', f:p=>{p.as*=1.4;p.crit+=.15} },
  { n:'Fortress',       d:'+80 max HP, +5 defense', r:'e', f:p=>{p.maxhp+=80;p.hp+=80;p.def+=5} },
  { n:'Perfect Form',   d:'Perfect-block window +0.15s, counter x2', r:'e', f:p=>{p.perf+=.15;p.counter+=2} },
  { n:'Storm Skill',    d:'Skill hits 2x and recharges 35% faster', r:'e', f:p=>{p.skM*=2;p.skCd*=.65} },
];
const RAR = { c:['Common','#9aa7b5'], u:['Rare','#4da3ff'], e:['Epic','#c06bff'] };
const GEAR_RAR = [['Common','#9aa7b5'],['Rare','#4da3ff'],['Epic','#c06bff'],['Legendary','#ff9d2e']];
