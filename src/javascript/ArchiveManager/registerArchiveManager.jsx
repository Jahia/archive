import React from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from 'react-i18next';
import {registry} from '@jahia/ui-extender';
import {addContextMenuTargetToActions} from '@jahia/jcontent';
import {Archive, TableBodyCell, Typography} from '@jahia/moonstone';
import {ArchivedNodesQueryHandler} from './ArchivedNodesQueryHandler';
import {ARCHIVE_FOLDER_NAME, formatDateTime} from '../ArchiveContent/utils/archiveUtils';

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
    property: 'originalPath.value',
    Cell: props => archiveCell({...props, body: props.value || '-', title: props.value}),
    Header: ArchiveHeader,
    width: '260px'
};

const dateCell = props => {
    if (!props.value) {
        return archiveCell({...props, body: '-'});
    }

    return archiveCell({
        ...props,
        body: formatDateTime(props.value),
        title: formatDateTime(props.value, {dateStyle: 'full', timeStyle: 'medium'})
    });
};

// Kept by the move: the date the content was first created, which editors look for
const createdColumn = {
    id: 'archiveCreated',
    label: 'label.archiveManager.table.created',
    accessor: 'created.value',
    sortable: true,
    property: 'created.value',
    Cell: dateCell,
    Header: ArchiveHeader,
    width: '190px'
};

const archivedAtColumn = {
    id: 'archiveArchivedAt',
    label: 'label.archiveManager.table.archivedAt',
    accessor: 'archivedAt.value',
    sortable: true,
    property: 'archivedAt.value',
    Cell: dateCell,
    Header: ArchiveHeader,
    width: '190px'
};

const archivedByColumn = {
    id: 'archiveArchivedBy',
    label: 'label.archiveManager.table.archivedBy',
    accessor: row => row.archivedBy?.refNode?.displayName || row.archivedBy?.refNode?.name || row.archivedBy?.value,
    sortable: true,
    property: 'archivedBy.refNode.displayName',
    Cell: props => {
        const uuid = props.row?.original?.archivedBy?.value;
        return archiveCell({...props, body: props.value || '-', title: uuid});
    },
    Header: ArchiveHeader,
    width: '160px'
};

const registerArchiveManagerComponents = () => {
    // The 'archive' namespace is loaded by init (AdminPanel.register), before this runs
    const renderDefaultContentTrees = registry.get('accordionItem', 'renderDefaultContentTrees');

    const accordionType = 'accordionItem';
    const accordionKey = 'archive';
    const accordionExists = registry.get(accordionType, accordionKey);

    if (!accordionExists) {
        // 1. The table's context menu. The registry is shared by every installed extension: the keys
        // carry the module's name.
        const menuName = 'archiveManagerContextMenu';
        const menuTarget = 'archiveManagerContextMenuActions';
        const menuActionWithRenderer = registry.get('action', 'menuAction');
        registry.add('action', menuName, menuActionWithRenderer, {
            menuTarget,
            menuItemProps: {isShowIcons: true}
        });
        // 2. Its actions: Preview first, so an archived item can be read before it is restored
        addContextMenuTargetToActions(menuTarget, ['preview', 'edit', 'export', 'restoreArchive']);

        registry.add(accordionType, accordionKey, renderDefaultContentTrees, {
            targets: ['jcontent:70'],
            icon: <Archive/>,
            label: 'archive:label.archiveManager.name',
            appsTarget: 'archive-manager',
            isEnabled: siteKey => siteKey !== 'systemsite',
            rootPath: `/sites/{site}/${ARCHIVE_FOLDER_NAME}`,
            requiredPermission: 'archiveContent',
            requireModuleInstalledOnSite: 'archive',
            tableConfig: {
                queryHandler: ArchivedNodesQueryHandler,
                // 3. Specify custom context menu for the table
                contextualMenu: menuName,
                // This is for hiding badge status in the content header
                header: {showStatus: false},
                // Custom columns by id (jcontent columns.js: publicationStatus, selection, name, nameBigIcon, status, type, createdBy, lastModified, visibleActions, fileSize, usages) or by definition
                columns: [
                    'publicationStatus',
                    'selection',
                    'name',
                    typeColumn,
                    createdColumn,
                    originalPathColumn,
                    archivedAtColumn,
                    archivedByColumn,
                    'visibleActions'
                ],
                showHeader: true,
                // Archived items in a month folder (pages included, through jmix:archived), and the
                // content of an archived folder once it is opened
                typeFilter: ['jmix:archived', 'jnt:content', 'jnt:contentFolder'],
                viewSelector: undefined
            },
            treeConfig: {
                hideRoot: true,
                rootLabel: 'archive:label.archiveManager.name',
                icon: <Archive/>,
                // Date folders, and archived content folders so their content can be browsed
                selectableTypes: ['jnt:archiveContentFolder', 'jnt:contentFolder'],
                openableTypes: ['jnt:archiveContentFolder', 'jnt:contentFolder']
            }
        });
    }
};

export default registerArchiveManagerComponents;
