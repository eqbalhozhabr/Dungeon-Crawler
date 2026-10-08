import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { C, H, W } from '../config';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { CARDS } from './logic/cards';
import type { CardInst, Tool } from './logic/types';

export const CW = 66;
export const CH = 94;

export const TOOL_COLOURS: Record<Tool, number> = {
  PRY: 0xe8803a,
  CUT: 0xe8505e,
  DIG: 0xb08040,
  KEY: 0xffc93c,
  LIGHT: 0xfff08a,
};
const RARITY_EDGE = [0x6a5a48, 0x4a8ac8, 0xe0a830];

export type CardState = 'normal' | 'dim' | 'match';

export interface CardView extends Phaser.GameObjects.Container {
  uid: number;
  cardId: string;
}

/** One card: name banner, cost, picture, fight text (top face) and tool strip (bottom face). */
export function makeCard(scene: Phaser.Scene, id: string, opts: { uid?: number; bonus?: number; temp?: boolean; state?: CardState } = {}): CardView {
  const def = CARDS[id];
  const state = opts.state ?? 'normal';
  const dim = state === 'dim';
  const c = scene.add.container(0, 0) as CardView;
  c.uid = opts.uid ?? -1;
  c.cardId = id;
  const rect = (x: number, y: number, w: number, h: number, col: number, a = 1) => scene.add.rectangle(x, y, w, h, col, a).setOrigin(0);
  const edge = state === 'match' ? 0xffffff : RARITY_EDGE[def.rarity];
  c.add(rect(0, 1, CW, CH - 1, C.ink));
  c.add(rect(1, 0, CW - 2, CH, C.ink));
  c.add(rect(1, 1, CW - 2, CH - 2, edge));
  c.add(rect(2, 2, CW - 4, CH - 4, dim ? 0x8a8070 : 0xd6c9a8));
  c.add(rect(2, CH - 40, CW - 4, 38, dim ? 0x7d7464 : 0xc8ba98));
  // banner
  c.add(rect(2, 2, CW - 4, 11, opts.temp ? 0x2f7a3a : dim ? 0x3a3340 : 0x46364a));
  c.add(new Label(scene, CW / 2 + 4, 4, def.name, { align: 'center', color: dim ? 0xaaa0aa : 0xf6ecd8, shadow: false }));
  // picture
  c.add(rect(6, 15, CW - 12, 28, dim ? 0x4a4250 : 0x2a2030));
  c.add(rect(7, 16, CW - 14, 26, dim ? 0x5a5260 : def.rarity === 2 ? 0x6a4a1c : 0x3c3040));
  const icon = scene.add.image(CW / 2, 29, `ic_${def.icon}`);
  if (dim) icon.setTint(0x9a9090);
  c.add(icon);
  // cost
  c.add(scene.add.circle(10, 19, 7.5, C.ink));
  c.add(scene.add.circle(10, 19, 6, dim ? 0x9a9488 : 0xf4efe0));
  c.add(new Label(scene, 10, 15, String(def.cost), { align: 'center', color: C.ink, shadow: false }));
  if (opts.bonus) c.add(new Label(scene, CW - 8, 17, `+${opts.bonus}`, { align: 'right', color: 0xffd35a }));
  // fight text
  def.fightText.forEach((t, i) => {
    if (t) c.add(new Label(scene, CW / 2, 55 + i * 8, t, { align: 'center', color: dim ? 0x5a5050 : 0x2a1a22, shadow: false }));
  });
  // tool strip
  c.add(rect(4, CH - 14, CW - 8, 10, dim ? 0x3a3340 : 0x2a2030));
  if (def.tools.length === 0) {
    c.add(new Label(scene, CW / 2, CH - 12, 'NO TOOL', { align: 'center', color: 0x6a6070, shadow: false }));
  } else {
    const w = (CW - 10) / def.tools.length;
    def.tools.forEach((t, i) => {
      c.add(rect(5 + i * w, CH - 13, w - (i < def.tools.length - 1 ? 1 : 0), 8, dim ? 0x5a5060 : TOOL_COLOURS[t]));
      c.add(new Label(scene, 5 + i * w + w / 2, CH - 12, t, { align: 'center', color: C.ink, shadow: false }));
    });
  }
  if (state === 'match') c.add(rect(2, 2, CW - 4, 2, 0xffffff));
  c.setSize(CW, CH);
  return c;
}

export function makeInteractive(card: CardView): void {
  card.setInteractive(new Phaser.Geom.Rectangle(CW / 2, CH / 2, CW, CH), Phaser.Geom.Rectangle.Contains);
}

