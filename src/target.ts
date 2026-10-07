// Build target. `web` = our own site, anything else = a portal build (CrazyGames, ...).
// Portal builds must never talk to our servers, show outside links, ads or debug hooks.
declare const __TARGET__: string;

export const TARGET: string = typeof __TARGET__ === 'string' ? __TARGET__ : 'web';
export const IS_PORTAL = TARGET !== 'web';
export const DEBUG = !IS_PORTAL && import.meta.env.VITE_ENABLE_DEBUG === '1';
