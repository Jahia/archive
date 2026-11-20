/**
 * Archive service - handles all archive operations
 */
import {
    FRAGMENTS,
    GET_NODE_INFO,
    CHECK_ARCHIVE_FOLDER,
    GET_CURRENT_USER,
    CHECK_PATH_EXISTS,
    GET_SITE_INFO,
    GET_SITE_LANGUAGES
} from '../graphql/queries';

import {
    CREATE_ARCHIVE_FOLDER,
    CREATE_FOLDER,
    CREATE_CONTENT_FOLDER,
    MOVE_NODE,
    buildLockMutation,
    buildRemoveArchiveMetadataMutation,
    buildSetArchiveMetadataMutation
} from '../graphql/mutations';

import {
    getArchiveFolderPath,
    getArchiveDestinationPath,
    isNodePublished,
    isNodeArchived,
    generateUniqueName,
    formatJCRDate,
    executeGraphQL,
    executeGraphQLSilent,
    getJContentContext
} from '../utils/archiveUtils';

/** `{id0: uuid0, id1: uuid1, ...}`: the variables of the set mutations (graphql/mutations.js). */
const idVariables = uuids => Object.fromEntries(uuids.map((uuid, i) => [`id${i}`, uuid]));

const parentOf = path => path.substring(0, path.lastIndexOf('/'));

/**
 * Archive service class
 */
class ArchiveService {
    /**
     * Get current UI language
     */
    getCurrentLanguage() {
        // Try multiple sources for current language
        if (globalThis.contextJsParameters?.uilang) {
            return globalThis.contextJsParameters.uilang;
        }

        if (globalThis.contextJsParameters?.lang) {
            return globalThis.contextJsParameters.lang;
        }

        // Fallback to browser language or 'en'
        return navigator.language?.split('-')[0] || 'en';
    }

    /**
     * Get node information
     */
    async getNodeInfo(path) {
        // The title of i18n content needs a language: without one, displayName falls back to the node name
        const data = await executeGraphQL(GET_NODE_INFO, {path, language: getJContentContext().language});
        return data.jcr?.nodeByPath;
    }

    /**
     * Get site languages.
     *
     * Throws rather than defaulting: the publication guard is only as wide as this
     * list, so silently narrowing it to ['en'] would let content published in any
     * other language pass validation unseen.
     */
    async getSiteLanguages(path) {
        const data = await executeGraphQL(GET_SITE_LANGUAGES, {path});
        const languages = data.jcr?.nodeByPath?.site?.languages?.values;

        if (!languages || languages.length === 0) {
            throw new Error(`Unable to determine the languages of the site owning ${path}`);
        }

        return languages;
    }

