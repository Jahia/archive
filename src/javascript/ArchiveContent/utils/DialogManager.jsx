/**
 * Global Dialog Manager
 * Manages dialogs that persist outside component lifecycle
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import i18next from 'i18next';
import {I18nextProvider, useTranslation} from 'react-i18next';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
    Typography
} from '@mui/material';

class DialogManager {
    container = null;
    root = null;

    initialize() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'archive-dialog-container';
            document.body.appendChild(this.container);
            this.root = ReactDOM.createRoot(this.container);
        }
    }

    showPublishedWarningDialog({nodeInfo, publishedLanguages}) {
        this.initialize();

        const handleClose = () => {
            this.hideDialog();
        };

        const DialogComponent = () => {
            const {t} = useTranslation('archive');
            return (
                <Dialog fullWidth open maxWidth="sm" onClose={handleClose}>
                    <DialogTitle>{t('archive:dialog.title.published')}</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            {t('archive:dialog.message.published')}
                        </DialogContentText>
                        <Typography variant="body2" sx={{mt: 2}}>
                            <strong>{t('archive:dialog.label.content')}</strong> {nodeInfo?.displayName || nodeInfo?.name}
                        </Typography>
                        <Typography variant="body2">
                            <strong>{t('archive:dialog.label.currentPath')}</strong> {nodeInfo?.path}
                        </Typography>
                        {publishedLanguages && publishedLanguages.length > 0 && (
                            <Typography variant="body2" sx={{mt: 2}}>
                                <strong>{t('archive:dialog.label.publishedLanguages')}</strong> {publishedLanguages.map(l => l.language.toUpperCase()).join(', ')}
                            </Typography>
                        )}
                        <Typography variant="body2" color="error" sx={{mt: 2}}>
                            {t('archive:dialog.message.published.unpublish')}
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleClose}>{t('archive:button.close')}</Button>
                    </DialogActions>
                </Dialog>
            );
        };

        this.root.render(
            <I18nextProvider i18n={i18next}>
                <DialogComponent/>
            </I18nextProvider>
        );
    }

    showConfirmDialog({nodeInfo, destinationPreview, onConfirm}) {
        this.initialize();

        const handleClose = () => {
            this.hideDialog();
        };

        const handleConfirm = () => {
            this.hideDialog();
            if (onConfirm) {
                onConfirm();
            }
        };

        const DialogComponent = () => {
            const {t} = useTranslation('archive');
            return (
                <Dialog fullWidth open maxWidth="sm" onClose={handleClose}>
                    <DialogTitle>{t('archive:dialog.title.archive')}</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            {t('archive:dialog.message.confirm')}
                        </DialogContentText>
                        <Typography variant="body2" sx={{mt: 2}}>
                            <strong>{t('archive:dialog.label.content')}</strong> {nodeInfo?.displayName || nodeInfo?.name}
                        </Typography>
                        <Typography variant="body2">
                            <strong>{t('archive:dialog.label.from')}</strong> {nodeInfo?.path}
                        </Typography>
                        <Typography variant="body2">
                            <strong>{t('archive:dialog.label.to')}</strong> {destinationPreview}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{mt: 2}}>
                            {t('archive:dialog.message.details')}
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleClose}>{t('archive:button.cancel')}</Button>
                        <Button variant="contained" color="primary" onClick={handleConfirm}>
                            {t('archive:button.archive')}
                        </Button>
                    </DialogActions>
                </Dialog>
            );
        };

        this.root.render(
            <I18nextProvider i18n={i18next}>
                <DialogComponent/>
            </I18nextProvider>
        );
    }

    showRestoreConfirmDialog({nodeInfo, archiveInfo, parentExists, customParentPath = null, onConfirm, onSelectParent}) {
        this.initialize();

        const handleClose = () => {
            this.hideDialog();
        };

        const handleConfirm = () => {
            if (onConfirm) {
                onConfirm(customParentPath);
            }
        };

        const handleSelectParent = () => {
            if (onSelectParent) {
                onSelectParent();
            }
        };

        const targetPath = customParentPath || archiveInfo.originalParentPath;

        const DialogComponent = () => {
            const {t} = useTranslation('archive');
            const targetName = customParentPath ? t('archive:dialog.label.selectedLocation') : t('archive:dialog.label.originalLocation');
            return (
                <Dialog fullWidth open maxWidth="md" onClose={handleClose}>
                    <DialogTitle>{t('archive:dialog.title.restore')}</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            {t('archive:dialog.message.restore.confirm')}
                        </DialogContentText>

                        <Typography variant="subtitle2" sx={{mt: 3, mb: 1}}>
                            {t('archive:dialog.section.contentInfo')}
                        </Typography>
                        <Typography variant="body2">
                            <strong>{t('archive:dialog.label.name')}</strong> {nodeInfo?.displayName || nodeInfo?.name}
                        </Typography>
                        <Typography variant="body2">
                            <strong>{t('archive:dialog.label.currentPath')}</strong> {nodeInfo?.path}
                        </Typography>

                        <Typography variant="subtitle2" sx={{mt: 2, mb: 1}}>
                            {t('archive:dialog.section.archiveInfo')}
                        </Typography>
                        <Typography variant="body2">
                            <strong>{t('archive:dialog.label.archivedAt')}</strong> {archiveInfo.archivedAt ? new Date(archiveInfo.archivedAt).toLocaleString() : 'Unknown'}
                        </Typography>
                        <Typography variant="body2">
                            <strong>{t('archive:dialog.label.originalPath')}</strong> {archiveInfo.originalPath || 'Unknown'}
                        </Typography>

                        <Typography variant="subtitle2" sx={{mt: 2, mb: 1}}>
                            {t('archive:dialog.section.restoreDestination')}
                        </Typography>
                        {!parentExists && !customParentPath ? (
                            <>
                                <Typography variant="body2" color="warning.main">
                                    <strong>{t('archive:dialog.message.restore.parentMissing')}</strong>
                                </Typography>
                                <Typography variant="body2" sx={{mt: 1}}>
                                    {t('archive:dialog.message.restore.parentMissingInfo')}
                                </Typography>
                            </>
                        ) : (
                            <>
                                <Typography variant="body2">
                                    <strong>{targetName}</strong> {targetPath}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>
                                    {t('archive:dialog.message.restore.details')}
                                </Typography>
                            </>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleClose}>{t('archive:button.cancel')}</Button>
                        {!parentExists && !customParentPath ? (
                            <Button variant="contained" color="primary" onClick={handleSelectParent}>
                                {t('archive:button.selectLocation')}
                            </Button>
                        ) : (
                            <>
                                {parentExists && !customParentPath && (
                                    <Button onClick={handleSelectParent}>
                                        {t('archive:button.chooseDifferentLocation')}
                                    </Button>
                                )}
                                <Button variant="contained" color="primary" onClick={handleConfirm}>
                                    {t('archive:button.restore')}
                                </Button>
                            </>
                        )}
                    </DialogActions>
                </Dialog>
            );
        };

        this.root.render(
            <I18nextProvider i18n={i18next}>
                <DialogComponent/>
            </I18nextProvider>
        );
    }

    showPathPickerDialog({nodeInfo, onConfirm}) {
        this.initialize();

        const handleClose = () => {
            this.hideDialog();
        };

        const handleOpenPicker = () => {
            // Close the current dialog
            this.hideDialog();

            // Open Jahia content picker
            globalThis.CE_API.openPicker({
                type: 'editorial',
                initialSelectedItem: [],
                site: globalThis.jahiaGWTParameters?.siteKey || globalThis.contextJsParameters?.siteKey,
                lang: globalThis.jahiaGWTParameters?.uilang || globalThis.contextJsParameters?.uilang,
                isMultiple: false,
                setValue: ([selected]) => {
                    if (selected?.path && onConfirm) {
                        onConfirm(selected.path);
                    }
                }
            });
        };

        const DialogComponent = () => {
            const {t} = useTranslation('archive');
            return (
                <Dialog fullWidth open maxWidth="sm" onClose={handleClose}>
                    <DialogTitle>{t('archive:dialog.title.selectLocation')}</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            {t('archive:dialog.message.restore.selectLocation')}
                        </DialogContentText>
                        <Typography variant="body2" sx={{mt: 2, mb: 2}}>
                            <strong>{t('archive:dialog.label.content')}</strong> {nodeInfo?.displayName || nodeInfo?.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('archive:dialog.message.restore.selectLocationInfo')}
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleClose}>{t('archive:button.cancel')}</Button>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleOpenPicker}
                        >
                            {t('archive:button.selectLocation')}
                        </Button>
                    </DialogActions>
                </Dialog>
            );
        };

        this.root.render(
            <I18nextProvider i18n={i18next}>
                <DialogComponent/>
            </I18nextProvider>
        );
    }

    hideDialog() {
        if (this.root) {
            this.root.render(null);
        }
    }

    cleanup() {
        if (this.root) {
            this.root.unmount();
        }

        this.container?.remove();

        this.container = null;
        this.root = null;
    }
}

// Create singleton instance
const dialogManager = new DialogManager();

export default dialogManager;
