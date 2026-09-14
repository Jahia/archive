# Archive Content - Jahia UI Extension

A production-ready Jahia UI Extension that enables archiving and restoring of JCR content from the jContent editor's Content Actions menu, plus an Archive Manager for browsing archived content.

## Overview

This extension provides a safe, controlled way to archive and restore unpublished content in Jahia DX 8.2+. Archived content is moved to a date-organized archive folder structure and marked with metadata preserving the original location for restoration.

## Features

- **Content Actions Integration**: Archive action accessible from the Content Actions menu (target: `contentActions:999`)
- **Restore Capability**: Restore archived content to its original location via Content Actions menu
- **Archive Manager**: Dedicated accordion in jContent for browsing and managing archived content
- **Archive-Specific Columns**: Type, Original Path, Archived Date, and Archived By columns in the Archive Manager table (jContent 3.7 `tableConfig.columns`)
- **Date-Organized Structure**: Automatic organization by year/month (YYYY/MM)
- **Publication Safety**: Prevents archiving of published content with clear warning dialogs
- **Metadata Preservation**: Stores original path, parent ID, archive timestamp, and archiving user
- **GraphQL-Based**: All repository operations use Jahia GraphQL mutations (no REST/JCR API)
- **Moonstone UX**: Professional dialogs, toasts, loading states, and error handling
- **Multi-language**: English and French localization included
- **Permission-Aware**: Custom permissions for archive, unarchive, and management operations

## Architecture

### Folder Structure

```
src/javascript/
├── ArchiveContent/
│   ├── components/
│   │   ├── ArchiveContentAction.jsx    # Archive action component
│   │   └── RestoreArchiveAction.jsx    # Restore action component
│   ├── services/
│   │   └── ArchiveService.js           # Core business logic
│   ├── graphql/
│   │   ├── queries.js                  # GraphQL queries
│   │   └── mutations.js                # GraphQL mutations
│   ├── utils/
│   │   └── archiveUtils.js             # Helper functions
│   └── index.js                        # Entry point
└── ArchiveManager/
    ├── ArchiveManager.jsx                        # Archive Manager accordion
    ├── ArchiveContentLayout.jsx                  # Custom content layout
    ├── ArchivedNodesQueryHandler.js              # Query handler for archived nodes
    ├── ArchivedNodesQueryHandler.gql-queries.js  # GraphQL query for archived nodes
    └── registerArchiveManager.jsx                # Accordion + custom column registration

src/main/resources/
├── META-INF/
│   └── definitions.cnd              # JCR node type definitions
└── javascript/locales/
    ├── en.json                      # English translations
    └── fr.json                      # French translations
```

## Archive Folder Structure

```
/<siteKey>/
  └── Archives/                      (jnt:archiveContentFolder)
      └── <YYYY>/                    (jnt:contentFolder)
          └── <MM>/                  (jnt:contentFolder)
              └── [archived-content-nodes]
```

### Example

```
/mysite/
  └── Archives/
          └── 2026/
              └── 02/
                  ├── old-news-article
                  ├── deprecated-page
                  └── obsolete-content-archived-1738704523000
```

## JCR Node Types

### jnt:archiveContentFolder

Primary node type for the archive root folder.

**Mixins:**
- `jmix:droppableContent` - Allows content to be moved into it
- `jmix:nolive` - Never published to live workspace
- `jmix:visibleInContentTree` - Visible in content tree navigation

### jmix:archived

Mixin applied to archived content nodes.

**Properties:**
- `archived` (boolean, mandatory, default: true) - Archive flag
- `archivedAt` (date, mandatory, autocreated) - Archive timestamp
- `archivedBy` (weakreference, mandatory) - Reference to user who archived
- `originalPath` (string, mandatory, indexed) - Full path before archiving
- `originalParentId` (string, mandatory) - Parent UUID before move

## Archive Flow

1. **Validation Phase**
   - Fetch node information via GraphQL
   - Check if already archived → show "Already Archived" dialog
   - Check publication status in **every language of the site** → show "Cannot Archive" warning if the content is published in any of them
   - Preview destination path in confirmation dialog

   If the publication status cannot be read — the site languages are unavailable, or a
   language check fails — validation **blocks** the archive rather than assuming the
   content is unpublished.

2. **Preparation Phase** (if validation passes)
   - Resolve site key from node path
   - Check if archive folder exists at `/sites/<siteKey>/Archives`
   - Create archive folder if missing (transparent, first-run only)
   - Ensure date folders (YYYY/MM) exist, create if needed

3. **Archive Operation**
   - Re-check the publication status, because this step is reachable without the dialog
   - Apply the `jmix:archived` mixin **and** its properties (archived, archivedAt, archivedBy, originalPath, originalParentId) in a **single request**, so the node either carries the complete marker or none of it
   - Move node to `/sites/<siteKey>/Archives/<YYYY>/<MM>/`
   - Handle name collisions by appending `-archived-<timestamp>` suffix
   - Lock the node so it is no longer editable in place

4. **Completion**
   - Show success notification with archive path
   - Optionally refresh content view

### Partial outcomes

