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
    GET_SITE_LANGUAGES,
    GET_PUBLICATION_STATUS
} from '../graphql/queries';

import {
    CREATE_ARCHIVE_FOLDER,
    CREATE_FOLDER,
    SET_ARCHIVE_METADATA,
    REMOVE_ARCHIVE_METADATA,
    MOVE_NODE,
    LOCK_NODE,
    UNLOCK_NODE
} from '../graphql/mutations';

import {
    getArchiveFolderPath,
    getArchiveDestinationPath,
    isNodePublished,
    isNodeArchived,
    generateUniqueName,
    formatJCRDate,
    executeGraphQL,
    executeGraphQLSilent
} from '../utils/archiveUtils';

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
        const data = await executeGraphQL(GET_NODE_INFO, {path});
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
     * Check publication status for all site languages.
     *
     * Any failing language rejects the whole check. An unreadable publication status
     * is not evidence that the content is unpublished, and treating it as such is how
     * published content gets archived out from under the live workspace.
     */
    async getPublicationStatusForAllLanguages(path, languages) {
        return Promise.all(
            languages.map(async lang => {
                const data = await executeGraphQL(GET_PUBLICATION_STATUS, {path, language: lang});
                const nodeInfo = data.jcr?.nodeByPath;

                if (!nodeInfo?.aggregatedPublicationInfo) {
                    throw new Error(`Unable to read the publication status of ${path} in ${lang}`);
                }

                return {
                    language: lang,
                    status: nodeInfo.aggregatedPublicationInfo.publicationStatus,
                    isPublished: isNodePublished(nodeInfo)
                };
            })
        );
    }

    /**
     * Resolve the languages a node is currently published in.
     *
     * Single source of truth for "is this content published" — used by both the
     * pre-flight validation and the archive operation itself, so the two can never
     * disagree. Rejects if the answer cannot be established.
     *
     * @param {string} nodePath - Path of the node to check
     * @returns {Promise<Array>} The published-language entries; empty when unpublished
     */
    async getPublishedLanguages(nodePath) {
        const siteLanguages = await this.getSiteLanguages(nodePath);
        const statuses = await this.getPublicationStatusForAllLanguages(nodePath, siteLanguages);
        return statuses.filter(l => l.isPublished);
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
     * Apply the archive marker — mixin and metadata — in a single request.
     *
     * One request is one JCR save, so the node either carries the complete marker or
     * none of it. Adding the mixin separately from its mandatory properties can strand
     * the node in a half-archived state that neither action can undo.
     */
    async setArchiveMetadata(path, originalPath, originalParentId, userUuid) {
        await executeGraphQL(SET_ARCHIVE_METADATA, {
            path,
            archived: 'true',
            archivedAt: formatJCRDate(),
            archivedBy: userUuid,
            originalPath,
            originalParentId
        });
    }

    /**
     * Remove the archive marker, dropping the mixin and its properties together.
     */
    async removeArchiveMetadata(pathOrId) {
        const result = await executeGraphQL(REMOVE_ARCHIVE_METADATA, {pathOrId});

        if (!result?.jcr?.mutateNode) {
            throw new Error('Failed to remove archived mixin');
        }
    }

    /**
     * Undo the archive marker after a later step failed.
     *
     * Best-effort: the caller is already throwing the failure that triggered this, and
     * that error is the one worth surfacing. A rollback that itself fails is logged with
     * the path, so the half-archived node can be found and cleared by hand.
     *
     * @param {string} nodePath - Path the marker was applied to
     * @param {Error} cause - The failure being compensated
     */
    async rollbackArchiveMetadata(nodePath, cause) {
        try {
            await this.removeArchiveMetadata(nodePath);
        } catch (rollbackError) {
            console.error(
                `[ArchiveService] Archive of ${nodePath} failed and the archive marker could ` +
                'not be removed — the node needs clearing by hand.',
                {cause, rollbackError}
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
                    alreadyArchived: true,
                    message: 'This content is already archived',
                    nodeInfo
                };
            }

            // Step 3: Check if published, in every language of the site.
            // Re-checked here rather than trusted from validateArchive: this is the
            // write site, and it is reachable without going through the dialog.
            const publishedLanguages = await this.getPublishedLanguages(nodePath);

            if (publishedLanguages.length > 0) {
                return {
                    success: false,
                    isPublished: true,
                    message: 'Cannot archive published content. Please unpublish first.',
                    publishedLanguages,
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

            // Step 9: Apply the archive marker — mixin and metadata in one save
            await this.setArchiveMetadata(
                nodePath,
                originalPath,
                originalParentId,
                currentUser.node.uuid
            );

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
                await this.rollbackArchiveMetadata(nodePath, moveError);
                throw moveError;
            }

            // Step 11: Lock the node (make it read-only). The content is archived at
            // this point; a failed lock is reported, never swallowed, because the
            // read-only guarantee is the one thing that is then missing.
            try {
                await executeGraphQL(LOCK_NODE, {pathOrId: movedNode.path});
            } catch (lockError) {
                console.error('[ArchiveService] Archived content could not be locked:', lockError);
                return {
                    success: true,
                    locked: false,
                    message: 'Content archived, but it could not be locked and stays editable',
                    originalPath,
                    archivePath: movedNode.path,
                    destinationPath
                };
            }

            return {
                success: true,
                locked: true,
                message: 'Content archived successfully',
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
     * Validate if node can be archived (pre-check before confirmation)
     */
    async validateArchive(nodePath) {
        try {
            const nodeInfo = await this.getNodeInfo(nodePath);

            if (!nodeInfo) {
                return {
                    canArchive: false,
                    reason: 'notFound',
                    message: 'Content not found'
                };
            }

            if (isNodeArchived(nodeInfo)) {
                return {
                    canArchive: false,
                    reason: 'alreadyArchived',
                    message: 'Content is already archived',
                    nodeInfo
                };
            }

            // Check publication status in all site languages
            const publishedLanguages = await this.getPublishedLanguages(nodePath);

            if (publishedLanguages.length > 0) {
                return {
                    canArchive: false,
                    reason: 'published',
                    message: 'Content is published and must be unpublished first',
                    nodeInfo,
                    publishedLanguages
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
                reason: 'error',
                message: error.message || 'Validation failed'
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
                
                query GetArchivedNodeInfo($path: String!) {
                    jcr(workspace: EDIT) {
                        nodeByPath(path: $path) {
                            ...CoreNodeFields
                            displayName
                            properties {
                                name
                                value
                            }
                        }
                    }
                }
            `;

            const result = await executeGraphQL(query, {path: nodePath});
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

            // Get original parent path by looking up the parent ID
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
                originalParentPath
            };
        } catch (error) {
            console.error('[ArchiveService] Failed to get archive info:', error);
            throw error;
        }
    }

    /**
     * Re-lock an archived node after a restore failed past the unlock step.
     *
     * Best-effort, for the same reason as {@link rollbackArchiveMetadata}: the restore
     * failure is the error the caller reports. A failed re-lock is logged with the path
     * because the content is then sitting in the archive and editable.
     *
     * @param {string} nodePath - Path of the node still in the archive
     * @param {Error} cause - The restore failure being compensated
     */
    async relockAfterFailedRestore(nodePath, cause) {
        try {
            await executeGraphQL(LOCK_NODE, {pathOrId: nodePath});
        } catch (relockError) {
            console.error(
                `[ArchiveService] Restore of ${nodePath} failed and the node could not be ` +
                're-locked — it stays in the archive and is editable.',
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
                finalName = generateUniqueName(node.name);
            }

            // Step 4: Unlock the node — a locked node cannot be moved out of the archive
            await executeGraphQL(UNLOCK_NODE, {pathOrId: nodePath});

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
                await this.relockAfterFailedRestore(nodePath, moveError);
                throw moveError;
            }

            if (!moveResult?.jcr?.moveNode?.node) {
                const error = new Error('Failed to move node');
                await this.relockAfterFailedRestore(nodePath, error);
                throw error;
            }

            const movedNodePath = moveResult.jcr.moveNode.node.path;

            // Step 6: Remove jmix:archived mixin (properties go with it). The content is
            // already back in place; if this fails it still shows as archived, and the
            // Restore action stays available on it so the operation can be retried.
            try {
                await this.removeArchiveMetadata(movedNodePath);
            } catch (mixinError) {
                console.error('[ArchiveService] Restored content still carries the archive marker:', mixinError);
                return {
                    success: true,
                    markerRemoved: false,
                    destinationPath: movedNodePath,
                    message: 'Content restored, but it still shows as archived — retry the restore'
                };
            }

            return {
                success: true,
                markerRemoved: true,
                destinationPath: movedNodePath,
                message: 'Content restored successfully'
            };
        } catch (error) {
            console.error('[ArchiveService] Restore failed:', error);
            return {
                success: false,
                message: error.message || 'Failed to restore content'
            };
        }
    }
}

export default new ArchiveService();
