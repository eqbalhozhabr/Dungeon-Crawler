import { Run, type Room } from './logic/run';

/** The run in progress, shared between scenes. */
export const session: { run: Run | null; room: Room | null } = { run: null, room: null };

export function newRun(seed = Math.floor(Math.random() * 1e9)): Run {
  session.run = new Run(seed);
  session.room = null;
  return session.run;
}