Each step after the marker is its own request, so the flow reports what actually happened
rather than assuming it all landed:

- **Move fails** → the archive marker is removed again, and the operation reports the failure.
  The content stays exactly where it was.
- **Lock fails** → the content *is* archived, and a warning says it stayed editable.
- **Restore fails after unlocking** → the content is re-locked in the archive.
- **Restore leaves the marker** → the content is back in place with a warning that it still
  shows as archived; running Restore again clears it.

## Read-Only Enforcement

Archived content becomes read-only through:

1. **JCR Lock**
   - Archiving locks the node, which is what actually stops it being edited in place
   - Restoring unlocks it again; a restore that fails after unlocking re-locks it
   - A lock that cannot be applied is reported as a warning, never silently skipped

2. **Archive Folder Configuration**
   - `jmix:nolive` prevents publication
   - Typical content editors don't have direct access to archive folder

3. **Mixin Marker**
   - `jmix:archived` can be used in Jahia permissions/rules to deny write
   - Administrators retain full access if needed

**Note:** the lock is the enforcement; the mixin is a marker for your own permission rules.
For defence in depth, configure role-based ACLs denying write on `jmix:archived` content for
non-admin roles — the module does not ship those ACLs.

## GraphQL Operations

### Key Queries

- `GET_NODE_INFO` - Fetch node details and existing mixins (it does **not** carry publication status; use `GET_PUBLICATION_STATUS`)
- `GET_SITE_LANGUAGES` - List the languages a publication check must cover
- `GET_PUBLICATION_STATUS` - Publication status of a node, per language
- `CHECK_ARCHIVE_FOLDER` - Verify archive folder existence
- `GET_CURRENT_USER` - Get current user reference for metadata
- `GET_SITE_INFO` - Resolve site key from node path

### Key Mutations

- `CREATE_ARCHIVE_FOLDER` - Create archive root folder
- `CREATE_FOLDER` - Create intermediate date folders
- `SET_ARCHIVE_METADATA` - Add the `jmix:archived` mixin and all of its properties in one request
- `REMOVE_ARCHIVE_METADATA` - Remove the mixin and its properties, to finish a restore or to undo a failed archive
- `MOVE_NODE` - Move node to archive destination
- `LOCK_NODE` / `UNLOCK_NODE` - Apply and lift the read-only lock

## Error Handling

The extension provides user-friendly error messages for common scenarios:

- **Permission Denied**: "You do not have permission to perform this action."
- **Content Not Found**: "The content could not be found."
- **Content Locked**: "The content is locked and cannot be archived."
- **Generic Errors**: Technical details logged to console, friendly message shown to user

All errors are logged with `[ArchiveContent]` prefix for debugging.

## Usage

### Archiving Content

1. Select a content node in the Content Editor
2. Open the **Content Actions** menu (three-dot menu or right-click)
3. Click **Archive**
4. Review the confirmation dialog showing:
   - Content name and current path
   - Archive destination preview (YYYY/MM)
5. Click **Archive** to confirm or **Cancel** to abort
6. Success notification appears with archive destination path

### Restoring Archived Content

1. Navigate to archived content in the Archive Manager or locate it in Content Editor
2. Open the **Content Actions** menu
3. Click **Restore**
4. Review the confirmation dialog showing:
   - Content name and current archive location
   - Original location where it will be restored
5. Click **Restore** to confirm or **Cancel** to abort
6. Success notification appears and content is restored to its original location

### Using Archive Manager

1. Open jContent
2. Navigate to the **Archive Manager** accordion in the left sidebar
3. Browse archived content organized by year/month
4. Each archived item is listed with archive-specific columns:
   - **Name** — the archived node's title
   - **Type** — the primary node type (e.g. Page, News, Image)
   - **Original Location** — the JCR path the item lived at before archiving
   - **Archived Date** — timestamp of the archive operation
   - **Archived By** — user who archived (resolved to a display name; UUID kept as a tooltip)
5. Click any column header to sort by that field
6. Select any archived content to:
   - View its properties and metadata
   - Restore it to its original location
   - Preview its content

### Published Content Warning

If content is published:
- A warning dialog blocks the operation
- Message: "This content is currently published and cannot be archived. Please unpublish this content manually before archiving."
- User must unpublish manually, then retry archive

### Already Archived

If content is already archived:
- Information dialog shows: "This content has already been archived."
- No duplicate archive operation performed

## Installation

1. Build the module:
   ```bash
   mvn clean install
   ```

2. Deploy to Jahia:
   - Copy the JAR to `digital-factory-data/modules/`
   - Or deploy via Jahia Module Manager

3. On module load:
   - Custom permissions are automatically registered ([permissions.xml](src/main/import/permissions.xml))
   - Pre-configured roles are imported ([roles.xml](src/main/import/roles.xml))
   - UI extension auto-registers

## Configuration

### Archive Folder Name

Default: `Archives`, giving an archive root of `/sites/<siteKey>/Archives`.

