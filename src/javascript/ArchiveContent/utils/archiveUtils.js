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
 * field gets `false` for every node — query `aggregatedPublicationInfo(language: …)`
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
 * @returns {string} A unique name
 */
export const generateUniqueName = (originalName, attempt = 1) => {
    if (attempt === 1) {
        // First attempt: add timestamp
        const timestamp = Date.now();
        return `${originalName}-archived-${timestamp}`;
    }

    // Subsequent attempts: add counter
    return `${originalName}-archived-${attempt}`;
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
 * Get user-friendly error message
 * @param {Error} error - The error object
 * @returns {string} User-friendly error message
 */
export const getErrorMessage = error => {
    console.error('[ArchiveContent] Error:', error);

    if (error.message) {
        // Check for common GraphQL errors
        if (error.message.includes('permission') || error.message.includes('denied')) {
            return 'You do not have permission to perform this action.';
        }

        if (error.message.includes('not found')) {
            return 'The content could not be found.';
        }

        if (error.message.includes('locked')) {
            return 'The content is locked and cannot be archived.';
        }

        return error.message;
    }

    return 'An unexpected error occurred while archiving content.';
};

/**
 * Execute GraphQL query
 * @param {string} query - GraphQL query string
 * @param {Object} variables - Query variables
 * @returns {Promise<Object>} Query result
 */
export const executeGraphQL = async (query, variables = {}) => {
    const response = await fetch('/modules/graphql', {
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
    const response = await fetch('/modules/graphql', {
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