    /**
     * Resolve the languages in which a node, or anything under it, is live, and which of those nodes
     * are locked.
     *
     * Single source of truth for "is this content published" and "is this content locked": used by
     * both the pre-flight validation and the archive operation itself, so the two can never disagree.
     * A locked node cannot take the archive marker or be moved, whoever holds the lock (an editor, a
     * workflow, a deletion mark).
     *
     * Reads each node's own status across the subtree, in one query. jContent's aggregated status
     * (`subNodes: true`) answers what remains to publish, so an unpublished child outweighs a
     * published one: a folder holding one published and one draft item reads NOT_PUBLISHED, and
     * archiving it would take the published item out from under the live workspace.
     *
     * Rejects if the answer cannot be established: a missing status is not evidence that the content
     * is unpublished.
     *
     * @param {string} nodePath - Path of the node to check
     * @returns {Promise<{publishedLanguages: Array<{language: string, isPublished: boolean}>, lockedPaths: string[]}>}
     *   The languages with live content in the subtree (empty when nothing is live), and the paths
     *   of the locked nodes in it (empty when nothing is locked)
     */
    async getSubtreeState(nodePath) {
        const languages = await this.getSiteLanguages(nodePath);
        const statusFields = languages
            .map((_, i) => `l${i}: aggregatedPublicationInfo(language: $l${i}, subNodes: false, references: false) { publicationStatus }`)
            .join('\n');
        const query = `
            query ArchivePublicationOfSubtree($path: String!, ${languages.map((_, i) => `$l${i}: String!`).join(', ')}) {
                jcr(workspace: EDIT) {
                    nodeByPath(path: $path) {
                        path
                        lockOwner: property(name: "jcr:lockOwner") {
                            value
                        }
                        ${statusFields}
                        descendants(typesFilter: {types: ["jnt:content", "jnt:contentFolder", "jnt:page"], multi: ANY}) {
                            pageInfo {
                                totalCount
                                nodesCount
                            }
                            nodes {
                                path
                                lockOwner: property(name: "jcr:lockOwner") {
                                    value
                                }
                                ${statusFields}
                            }
                        }
                    }
                }
            }
        `;
        const variables = {path: nodePath};
        languages.forEach((language, i) => {
            variables[`l${i}`] = language;
        });

        const data = await executeGraphQL(query, variables);
        const node = data.jcr?.nodeByPath;
        if (!node) {
            throw new Error(`Unable to read the publication status of ${nodePath}`);
        }

        // Descendants stops at 5000 nodes while still answering hasNextPage: false. A truncated list
        // could hide a published item, so a subtree too large to read whole is refused, not guessed.
        const pageInfo = node.descendants?.pageInfo;
        if (pageInfo && pageInfo.nodesCount < pageInfo.totalCount) {
            const error = new Error(`Too much content under ${nodePath} to check its publication (${pageInfo.totalCount} items)`);
            error.reason = 'tooLarge';
            error.count = pageInfo.totalCount;
            throw error;
        }

        const nodes = [node, ...(node.descendants?.nodes || [])];
        const publishedLanguages = languages
            .map((language, i) => {
                const statuses = nodes.map(n => n[`l${i}`]?.publicationStatus);
                if (statuses.some(status => !status)) {
                    throw new Error(`Unable to read the publication status of ${nodePath} in ${language}`);
                }

                return {
                    language,
                    isPublished: statuses.some(status => isNodePublished({aggregatedPublicationInfo: {publicationStatus: status}}))
                };
            })
            .filter(entry => entry.isPublished);
        const lockedPaths = nodes.filter(n => n.lockOwner).map(n => n.path);

        return {publishedLanguages, lockedPaths};
    }

    /**
     * Get site information from node path
     */
    async getSiteInfo(path) {
        const data = await executeGraphQL(GET_SITE_INFO, {path});
        return data.jcr?.nodeByPath?.site;
    }

    /**
     * Get current user
     */
    async getCurrentUser() {
        const data = await executeGraphQL(GET_CURRENT_USER);
        return data.currentUser;
    }

    /**
     * Check if path exists
     */
    async checkPathExists(path) {
        try {
            const data = await executeGraphQLSilent(CHECK_PATH_EXISTS, {path});
            return Boolean(data.jcr?.nodeByPath);
        } catch (error) {
            // PathNotFoundException is expected when checking for conflicts
            if (error.message?.includes('PathNotFoundException')) {
                return false;
            }

            // For other unexpected errors, log them
            console.warn('[ArchiveService] Unexpected error checking path existence:', error);
            return false;
        }
    }

    /**
     * Check if archive folder exists
     */
    async checkArchiveFolderExists(archiveFolderPath) {
        try {
            const data = await executeGraphQL(CHECK_ARCHIVE_FOLDER, {path: archiveFolderPath});
            return Boolean(data.jcr?.nodeByPath);
        } catch {
            return false;
        }
    }

    /**
     * Create archive folder
     */
    async createArchiveFolder(siteKey) {
        const parentPath = `/sites/${siteKey}`;
        const folderName = 'Archives';

        const data = await executeGraphQL(CREATE_ARCHIVE_FOLDER, {
            parentPath,
            name: folderName,
            primaryNodeType: 'jnt:archiveContentFolder'
        });

        return data.jcr?.addNode;
    }

