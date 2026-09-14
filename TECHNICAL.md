# Archive Content Extension - Technical Documentation

## System Requirements

- **Jahia DX**: 8.2.0.0 or higher
- **Java**: 11+
- **Node.js**: 14+ (for development)
- **Maven**: 3.6+ (for building)

## Installation

### 1. Build from Source

```bash
# Clone or navigate to the module directory
cd /path/to/archive

# Install Node dependencies
npm install

# Build frontend assets
npm run webpack

# Build the complete module
mvn clean install

# Output: target/archive-1.0-SNAPSHOT.jar
```

### 2. Deploy to Jahia

**Option A: Manual Deployment**
```bash
# Copy JAR to Jahia modules directory
cp target/archive-*.jar $JAHIA_HOME/digital-factory-data/modules/
```

**Option B: Maven Deploy**
```bash
mvn jahia:deploy
```

**Option C: Jahia Module Manager**
1. Access Jahia Administration → Server Settings → Modules
2. Click "Upload Module"
3. Select the JAR file
4. Click "Install"

### 3. Verify Installation

1. Log into Jahia as administrator
2. Navigate to Content Editor
3. Select any unpublished content
4. Open Content Actions menu (⋮)
5. Confirm "Archive" action appears

## Configuration

### Permission Configuration

The module defines three permissions in [permissions.xml](src/main/import/permissions.xml):

1. **archiveContent**: Archive unpublished content
2. **unarchiveContent**: Restore archived content (future feature)
3. **manageArchive**: Manage archive settings

#### Assign to Roles

Default role mappings in [roles.xml](src/main/import/roles.xml):

- **editor-in-chief**: archiveContent, unarchiveContent
- **editor**: archiveContent
- **site-administrator**: all archive permissions

#### Custom Role Assignment

Add archive permissions to custom roles:

```xml
<your-custom-role jcr:primaryType="jnt:role"
                   j:permissionNames="archiveContent"
/>
```

### Archive Folder Configuration

**Default Location**: `/<siteKey>/contents/archive`

**To Change**:

Edit [archiveUtils.js](src/javascript/ArchiveContent/utils/archiveUtils.js):

```javascript
export const ARCHIVE_FOLDER_NAME = 'your-custom-name';
```

**Important**: Change before first use. Existing archives won't migrate automatically.

### Read-Only Enforcement

Archiving locks the node, and that lock is what stops it being edited in place. The
`jmix:archived` mixin is a marker you can additionally build ACLs on:

**Example ACL Rule** (apply to `jnt:archiveContentFolder`):

```xml
<archive jcr:primaryType="jnt:archiveContentFolder">
    <j:acl jcr:primaryType="jnt:acl">
        <GRANT_r_editor jcr:primaryType="jnt:ace"
                        j:principal="g:editors"
                        j:privileges="jcr:read"
                        j:roleGroup="true"
        />
        <DENY_jcr_write_editor jcr:primaryType="jnt:ace"
                               j:principal="g:editors"
                               j:privileges="jcr:write jcr:modifyProperties jcr:removeNode"
                               j:roleGroup="true"
        />
    </j:acl>
</archive>
```

This grants read but denies write/modify/delete to editors. Administrators retain full access.

## GraphQL API Reference

### Queries

#### GET_NODE_INFO
Fetches node information. It does **not** carry publication status — that is per-language
and comes from `GET_PUBLICATION_STATUS`.

**Variables:**
- `path` (String!): JCR path of the node

**Returns:**
- uuid, path, name, displayName
- primaryNodeType, mixinTypes
- parent reference
- archived flag

#### GET_SITE_LANGUAGES
Lists the languages of the site owning a node — the set a publication check must cover.

**Variables:**
- `path` (String!): JCR path of the node

**Returns:**
- the site's `j:languages` values

#### GET_PUBLICATION_STATUS
Publication status of a node in one language. Called once per site language; a failure in
any of them blocks the archive rather than being treated as "not published".

