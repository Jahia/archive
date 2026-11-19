/**
 * Utility functions for archive content extension
 */

/**
 * Archive folder name constant
 */
export const ARCHIVE_FOLDER_NAME = 'Archives';

/**
 * Get the archive folder path for a given site
 * @param {string} siteKey - The site key
 * @returns {string} The archive folder path
 */
export const getArchiveFolderPath = siteKey => {
    return `/sites/${siteKey}/${ARCHIVE_FOLDER_NAME}`;
};

/**
 * Node types the Archive action is offered on: pages, editorial content and content folders
 * (archiving a folder moves it with everything it holds), plus any type a module marks archivable.
 */
export const ARCHIVABLE_TYPES = ['jnt:page', 'jmix:editorialContent', 'jnt:contentFolder', 'jmix:archivable'];

/**
 * Paths the Archive action is never offered on, whatever their type: a site's home page, a site's
 * content root, and the whole archive tree - its root, its date folders and everything inside an
 * archived folder, which is archived with it.
 */
export const NOT_ARCHIVABLE_PATHS = [
    '^/sites/[^/]+/home/?$',
    '^/sites/[^/]+/contents/?$',
    `^/sites/[^/]+/${ARCHIVE_FOLDER_NAME}(/.*)?$`
];

/**
 * The site, language and UI language open in jContent.
 *
 * Read from jContent's own store: `contextJsParameters.siteKey` is the site the server resolved for
 * the request, which is `systemsite` wherever sites share a server name.
 *
 * @returns {{site: (string|undefined), language: (string|undefined), uilang: (string|undefined)}}
 */
export const getJContentContext = () => {
    const state = globalThis.jahia?.reduxStore?.getState?.() || {};
    return {
        site: state.site || globalThis.contextJsParameters?.siteKey,
        language: state.language || globalThis.contextJsParameters?.lang,
        uilang: state.uilang || globalThis.contextJsParameters?.uilang
    };
};

/**
 * Format date as YYYY/MM for archive path structure
 * @param {Date} date - The date to format
 * @returns {Object} Object with year and month strings
 */
export const formatArchiveDatePath = (date = new Date()) => {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return {year, month};
};

/**
 * Get the full archive destination path including date structure
 * @param {string} archiveFolderPath - Base archive folder path
 * @param {Date} date - Optional date (defaults to now)
 * @returns {string} Full destination path
 */
export const getArchiveDestinationPath = (archiveFolderPath, date = new Date()) => {
    const {year, month} = formatArchiveDatePath(date);
    return `${archiveFolderPath}/${year}/${month}`;
};

/**
 * Extract site key from a JCR path
 * @param {string} path - The JCR node path
 * @returns {string|null} The site key or null if not found
 */
export const extractSiteKeyFromPath = path => {
    if (!path) {
        return null;
    }

    // Path format: /sites/<siteKey>/... or /<siteKey>/...
    const match = /^\/(?:sites\/)?([^/]+)/.exec(path);
    return match ? match[1] : null;
};

/**
 * Check if a node is published, for one language.
 *
 * Reads `aggregatedPublicationInfo.publicationStatus` and falls back to an
 * `isPublished` property alias. A caller passing a node fetched without either
 * field gets `false` for every node - query `aggregatedPublicationInfo(language: …)`
 * (it takes a mandatory `language` argument) before relying on this.
 *
 * @param {Object} nodeInfo - Node information from GraphQL query
 * @returns {boolean} True if node is published
 */
export const isNodePublished = nodeInfo => {
    if (!nodeInfo) {
        return false;
    }

    // Check aggregatedPublicationInfo
    const pubStatus = nodeInfo.aggregatedPublicationInfo?.publicationStatus;
    if (pubStatus === 'PUBLISHED' || pubStatus === 'MODIFIED') {
        return true;
    }

    // Fallback: check j:published property
    if (nodeInfo.isPublished?.value === 'true' || nodeInfo.isPublished?.value === true) {
        return true;
    }

    return false;
};

/**
 * Check if a node is already archived
 * @param {Object} nodeInfo - Node information from GraphQL query
 * @returns {boolean} True if node is already archived
 */
export const isNodeArchived = nodeInfo => {
    if (!nodeInfo) {
        return false;
    }

    // Check for jmix:archived mixin
    const hasArchivedMixin = nodeInfo.mixinTypes?.some(
        mixin => mixin.name === 'jmix:archived'
    );

    // Check for archived property
    const archivedProp = nodeInfo.archivedProp?.value === 'true' ||
                        nodeInfo.archivedProp?.value === true;

    return hasArchivedMixin || archivedProp;
};

