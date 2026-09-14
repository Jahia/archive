// Used only if jahia-ui-root is the host, experimental.
//
// The import stays dynamic: @jahia/app-shell/bootstrap is a Module Federation remote,
// and the dynamic import is the async boundary that lets its container initialise
// before anything touches it. Awaiting it at the top level is what makes this file an
// ES module, and the export below keeps that explicit.
const appShell = await import('@jahia/app-shell/bootstrap');

globalThis.jahia = appShell;
appShell.startAppShell(globalThis.appShell.remotes, globalThis.appShell.targetId);

export default appShell;
