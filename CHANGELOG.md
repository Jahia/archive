# Changelog

All notable changes to the Archive Content extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.1.3

* Fixed archiving so published content is reliably detected and blocked, including content published in only one language. Archiving and restoring now recover cleanly when a step fails, instead of leaving content stuck as archived or editable inside the archive.

## \[1.0.0] - 2026-02-05

### Added

#### Core Features

* Archive content action in Content Actions menu (target: contentActions:999)
* Automatic archive folder creation on first use per site
* Date-based organization structure (YYYY/MM) using Jahia autosplit
* Publication status validation (blocks published content)
* Already-archived detection (prevents duplicate archives)
* Name collision handling with timestamp suffix
* Archive metadata preservation (originalPath, originalParentId, archivedAt, archivedBy)

#### UI Components

* Confirmation dialog with destination preview
* Published content warning dialog
* Already archived information dialog
* Success/error toast notifications
* Loading states for async operations
* Moonstone-compliant design system integration

#### GraphQL Integration

* GET\_NODE\_INFO query with publication status
* CHECK\_ARCHIVE\_FOLDER query
* GET\_CURRENT\_USER query
* GET\_SITE\_INFO query for site key resolution
* CREATE\_ARCHIVE\_FOLDER mutation
* CREATE\_FOLDER mutation for date folders
* ADD\_MIXIN mutation for jmix:archived
* SET\_PROPERTIES mutation for archive metadata
* MOVE\_NODE mutation with collision handling

#### Node Types & Mixins

* jnt:archiveContentFolder node type with autosplit
* jmix:archived mixin with full metadata
* Property constraints and indexing configuration

#### Localization

* English (en) translations
* French (fr) translations
* i18next integration

#### Documentation

* README.md - Project overview and features
* TECHNICAL.md - Deployment and operations guide
* USER\_GUIDE.md - End-user reference
* CHANGELOG.md - Version history

#### Utilities

* archiveUtils.js - Helper functions for date paths, validation
* ArchiveService.js - Core business logic service
* Error handling with user-friendly messages
* Debug logging for development mode

#### Permissions & Roles

* archiveContent permission
* unarchiveContent permission (for future use)
* manageArchive permission (for future use)
* Default role mappings (editor, editor-in-chief, site-administrator)

### Technical Details

#### Architecture

* React 16+ component-based UI
* GraphQL-only repository operations (no REST/JCR API)
* Service layer pattern for business logic
* Utility functions for date formatting and validation

#### Dependencies

* @jahia/moonstone ^2.5.3
* @jahia/ui-extender ^1.0.3
* @jahia/data-helper ^1.0.0
* react ^16.10.2
* i18next ^19.0.3

#### Build System

* Webpack 5 with module federation
* Babel transpilation for ES6+
* SASS/CSS modules support
* Source maps for development

#### Performance

* Minimal GraphQL roundtrips
* Folder caching (created once per month)
* Efficient UUID-based move operations
* Lazy loading of dialog components

### Security

* Permission-based access control
* Validation before operations
* Safe handling of published content
* Weak references for user tracking

### Compatibility

* **Jahia DX**: 8.2.0.0 or higher
* **Java**: 11+
* **Node.js**: 14+ (for development)
* **Browsers**: Modern browsers (Chrome, Firefox, Safari, Edge)

## \[Unreleased]

### Planned Features

#### Short-term (v1.1)

* Bulk archive support (multi-selection)
* Archive operation progress bar
* Archive success with "Open in archive" link
* Additional archive statistics

#### Mid-term (v1.2)

* Unarchive action to restore content
* Archive browser UI
* Search within archived content
* Archive analytics dashboard

#### Long-term (v2.0)

* Scheduled auto-archive based on content age
* Archive policies per content type
* Archive retention management
* Archive audit trail
* Export/import archived content

### Known Limitations

* Single-selection only (bulk archive not yet supported)
* Manual unpublish required for published content
* Read-only enforcement depends on ACL configuration

### Future Improvements

* \[ ] Add unit tests for utility functions
* \[ ] Add integration tests for GraphQL operations
* \[ ] Performance benchmarking for large archives
* \[ ] Advanced date organization options (quarterly, custom)
* \[ ] Archive compression/optimization
* \[ ] Archive search indexing
* \[ ] Webhook notifications on archive events

## Version History

### Release Notes

#### v1.0.0 (Current)

First production release with core archive functionality.

**Highlights:**

* Complete archive workflow from Content Actions
* Robust error handling and user feedback
* Production-ready code quality
* Comprehensive documentation

**Migration Notes:**

* Initial release, no migrations needed

**Breaking Changes:**

* None

***

## Contributing

For contributions, bug reports, or feature requests:

1. Follow Jahia development guidelines
2. Include tests for new features
3. Update documentation accordingly
4. Follow semantic versioning

## Support

* Documentation: See README.md and TECHNICAL.md
* Issues: Contact your Jahia support team
* Community: Jahia Academy forums

***

**Maintained by**: \[Your Team/Organization]\
**License**: MIT\
**Repository**: \[Repository URL]