    /**
     * Create intermediate folders (year/month) for autosplit structure
     */
    async ensureDateFoldersExist(archiveFolderPath, date = new Date()) {
        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');

        // Check/create year folder
        const yearPath = `${archiveFolderPath}/${year}`;
        let yearExists = await this.checkPathExists(yearPath);

        if (!yearExists) {
            try {
                await executeGraphQL(CREATE_FOLDER, {
                    parentPath: archiveFolderPath,
                    name: year
                });

                // Verify it was created
                yearExists = await this.checkPathExists(yearPath);
                if (!yearExists) {
                    throw new Error(`Failed to create year folder: ${yearPath}`);
                }
            } catch (error) {
                console.error('[ArchiveService] Error creating year folder:', error);
                throw error;
            }
        }

        // Check/create month folder
        const monthPath = `${yearPath}/${month}`;
        let monthExists = await this.checkPathExists(monthPath);

        if (!monthExists) {
            try {
                await executeGraphQL(CREATE_FOLDER, {
                    parentPath: yearPath,
                    name: month
                });

                // Verify it was created
                monthExists = await this.checkPathExists(monthPath);
                if (!monthExists) {
                    throw new Error(`Failed to create month folder: ${monthPath}`);
                }
            } catch (error) {
                console.error('[ArchiveService] Error creating month folder:', error);
                throw error;
            }
        }

        console.log('[ArchiveService] Date folders ready, final path:', monthPath);
        return monthPath;
    }

    /**
     * The items of a content folder that are archived with it, each with the marker of its own: every
     * content folder inside it and every node directly in one of them. The children of a content item
     * (an article's own sub-content) are not items: they go and come back with their item.
     *
     * Rejects a folder whose descendants cannot be read whole (`descendants` stops at 5000 nodes).
     *
     * @param {string} folderPath - Path of the folder about to be archived
     * @returns {Promise<Array<{uuid: string, path: string, parentUuid: string}>>}
     */
    async getFolderItems(folderPath) {
        const data = await executeGraphQL(`
            query ArchiveFolderItems($path: String!) {
                jcr(workspace: EDIT) {
                    nodeByPath(path: $path) {
                        descendants(typesFilter: {types: ["jnt:content", "jnt:contentFolder"], multi: ANY}) {
                            pageInfo {
                                totalCount
                                nodesCount
                            }
                            nodes {
                                uuid
                                path
                                parent {
                                    uuid
                                    isFolder: isNodeType(type: {types: ["jnt:contentFolder"]})
                                }
                            }
                        }
                    }
                }
            }
        `, {path: folderPath});
        const descendants = data.jcr?.nodeByPath?.descendants;
        if (!descendants) {
            throw new Error(`Unable to read the content of ${folderPath}`);
        }

        if (descendants.pageInfo.nodesCount < descendants.pageInfo.totalCount) {
            const error = new Error(`Too much content under ${folderPath} to archive it (${descendants.pageInfo.totalCount} items)`);
            error.reason = 'tooLarge';
            error.count = descendants.pageInfo.totalCount;
            throw error;
        }

        return descendants.nodes
            .filter(node => node.parent?.isFolder)
            .map(node => ({uuid: node.uuid, path: node.path, parentUuid: node.parent.uuid}));
    }

    /**
     * Apply the archive marker - mixin and metadata - to a set of nodes, in a single request.
     *
     * One request is one JCR save, so the set either carries the complete marker or none of it.
     * Adding the mixin separately from its mandatory properties can strand a node in a half-archived
     * state that neither action can undo.
     *
     * @param {Array<{uuid: string, originalPath: string, originalParentId: string}>} entries
     * @param {string} userUuid - The archiving user's node
     */
    async setArchiveMetadata(entries, userUuid) {
        const variables = {archived: 'true', archivedAt: formatJCRDate(), archivedBy: userUuid};
        entries.forEach((entry, i) => {
            variables[`id${i}`] = entry.uuid;
            variables[`originalPath${i}`] = entry.originalPath;
            variables[`originalParentId${i}`] = entry.originalParentId;
        });
        await executeGraphQL(buildSetArchiveMetadataMutation(entries.length), variables);
    }

