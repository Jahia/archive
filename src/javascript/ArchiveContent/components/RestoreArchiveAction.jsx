/**
 * Restore action, on one archived item at a time: each item goes back to its own original location,
 * or to a location the editor picks when that one is gone.
 */
import React, {useContext} from 'react';
import PropTypes from 'prop-types';
import {ComponentRendererContext, registry} from '@jahia/ui-extender';
import {Unarchive} from '@jahia/moonstone';
import {useApolloClient} from 'react-apollo';
import {useNodeChecks} from '@jahia/data-helper';
import RestoreDialog from '../dialogs/RestoreDialog';
import {refreshAfterMove} from '../utils/refresh';
import {useNotify} from '../utils/useNotify';

const DIALOG_KEY = 'restoreArchiveDialog';

export const RestoreArchiveAction = ({path, render: Render, loading: Loading, ...otherProps}) => {
    const componentRenderer = useContext(ComponentRendererContext);
    const client = useApolloClient();
    const notify = useNotify();
    const {checksResult, loading} = useNodeChecks({path}, {
        showOnNodeTypes: ['jmix:archived'],
        requiredPermission: ['unarchiveContent'],
        requireModuleInstalledOnSite: ['archive']
    });

    if (loading && Loading) {
        return <Loading {...otherProps}/>;
    }

    if (!Render) {
        return null;
    }

    const openDialog = () => {
        componentRenderer.render(DIALOG_KEY, RestoreDialog, {
            path,
            notify,
            onDone: () => refreshAfterMove(client, [path]),
            onClose: () => componentRenderer.destroy(DIALOG_KEY)
        });
    };

    // Hidden through the render prop, never by returning null: jContent's menus show their items
    // once none is loading, and an item that rendered Loading then nothing stays loading for good,
    // which left every right-click and row menu on grey placeholders (1.2.0 to 1.2.1).
    return <Render {...otherProps} isVisible={!loading && Boolean(checksResult)} onClick={openDialog}/>;
};

RestoreArchiveAction.propTypes = {
    path: PropTypes.string.isRequired,
    render: PropTypes.func,
    loading: PropTypes.func
};

export const registerRestoreArchiveAction = () => {
    registry.addOrReplace('action', 'restoreArchive', {
        targets: [
            'contentItemActions:998',
            'contentItemContextActions:998',
            'accordionContentActions:998'
        ],
        buttonIcon: <Unarchive/>,
        buttonLabel: 'archive:label.restoreArchive',
        isModal: true,
        component: RestoreArchiveAction
    });
};

export default RestoreArchiveAction;