/**
 * Generate a unique name if collision occurs
 * @param {string} originalName - The original node name
 * @param {number} attempt - The attempt number
 * @param {string} label - What happened to the node: `archived` when it lands in the archive,
 *   `restored` when it comes back (a restored folder whose name was taken, often because an item of it
 *   was restored first and its folder created again)
 * @returns {string} A unique name
 */
export const generateUniqueName = (originalName, attempt = 1, label = 'archived') => {
    if (attempt === 1) {
        // First attempt: add timestamp
        const timestamp = Date.now();
        return `${originalName}-${label}-${timestamp}`;
    }

    // Subsequent attempts: add counter
    return `${originalName}-${label}-${attempt}`;
};

/**
 * A Jahia language code as a BCP 47 tag: `zh_CN` becomes `zh-CN`. `Intl` throws
 * `RangeError: Invalid language tag` on the underscore form.
 *
 * @param {string} language - A Jahia language code (`fr`, `zh_CN`)
 * @returns {string} The BCP 47 tag, `en` when none was given
 */
export const toLanguageTag = language => (language || 'en').replace('_', '-');

/** Medium date and short time, as jContent's own date columns show them. */
const DEFAULT_DATE_FORMAT = {dateStyle: 'medium', timeStyle: 'short'};

/**
 * Formats a date in the jContent UI language, the way jContent's own date columns do.
 *
 * @param {string} value - An ISO date
 * @param {Object} [options] - `Intl.DateTimeFormat` options; medium date and short time by default
 * @returns {string} The formatted date, or '' when there is no date
 */
export const formatDateTime = (value, options = DEFAULT_DATE_FORMAT) => {
    if (!value) {
        return '';
    }

    try {
        return new Intl.DateTimeFormat(toLanguageTag(getJContentContext().uilang), options).format(new Date(value));
    } catch (error) {
        console.warn('[ArchiveContent] Date not formatted in the UI language:', error);
        return new Date(value).toLocaleString();
    }
};

/**
 * Format ISO date string for JCR DATE property
 * @param {Date} date - The date to format
 * @returns {string} ISO formatted date string
 */
export const formatJCRDate = (date = new Date()) => {
    return date.toISOString();
};

/**
 * Translated, user-friendly description of an error.
 *
 * The known cases come from the locale files; anything else shows the server's own message, which
 * the user may need to report.
 *
 * @param {Function} t - The `t` function of `useTranslation('archive')`
 * @param {Error} error - The error object
 * @returns {string} The message to show
 */
export const describeError = (t, error) => {
    console.error('[ArchiveContent] Error:', error);
    const message = error?.message || '';

    if (message.includes('permission') || message.includes('denied')) {
        return t('archive:error.permission');
    }

    if (message.includes('not found') || message.includes('PathNotFoundException')) {
        return t('archive:error.notFound');
    }

    if (message.includes('locked')) {
        return t('archive:error.locked');
    }

    return message ? t('archive:error.withDetail', {detail: message}) : t('archive:error.unexpected');
};

/**
 * Execute GraphQL query
 * @param {string} query - GraphQL query string
 * @param {Object} variables - Query variables
 * @returns {Promise<Object>} Query result
 */
export const executeGraphQL = async (query, variables = {}) => {
    const response = await fetch(`${globalThis.contextJsParameters?.contextPath || ''}/modules/graphql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query,
            variables
        })
    });

    const result = await response.json();

    if (result.errors) {
        console.error('[ArchiveContent] GraphQL errors:', result.errors);
        throw new Error(result.errors[0]?.message || 'GraphQL query failed');
    }

    return result.data;
};

/**
 * Execute GraphQL query without logging errors (for cases where errors are expected)
 * @param {string} query - GraphQL query string
 * @param {Object} variables - Query variables
 * @returns {Promise<Object>} Query result
 */
export const executeGraphQLSilent = async (query, variables = {}) => {
    const response = await fetch(`${globalThis.contextJsParameters?.contextPath || ''}/modules/graphql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query,
            variables
        })
    });

    const result = await response.json();

    if (result.errors) {
        throw new Error(result.errors[0]?.message || 'GraphQL query failed');
    }

    return result.data;
};