    /**
     * Remove the archive marker from a set of nodes, dropping each mixin and its properties together.
     *
     * @param {string[]} uuids - The nodes
     */
    async removeArchiveMetadata(uuids) {
        const result = await executeGraphQL(buildRemoveArchiveMetadataMutation(uuids.length), idVariables(uuids));

        if (!result?.jcr?.n0) {
            throw new Error('Failed to remove archived mixin');
        }
    }

    /**
     * Lock or unlock a set of nodes in one request.
     *
     * @param {string[]} uuids - The nodes
     * @param {boolean} lock - true to lock, false to unlock
     */
    async setLocked(uuids, lock) {
        if (uuids.length > 0) {
            await executeGraphQL(buildLockMutation(uuids.length, lock), idVariables(uuids));
        }
    }

    /**
     * Undo the archive marker after a later step failed.
     *
     * Best-effort: the caller is already throwing the failure that triggered this, and
     * that error is the one worth surfacing. A rollback that itself fails is logged with
     * the nodes, so the half-archived content can be found and cleared by hand.
     *
     * @param {string[]} uuids - The nodes the marker was applied to
     * @param {Error} cause - The failure being compensated
     */
    async rollbackArchiveMetadata(uuids, cause) {
        try {
            await this.removeArchiveMetadata(uuids);
        } catch (rollbackError) {
            console.error(
                `[ArchiveService] Archive failed and the archive marker could not be removed from ${uuids.length} ` +
                'node(s) - they need clearing by hand.',
                {uuids, cause, rollbackError}
            );
        }
    }

    /**
     * Move node to archive destination
     */
    async moveNode(nodeUuid, destParentPath, originalName) {
        try {
            // Try with original name first
            const result = await executeGraphQL(MOVE_NODE, {
                pathOrId: nodeUuid,
                destParentPathOrId: destParentPath,
                destName: null // Keep original name
            });

            return result.jcr?.moveNode?.node;
        } catch (error) {
            // If name collision, try with unique name
            if (error.message?.includes('already exists') || error.message?.includes('collision')) {
                const uniqueName = generateUniqueName(originalName);

                const result = await executeGraphQL(MOVE_NODE, {
                    pathOrId: nodeUuid,
                    destParentPathOrId: destParentPath,
                    destName: uniqueName
                });

                return result.jcr?.moveNode?.node;
            }

            throw error;
        }
    }

