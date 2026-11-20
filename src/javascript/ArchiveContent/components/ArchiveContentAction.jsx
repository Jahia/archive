/**
 * Archive action.
 *
 * Offered on pages, content and content folders, from the row menu, the right-click menu, the left
 * tree and the bar of a multiple selection (jContent hands that bar's actions `paths` when more than
 * one item is selected, `path` otherwise). The dialog goes through jContent's component renderer: the
 * menu unmounts its items on click, and a dialog rendered by the action would close with it.
 */
import React, {useContext} from 'react';
import PropTypes from 'prop-types';
import {ComponentRendererContext, registry} from '@jahia/ui-extender';
import {Archive} from '@jahia/moonstone';
import {useApolloClient} from 'react-apollo';
import {useNodeChecks} from '@jahia/data-helper';
import ArchiveDialog from '../dialogs/ArchiveDialog';
import {ARCHIVABLE_TYPES, NOT_ARCHIVABLE_PATHS} from '../utils/archiveUtils';
import {refreshAfterMove} from '../utils/refresh';
import {useNotify} from '../utils/useNotify';

const DIALOG_KEY = 'archiveContentDialog';

export const ArchiveContentAction = ({path, paths, render: Render, loading: Loading, ...otherProps}) => {
    const componentRenderer = useContext(ComponentRendererContext);
    const client = useApolloClient();
    const notify = useNotify();
    // With several paths, useNodeChecks passes only when every node passes
    const {checksResult, node, nodes, loading} = useNodeChecks(paths ? {paths} : {path}, {
        getLockInfo: true,
        showOnNodeTypes: ARCHIVABLE_TYPES,
        hideOnNodeTypes: ['jnt:archiveContentFolder', 'jmix:archived'],
        hideForPaths: NOT_ARCHIVABLE_PATHS,
        requiredPermission: ['archiveContent'],
        requireModuleInstalledOnSite: ['archive']
    });

    if (loading) {
        return Loading ? <Loading {...otherProps}/> : null;
    }

    // A locked node cannot be moved, whoever holds the lock: marking for deletion locks it too
    const isLocked = (nodes || [node]).some(n => n?.lockOwner);

    if (!Render || !checksResult || isLocked) {
        return null;
    }

    const openDialog = () => {
        componentRenderer.render(DIALOG_KEY, ArchiveDialog, {
            paths: paths || [path],
            notify,
            onDone: archivedPaths => refreshAfterMove(client, archivedPaths),
            onClose: () => componentRenderer.destroy(DIALOG_KEY)
        });
    };

    return <Render {...otherProps} onClick={openDialog}/>;
};

ArchiveContentAction.propTypes = {
    path: PropTypes.string,
    paths: PropTypes.arrayOf(PropTypes.string),
    render: PropTypes.func,
    loading: PropTypes.func
};

/**
 * Registers the action on jContent's own menus. Never on the legacy `contentActions` target, which
 * reaches a different set of menus depending on the jContent version and never the selection bar.
 */
export const registerArchiveAction = () => {
    registry.addOrReplace('action', 'archiveContent', {
        targets: [
            'contentItemActions:99',
            'contentItemContextActions:99',
            'accordionContentActions:99',
            'selectedContentActions:99'
        ],
        buttonIcon: <Archive/>,
        buttonLabel: 'archive:label.archiveContent',
        isModal: true,
        component: ArchiveContentAction
    });
};

export default ArchiveContentAction;
