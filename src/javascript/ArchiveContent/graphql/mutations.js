/**
 * GraphQL mutations for archive content extension
 */

/**
 * Mutation to create the archive folder
 */
export const CREATE_ARCHIVE_FOLDER = `
  mutation CreateArchiveFolder($parentPath: String!, $name: String!, $primaryNodeType: String!) {
    jcr(workspace: EDIT) {
      addNode(
        name: $name
        parentPathOrId: $parentPath
        primaryNodeType: $primaryNodeType
      ) {
        uuid
        node {
          path
          name
        }
      }
    }
  }
`;

/**
 * Mutation to create intermediate folders (year/month) for autosplit structure
 */
export const CREATE_FOLDER = `
  mutation CreateFolder($parentPath: String!, $name: String!) {
    jcr(workspace: EDIT) {
      addNode(
        name: $name
        parentPathOrId: $parentPath
        primaryNodeType: "jnt:archiveContentFolder"
      ) {
        uuid
        node {
          path
          name
        }
      }
    }
  }
`;

/**
 * Mutation to create a content folder, when a restore puts content back in a folder that is gone.
 */
export const CREATE_CONTENT_FOLDER = `
  mutation CreateContentFolder($parentPath: String!, $name: String!) {
    jcr(workspace: EDIT) {
      addNode(name: $name, parentPathOrId: $parentPath, primaryNodeType: "jnt:contentFolder") {
        node {
          path
        }
      }
    }
  }
`;

/**
 * Mutation to move a node to a new location
 */
export const MOVE_NODE = `
  mutation MoveNode($pathOrId: String!, $destParentPathOrId: String!, $destName: String) {
    jcr(workspace: EDIT) {
      moveNode(
        pathOrId: $pathOrId
        destParentPathOrId: $destParentPathOrId
        destName: $destName
      ) {
        node {
          uuid
          path
          name
          primaryNodeType {
            name
          }
        }
      }
    }
  }
`;

// The mutations below act on a set of nodes in ONE request: each node is a `mutateNode` alias
// (`n0`, `n1`...), addressed by uuid so that a move between two requests does not change the target.
// One request is one JCR save, so the set either carries the change or none of it.

const aliases = (count, body) => Array.from({length: count}, (_, i) => `n${i}: mutateNode(pathOrId: $id${i}) { ${body(i)} }`).join('\n');
const idVariables = count => Array.from({length: count}, (_, i) => `$id${i}: String!`);

/**
 * Applies the whole archive marker - the jmix:archived mixin and every property it declares
 * mandatory - to a set of nodes: the archived node and, for a content folder, every item inside it.
 *
 * The mixin and its properties MUST stay in one request. Split across two they are two JCR saves,
 * and a failure in between leaves a node carrying the mixin with none of its mandatory properties: a
 * state neither the Archive action (hidden on jmix:archived) nor the Restore action (needs
 * originalParentId) can undo.
 *
 * Variables: `$archived`, `$archivedAt`, `$archivedBy` shared, then `$id<i>`, `$originalPath<i>`,
 * `$originalParentId<i>` per node.
 *
 * @param {number} count - Number of nodes
 * @returns {string} The mutation
 */
export const buildSetArchiveMetadataMutation = count => `
  mutation SetArchiveMetadata(${[
        '$archived: String!',
        '$archivedAt: String!',
        '$archivedBy: String!',
        ...Array.from({length: count}, (_, i) => `$id${i}: String!, $originalPath${i}: String!, $originalParentId${i}: String!`)
    ].join(', ')}) {
    jcr(workspace: EDIT) {
      ${aliases(count, i => `addMixins(mixins: ["jmix:archived"])
        archived: mutateProperty(name: "archived") { setValue(value: $archived, type: BOOLEAN) }
        archivedAt: mutateProperty(name: "archivedAt") { setValue(value: $archivedAt, type: DATE) }
        archivedBy: mutateProperty(name: "archivedBy") { setValue(value: $archivedBy, type: WEAKREFERENCE) }
        originalPath: mutateProperty(name: "originalPath") { setValue(value: $originalPath${i}, type: STRING) }
        originalParentId: mutateProperty(name: "originalParentId") { setValue(value: $originalParentId${i}, type: STRING) }`)}
    }
  }
`;

/**
 * Removes the archive marker from a set of nodes: the mixin goes with its properties. Used to finish
 * a restore, and to undo an archive that failed after the marker was applied.
 *
 * @param {number} count - Number of nodes (variables `$id<i>`)
 * @returns {string} The mutation
 */
export const buildRemoveArchiveMetadataMutation = count => `
  mutation RemoveArchiveMetadata(${idVariables(count).join(', ')}) {
    jcr(workspace: EDIT) {
      ${aliases(count, () => 'removeMixins(mixins: ["jmix:archived"])')}
    }
  }
`;

/**
 * Locks or unlocks a set of nodes (variables `$id<i>`).
 *
 * @param {number} count - Number of nodes
 * @param {boolean} lock - true to lock, false to unlock
 * @returns {string} The mutation
 */
export const buildLockMutation = (count, lock) => `
  mutation ${lock ? 'LockNodes' : 'UnlockNodes'}(${idVariables(count).join(', ')}) {
    jcr(workspace: EDIT) {
      ${aliases(count, () => (lock ? 'lock' : 'unlock'))}
    }
  }
`;
