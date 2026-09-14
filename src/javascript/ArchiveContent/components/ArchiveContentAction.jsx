/**
 * Archive Content Action Component
 * Jahia UI Extension for archiving content from Content Actions menu
 */
import React from 'react';
import PropTypes from 'prop-types';
import {registry} from '@jahia/ui-extender';
import {Archive} from '@jahia/moonstone';
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
 * Confirmation Dialog Component
 */
/**
 * Main Archive Action Component
 */
export const ArchiveContentAction = ({path, render: Render, ...otherProps}) => {
    const client = useApolloClient();
    const {checksResult} = useNodeChecks({path}, {
        showOnNodeTypes: ['jnt:page', 'jmix:editorialContent', 'jmix:archivable'],
        hideOnNodeTypes: ['jnt:archiveContentFolder', 'jmix:archived'],
        hideForPaths: ['^/sites/((?!/).)+/Archives/?$'],
        requiredPermission: ['archiveContent', 'unarchiveContent'],
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
     * Handle action click - validate before showing confirmation
     */
    const handleClick = async () => {
        try {
            const validation = await ArchiveService.validateArchive(path);

            if (!validation.canArchive) {
                // Show dialog/notification immediately before component unmounts
                if (validation.reason === 'published') {
                    dialogManager.showPublishedWarningDialog({
                        nodeInfo: validation.nodeInfo,
                        publishedLanguages: validation.publishedLanguages
                    });
                } else if (validation.reason === 'alreadyArchived') {
                    showNotification('This content is already archived', 'warning');
                } else {
                    showNotification(validation.message || 'Cannot archive this content', 'error');
                }

                return;
            }

            // Show confirmation dialog
            dialogManager.showConfirmDialog({
                nodeInfo: validation.nodeInfo,
                destinationPreview: validation.destinationPreview,
                onConfirm: () => handleConfirm()
            });
        } catch (error) {
            console.error('[ArchiveContent] Validation error:', error);
            showNotification(getErrorMessage(error), 'error');
        }
    };

    /**
     * Handle confirmed archive action
     */
    const handleConfirm = async () => {
        try {
            const result = await ArchiveService.archiveNode(path);

            if (result.success) {
                // A false `locked` flag means the content is archived but stayed
                // editable — a success the user still needs to know about.
                showNotification(
                    `${result.message} (${result.destinationPath})`,
                    result.locked === false ? 'warning' : 'success'
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
            } else {
                showNotification(result.message || 'Archive operation failed', 'error');
            }
        } catch (error) {
            console.error('[ArchiveContent] Archive error:', error);
            showNotification(getErrorMessage(error), 'error');
        }
    };

    // If render function provided, use it (for menu rendering)
    if (Render && checksResult) {
        return <Render {...otherProps} onClick={handleClick}/>;
    }

    // This shouldn't happen with proper registration, but provide a fallback
    return null;
};

ArchiveContentAction.propTypes = {
    path: PropTypes.string.isRequired,
    render: PropTypes.func
};

/**
 * Register the action in Jahia UI Extensions
 */
export const registerArchiveAction = () => {
    registry.addOrReplace('action', 'archiveContent', {
        targets: ['contentActions:99'],
        buttonIcon: <Archive/>,
        buttonLabel: 'archive:label.archiveContent',
        showOnNodeTypes: ['jnt:page', 'jmix:editorialContent', 'jmix:archivable'],
        hideOnNodeTypes: ['jnt:archiveContentFolder', 'jmix:archived'],
        hideForPaths: ['^/sites/((?!/).)+/Archives/?$'],
        requiredPermission: 'archiveContent',
        requireModuleInstalledOnSite: 'archive',
        isModal: true,
        hasBypassChildrenLimit: false,
        component: ArchiveContentAction
    });

    console.info('[ArchiveContent] Archive action registered');
};

export default ArchiveContentAction;