    /**
     * Main archive operation
     * @param {string} nodePath - Path of the node to archive
     * @returns {Promise<Object>} Result object with success status and details
     */
    async archiveNode(nodePath) {
        try {
            // Step 1: Get node information
            const nodeInfo = await this.getNodeInfo(nodePath);

            if (!nodeInfo) {
                throw new Error('Node not found');
            }

            // Step 2: Check if already archived
            if (isNodeArchived(nodeInfo)) {
                return {
                    success: false,
                    reason: 'alreadyArchived',
                    nodeInfo
                };
            }

            // Step 3: Check if published, in every language of the site, or locked.
            // Re-checked here rather than trusted from validateArchive: this is the
            // write site, and it is reachable without going through the dialog.
            const {publishedLanguages, lockedPaths} = await this.getSubtreeState(nodePath);

            if (publishedLanguages.length > 0) {
                return {
                    success: false,
                    reason: 'published',
                    publishedLanguages,
                    nodeInfo
                };
            }

            if (lockedPaths.length > 0) {
                return {
                    success: false,
                    reason: 'locked',
                    lockedPaths,
                    nodeInfo
                };
            }

            // Step 4: Get site information
            const siteInfo = await this.getSiteInfo(nodePath);
            if (!siteInfo) {
                throw new Error('Unable to determine site information');
            }

            const siteKey = siteInfo.name;

            // Step 5: Ensure archive folder exists
            const archiveFolderPath = getArchiveFolderPath(siteKey);
            let archiveFolderExists = await this.checkArchiveFolderExists(archiveFolderPath);

            if (!archiveFolderExists) {
                await this.createArchiveFolder(siteKey);

                // Verify it was created
                archiveFolderExists = await this.checkArchiveFolderExists(archiveFolderPath);
                if (!archiveFolderExists) {
                    throw new Error('Failed to create archive folder');
                }
            }

            // Step 6: Ensure date folders exist
            const destinationPath = await this.ensureDateFoldersExist(archiveFolderPath);

            // Step 7: Get current user
            const currentUser = await this.getCurrentUser();
            if (!currentUser?.node?.uuid) {
                throw new Error('Unable to determine current user');
            }

            // Step 8: Store original location info
            const originalPath = nodeInfo.path;
            const originalParentId = nodeInfo.parent?.uuid;

            if (!originalParentId) {
                throw new Error('Unable to determine the current parent of the content');
            }

            // Step 9: Apply the archive marker - mixin and metadata in one save - to the node and,
            // for a content folder, to each item inside it, which can then be restored on its own
            const isFolder = nodeInfo.primaryNodeType?.name === 'jnt:contentFolder';
            const items = isFolder ? await this.getFolderItems(nodePath) : [];
            const entries = [
                {uuid: nodeInfo.uuid, originalPath, originalParentId},
                ...items.map(item => ({uuid: item.uuid, originalPath: item.path, originalParentId: item.parentUuid}))
            ];
            const uuids = entries.map(entry => entry.uuid);
            await this.setArchiveMetadata(entries, currentUser.node.uuid);

            // Step 10: Move node to archive. On failure, take the marker back off:
            // a node left flagged in its original location is invisible to the Archive
            // action and useless to the Restore action.
            let movedNode;
            try {
                movedNode = await this.moveNode(
                    nodeInfo.uuid,
                    destinationPath,
                    nodeInfo.name
                );
            } catch (moveError) {
                await this.rollbackArchiveMetadata(uuids, moveError);
                throw moveError;
            }

            // Step 11: Lock what was archived (make it read-only): the node and the items of a
            // folder, Jahia locks not being deep. The content is archived at this point; a failed
            // lock is reported, never swallowed, because the read-only guarantee is then missing.
            try {
                await this.setLocked(uuids, true);
            } catch (lockError) {
                console.error('[ArchiveService] Archived content could not be locked:', lockError);
                return {
                    success: true,
                    locked: false,
                    originalPath,
                    archivePath: movedNode.path,
                    destinationPath
                };
            }

            return {
                success: true,
                locked: true,
                originalPath,
                archivePath: movedNode.path,
                destinationPath
            };
        } catch (error) {
            console.error('[ArchiveService] Archive operation failed:', error);
            throw error;
        }
    }

    /**
     * Archive several nodes, one after the other.
     *
     * Sequential on purpose: each archive may create the year and month folders, and two archives
     * running at once would both try to create them. A failure on one node does not stop the others;
     * each outcome is reported.
     *
     * @param {string[]} nodePaths - Paths of the nodes to archive
     * @param {Function} [onProgress] - Called with (done, total) after each node
     * @returns {Promise<{archived: Object[], notLocked: Object[], refused: Object[], failed: Object[]}>}
     *   `archived` holds every node now in the archive (`notLocked` the ones of them that stayed
     *   editable), `refused` the nodes the checks turned down (with their `reason`), `failed` the ones
     *   whose archive threw (with the `error`)
     */
    async archiveNodes(nodePaths, onProgress) {
        const outcome = {archived: [], notLocked: [], refused: [], failed: []};

        for (const [index, nodePath] of nodePaths.entries()) {
            try {
                // Sequential on purpose: two archives at once would race to create the date folders
                // eslint-disable-next-line no-await-in-loop
                const result = await this.archiveNode(nodePath);
                if (result.success) {
                    outcome.archived.push({path: nodePath, ...result});
                    if (result.locked === false) {
                        outcome.notLocked.push({path: nodePath, ...result});
                    }
                } else {
                    outcome.refused.push({path: nodePath, ...result});
                }
            } catch (error) {
                outcome.failed.push({path: nodePath, error});
            }

            onProgress?.(index + 1, nodePaths.length);
        }

        return outcome;
    }

