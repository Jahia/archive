/**
 * Brings jContent up to date after archive or restore moved nodes.
 *
 * Flushes the moved paths from the Apollo cache, drops them from jContent's selection (a moved node's
 * old path no longer exists, and a selection that still names it offers actions on nothing), then asks
 * jContent to refetch what it shows.
 *
 * @param {Object} client - The Apollo client of the action component
 * @param {string[]} paths - The paths the nodes had before the move
 */
export const refreshAfterMove = (client, paths) => {
    try {
        paths.forEach(path => client?.cache?.flushNodeEntryByPath?.(path));
    } catch (error) {
        console.warn('[ArchiveContent] Cache flush failed, the refetch below still runs:', error);
    }

    globalThis.jahia?.reduxStore?.dispatch?.({type: 'CM_REMOVE_SELECTION', payload: paths});
    globalThis.jahia?.jcontent?.refetches?.triggerRefetchAll?.();
};