To customize, edit `ARCHIVE_FOLDER_NAME` in [archiveUtils.js](src/javascript/ArchiveContent/utils/archiveUtils.js#L8):

```javascript
export const ARCHIVE_FOLDER_NAME = 'Archives'; // Change to your preference
```

The name is also spelled out in two other places that must be changed with it: the Archive
Manager's `rootPath` in [registerArchiveManager.jsx](src/javascript/ArchiveManager/registerArchiveManager.jsx),
and the `hideForPaths` rule in [ArchiveContentAction.jsx](src/javascript/ArchiveContent/components/ArchiveContentAction.jsx).

### Required Permissions

The module defines three custom permissions:

#### archiveContent
- **Purpose**: Allows archiving of unpublished content
- **Required for**: Using the Archive action from Content Actions menu
- **Default roles**: editor, editor-in-chief, site-administrator

#### unarchiveContent
- **Purpose**: Allows restoration of archived content
- **Required for**: the Restore action on archived content
- **Default roles**: editor-in-chief, site-administrator

#### manageArchive
- **Purpose**: Allows managing archive folder and settings
- **Required for**: Administrative archive operations
- **Default roles**: site-administrator

**Additional JCR permissions needed:**
- `jcr:write` permission on the content node
- `jcr:addChildNodes` on `/sites/<siteKey>/` (for first-run folder creation)

### Roles

The module provides pre-configured roles in [roles.xml](src/main/import/roles.xml):

- **editor**: `archiveContent`
- **editor-in-chief**: `archiveContent`, `unarchiveContent`
- **site-administrator**: `archiveContent`, `unarchiveContent`, `manageArchive`

These roles can be assigned to users through Jahia's administration interface or customized as needed.

### Debug Logging

Enable debug logs in development:

```javascript
// In archiveUtils.js, debugLog only outputs in development mode
if (process.env.NODE_ENV === 'development') {
    console.debug(`[ArchiveContent] ${message}`, data || '');
}
```

Production builds automatically suppress debug logs.

## Development

### Prerequisites

- Node.js 14+
- Maven 3.6+
- Jahia DX 8.2+ (jContent 3.7+ required for Archive Manager custom columns)

### Compatibility Note

`@jahia/data-helper` is pinned to `~1.0.12` (the legacy `apollo-client@2.x` line) so that the module federation shared scope stays compatible with the app-shell shipped in Jahia 8.2.3.x (`@apollo/client@3.5.10`). When targeting a Jahia whose app-shell provides `@apollo/client@3.7+`, this pin can be lifted.

### Build

```bash
# Install dependencies
npm install

# Build frontend assets
npm run webpack

# Build Java module
mvn clean install
```

### Testing

Run the module in a Jahia development environment:

```bash
mvn jahia:deploy
```

Test scenarios:
- ✅ Archive unpublished content → Success
- ✅ Archive published content → Warning dialog
- ✅ Archive already archived content → Info dialog
- ✅ First archive in site → Auto-creates folder
- ✅ Name collision → Appends suffix
- ✅ Permission denied → Error message
- ✅ Date structure → Organizes by YYYY/MM

## Troubleshooting

### Archive folder not created
- Check user has `jcr:addChildNodes` permission on `/<siteKey>/`
- Verify `jnt:archiveContentFolder` node type is registered
- Check console for GraphQL errors

### Cannot archive (permission denied)
- Ensure user has the `archiveContent` permission (check their assigned roles)
- Verify user has `jcr:write` on the content node
- Check if node is locked by another user
- Verify user has access to the content's site

### Archived content still editable
- Review Jahia ACL configuration
- Add permission rules based on `jmix:archived` mixin
- Configure role-based write denial for archived content

### Date folders not created
- Ensure GraphQL mutations have proper permissions
- Verify folder creation logic in `ArchiveService.ensureDateFoldersExist()`

## Extension Points

### Custom Archive Logic

Extend `ArchiveService` to customize behavior:

```javascript
import ArchiveService from './services/ArchiveService';

// Override destination path logic
ArchiveService.getCustomDestination = (nodeInfo) => {
    // Custom logic here
    return customPath;
};
```

### Additional Metadata

Add more properties in [mutations.js](src/javascript/ArchiveContent/graphql/mutations.js):

```graphql
setCustomProperty: setProperty(
    name: "customField", 
    value: $customValue, 
    type: STRING
) { path }
```

## Known Limitations

1. **Single Selection**: Currently supports single node selection (not bulk archive)
2. **Manual Unpublish**: Published content must be manually unpublished
3. **Permission Configuration**: Read-only enforcement requires ACL setup

## Roadmap

- [x] Unarchive action (restore to original location) - **Completed**
- [x] Archive search/browser UI - **Completed** (Archive Manager accordion)
- [ ] Bulk archive (multi-selection support)
- [ ] Scheduled auto-archive based on content age
- [ ] Archive analytics and reporting

## Support

For issues, questions, or contributions:
- Check Jahia documentation: https://academy.jahia.com/
- Review GraphQL API: https://academy.jahia.com/documentation/developer/dx/8/extending-jahia-dx/using-graphql-api
- Console logs: Look for `[ArchiveContent]` prefix

## License

This module is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Credits

Built following Jahia UI Extension best practices and Moonstone design system.
