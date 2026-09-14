// Used only if jahia-ui-root is the host, experimental.
// The empty export is what marks this file as an ES module, which is what allows the
// top-level await below: the only other statement is a dynamic import, which does not
// make a module on its own.
export {};

const appShell = await import('@jahia/app-shell/bootstrap');

globalThis.jahia = appShell;
appShell.startAppShell(globalThis.appShell.remotes, globalThis.appShell.targetId);