    /**
     * Validate if node can be archived (pre-check before confirmation)
     */
    async validateArchive(nodePath) {
        try {
            const nodeInfo = await this.getNodeInfo(nodePath);

            if (!nodeInfo) {
                return {
                    canArchive: false,
                    reason: 'notFound'
                };
            }

            if (isNodeArchived(nodeInfo)) {
                return {
                    canArchive: false,
                    reason: 'alreadyArchived',
                    nodeInfo
                };
            }

            // Check publication status in all site languages
            const {publishedLanguages, lockedPaths} = await this.getSubtreeState(nodePath);

            if (publishedLanguages.length > 0) {
                return {
                    canArchive: false,
                    reason: 'published',
                    nodeInfo,
                    publishedLanguages
                };
            }

            if (lockedPaths.length > 0) {
                return {
                    canArchive: false,
                    reason: 'locked',
                    nodeInfo,
                    lockedPaths
                };
            }

            // Get preview of destination
            const siteInfo = await this.getSiteInfo(nodePath);
            const archiveFolderPath = getArchiveFolderPath(siteInfo.name);
            const destinationPath = getArchiveDestinationPath(archiveFolderPath);

            return {
                canArchive: true,
                nodeInfo,
                destinationPreview: destinationPath
            };
        } catch (error) {
            console.error('[ArchiveService] Validation failed:', error);
            return {
                canArchive: false,
                // A known refusal keeps its own reason (a subtree too large to check), anything else is an error
                reason: error.reason || 'error',
                count: error.count,
                error
            };
        }
    }

    /**
     * Get archive information for a node
     * @param {string} nodePath - Path to the archived node
     * @returns {Promise<Object>} Archive information
     */
    async getArchiveInfo(nodePath) {
        try {
            // Query in EDIT workspace where archived content exists
            const query = `
                ${FRAGMENTS}
                
                query GetArchivedNodeInfo($path: String!, $language: String) {
                    jcr(workspace: EDIT) {
                        nodeByPath(path: $path) {
                            ...CoreNodeFields
                            displayName(language: $language)
                            properties {
                                name
                                value
                            }
                        }
                    }
                }
            `;

            const result = await executeGraphQL(query, {path: nodePath, language: getJContentContext().language});
            // ExecuteGraphQL returns result.data, so we access jcr directly
            const node = result?.jcr?.nodeByPath;

            if (!node) {
                console.error('[ArchiveService] Node not found at path:', nodePath);
                console.error('[ArchiveService] Query result:', result);
                throw new Error(`Node not found at path: ${nodePath}`);
            }

            const isArchived = node.mixinTypes?.some(m => m.name === 'jmix:archived');
            const properties = node.properties || [];

            // Extract archive properties
            const archivedProp = properties.find(p => p.name === 'archived');
            const archivedAtProp = properties.find(p => p.name === 'archivedAt');
            const archivedByProp = properties.find(p => p.name === 'archivedBy');
            const originalPathProp = properties.find(p => p.name === 'originalPath');
            const originalParentIdProp = properties.find(p => p.name === 'originalParentId');

            // Get original parent path by looking up the parent ID: it follows the parent if it was
            // moved or renamed since. A parent that is itself in the archive (an item of an archived
            // folder) is not where the item goes back: the path the item had is.
            let originalParentPath = null;
            if (originalParentIdProp?.value) {
                try {
                    const parentResult = await executeGraphQL(`
                        query GetNodeById($uuid: String!) {
                            jcr(workspace: EDIT) {
                                nodeById(uuid: $uuid) {
                                    path
                                }
                            }
                        }
                    `, {uuid: originalParentIdProp.value});
                    // ExecuteGraphQL returns result.data, so access jcr directly
                    originalParentPath = parentResult?.jcr?.nodeById?.path;
                } catch (e) {
                    console.warn('[ArchiveService] Could not find original parent:', e);
                }
            }

            const archiveRoot = getArchiveFolderPath(node.path.split('/')[2]);
            if (originalParentPath && (originalParentPath === archiveRoot || originalParentPath.startsWith(`${archiveRoot}/`))) {
                originalParentPath = null;
            }

            const restoreTarget = await this.resolveRestoreTarget(originalParentPath, originalPathProp?.value);

            return {
                isArchived,
                nodeInfo: {
                    name: node.name,
                    displayName: node.displayName,
                    path: node.path,
                    uuid: node.uuid,
                    primaryNodeType: node.primaryNodeType?.name
                },
                archived: archivedProp?.value,
                archivedAt: archivedAtProp?.value,
                archivedBy: archivedByProp?.value,
                originalPath: originalPathProp?.value,
                originalParentId: originalParentIdProp?.value,
                // Where Restore puts the item back by default, null when it must be chosen
                originalParentPath: restoreTarget.path,
                // Content folders of that path to create first, top-down (their originals are gone)
                foldersToCreate: restoreTarget.foldersToCreate
            };
        } catch (error) {
            console.error('[ArchiveService] Failed to get archive info:', error);
            throw error;
        }
    }