**Variables:**
- `path` (String!): JCR path of the node
- `language` (String!): language code (mandatory)

**Returns:**
- `aggregatedPublicationInfo.publicationStatus`

#### CHECK_ARCHIVE_FOLDER
Checks if the archive folder exists.

**Variables:**
- `path` (String!): Archive folder path

**Returns:**
- uuid, path if exists; null otherwise

#### GET_CURRENT_USER
Gets current user information for metadata.

**Returns:**
- name, path, node.uuid

### Mutations

#### CREATE_ARCHIVE_FOLDER
Creates the archive root folder.

**Variables:**
- `parentPath` (String!): Parent path (e.g., `/mysite/contents`)
- `name` (String!): Folder name (e.g., `archive`)
- `primaryNodeType` (String!): `jnt:archiveContentFolder`

**Returns:**
- uuid, path of created folder

#### SET_ARCHIVE_METADATA
Adds the `jmix:archived` mixin **and** every property it declares mandatory, in one request.

These must stay in a single mutation. Split across two requests they are two JCR saves, and a
failure in between leaves the node carrying the mixin with none of its mandatory properties —
a state neither the Archive action (hidden on `jmix:archived`) nor the Restore action (needs
`originalParentId`) can undo.

**Variables:**
- `path` (String!): Node path
- `archived` (String!): `"true"`, written as BOOLEAN
- `archivedAt` (String!): ISO date string, written as DATE
- `archivedBy` (String!): User UUID, written as WEAKREFERENCE
- `originalPath` (String!): Original JCR path
- `originalParentId` (String!): Parent UUID

#### REMOVE_ARCHIVE_METADATA
Removes the mixin and its properties together. Used to finish a restore, and to undo an
archive that failed after the marker was applied.

**Variables:**
- `pathOrId` (String!): Node path or UUID

#### MOVE_NODE
Moves node to archive destination.

**Variables:**
- `pathOrId` (String!): Node UUID or path
- `destParentPath` (String!): Destination parent path
- `newName` (String): Optional new name (for collision handling)

**Returns:**
- uuid, path, name of moved node

## Database Schema

### Node Types

#### jnt:archiveContentFolder

```cnd
[jnt:archiveContentFolder] > jnt:contentFolder, 
                              jmix:droppableContent, 
                              jmix:nolive, 
                              jmix:visibleInContentTree
```

**Purpose**: Root archive folder.

**Mixins**:
- `jmix:droppableContent`: Accept dropped content
- `jmix:nolive`: Never published
- `jmix:visibleInContentTree`: Visible in navigation

#### jmix:archived

```cnd
[jmix:archived] mixin
 - archived (boolean) = true mandatory autocreated indexed=no
 - archivedAt (date) mandatory autocreated indexed=no
 - archivedBy (weakreference) mandatory < 'jnt:user' indexed=no
 - originalPath (string) mandatory indexed=yes
 - originalParentId (string) mandatory indexed=no
```

**Purpose**: Mark content as archived with metadata.

**Properties**:
- `archived`: Always true, indicates archived status
- `archivedAt`: Archive timestamp (ISO 8601)
- `archivedBy`: Weak reference to `jnt:user`
- `originalPath`: Full JCR path before move (indexed for search)
- `originalParentId`: Parent UUID for restoration

### Indexing

Only `originalPath` is indexed to enable search queries like:

```graphql
query FindArchivedByOriginalPath($originalPath: String!) {
  jcr {
    nodesByQuery(
      query: "SELECT * FROM [jmix:archived] WHERE [originalPath] = $originalPath"
    ) {
      nodes {
        uuid
        path
        archivedAt: property(name: "archivedAt") { value }
      }
    }
  }
}
```

## Operation Modes

### Production Mode

- Debug logging disabled
- Minified JavaScript bundles
- Error details logged to console only (not shown to users)

**Build:**
```bash
NODE_ENV=production npm run webpack
mvn clean install -Pproduction
```

### Development Mode

- Debug logging enabled (`debugLog` outputs to console)
- Source maps included
- Detailed error messages

