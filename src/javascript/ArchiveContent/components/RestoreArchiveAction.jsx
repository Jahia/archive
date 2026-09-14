/**
 * Restore Archive Action Component
 * Jahia UI Extension for restoring archived content
 */
import React from 'react';
import PropTypes from 'prop-types';
import {registry} from '@jahia/ui-extender';
import {Unarchive} from '@jahia/moonstone';
import {useApolloClient} from 'react-apollo';
import ArchiveService from '../services/ArchiveService';
import {getErrorMessage} from '../utils/archiveUtils';
import dialogManager from '../utils/DialogManager';
import {useNodeChecks} from '@jahia/data-helper';

/**
 * Show notification to user
 */
const showNotification = (message, variant = 'info') => {
    if (window.jahia?.toastDispatcher) {
        window.jahia.toastDispatcher.add({
            message,
            variant
        });
    }
};

/**
 * Main Restore Archive Action Component
 */
export const RestoreArchiveAction = ({path, render: Render, ...otherProps}) => {
    const client = useApolloClient();
    const {checksResult} = useNodeChecks({path}, {
        showOnNodeTypes: ['jmix:archived'],
        requiredPermission: ['unarchiveContent'],
        requireModuleInstalledOnSite: ['archive']
    });

    // Get triggerRefetchAll from jContent if available
    const triggerRefetchAll = React.useMemo(() => {
        try {
            const jcontentRefetches = window.jahia?.jcontent?.refetches;
            return jcontentRefetches?.triggerRefetchAll || (() => {});
        } catch {
            return () => {};
        }
    }, []);

    /**
     * Handle action click - validate and show restore dialog
     */
    const handleClick = async () => {
        try {
            const archiveInfo = await ArchiveService.getArchiveInfo(path);

            if (!archiveInfo.isArchived) {
                showNotification('This content is not archived', 'warning');
                return;
            }

            // Check if original parent still exists
            const parentExists = await ArchiveService.checkPathExists(archiveInfo.originalParentPath);

            // Show restore confirmation dialog
            dialogManager.showRestoreConfirmDialog({
                nodeInfo: archiveInfo.nodeInfo,
                archiveInfo: archiveInfo,
                parentExists: parentExists,
                onConfirm: selectedParentPath => handleConfirm(archiveInfo, selectedParentPath),
                onSelectParent: () => handleSelectParent(archiveInfo)
            });
        } catch (error) {
            console.error('[RestoreArchive] Error:', error);
            showNotification(getErrorMessage(error), 'error');
        }
    };

    /**
     * Handle confirmed restore action
     */
    const handleConfirm = async (archiveInfo, customParentPath = null) => {
        try {
            const targetParentPath = customParentPath || archiveInfo.originalParentPath;
            const result = await ArchiveService.restoreNode(path, targetParentPath);

            if (result.success) {
                // A false `markerRemoved` flag means the content is back in place but
                // still flagged archived — surfaced so the user can retry the restore.
                showNotification(
                    `${result.message} (${result.destinationPath})`,
                    result.markerRemoved === false ? 'warning' : 'success'
                );

                // Clear Apollo cache for both paths
                try {
                    client.cache.flushNodeEntryByPath(path);
                    if (result.destinationPath) {
                        client.cache.flushNodeEntryByPath(result.destinationPath);
                    }
                } catch {
                    // Cache flush failed silently - not critical
                }

                // Trigger iframe and component refresh
                triggerRefetchAll();

                // Trigger content refresh if possible
                if (otherProps.refetch) {
                    otherProps.refetch();
                }

                // Hide dialog
                dialogManager.hideDialog();
            } else {
                showNotification(result.message || 'Restore operation failed', 'error');
            }
        } catch (error) {
            console.error('[RestoreArchive] Restore error:', error);
            showNotification(getErrorMessage(error), 'error');
        }
    };

    /**
     * Handle parent path selection
     */
    const handleSelectParent = archiveInfo => {
        // Show path picker dialog
        dialogManager.showPathPickerDialog({
            nodeInfo: archiveInfo.nodeInfo,
            onConfirm: selectedPath => {
                // Show restore confirmation with new parent
                dialogManager.showRestoreConfirmDialog({
                    nodeInfo: archiveInfo.nodeInfo,
                    archiveInfo: archiveInfo,
                    parentExists: true,
                    customParentPath: selectedPath,
                    onConfirm: selectedParentPath => handleConfirm(archiveInfo, selectedParentPath)
                });
            }
        });
    };

    if (!Render || !checksResult) {
        return null;
    }

    return <Render {...otherProps} onClick={handleClick}/>;
};

RestoreArchiveAction.propTypes = {
    path: PropTypes.string.isRequired,
    render: PropTypes.func
};

/**
 * Register the restore action in Jahia UI Extensions
 */
export const registerRestoreArchiveAction = () => {
    registry.addOrReplace('action', 'restoreArchive', {
        targets: ['contentActions:998'],
        buttonIcon: <Unarchive/>,
        buttonLabel: 'archive:label.restoreArchive',
        showOnNodeTypes: ['jmix:archived'],
        requiredPermission: 'unarchiveContent',
        requireModuleInstalledOnSite: 'archive',
        isModal: true,
        component: RestoreArchiveAction
    });

    console.info('[ArchiveContent] Restore archive action registered');
};

export default RestoreArchiveAction;
