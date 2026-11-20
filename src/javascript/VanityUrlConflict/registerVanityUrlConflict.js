/**
 * Explains to the SEO vanity URL screens that a URL is taken by archived content.
 *
 * Archived content keeps its vanity URLs, so that a restore brings them back, and Jahia keeps them
 * unique: another page cannot take one while the content sits in the archive. Without this, the SEO
 * screen only names a path under /Archives, which tells the editor nothing.
 *
 * Read by site-settings-seo through its `vanityUrlConflict` registry type; an SEO version without
 * it never calls this, and keeps its own message.
 */
import {registry} from '@jahia/ui-extender';
import i18next from 'i18next';
import {executeGraphQL, formatDateTime, getJContentContext} from '../ArchiveContent/utils/archiveUtils';

const ARCHIVED_FIELDS = `
    displayName(language: $language)
    archived: isNodeType(type: {types: ["jmix:archived"]})
    archivedAt: property(name: "archivedAt") {
        value
    }
    archivedBy: property(name: "archivedBy") {
        refNode {
            displayName
        }
    }
    originalPath: property(name: "originalPath") {
        value
    }
`;

const ConflictingNodeQuery = `
    query ArchiveVanityUrlConflict($path: String!, $language: String) {
        jcr(workspace: EDIT) {
            nodeByPath(path: $path) {
                ${ARCHIVED_FIELDS}
                ancestors {
                    ${ARCHIVED_FIELDS}
                }
            }
        }
    }
`;

/**
 * Answers for a node that is archived, or sits inside archived content (a sub-page moves with the
 * page it belongs to, and only that page carries the marker); null for any other node.
 */
export const explainArchivedConflict = async ({existingNodePath}) => {
    const data = await executeGraphQL(ConflictingNodeQuery, {path: existingNodePath, language: getJContentContext().language});
    const node = data.jcr?.nodeByPath;
    if (!node) {
        return null;
    }

    // Ancestors come root first: the closest archived one is the last
    const archivedNode = node.archived ? node : [...(node.ancestors || [])].reverse().find(ancestor => ancestor.archived);
    if (!archivedNode) {
        return null;
    }

    await i18next.loadNamespaces('archive');
    return {
        label: i18next.t('archive:vanityConflict.label'),
        message: i18next.t('archive:vanityConflict.message', {
            title: node.displayName,
            date: formatDateTime(archivedNode.archivedAt?.value, {dateStyle: 'medium'}),
            user: archivedNode.archivedBy?.refNode?.displayName || '',
            originalPath: archivedNode.originalPath?.value || '',
            interpolation: {escapeValue: false}
        })
    };
};

export const registerVanityUrlConflict = () => {
    registry.addOrReplace('vanityUrlConflict', 'archive', {
        explain: explainArchivedConflict
    });
};