**Build:**
```bash
NODE_ENV=development npm run webpack
mvn clean install
```

## Monitoring & Logging

### Client-Side Logs

All extension logs use `[ArchiveContent]` prefix:

```javascript
console.debug('[ArchiveContent] Fetching node info for:', path);
console.error('[ArchiveContent] Archive operation failed:', error);
```

**Search logs:**
```javascript
// Browser console
// Filter by: /ArchiveContent/
```

### Server-Side Logs

GraphQL operations log to `jahia.log`:

```
INFO  [GraphQLServlet] - Executing query: GetNodeInfo
ERROR [GraphQLServlet] - GraphQL error: Permission denied
```

**Monitor:**
```bash
tail -f $JAHIA_HOME/tomcat/logs/jahia.log | grep -i archive
```

## Performance Considerations

### GraphQL Query Optimization

1. **Batch Reads**: Validation combines multiple checks in one query
2. **Minimal Fields**: Only fetch required node properties
3. **Caching**: Browser caches GraphQL schema

### Folder Creation

- Archive folder created once per site (first run only)
- Date folders created once per month
- Subsequent archives reuse existing folders (no redundant queries)

### Move Operations

- Uses node UUID for move (not path) - more efficient
- Name collision handling adds minimal overhead
- Mixin/property updates happen before move (single transaction)

## Troubleshooting

### Issue: "Permission denied" on archive

**Symptoms**: User clicks Archive, gets permission error

**Causes**:
1. User lacks `jcr:write` on node
2. User lacks `archiveContent` permission
3. Node is locked

**Resolution**:
```bash
# Check permissions
SELECT * FROM [jnt:user] WHERE [j:username] = 'username'

# Grant permission
# Via Jahia UI: Administration → Roles → [role] → Add "archiveContent"
```

### Issue: Archive folder not created

**Symptoms**: First archive fails with "Path not found"

**Causes**:
1. User lacks `jcr:addChildNodes` on `/<siteKey>/contents`
2. `jnt:archiveContentFolder` not registered

**Resolution**:
```bash
# Verify node type registration
SELECT * FROM [jnt:archiveContentFolder]

# Grant permission
# Via Jahia UI: Administration → Permissions → Site → [user/role] → Add "Add child nodes"
```

### Issue: Published content archived

**Symptoms**: Published content was archived (should be prevented)

**Causes**:
1. Race condition: published between validation and archive
2. Custom publication workflow not detected

**Resolution**:
- The publication check runs per site language, in both `validateArchive()` and
  `archiveNode()`; an unreadable status blocks rather than permits
- A race between validation and the archive itself is still possible — the second check
  narrows the window but does not close it
- Enforcement lives in the browser; a backend guard is the only way to close it fully

### Issue: Name collision creates infinite loop

**Symptoms**: Archive operation hangs or times out

**Causes**:
- `generateUniqueName()` not creating unique names
- Destination folder has many same-name nodes

**Resolution**:
```javascript
// Enhanced unique name generation
export const generateUniqueName = (originalName, attempt = 1) => {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000);
    return `${originalName}-archived-${timestamp}-${random}`;
};
```

### Issue: Archived content still editable

**Symptoms**: Users can edit archived content

**Causes**:
- ACLs not configured for `jnt:archiveContentFolder`
- User has admin role (admin overrides ACLs)

**Resolution**:
1. Apply ACL to archive folder (see "Read-Only Enforcement" section)
2. Verify user role doesn't grant `jcr:all` on archive path
3. Test with non-admin user

## Backup & Recovery

### Backup Archived Content

**Full Site Backup**:
```bash
# Jahia backup includes archive folder
$JAHIA_HOME/bin/backup.sh -full
```

**Archive Folder Only**:
```graphql
mutation ExportArchive($path: String!) {
  jcr {
    exportNode(pathOrId: $path, exportFormat: "XML") {
      output
    }
  }
}
# Variables: { "path": "/mysite/contents/archive" }
```

