# Archive Content - User Guide

Quick reference guide for content editors and managers.

## What is Archive Content?

The Archive feature allows you to safely move outdated or unused content to a secure archive location. Archived content is:

- ✅ Preserved with all metadata intact
- ✅ Organized by date (year/month)
- ✅ Marked as read-only
- ✅ Traceable to its original location

## When to Archive Content

**Good candidates for archiving:**
- Expired news articles or blog posts
- Outdated campaign pages
- Deprecated product information
- Seasonal content after the season ends
- Draft content that's no longer needed

**Do NOT archive:**
- Currently published content (unpublish it first)
- Content that may be needed soon
- Pages with active incoming links
- Legal/compliance documents with retention requirements

## How to Archive Content

### Step 1: Navigate to Content

1. Open **jContent**
2. Browse to the page, content item or content folder you want to archive
3. To archive several items at once, tick them in the list

### Step 2: Check Publication Status

**⚠️ Important**: Content must be **unpublished** before archiving.

- **Published content**: Shows green indicator or "Published" badge
- **Unpublished content**: Shows gray indicator or "Not Published"

**If content is published:**
1. Click the **Publish** menu → **Unpublish**
2. Wait for unpublish to complete
3. Proceed with archiving

### Step 3: Archive

1. Right-click the item (or open its ⋮ menu, or right-click it in the left tree). With several items ticked, use the bar above the list.
2. Select **Archive Content**
3. Review the dialog:
   - What will be archived, and where
   - What cannot be archived, and why (published, and in which languages)
4. Click **Archive**, or **Archive the other items** when some are blocked

### Step 4: Confirmation

✅ A message confirms how many items were archived (for example "2 items archived")

The content is now:
- Moved to the archive folder
- Organized by current date
- Marked as archived
- Protected from accidental editing

## Finding Archived Content

### Via the Archive Manager

1. Open **jContent**
2. Click **Archive Manager** in the left menu
3. Browse by year and month; open an archived folder to see what it holds
4. Columns: name, type, **creation date**, original location, archive date, who archived it. Hover a
   date for its time, or a cut location for the whole path. At 1280 px every column shows once the
   jContent navigation is closed
5. Click an item to **preview** it in the side panel before deciding to restore it

### Via Search

Search for archived content using:
- Original content name
- Original path
- Archive date

## What Happens to Archived Content?

### Location

Archived content moves from:
```
/mysite/content/news/old-article
```

To:
```
/sites/mysite/Archives/2026/02/old-article
```

### Metadata

Each archived item stores:
- **Original Path**: `/mysite/content/news/old-article`
- **Archived Date**: February 5, 2026, 10:30 AM
- **Archived By**: Your username
- **Parent ID**: Reference to original parent folder

### Access

- **Viewing**: All users with content access can view archived content
- **Editing**: Only administrators can edit archived content
- **Publishing**: Archived content cannot be published

## Common Scenarios

### Scenario 1: Archive Expired News Article

**Situation**: News article from 2025 is no longer relevant

**Steps:**
1. Find the news article in jContent
2. Verify it's unpublished (or unpublish it)
3. Right-click → Archive Content
4. Confirm archive

**Result**: Article moves to `/sites/mysite/Archives/2026/02/old-news`

### Scenario 1b: Archive a Whole Year

**Situation**: A content folder "2016" holds a year of old articles

**Steps:**
1. Make sure nothing in the folder is published (unpublish the folder if needed)
2. Right-click the folder → Archive Content
3. Confirm

**Result**: The folder moves to the archive with everything it contains, and each article in it is
archived and locked too. In the Archive Manager, open the folder: each article shows where it came
from, and can be restored on its own. If its folder no longer exists, it is created again.

### Scenario 2: Try to Archive Published Page

**Situation**: You attempt to archive a page that's still live

**What happens:**
- ⚠️ The dialog lists the page as not archivable, with **which languages** it is published in
- Message: "Please unpublish this content in all languages before archiving"
- Other items of the same selection can still be archived

The check covers every language of the site and, for a folder, everything inside it: a folder
holding one published article is blocked. If the publication status cannot be read at all, the
archive is blocked rather than allowed.

