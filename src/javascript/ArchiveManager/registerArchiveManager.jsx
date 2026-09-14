import React from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import {useTranslation} from 'react-i18next';
import {registry} from '@jahia/ui-extender';
import {addContextMenuTargetToActions} from '@jahia/jcontent';
import {Archive, TableBodyCell, Typography} from '@jahia/moonstone';
import {ArchivedNodesQueryHandler} from './ArchivedNodesQueryHandler';

const ArchiveHeader = ({column}) => {
    const {t} = useTranslation('archive');
    return <Typography weight="bold">{t(column.label)}</Typography>;
};

ArchiveHeader.propTypes = {
    column: PropTypes.shape({
        label: PropTypes.string
    }).isRequired
};

const archiveCell = ({body, title, cell, column, row}) => (
    <TableBodyCell key={row.id + column.id}
                   {...cell.getCellProps()}
                   width={column.width}
                   data-cm-role={'table-content-list-cell-' + column.id}
    >
        <Typography title={title}>{body}</Typography>
    </TableBodyCell>
);

const typeColumn = {
    id: 'archiveContentType',
    label: 'label.archiveManager.table.type',
    accessor: 'primaryNodeType.displayName',
    sortable: true,
    property: 'primaryNodeType.displayName',
    Cell: props => archiveCell({...props, body: props.value || '-'}),
    Header: ArchiveHeader,
    width: '160px'
};

const originalPathColumn = {
    id: 'archiveOriginalPath',
    label: 'label.archiveManager.table.originalPath',
    accessor: 'originalPath.value',
    sortable: true,
    property: 'originalPath',
    Cell: props => archiveCell({...props, body: props.value || '-', title: props.value}),
    Header: ArchiveHeader,
    width: '260px'
};

const archivedAtColumn = {
    id: 'archiveArchivedAt',
    label: 'label.archiveManager.table.archivedAt',
    accessor: 'archivedAt.value',
    sortable: true,
    property: 'archivedAt',
    Cell: props => {
        if (!props.value) {
            return archiveCell({...props, body: '-'});
        }

        const d = dayjs(props.value);
        return archiveCell({...props, body: d.format('L LT'), title: d.format('LLLL')});
    },
    Header: ArchiveHeader,
    width: '180px'
};

const archivedByColumn = {
    id: 'archiveArchivedBy',
    label: 'label.archiveManager.table.archivedBy',
    accessor: row => row.archivedBy?.refNode?.displayName || row.archivedBy?.refNode?.name || row.archivedBy?.value,
    sortable: true,
    property: 'archivedBy',
    Cell: props => {
        const uuid = props.row?.original?.archivedBy?.value;
        return archiveCell({...props, body: props.value || '-', title: uuid});
    },
    Header: ArchiveHeader,
    width: '160px'
};

const registerArchiveManagerComponents = () => {
    globalThis.jahia.i18n.loadNamespaces('archive');

    const renderDefaultContentTrees = registry.get('accordionItem', 'renderDefaultContentTrees');

    const accordionType = 'accordionItem';
    const accordionKey = 'archive';
    const accordionExists = registry.get(accordionType, accordionKey);

    if (!accordionExists) {
        // 1. Define a custom context menu
        const menuName = 'myCustomContextMenu';
        const menuTarget = 'myCustomContextMenuActions';
        const menuActionWithRenderer = registry.get('action', 'menuAction');
        registry.add('action', menuName, menuActionWithRenderer, {
            menuTarget,
            menuItemProps: {isShowIcons: true}
        });
        // 2. Define the actions that will be displayed in the custom context menu
        addContextMenuTargetToActions(menuTarget, ['edit', 'export', 'restoreArchive']);

        registry.add(accordionType, accordionKey, renderDefaultContentTrees, {
            targets: ['jcontent:70'],
            icon: <Archive/>,
            label: 'archive:label.archiveManager.name',
            appsTarget: 'archive-manager',
            isEnabled: siteKey => siteKey !== 'systemsite',
            rootPath: '/sites/{site}/Archives',
            requiredPermission: 'archiveContent',
            requireModuleInstalledOnSite: 'archive',
            tableConfig: {
                queryHandler: ArchivedNodesQueryHandler,
                // 3. Specify custom context menu for the table
                contextualMenu: menuName,
                // This is for hiding badge status in the content header
                header: {showStatus: false},
                // Specify custom columns either by id (see jcontent columns.js: publicationStatus, selection, name, nameBigIcon, status, type, createdBy, lastModified, visibleActions, fileSize, usages) or by providing a column definition object
                columns: [
                    'publicationStatus',
                    'selection',
                    'name',
                    typeColumn,
                    originalPathColumn,
                    archivedAtColumn,
                    archivedByColumn,
                    'visibleActions'
                ],
                showHeader: true,
                typeFilter: ['jmix:archived'],
                viewSelector: undefined
            },
            treeConfig: {
                hideRoot: true,
                rootLabel: 'archive:label.archiveManager.name',
                icon: <Archive/>,
                selectableTypes: ['jnt:archiveContentFolder'],
                openableTypes: ['jnt:archiveContentFolder']
            }
        });
    }
};

export default registerArchiveManagerComponents;