    /**
     * Where an archived item goes back to.
     *
     * Its original parent if it still exists outside the archive; else the path its parent had. When
     * that path is gone and lies in the site's content folders, the missing folders are created
     * again (they were content folders); anywhere else (a page, another root) the editor chooses.
     *
     * @param {?string} parentPath - The original parent's current path, outside the archive
     * @param {?string} originalPath - The path the item had
     * @returns {Promise<{path: ?string, foldersToCreate: string[]}>}
     */
    async resolveRestoreTarget(parentPath, originalPath) {
        if (parentPath && await this.checkPathExists(parentPath)) {
            return {path: parentPath, foldersToCreate: []};
        }

        if (!originalPath) {
            return {path: null, foldersToCreate: []};
        }

        const formerParent = parentOf(originalPath);
        const missing = [];
        let existing = formerParent;
        // Walking up one ancestor at a time: each step depends on the one before
        // eslint-disable-next-line no-await-in-loop
        while (existing && !(await this.checkPathExists(existing))) {
            missing.unshift(existing);
            existing = parentOf(existing);
        }

        if (missing.length === 0) {
            return {path: formerParent, foldersToCreate: []};
        }

        // Only content folders are created again: the deepest existing ancestor must be the site's
        // content root or one of its folders
        const contentsRoot = /^\/sites\/[^/]+\/contents/.exec(originalPath)?.[0];
        if (contentsRoot && (existing === contentsRoot || existing.startsWith(`${contentsRoot}/`))) {
            return {path: formerParent, foldersToCreate: missing};
        }

        return {path: null, foldersToCreate: []};
    }

    /**
     * Create content folders, top-down, so that a restore can put content back where it was.
     *
     * @param {string[]} paths - The folders to create, parents first
     */
    async createContentFolders(paths) {
        for (const folderPath of paths) {
            // Each folder needs the one before it
            // eslint-disable-next-line no-await-in-loop
            await executeGraphQL(CREATE_CONTENT_FOLDER, {
                parentPath: parentOf(folderPath),
                name: folderPath.substring(folderPath.lastIndexOf('/') + 1)
            });
        }
    }

    /**
     * The archived nodes of a subtree: the node itself and every archived item inside it (the items
     * of an archived folder carry the marker of their own), with whether each is locked.
     *
     * @param {string} nodePath - Path of the archived node
     * @returns {Promise<Array<{uuid: string, locked: boolean}>>}
     */
    async getArchivedSubtree(nodePath) {
        const data = await executeGraphQL(`
            query ArchivedSubtree($path: String!) {
                jcr(workspace: EDIT) {
                    nodeByPath(path: $path) {
                        uuid
                        lockOwner: property(name: "jcr:lockOwner") {
                            value
                        }
                        descendants(typesFilter: {types: ["jmix:archived"]}) {
                            nodes {
                                uuid
                                lockOwner: property(name: "jcr:lockOwner") {
                                    value
                                }
                            }
                        }
                    }
                }
            }
        `, {path: nodePath});
        const node = data.jcr?.nodeByPath;
        if (!node) {
            throw new Error('Node not found');
        }

        return [node, ...(node.descendants?.nodes || [])].map(n => ({uuid: n.uuid, locked: Boolean(n.lockOwner)}));
    }

