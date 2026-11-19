/**
 * GraphQL queries for archive content extension
 */

/**
 * Core node fragments
 */
export const FRAGMENTS = `
  fragment SimpleCoreNodeFields on JCRNode {
    workspace
    uuid
    path
    name
  }

  fragment CoreNodeFields on JCRNode {
    ...SimpleCoreNodeFields
    primaryNodeType {
      name
      supertypes {
        name
      }
    }
    mixinTypes {
      name
    }
  }
`;

/**
 * Query to fetch node information including publication status for all languages
 */
export const GET_NODE_INFO = `
  ${FRAGMENTS}
  
  query GetNodeInfo($path: String!, $language: String) {
    jcr(workspace: EDIT) {
      nodeByPath(path: $path) {
        ...CoreNodeFields
        displayName(language: $language)
        parent {
          ...SimpleCoreNodeFields
        }
        site {
          languages: property(name: "j:languages") {
            values
          }
        }
        properties {
          name
          value
        }
        archivedProp: property(name: "archived") {
          value
        }
      }
    }
  }
`;

/**
 * Query to get site languages
 */
export const GET_SITE_LANGUAGES = `
  query GetSiteLanguages($path: String!) {
    jcr(workspace: EDIT) {
      nodeByPath(path: $path) {
        site {
          languages: property(name: "j:languages") {
            values
          }
        }
      }
    }
  }
`;

/**
 * Query to check if archive folder exists
 */
export const CHECK_ARCHIVE_FOLDER = `
  ${FRAGMENTS}
  
  query CheckArchiveFolder($path: String!) {
    jcr(workspace: EDIT) {
      nodeByPath(path: $path) {
        ...CoreNodeFields
      }
    }
  }
`;

/**
 * Query to get current user information
 */
export const GET_CURRENT_USER = `
  query GetCurrentUser {
    currentUser {
      name
      node {
        uuid
        path
      }
    }
  }
`;

/**
 * Query to check if destination path exists (for autosplit folders)
 */
export const CHECK_PATH_EXISTS = `
  ${FRAGMENTS}
  
  query CheckPathExists($path: String!) {
    jcr(workspace: EDIT) {
      nodeByPath(path: $path) {
        ...CoreNodeFields
      }
    }
  }
`;

/**
 * Query to get site key from a node path
 */
export const GET_SITE_INFO = `
  ${FRAGMENTS}
  
  query GetSiteInfo($path: String!) {
    jcr(workspace: EDIT) {
      nodeByPath(path: $path) {
        ...CoreNodeFields
        site {
          name
          path
        }
      }
    }
  }
`;
