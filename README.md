# Archive Content - Jahia UI Extension

A production-ready Jahia UI Extension that enables archiving and restoring of pages, content and content folders from jContent's menus, plus an Archive Manager for browsing archived content.

## Overview

This extension provides a safe, controlled way to archive and restore unpublished content in Jahia DX 8.2+. Archived content is moved to a date-organized archive folder structure and marked with metadata preserving the original location for restoration.

## Features

- **Archive from every jContent menu**: the row's menu, the right-click menu, the left tree, and the bar shown on a multiple selection (`contentItemActions`, `contentItemContextActions`, `accordionContentActions`, `selectedContentActions`)
- **Content folders and multiple selections**: archive a whole content folder with everything it holds, or several items at once; items that cannot be archived are listed with the reason and the others can still go
- **Restore Capability**: Restore archived content to its original location, or to another one picked in the dialog
- **Archive Manager**: Dedicated accordion in jContent for browsing and managing archived content, including the content of an archived folder
- **Preview before restoring**: jContent's side panel (Preview, Details, History, Usages) works on archived content, and *Preview* is in the Archive Manager's context menu
- **Archive-Specific Columns**: Type, Created, Original Location, Archived Date and Archived By columns in the Archive Manager table (jContent 3.7 `tableConfig.columns`), dates in the jContent UI language
- **Date-Organized Structure**: Automatic organization by year/month (YYYY/MM)
- **Publication Safety**: Prevents archiving of published content with clear warning dialogs
- **Metadata Preservation**: Stores original path, parent ID, archive timestamp, and archiving user
- **GraphQL-Based**: All repository operations use Jahia GraphQL mutations (no REST/JCR API)
- **Moonstone UX**: dialogs are Moonstone `Modal`s rendered through jContent's component renderer, and messages use jContent's own notifications
- **Multi-language**: English and French localization included; every message, notification and dialog comes from the locale files
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
   - Check publication status in **every language of the site**, for the node **and everything under it** → the item is listed as not archivable, with the languages it is published in, if anything in it is live

   The subtree is checked node by node. jContent's aggregated status answers *what remains to
   publish*, so a folder holding one published and one draft item reads "not published"; archiving
   it would take the published item out from under the live workspace.
   - Preview destination path in confirmation dialog

   If the publication status cannot be read - the site languages are unavailable, or a
   language check fails - validation **blocks** the archive rather than assuming the
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
   - Show one notification for the run (how many items were archived, which could not be)
   - Remove the moved items from jContent's selection and refresh the view

A multiple selection runs the same operation **one item at a time**: each archive may create the
year and month folders, and two at once would race to create them.

### Archiving a content folder