### Restore Archived Content

**Using the Restore Action**:

1. Select archived content in Archive Manager or Content Editor
2. Click "Restore" from Content Actions menu
3. Content is moved back to its original location with archived mixin removed

**Manual Restoration via GraphQL** (if needed):

1. Identify archived node:
```graphql
query FindArchived($uuid: String!) {
  jcr {
    nodeById(uuid: $uuid) {
      path
      originalPath: property(name: "originalPath") { value }
      originalParentId: property(name: "originalParentId") { value }
    }
  }
}
```

2. Move back to original location:
```graphql
mutation RestoreNode($uuid: String!, $originalParentPath: String!) {
  jcr {
    moveNode(pathOrId: $uuid, destParentPathOrId: $originalParentPath) {
      path
    }
  }
}
```

3. Remove archive mixin:
```graphql
mutation RemoveMixin($path: String!) {
  jcr {
    mutateNode(pathOrId: $path) {
      removeMixins(mixins: ["jmix:archived"])
    }
  }
}
```

## Security Best Practices

1. **Least Privilege**: Only grant `archiveContent` permission to trusted roles
2. **Audit Logging**: Enable Jahia audit logs to track archive operations
3. **Archive Access**: Restrict direct access to archive folder via ACLs
4. **Review Archived Content**: Periodically review archive for sensitive data
5. **Backup Archives**: Include archive folder in regular backups

## Upgrade Path

### From 1.0 to Future Versions

**Breaking Changes**: None planned

**Data Migration**: Archive folder and node types backward-compatible

**Steps**:
1. Build new version
2. Deploy via Module Manager
3. Restart Jahia (if required)
4. Existing archived content remains intact

## API for Custom Integrations

### Programmatic Archive

```javascript
import ArchiveService from '@jahia/archive-content/services/ArchiveService';

// Validate before archive
const validation = await ArchiveService.validateArchive('/path/to/node');

if (validation.canArchive) {
    // Perform archive
    const result = await ArchiveService.archiveNode('/path/to/node');
    console.log('Archived to:', result.archivePath);
} else {
    console.warn('Cannot archive:', validation.message);
}
```

### Custom Archive Destination

Override destination logic:

```javascript
import ArchiveService from '@jahia/archive-content/services/ArchiveService';

// Custom destination based on content type
const originalEnsure = ArchiveService.ensureDateFoldersExist;
ArchiveService.ensureDateFoldersExist = async function(archiveFolderPath, date) {
    // Add content-type subfolder
    const contentType = 'news'; // Derive from node
    const typePath = `${archiveFolderPath}/${contentType}`;
    
    // Ensure type folder exists
    // ... custom logic
    
    // Then call original date folder logic
    return originalEnsure.call(this, typePath, date);
};
```

## Support & Maintenance

### Log Analysis

**Monitor archive operations:**
```bash
# Client-side errors
grep -i "ArchiveContent.*error" browser-console.log

# Server-side GraphQL errors
grep -i "archiv" $JAHIA_HOME/tomcat/logs/jahia.log | tail -50
```

**Common patterns:**
- `Permission denied` → User lacks required permissions
- `Node not found` → Invalid path or deleted content
- `Name collision` → Duplicate name in destination

### Performance Metrics

**Monitor:**
- Archive operation latency (should be < 2 seconds)
- Archive folder size (cleanup old archives if needed)
- Failed archive attempts (permission or validation issues)

**Jahia Metrics** (if enabled):
```bash
# Archive operation count
jahia.archive.operations.count

# Archive failure rate
jahia.archive.failures.rate
```

## License & Credits

**License**: MIT License - See [LICENSE](LICENSE) file for details

**Dependencies**:
- Jahia DX 8.2+ (AGPLv3)
- React 17+ (MIT)
- Moonstone UI (Jahia proprietary)
- GraphQL (Facebook - MIT)

**Authors**: [Your team/organization]

**Maintainer**: [Contact email]

---

For feature requests or bug reports, consult your Jahia support channels.