**Resolution:**
1. Click **Cancel** (or archive the other items)
2. Unpublish the page in every language listed
3. Retry archive

### Scenario 3: Already Archived Content

**Situation**: You try to archive content that's already in the archive

**What happens:**
- ℹ️ Information dialog: "Already Archived"
- No action taken (prevents duplicate archives)

## Troubleshooting

### Error: "Permission denied"

**Problem**: You don't have permission to archive content

**Solution**: Contact your site administrator to request the "Archive Content" permission

### Locked content

**Problem**: The content is locked, by an editor, a workflow, or because it is marked for deletion

**What happens:**
- Locked content does not offer **Archive** at all, in any menu or in the selection bar
- A page or folder that holds locked content is listed in the dialog as not archivable: "locked, or
  holds locked content"
- A page or folder that holds content marked for deletion is refused with its own reason: archiving
  it would move that content under the Archives folder, which is never published, so its deletion
  could never be completed

**Solution**:
1. Unlock the content, or publish or undo its deletion
2. Retry archive

### Warning: "Content archived, but it could not be locked"

**Problem**: The content reached the archive, but it stayed editable

**Solution**: The archive itself succeeded and nothing was lost. Tell your administrator, as
archived content is meant to be locked.

### Warning: "Content restored, but it still shows as archived"

**Problem**: The content is back where you wanted it, but still carries the archived marker

**Solution**: Run **Restore** on it once more - the action is still available on it, and the
second run clears the marker.

### Archive Folder Not Visible

**Problem**: You can't find the archive folder

**Solution**: 
1. Check: `/sites/[yoursite]/Archives`
2. If missing, try archiving any content first (creates the folder automatically)
3. Contact administrator if issue persists

### Can't Find Archived Content

**Problem**: You archived content but can't locate it

**Solution**:
1. Open the **Archive Manager** in jContent's left menu
2. Browse `[year]/[month]`, or sort by the **Original Location** or **Created** column
3. Search by original content name
4. Contact administrator with original path

## Best Practices

### Before Archiving

- ✅ Verify content is unpublished
- ✅ Check for incoming links (update or redirect them)
- ✅ Document why you're archiving (for team reference)
- ✅ Confirm with team if content is shared/referenced

### Regular Maintenance

- 📅 Schedule monthly archive reviews
- 📅 Archive seasonal content after the season
- 📅 Archive campaign content 30 days after campaign ends
- 📅 Archive draft content that's been inactive > 90 days

### What NOT to Do

- ❌ Don't archive content "just to clean up" - evaluate if truly needed
- ❌ Don't archive published content without unpublishing first
- ❌ Don't archive content with active redirects pointing to it
- ❌ Don't delete archived content - consult admin first

## Permissions

### Who Can Archive?

By default:
- **Editor-in-Chief**: Can archive and unarchive
- **Senior Editor**: Can archive
- **Site Administrator**: Full archive management

### Request Access

If you need archive permissions:
1. Contact your site administrator
2. Specify: "I need Archive Content permission"
3. Explain why you need it

## Future Features

Coming soon:
- **Bulk Archive**: Archive multiple items at once
- **Unarchive**: Restore content to original location
- **Archive Browser**: Dedicated UI for browsing archives
- **Scheduled Archive**: Auto-archive based on content age

## Support

### Need Help?

- 📖 Full documentation: See [README.md](README.md)
- 🔧 Technical details: See [TECHNICAL.md](TECHNICAL.md)
- 💬 Contact: Your site administrator or Jahia support team

### Report Issues

If you encounter problems:
1. Note the exact error message
2. Note what you were trying to archive (path/name)
3. Take a screenshot if helpful
4. Contact your administrator with these details

## Quick Reference Card

| Action | Menu Path | Shortcut |
|--------|-----------|----------|
| Archive content | Right-click → Archive Content (or tick several items) | - |
| View archive | Archive Manager → [year]/[month] | - |
| Preview archived content | Archive Manager → click the item | - |
| Restore | Archive Manager → right-click → Restore Archive | - |
| Unpublish | Publish → Unpublish | - |
| Check status | Content toolbar (badge) | - |

---

**Version**: 1.0  
**Last Updated**: February 2026  
**For**: Jahia DX 8.2+