The folder moves with everything it holds. Each **item** inside it gets its own archive marker and
lock, in the same request as the folder: every content folder inside it and every content directly
in a folder (an article's own sub-content goes and comes back with its article). In the Archive
Manager each item shows its original location, archive date and archiving user, and can be
**restored on its own**.

Restoring one item: its original folder is in the archive, so it goes back to the path it had. When
that folder no longer exists, the missing content folders are created again (the dialog lists
them); outside the site's content folders the editor picks a location. Restoring the whole folder
unlocks and unmarks everything inside it; if a folder of the same name was created again meanwhile,
the restored one takes a `-restored-<timestamp>` suffix.

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
non-admin roles - the module does not ship those ACLs.

## GraphQL Operations

### Key Queries

- `GET_NODE_INFO` - Fetch node details, its title in the content language and existing mixins (it does **not** carry publication status)
- `GET_SITE_LANGUAGES` - List the languages a publication check must cover
- `ArchivePublicationOfSubtree` (built in `ArchiveService.getPublishedLanguages`) - each node's own publication status, per site language, for the node and its descendants, in one request
- `CHECK_ARCHIVE_FOLDER` - Verify archive folder existence
- `GET_CURRENT_USER` - Get current user reference for metadata
- `GET_SITE_INFO` - Resolve site key from node path

### Key Mutations

- `CREATE_ARCHIVE_FOLDER` - Create archive root folder
- `CREATE_FOLDER` - Create intermediate date folders
- `buildSetArchiveMetadataMutation(n)` - Add the `jmix:archived` mixin and all of its properties to n nodes (an archived folder and its items) in one request
- `buildRemoveArchiveMetadataMutation(n)` - Remove the mixin and its properties from n nodes, to finish a restore or to undo a failed archive
- `CREATE_CONTENT_FOLDER` - Create again a content folder a restore puts content back into
- `MOVE_NODE` - Move node to archive destination
- `buildLockMutation(n, lock)` - Apply and lift the read-only lock on n nodes

## Error Handling

Messages come from the locale files (`error.*` keys) in the jContent UI language:

- **Permission denied**, **content not found**, **content locked**: a sentence of their own
- **Anything else**: the server's own message, which the editor may need to report
- Every error is also logged to the console

All errors are logged with `[ArchiveContent]` prefix for debugging.

## Usage

### Archiving Content

1. In jContent, right-click a page, a content item or a content folder (or open its row's menu, or the left tree's), or tick several items and use the selection bar
2. Click **Archive Content**
3. The dialog checks each item and shows:
   - What will be archived, and where (`Archives/<YYYY>/<MM>`)
   - What cannot be archived, with the reason: published (and in which languages), already archived, not found
4. Click **Archive** (or **Archive the other N items** when some are blocked), or **Cancel**
5. One notification reports the outcome

### Restoring Archived Content

1. Navigate to archived content in the Archive Manager or locate it in Content Editor
2. Open the **Content Actions** menu
3. Click **Restore**
4. Review the dialog: name, current location, archive date, original location
5. Keep the original location, or **Choose a different location** in the content picker (required when the original one is gone)
6. Click **Restore**; a notification gives the new location

If another page now uses one of the vanity URLs of the content (or of anything restored with it),
the dialog lists each one with the page that holds it, and the button becomes **Remove … and
restore**: those vanity URLs are removed from the restored content, the other pages keep them, and
the URLs still free come back unchanged. The check runs again at restore time.

### Using Archive Manager

1. Open jContent
2. Navigate to the **Archive Manager** accordion in the left sidebar
3. Browse archived content organized by year/month
4. Each archived item is listed with archive-specific columns:
   - **Name** - the archived node's title
   - **Type** - the primary node type (e.g. Page, News, Image)
   - **Created** - the day the content was first created (kept by the move); the tooltip gives the time
   - **Original Location** - the JCR path the item lived at before archiving (whole in the tooltip when cut)
   - **Archived Date** - the day of the archive operation; the tooltip gives the time
   - **Archived By** - user who archived (resolved to a display name; UUID kept as a tooltip)
5. Click any column header to sort by that field
6. Click an archived item to open jContent's side panel (**Preview**, Details, History, Usages): read it before deciding to restore it
7. Right-click it for **Preview**, **Edit**, **Export** and **Restore**
8. Open an archived content folder in the tree to browse what it holds

### Published Content Warning

If an item, or anything inside a folder, is published in any language:
- The dialog lists it as not archivable, with the languages (for example "published in FR, EN")
- The other items of the selection can still be archived
- Unpublish it in every language listed, then archive it

### Already Archived

The Archive action is not offered on archived content, on the archive tree, on a site's home page
or on its `contents` root. If an item is archived meanwhile, the dialog lists it as already archived.

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

The Archive Manager's root and the paths the Archive action is hidden on are derived from it.

### Required Permissions

The module defines three custom permissions:

#### archiveContent
- **Purpose**: Allows archiving of unpublished content
- **Required for**: the Archive action, and the Archive Manager
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

- Node.js 20 (the Maven build pins v20.18.0 via `frontend-maven-plugin`)
- Yarn 1.22 - the project is pinned with `packageManager` in `package.json`. A
  corepack-managed yarn honours that pin; do not add a `.yarnrc.yml`, which would make
  yarn treat this Berry-style and refuse the v1 lockfile.
- Maven 3.6+
- Jahia DX 8.2+ (jContent 3.7+ required for Archive Manager custom columns)

### Compatibility Note

`@jahia/data-helper` is pinned to `~1.0.12` (the legacy `apollo-client@2.x` line) so that the module federation shared scope stays compatible with the app-shell shipped in Jahia 8.2.3.x (`@apollo/client@3.5.10`). When targeting a Jahia whose app-shell provides `@apollo/client@3.7+`, this pin can be lifted.

### Build

```bash
# Install dependencies
yarn install --frozen-lockfile

# Lint and build frontend assets
yarn build

# Build the module (runs the frontend build too)
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

1. **Restore one at a time**: archive takes a multiple selection, restore takes one item (each goes back to its own location)
2. **Two folders after a partial restore**: restoring an item first recreates its folder, so the archived folder restored later comes back next to it, with a `-restored-` suffix, rather than merged into it
3. **Manual Unpublish**: Published content must be manually unpublished
4. **Permission Configuration**: archived content is locked, which is what makes it
   read-only. Denying write on `jmix:archived` via role ACLs is an optional extra layer
   the module does not ship.

## Roadmap

- [x] Unarchive action (restore to original location) - **Completed**
- [x] Archive search/browser UI - **Completed** (Archive Manager accordion)
- [x] Bulk archive (multi-selection, content folders) - **Completed**
- [ ] Scheduled auto-archive based on content age
- [ ] Archive analytics and reporting

## Contributing

### Continuous integration

Every pull request runs `.github/workflows/on-code-change.yml`: static analysis (lint and
dependency audit), the Maven build, and SonarQube analysis. The Quality Gate must pass.

`schedule-sonar.yml` analyses `main` on a schedule and on demand. That run is what gives
SonarQube a baseline; without it, a pull request's "new code" is the whole repository and
its gate reports the entire codebase's debt against whoever opened it.

### Changelog

Do not edit `CHANGELOG.md` by hand. This repository uses **chachalog**: a user-facing
change carries a fragment in `.chachalog/`, named randomly to avoid collisions between
pull requests.

```markdown
---
archive: patch
---

Fixed <the user-visible outcome, one sentence>.
```

The bump is `patch`, `minor` or `major`. Write the outcome a content editor would notice,
not the implementation - no class, method or service names. A purely internal change
(refactor, test, CI, docs) needs no fragment. The `Chachalog - Prepare Changelog` workflow
aggregates the fragments and updates `CHANGELOG.md` on release.

## Support

For issues, questions, or contributions:
- Check Jahia documentation: https://academy.jahia.com/
- Review GraphQL API: https://academy.jahia.com/documentation/developer/dx/8/extending-jahia-dx/using-graphql-api
- Console logs: Look for `[ArchiveContent]` prefix

## License

This module is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Credits

Built following Jahia UI Extension best practices and Moonstone design system.