    /**
     * Re-lock an archived node after a restore failed past the unlock step.
     *
     * Best-effort, for the same reason as {@link rollbackArchiveMetadata}: the restore
     * failure is the error the caller reports. A failed re-lock is logged with the path
     * because the content is then sitting in the archive and editable.
     *
     * @param {string} nodePath - Path of the node still in the archive
     * @param {string[]} uuids - The nodes that were unlocked
     * @param {Error} cause - The restore failure being compensated
     */
    async relockAfterFailedRestore(nodePath, uuids, cause) {
        try {
            await this.setLocked(uuids, true);
        } catch (relockError) {
            console.error(
                `[ArchiveService] Restore of ${nodePath} failed and the content could not be ` +
                're-locked - it stays in the archive and is editable.',
                {cause, relockError}
            );
        }
    }

    /**
     * Restore archived node to original or new location
     * @param {string} nodePath - Path to archived node
     * @param {string} targetParentPath - Path to parent where node should be restored
     * @returns {Promise<Object>} Restore result
     */
    async restoreNode(nodePath, targetParentPath) {
        try {
            console.log('[ArchiveService] Restoring node:', nodePath, 'to parent:', targetParentPath);

            // Step 1: Get node info
            const nodeResult = await executeGraphQL(GET_NODE_INFO, {path: nodePath});
            // ExecuteGraphQL returns result.data, so access jcr directly
            const node = nodeResult?.jcr?.nodeByPath;

            if (!node) {
                throw new Error('Node not found');
            }

            // Step 2: Verify target parent exists
            const parentExists = await this.checkPathExists(targetParentPath);
            if (!parentExists) {
                throw new Error('Target parent path does not exist');
            }

            // Step 3: Check if a node with same name already exists at destination
            const destinationPath = `${targetParentPath}/${node.name}`;
            const destExists = await this.checkPathExists(destinationPath);
            let finalName = node.name;

            if (destExists) {
                finalName = generateUniqueName(node.name, 1, 'restored');
            }

            // Step 4: Unlock what is locked in the archived subtree - a locked node cannot be moved
            // out of the archive, and the items of a folder come back editable with it
            const archived = await this.getArchivedSubtree(nodePath);
            const unlocked = archived.filter(n => n.locked).map(n => n.uuid);
            await this.setLocked(unlocked, false);

            // Step 5: Move node to target location. If the move fails the content is
            // still in the archive, so put the lock back: leaving it unlocked there
            // silently drops the read-only guarantee while the toast reports a failure.
            let moveResult;
            try {
                moveResult = await executeGraphQL(MOVE_NODE, {
                    pathOrId: nodePath,
                    destParentPathOrId: targetParentPath,
                    destName: finalName
                });
            } catch (moveError) {
                await this.relockAfterFailedRestore(nodePath, unlocked, moveError);
                throw moveError;
            }

            if (!moveResult?.jcr?.moveNode?.node) {
                const error = new Error('Failed to move node');
                await this.relockAfterFailedRestore(nodePath, unlocked, error);
                throw error;
            }

            const movedNodePath = moveResult.jcr.moveNode.node.path;

            // Step 6: Remove jmix:archived mixin (properties go with it). The content is
            // already back in place; if this fails it still shows as archived, and the
            // Restore action stays available on it so the operation can be retried.
            try {
                await this.removeArchiveMetadata(archived.map(n => n.uuid));
            } catch (mixinError) {
                console.error('[ArchiveService] Restored content still carries the archive marker:', mixinError);
                return {
                    success: true,
                    markerRemoved: false,
                    destinationPath: movedNodePath
                };
            }

            return {
                success: true,
                markerRemoved: true,
                destinationPath: movedNodePath
            };
        } catch (error) {
            console.error('[ArchiveService] Restore failed:', error);
            return {
                success: false,
                error
            };
        }
    }
}

export default new ArchiveService();
