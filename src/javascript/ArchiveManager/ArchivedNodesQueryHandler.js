/**
 * Query handler of the Archive Manager table.
 *
 * Delegates to jContent's own content-folders handler and adds one fragment for the archive fields.
 * jContent's side panel (Preview, Details) reads its node from the table rows, and its preview tab
 * needs fields the rows must carry (`isPage`, `isContent`, `hasCmView`, `displayableNode`, `jView`,
 * `pageAncestors`): a query of our own that misses one leaves the preview blank without an error.
 * jContent's handler always carries the fields its own panel needs, whatever its version, so the
 * rows are jContent's and only the archive columns are ours.
 *
 * The handler is read from the registry when the table queries, not at registration: jContent
 * registers its accordions in its own init, which may come after ours.
 */
import gql from 'graphql-tag';
import {registry} from '@jahia/ui-extender';
import {ArchivedNodesQuery} from './ArchivedNodesQueryHandler.gql-queries';

/** The archive metadata shown by the Archive Manager's own columns, spread into each row. */
const ArchiveFieldsFragment = {
    gql: gql`
        fragment ArchiveFields on JCRNode {
            originalPath: property(name: "originalPath") {
                value
            }
            archivedAt: property(name: "archivedAt") {
                value
            }
            archivedBy: property(name: "archivedBy") {
                value
                refNode {
                    name
                    displayName(language: $displayLanguage)
                }
            }
        }
    `,
    applyFor: 'node'
};

const hostHandler = () => registry.get('accordionItem', 'content-folders')?.tableConfig?.queryHandler;

/**
 * Fallback for a jContent without a content-folders handler in its registry: the module's former
 * query, which carries the archive fields itself (and not the preview fields).
 */
const LegacyArchivedNodesQueryHandler = {
    getQuery: () => ArchivedNodesQuery,
    getQueryVariables: ({path, lang, uilang, pagination, sort}) => ({
        path,
        language: lang,
        displayLanguage: uilang,
        offset: pagination.currentPage * pagination.pageSize,
        limit: pagination.pageSize,
        fieldSorter: sort.orderBy ? {
            sortType: sort.order === 'DESC' ? 'DESC' : 'ASC',
            fieldName: sort.orderBy,
            ignoreCase: true
        } : null
    }),
    getResults: data => data?.jcr?.nodeByPath?.children || {nodes: [], pageInfo: {totalCount: 0, nodesCount: 0}},
    structureData: (parentPath, result) => ({...result, nodes: result?.nodes || []}),
    isStructured: () => false
};

const handler = () => hostHandler() || LegacyArchivedNodesQueryHandler;

export const ArchivedNodesQueryHandler = {
    getQuery: (...args) => handler().getQuery(...args),
    getQueryVariables: (...args) => handler().getQueryVariables(...args),
    getResults: (...args) => handler().getResults(...args),
    structureData: (...args) => handler().structureData(...args),
    isStructured: (...args) => handler().isStructured?.(...args) ?? false,
    getTreeParams: (...args) => handler().getTreeParams?.(...args) ?? null,
    structureTreeEntries: (...args) => handler().structureTreeEntries?.(...args) ?? args[0],
    // A fragment the query never spreads is a GraphQL error: only jContent's query has the
    // `...node` placeholder that takes this one, the legacy query carries the fields itself.
    getFragments: () => {
        const host = hostHandler();
        return host ? [...(host.getFragments?.() || []), ArchiveFieldsFragment] : [];
    }
};
