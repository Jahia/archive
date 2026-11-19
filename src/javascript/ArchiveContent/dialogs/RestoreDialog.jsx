/**
 * Restore dialog: shows where an archived item came from, lets the editor keep that location or
 * pick another one, then moves it back.
 *
 * Rendered through jContent's component renderer (see RestoreArchiveAction), inside jContent's tree.
 */
import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from 'react-i18next';
import {Button, Loader, Modal, ModalBody, ModalFooter, ModalHeader, Typography} from '@jahia/moonstone';
import ArchiveService from '../services/ArchiveService';
import {describeError, formatDateTime, getJContentContext} from '../utils/archiveUtils';
import styles from './ArchiveDialogs.scss';

const Line = ({label, value}) => (
    <Typography>
        {label} <span className={styles.path}>{value}</span>
    </Typography>
);

Line.propTypes = {
    label: PropTypes.string.isRequired,
    value: PropTypes.node
};

export const RestoreDialog = ({path, notify, onDone, onClose}) => {
    const {t} = useTranslation('archive');
    const [phase, setPhase] = useState('loading');
    const [info, setInfo] = useState(null);
    const [parentExists, setParentExists] = useState(false);
    const [chosenParent, setChosenParent] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const archiveInfo = await ArchiveService.getArchiveInfo(path);
                const exists = archiveInfo.originalParentPath ?
                    await ArchiveService.checkPathExists(archiveInfo.originalParentPath) :
                    false;
                if (!cancelled) {
                    setInfo(archiveInfo);
                    setParentExists(exists);
                    setPhase('ready');
                }
            } catch (error) {
                if (!cancelled) {
                    notify(describeError(t, error), 'error');
                    onClose();
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [path, notify, onClose, t]);

    const target = chosenParent || (parentExists ? info?.originalParentPath : null);
    const canPick = Boolean(globalThis.CE_API?.openPicker);

    const pickLocation = () => {
        const {site, uilang} = getJContentContext();
        globalThis.CE_API?.openPicker?.({
            type: 'editorial',
            initialSelectedItem: [],
            site,
            lang: uilang,
            isMultiple: false,
            setValue: ([selected] = []) => {
                if (selected?.path) {
                    setChosenParent(selected.path);
                }
            }
        });
    };

    const restore = async () => {
        setPhase('running');
        const result = await ArchiveService.restoreNode(path, target);
        if (result.success) {
            if (result.markerRemoved === false) {
                notify(t('archive:notification.restoredStillMarked', {path: result.destinationPath}), 'warning');
            } else {
                notify(t('archive:notification.restored', {path: result.destinationPath}), 'success');
            }

            onDone(result.destinationPath);
            onClose();
        } else {
            notify(describeError(t, result.error), 'error');
            setPhase('ready');
        }
    };

    const close = () => {
        if (phase !== 'running') {
            onClose();
        }
    };

    const renderBody = () => {
        if (phase === 'loading') {
            return (
                <div className={styles.waiting}>
                    <Loader size="small"/>
                    <Typography>{t('archive:dialog.loading')}</Typography>
                </div>
            );
        }

        const archivedAt = formatDateTime(info.archivedAt) || t('archive:dialog.unknown');
        return (
            <>
                <Typography>{t('archive:dialog.message.restore.confirm')}</Typography>
                <section className={styles.section}>
                    <Typography weight="bold">{t('archive:dialog.section.contentInfo')}</Typography>
                    <Line label={t('archive:dialog.label.name')} value={info.nodeInfo?.displayName || info.nodeInfo?.name}/>
                    <Line label={t('archive:dialog.label.currentPath')} value={info.nodeInfo?.path}/>
                    <Line label={t('archive:dialog.label.archivedAt')} value={archivedAt}/>
                    <Line label={t('archive:dialog.label.originalPath')} value={info.originalPath || t('archive:dialog.unknown')}/>
                </section>
                <section className={styles.section}>
                    <Typography weight="bold">{t('archive:dialog.section.restoreDestination')}</Typography>
                    {target ? (
                        <>
                            <Line
                                label={chosenParent ? t('archive:dialog.label.selectedLocation') : t('archive:dialog.label.originalLocation')}
                                value={target}
                            />
                            <Typography variant="caption">{t('archive:dialog.message.restore.details')}</Typography>
                        </>
                    ) : (
                        <>
                            <Typography weight="bold">{t('archive:dialog.message.restore.parentMissing')}</Typography>
                            <Typography variant="caption">{t('archive:dialog.message.restore.parentMissingInfo')}</Typography>
                        </>
                    )}
                </section>
                {phase === 'running' && (
                    <div className={styles.waiting}>
                        <Loader size="small"/>
                        <Typography>{t('archive:dialog.restoring')}</Typography>
                    </div>
                )}
            </>
        );
    };

    return (
        // Large: three buttons in the footer (Cancel, the location picker, Restore)
        <Modal isOpen size="large" onOpenChange={open => !open && close()}>
            <div className={styles.dialog}>
                <ModalHeader title={t('archive:dialog.title.restore')}/>
                <ModalBody>
                    <div className={styles.body}>{renderBody()}</div>
                </ModalBody>
                <ModalFooter>
                    <Button label={t('archive:button.cancel')} isDisabled={phase === 'running'} onClick={close}/>
                    {phase !== 'loading' && (
                        <Button
                            variant="outlined"
                            label={target ? t('archive:button.chooseDifferentLocation') : t('archive:button.selectLocation')}
                            isDisabled={!canPick || phase === 'running'}
                            onClick={pickLocation}
                        />
                    )}
                    {phase !== 'loading' && (
                        <Button
                            color="accent"
                            label={t('archive:button.restore')}
                            isDisabled={!target || phase === 'running'}
                            onClick={restore}
                        />
                    )}
                </ModalFooter>
            </div>
        </Modal>
    );
};

RestoreDialog.propTypes = {
    /** Path of the archived item */
    path: PropTypes.string.isRequired,
    /** Shows a message to the editor: (message, variant) */
    notify: PropTypes.func.isRequired,
    /** Called with the restored item's new path, before the dialog closes */
    onDone: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired
};

export default RestoreDialog;