/** A small dark panel with a text line. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, alpha = 0.78): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  c.add(scene.add.rectangle(0, 0, w, h, C.ink, alpha).setOrigin(0));
  c.add(scene.add.rectangle(0, 0, w, 1, C.panelEdge).setOrigin(0));
  c.add(scene.add.rectangle(0, h - 1, w, 1, C.panelEdge).setOrigin(0));
  return c;
}

export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color: number, scale = 1): void {
  const l = new Label(scene, x, y, text, { align: 'center', color, scale, depth: 900 });
  scene.tweens.add({ targets: l, y: y - 18, alpha: { from: 1, to: 0 }, duration: 800, delay: 150, ease: 'Sine.easeOut', onComplete: () => l.destroy() });
}

export const wait = (scene: Phaser.Scene, ms: number) => new Promise<void>((res) => scene.time.delayedCall(ms, res));

/** Dark backdrop that swallows clicks, used under overlays. */
export function dimmer(scene: Phaser.Scene, alpha = 0.88): Phaser.GameObjects.Rectangle {
  const r = scene.add.rectangle(0, 0, W, H, 0x07030a, alpha).setOrigin(0).setDepth(1000);
  r.setInteractive();
  return r;
}

/** "Choose your reward - take only one" with an optional "No thanks". */
export function showReward(
  scene: Phaser.Scene,
  ids: { id: string; temp?: boolean }[],
  opts: { title: string; sub?: string; noThanks?: string },
  onPick: (id: string | null) => void,
): void {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    objs.push(o);
    return o;
  };
  keep(dimmer(scene));
  keep(new Label(scene, W / 2, 26, opts.title, { align: 'center', scale: 2, color: C.accent, depth: 1001 }));
  if (opts.sub) keep(new Label(scene, W / 2, 48, opts.sub, { align: 'center', color: C.textDim, depth: 1001 }));
  const gap = 14;
  const total = ids.length * CW + (ids.length - 1) * gap;
  const x0 = (W - total) / 2;
  let done = false;
  const finish = (id: string | null) => {
    if (done) return;
    done = true;
    objs.forEach((o) => o.destroy());
    onPick(id);
  };
  ids.forEach((it, i) => {
    const card = keep(makeCard(scene, it.id, { temp: it.temp })).setDepth(1001);
    card.setScale(1.25);
    card.setPosition(x0 + i * (CW + gap) - (CW * 0.25) / 2, 70);
    makeInteractive(card);
    card.input!.cursor = 'pointer';
    const baseY = card.y;
    card.on('pointerover', () => scene.tweens.add({ targets: card, y: baseY - 6, duration: 90 }));
    card.on('pointerout', () => scene.tweens.add({ targets: card, y: baseY, duration: 90 }));
    card.on('pointerup', () => {
      sfx.unlock();
      sfx.set();
      finish(it.id);
    });
    const def = CARDS[it.id];
    const tools = def.tools.length ? `TOOL: ${def.tools.join(' / ')}` : 'NO TOOL USE';
    keep(new Label(scene, x0 + i * (CW + gap) + CW / 2, 70 + CH * 1.25 + 6, tools, { align: 'center', color: C.textDim, depth: 1001 }));
  });
  if (opts.noThanks) {
    const b = keep(new Button(scene, W / 2 - 50, H - 36, 100, 22, opts.noThanks, () => finish(null), { fill: 0x4a3340 })).setDepth(1001);
    b.setDepth(1001);
  }
}

/** Looks at the whole deck (or a subset) in a grid; optionally pick one card. */
export function showDeck(
  scene: Phaser.Scene,
  cards: CardInst[],
  opts: { title: string; sub?: string; pick?: boolean; backLabel?: string },
  onDone: (uid: number | null) => void,
): void {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    objs.push(o);
    return o;
  };
  keep(dimmer(scene, 0.86));
  keep(new Label(scene, W / 2, 8, opts.title, { align: 'center', scale: 2, color: C.accent, depth: 1001 }));
  if (opts.sub) keep(new Label(scene, W / 2, 28, opts.sub, { align: 'center', color: C.textDim, depth: 1001 }));
  const per = 10;
  const sc = cards.length > 20 ? 0.62 : 0.72;
  const w = CW * sc;
  const h = CH * sc;
  const rows = Math.ceil(cards.length / per);
  const gx = Math.min(8, (W - 20 - per * w) / (per - 1));
  const x0 = (W - (Math.min(per, cards.length) * w + (Math.min(per, cards.length) - 1) * gx)) / 2;
  const y0 = 42;
  let done = false;
  const finish = (uid: number | null) => {
    if (done) return;
    done = true;
    objs.forEach((o) => o.destroy());
    onDone(uid);
  };
  cards.forEach((inst, i) => {
    const col = i % per;
    const row = Math.floor(i / per);
    const card = keep(makeCard(scene, inst.id, { uid: inst.uid, bonus: inst.bonus })).setDepth(1001);
    card.setScale(sc);
    const bx = x0 + col * (w + gx);
    const by = y0 + row * (h + 6) - (rows > 3 ? row * 4 : 0);
    card.setPosition(bx, by);
    if (opts.pick) {
      makeInteractive(card);
      card.input!.cursor = 'pointer';
      card.on('pointerover', () => card.setPosition(bx, by - 4));
      card.on('pointerout', () => card.setPosition(bx, by));
      card.on('pointerup', () => {
        sfx.unlock();
        sfx.click();
        finish(inst.uid);
      });
    }
  });
  keep(new Button(scene, W / 2 - 45, H - 28, 90, 20, opts.backLabel ?? 'CLOSE', () => finish(null), { fill: 0x4a3340 })).setDepth(1001);
}
