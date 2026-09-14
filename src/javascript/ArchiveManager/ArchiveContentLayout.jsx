/**
 * Custom Content Layout for Archive Manager
 * Wraps ContentTable with custom columns from tableConfig
 */
import React, {useMemo} from 'react';
import PropTypes from 'prop-types';
import {useSelector} from 'react-redux';
import {registry} from '@jahia/ui-extender';

// We need to import ContentTable from jContent
// Since it's a remote module, we'll access it via the registry or window context
let ContentTable;
try {
    // Try to get ContentTable from jContent's remote module
    const jcontent = globalThis.jahia?.jcontent;
    if (jcontent?.ContentTable) {
        ContentTable = jcontent.ContentTable;
    }
} catch (e) {
    console.error('[ArchiveContentLayout] Failed to load ContentTable:', e);
}

export const ArchiveContentLayout = ({totalCount, rows, isContentNotFound, isStructured, isLoading}) => {
    const mode = useSelector(state => state.jcontent?.mode);

    // Get the accordion configuration and extract columns from tableConfig
    const columns = useMemo(() => {
        try {
            const accordionItem = registry.get('accordionItem', mode);
            if (accordionItem?.tableConfig?.columns) {
                return accordionItem.tableConfig.columns;
            }
        } catch (e) {
            console.error('[ArchiveContentLayout] Failed to get columns from tableConfig:', e);
        }

        return undefined;
    }, [mode]);

    // If ContentTable is not available, show error
    if (!ContentTable) {
        return (
            <div style={{padding: '20px', color: 'red'}}>
                Error: ContentTable component not available
            </div>
        );
    }

    return (
        <ContentTable
            totalCount={totalCount}
            rows={rows}
            columns={columns}
            isContentNotFound={isContentNotFound}
            isStructured={isStructured}
            isLoading={isLoading}
        />
    );
};

ArchiveContentLayout.propTypes = {
    totalCount: PropTypes.number,
    rows: PropTypes.array,
    isContentNotFound: PropTypes.bool,
    isStructured: PropTypes.bool,
    isLoading: PropTypes.bool
};
