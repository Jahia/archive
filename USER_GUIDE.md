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

1. Open **Content Editor**
2. Browse to the content you want to archive
3. Select the content item

### Step 2: Check Publication Status

**⚠️ Important**: Content must be **unpublished** before archiving.

- **Published content**: Shows green indicator or "Published" badge
- **Unpublished content**: Shows gray indicator or "Not Published"

**If content is published:**
1. Click the **Publish** menu → **Unpublish**
2. Wait for unpublish to complete
3. Proceed with archiving

### Step 3: Archive

1. Click the **Content Actions** menu (⋮ three-dot icon)
2. Select **Archive** from the menu
3. Review the confirmation dialog:
   - Content name and current location
   - Archive destination preview
4. Click **Archive** to confirm

### Step 4: Confirmation

✅ Success message appears: "Content archived successfully to /mysite/contents/archive/2026/02"

The content is now:
- Moved to the archive folder
- Organized by current date
- Marked as archived
- Protected from accidental editing

## Finding Archived Content

### Via Content Tree

1. Open **Content Editor**
2. Navigate to: **[Your Site] → contents → archive**
3. Browse by year/month folders
4. Content is organized: `archive/2026/02/your-content`

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
/mysite/contents/archive/2026/02/old-article
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
1. Open the news article in Content Editor
2. Verify it's unpublished (or unpublish it)
3. Content Actions → Archive
4. Confirm archive

**Result**: Article moves to `/mysite/contents/archive/2026/02/old-news`

### Scenario 2: Try to Archive Published Page

**Situation**: You attempt to archive a page that's still live

**What happens:**
- ⚠️ Warning dialog appears: "Cannot Archive Published Content"
- Message: "Please unpublish this content manually before archiving"
- The dialog lists **which languages** the content is published in
- Archive action is blocked

The check covers every language of the site, so content published in only one language is
blocked just the same. If the publication status cannot be read at all, the archive is
blocked rather than allowed.

**Resolution:**
1. Click **Close** on the warning
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

### Error: "Content is locked"

**Problem**: Another user is editing the content

**Solution**: 
1. Wait for the other user to finish
2. Or ask them to unlock the content
3. Retry archive

### Warning: "Content archived, but it could not be locked"

**Problem**: The content reached the archive, but it stayed editable

**Solution**: The archive itself succeeded and nothing was lost. Tell your administrator, as
archived content is meant to be locked.

### Warning: "Content restored, but it still shows as archived"

**Problem**: The content is back where you wanted it, but still carries the archived marker

**Solution**: Run **Restore** on it once more — the action is still available on it, and the
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
1. Check the success message for the exact path
2. Navigate to: `contents/archive/[year]/[month]`
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
| Archive content | Content Actions → Archive | - |
| View archive | Contents → archive → [year]/[month] | - |
| Unpublish | Publish → Unpublish | - |
| Check status | Content toolbar (badge) | - |

---

**Version**: 1.0  
**Last Updated**: February 2026  
**For**: Jahia DX 8.2+
