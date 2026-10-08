// Rule checks for the salvage combat engine: npx tsx scripts/salvage-rules.ts
import { Rng } from '../src/rng';
import { Combat } from '../src/salvage/logic/combat';
import { ENEMIES } from '../src/salvage/logic/enemies';
import type { CardInst } from '../src/salvage/logic/types';

let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++;
    console.log('FAIL', m);
  } else console.log('ok  ', m);
};
let uid = 1;
const deck = (...ids: string[]): CardInst[] => ids.map((id) => ({ uid: uid++, id, bonus: 0 }));
const fill = (ids: string[]) => deck(...ids, ...Array(10).fill('beans'));
const mk = (hand: string[], enemies: string[], kits: string[][], opts = {}) => {
  const c = new Combat(fill(hand), 40, 40, enemies, new Rng(3), opts);
  enemies.forEach((_, i) => (c.enemies[i].kit = kits[i].slice()));
  c.drawPile = c.drawPile.sort((a, b) => (hand.includes(a.id) ? 1 : 0) - (hand.includes(b.id) ? 1 : 0));
  c.start();
  return c;
};
const find = (c: Combat, id: string) => c.hand.find((x) => x.id === id)!;

{
  // a hit of 6+ disarms; the object lands in your hand
  const c = mk(['boot'], ['slug'], [['pan', 'crowbar']]);
  const ev = c.play(find(c, 'boot').uid, 0);
  ok(ev.some((e) => e.t === 'disarm'), 'a 9 damage hit disarms');
  ok(c.hand.some((x) => x.id === 'pan' && x.temp), 'the dropped pan is in your hand');
  ok(c.enemies[0].kit.length === 1 && c.enemies[0].kit[0] === 'crowbar', 'the slug keeps its other object');
}
{
  // a small hit does not
  const c = mk(['knife'], ['slug'], [['pan']]);
  const ev = c.play(find(c, 'knife').uid, 0);
  ok(!ev.some((e) => e.t === 'disarm'), 'a 4 damage hit does not disarm');
}
{
  // fishhook grabs the current object, free
  const c = mk(['fishhook'], ['slug'], [['crowbar']]);
  const ev = c.play(find(c, 'fishhook').uid, 0);
  ok(ev.some((e) => e.t === 'grab'), 'fishhook grabs');
  const g = c.hand.find((x) => x.id === 'crowbar');
  ok(!!g && !!g.free && c.costOf(g) === 0, 'the grabbed crowbar is free this turn');
  ok(c.enemies[0].kit.length === 0, 'the slug is bare-handed');
  const e0 = c.energy;
  c.play(g!.uid, 0);
  ok(c.energy === e0, 'playing it costs no energy');
}
{
  // hidden face: an enemy holding a PRY object next to an unused valve is ambiguous, peek reveals it
  const c = mk(['lantern'], ['slug'], [['boathook']], { fixtures: ['valve'] });
  ok(c.describe(0).ambiguous && c.describe(0).face === null, 'face is hidden while a valve could be pried');
  c.play(find(c, 'lantern').uid, 0);
  ok(!c.describe(0).ambiguous && c.describe(0).face !== null, 'peek reveals the face');
}
{
  // no matching fixture, no guessing
  const c = mk([], ['slug'], [['boathook']], { fixtures: ['cyst'] });
  ok(!c.describe(0).ambiguous && c.describe(0).face === 'fight', 'a boathook next to a cyst is a known fight face');
}
{
  // you use the valve: acid on enemies, fixture spent, denies the enemy
  const c = mk(['boathook'], ['slug', 'mite'], [['boathook'], ['knife']], { fixtures: ['valve'] });
  const ev = c.playTool(find(c, 'boathook').uid, 0);
  ok(ev.filter((e) => e.t === 'dmg').length === 2, 'valve hits every enemy');
  ok(c.enemies[0].hp === ENEMIES.slug.hp - 7, 'for 7');
  ok(!c.describe(0).ambiguous, 'once spent, the enemy can no longer play the tool side');
}
{
  // enemy plays the tool side: you take the acid
  let hits = 0;
  for (let seed = 0; seed < 40; seed++) {
    const c = new Combat(fill([]), 40, 40, ['slug'], new Rng(seed), { fixtures: ['valve'] });
    c.enemies[0].kit = ['boathook'];
    c.start();
    const ev = c.endTurn();
    const act = ev.find((e) => e.t === 'act');
    if (act && act.t === 'act' && act.face === 'tool') {
      hits++;
      ok(ev.some((e) => e.t === 'fixture' && e.by === 'enemy') && c.hp === 33, 'enemy tool face opens the valve: 7 acid on you');
      break;
    }
  }
  ok(hits === 1, 'the enemy sometimes plays the tool side');
}
{
  // old key consumed by the tool face; lockpick kept
  const c = mk(['oldkey', 'lockpick'], ['slug'], [['pan']], { fixtures: ['valve', 'valve'] });
  c.playTool(find(c, 'oldkey').uid, 0);
  ok(c.removedFromDeck().length === 1, 'old key is used up for the run');
  c.playTool(find(c, 'lockpick').uid, 1);
  ok(c.removedFromDeck().length === 1, 'lockpick is kept');
}
{
  // thief: steals, flees after 2 acts, the card is lost
  const c = new Combat(fill(['boot']), 40, 40, ['thief'], new Rng(5), {});
  c.start();
  const before = c.hand.length;
  c.endTurn();
  c.endTurn();
  ok(c.result === 'win' && c.enemies[0].fled, 'the thief escapes after two turns (the fight ends)');
  ok(c.lost.length === 1, 'and it takes one card of your deck for good');
  void before;
}
{
  // thief killed: card returns
  const c = new Combat(fill(['boot']), 40, 40, ['thief', 'mite'], new Rng(5), {});
  c.start();
  c.endTurn();
  const t = c.enemies[0];
  t.hp = 5;
  c.pDazzle = 0;
  ok(t.stolen.length === 1, 'thief holds a stolen card');
  c.hand.push({ uid: 999, id: 'boot', bonus: 0 });
  c.energy = 3;
  const ev = c.play(999, 0);
  ok(ev.some((e) => e.t === 'returned') && c.lost.length === 0, 'killing it returns your card');
}
{
  // acid rises for everyone
  const c = new Combat(fill([]), 40, 40, ['tick'], new Rng(1), { acidFrom: 2 });
  c.enemies[0].kit = [];
  c.start();
  c.endTurn();
  const hp1 = c.hp;
  const ev = c.endTurn();
  ok(ev.some((e) => e.t === 'acid'), 'acid starts at turn 2');
  ok(c.hp < hp1, 'and it hurts you');
}
{
  // ambush: the enemies act before your first turn
  const c = new Combat(fill([]), 40, 40, ['mite'], new Rng(1), { ambush: true });
  c.enemies[0].kit = [];
  const ev = c.start();
  ok(ev.some((e) => e.t === 'act') && c.hp < 40, 'ambush: they strike first');
}
console.log(fails ? `${fails} FAILED` : 'all rule checks passed');
process.exit(fails ? 1 : 0);
