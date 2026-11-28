// ===== Step 3: PLACEHOLDER run cards (real content comes in Step 4) =====
// Picked on level-up. Picking a card you already have raises its level (max = how many times it can stack).
// f(p) is applied once per card level to the hero's run stats p.
// kind: stat | trigger | adventure | mythic  (icon only for now)
const RARITY = {
  common:    { name:'Common',    color:'#8a97a6', w:55 },
  rare:      { name:'Rare',      color:'#3f8ff0', w:28 },
  epic:      { name:'Epic',      color:'#a55df0', w:12 },
  legendary: { name:'Legendary', color:'#f0a020', w:5 },
  mythic:    { name:'Mythic',    color:'#e8434f', w:0 },   // only offered every 5 levels (all 3 choices)
};
const CARD_POOL = [
  // common: plain stats
  { id:'edge',    n:'Sharp Edge',     r:'common', kind:'stat', max:3, d:'+10% ATK',              f:p => p.atk *= 1.10 },
  { id:'tough',   n:'Tough Skin',     r:'common', kind:'stat', max:3, d:'+12% max HP',           f:p => p.maxhp *= 1.12 },
  { id:'guard',   n:'Guard Up',       r:'common', kind:'stat', max:3, d:'+4 DEF',                f:p => p.def += 4 },
  { id:'keen',    n:'Keen Eye',       r:'common', kind:'stat', max:3, d:'+5% crit chance',       f:p => p.crit += .05 },
  { id:'forager', n:'Light Eater',    r:'common', kind:'adventure', max:3, d:'Steps use 12% less hunger', f:p => p.hungerMul *= .88 },
  { id:'lucky',   n:'Lucky Pouch',    r:'common', kind:'adventure', max:3, d:'+15% coins',       f:p => p.coinMul *= 1.15 },
  // rare: simple effects
  { id:'combo',   n:'Combo Training', r:'rare', kind:'trigger', max:3, d:'+8% combo chance (hit again)', f:p => p.combo += .08 },
  { id:'leech',   n:'Leech',          r:'rare', kind:'trigger', max:3, d:'Heal 5% of damage dealt',      f:p => p.steal += .05 },
  { id:'pierce',  n:'Piercing',       r:'rare', kind:'stat',    max:3, d:'Ignore 12% of enemy DEF',      f:p => p.pen += .12 },
  { id:'snack',   n:'Victory Snack',  r:'rare', kind:'trigger', max:3, d:'Heal 6% max HP after each win', f:p => p.killHeal += .06 },
  { id:'scrap',   n:'Scavenger',      r:'rare', kind:'adventure', max:2, d:'+30% chance of junk from fights', f:p => p.junkChance += .3 },
  // epic: conditions
  { id:'triple',  n:'Third Strike',   r:'epic', kind:'trigger', max:2, d:'Every 3rd attack deals +80% damage', f:p => p.triple += .8 },
  { id:'iron',    n:'Iron Skin',      r:'epic', kind:'trigger', max:2, d:'First hit you take each fight: -50% damage', f:p => p.ironSkin += .5 },
  { id:'thorns',  n:'Thorns',         r:'epic', kind:'trigger', max:2, d:'Reflect 20% of damage taken',    f:p => p.thorns += .2 },
  { id:'scout',   n:'Scout',          r:'epic', kind:'adventure', max:1, d:'Reveal what ? encounters are', f:p => p.scout = true },
  // legendary: build makers
  { id:'berserk', n:'Berserk',        r:'legendary', kind:'trigger', max:2, d:'+35% ATK while below 50% HP', f:p => p.berserk += .35 },
  { id:'fort',    n:'Fortify',        r:'legendary', kind:'stat',    max:2, d:'+25% DEF and +15% max HP',  f:p => { p.def *= 1.25; p.maxhp *= 1.15; } },
  { id:'chain',   n:'Chain Combo',    r:'legendary', kind:'trigger', max:2, d:'Combos can chain 1 more time, +5% combo', f:p => { p.comboMax += 1; p.combo += .05; } },
  // mythic: rule changers with a trade-off (once per run)
  { id:'twin',    n:'Twin Blades',    r:'mythic', kind:'mythic', max:1, d:'Attack twice every turn, but take 25% more damage', f:p => { p.hits = 2; p.dmgTaken *= 1.25; } },
  { id:'glass',   n:'Glass Cannon',   r:'mythic', kind:'mythic', max:1, d:'+70% ATK, but -30% max HP',              f:p => { p.atk *= 1.7; p.maxhp *= .7; } },
  { id:'bulwark', n:'Bulwark',        r:'mythic', kind:'mythic', max:1, d:'DEF x2.5, but -25% ATK',                 f:p => { p.def *= 2.5; p.atk *= .75; } },
  { id:'endless', n:'Endless Combo',  r:'mythic', kind:'mythic', max:1, d:'+25% combo, combos never stop chaining, but -20% ATK', f:p => { p.combo += .25; p.comboMax = 99; p.atk *= .8; } },
  { id:'vamp',    n:'Vampire',        r:'mythic', kind:'mythic', max:1, d:'Heal 20% of damage dealt, but -20% max HP', f:p => { p.steal += .2; p.maxhp *= .8; } },
];
const HERO_BASE = { maxhp:120, atk:15, def:5, crit:.05, critDmg:1.8, combo:0, comboMax:1, pen:0, steal:0, killHeal:.08, thorns:0, triple:0,
  ironSkin:0, berserk:0, hits:1, dmgTaken:1, coinMul:1, junkChance:.25, hungerMul:1, scout:false };
