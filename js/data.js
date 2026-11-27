// ===== EDIT ME: add stages, enemies, events and cards here =====
// spr = sprite base name in assets/enemies (frames: <spr>_a.png / <spr>_b.png)
// intro = line shown when you meet it
const ENEMIES = {
  slime:   { spr:'slime_normal_walk', hp:30, atk:6,  xp:8,  coin:3, intro:['A hungry slime blocks the road.','Something wobbly jumps out at you.'] },
  snail:   { spr:'snail_walk',        hp:55, atk:5,  xp:10, coin:4, intro:['A grumpy snail refuses to move.'] },
  mouse:   { spr:'mouse_walk',        hp:22, atk:8,  xp:9,  coin:3, intro:['A mouse darts out of the grass.'] },
  ladybug: { spr:'ladybug_walk',      hp:35, atk:9,  xp:11, coin:5, intro:['A ladybug the size of a dog lands in front of you.'] },
  worm:    { spr:'worm_normal_move',  hp:48, atk:10, xp:12, coin:5, intro:['The ground wriggles. A worm!'] },
  fire:    { spr:'slime_fire_walk',   hp:60, atk:13, xp:16, coin:7, intro:['A fiery slime hisses at you.'] },
};
// scenes = number of encounters in the stage (the last one is always the boss)
const STAGES = [
  { name:'Meadow Road', scenes:7, sky:['#8fd3ff','#e4f7ff'], pool:['slime','snail','mouse'],
    boss:{ name:'Big Block Slime', spr:'slime_block_walk', hp:700, atk:16, xp:120, coin:60 } },
  { name:'Bug Trail',   scenes:8, sky:['#ffc98f','#fff1dd'], pool:['ladybug','worm','mouse','snail'],
    boss:{ name:'Spiky King',      spr:'slime_spike_walk', hp:1100, atk:22, xp:200, coin:100 } },
  { name:'Ember Path',  scenes:9, sky:['#c9a0ff','#f1e6ff'], pool:['fire','ladybug','worm'],
    boss:{ name:'Cinder Blob',     spr:'slime_fire_walk',  hp:1600, atk:30, xp:300, coin:150 } },
]; // after the last stage the list loops with tougher enemies (endless)

// Non-fight encounters: text shown when you reach them
const EVENTS = {
  treasure: ['You found a shiny pile of coins by the road.','Something glitters in the grass. Treasure!'],
  berries:  ['Very hungry, you eat some foraged berries. Delicious!','You rest under a tree and snack on sweet berries.'],
  trap:     ['A rope snaps overhead. Rocks are falling! BLOCK!','You trip a hidden wire. Look out above! BLOCK!'],
};

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
