/**
 * Archive dialog: checks the chosen content, says what cannot be archived and why, then archives
 * the rest one item at a time.
 *
 * Rendered through jContent's component renderer (see ArchiveContentAction), so it sits inside
 * jContent's own tree: translations, Apollo and the store are jContent's, with no provider of its own.
 */
import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from 'react-i18next';
import {Button, Loader, Modal, ModalBody, ModalFooter, ModalHeader, Typography} from '@jahia/moonstone';
import ArchiveService from '../services/ArchiveService';
import {describeError} from '../utils/archiveUtils';
import styles from './ArchiveDialogs.scss';

const MAX_LISTED = 10;

const nameOf = check => check.nodeInfo?.displayName || check.nodeInfo?.name || check.path;

const isFolder = check => check.nodeInfo?.primaryNodeType?.name === 'jnt:contentFolder';

/**
 * Why one item cannot be archived, as a sentence for the editor.
 */
const blockReason = (t, check) => {
    switch (check.reason) {
        case 'published':
            return t('archive:dialog.blocked.published', {
                languages: (check.publishedLanguages || []).map(l => l.language.toUpperCase()).join(', ')
            });
        case 'alreadyArchived':
            return t('archive:dialog.blocked.alreadyArchived');
        case 'notFound':
            return t('archive:dialog.blocked.notFound');
        default:
            return describeError(t, check.error);
    }
};

const NameList = ({items, renderItem}) => {
    const {t} = useTranslation('archive');
    const shown = items.slice(0, MAX_LISTED);
    return (
        <ul className={styles.list}>
            {shown.map(item => (
                <li key={item.path}>{renderItem(item)}</li>
            ))}
            {items.length > shown.length && (
                <li>
                    <Typography variant="caption">
                        {t('archive:dialog.andMore', {count: items.length - shown.length})}
                    </Typography>
                </li>
            )}
        </ul>
    );
};

NameList.propTypes = {
    items: PropTypes.arrayOf(PropTypes.shape({path: PropTypes.string})).isRequired,
    renderItem: PropTypes.func.isRequired
};

export const ArchiveDialog = ({paths, notify, onDone, onClose}) => {
    const {t} = useTranslation('archive');
    const [phase, setPhase] = useState('checking');
    const [checks, setChecks] = useState([]);
    const [progress, setProgress] = useState({done: 0, total: 0});

    useEffect(() => {
        let cancelled = false;
        Promise.all(paths.map(path => ArchiveService.validateArchive(path).then(check => ({path, ...check}))))
            .then(results => {
                if (!cancelled) {
                    setChecks(results);
                    setPhase('review');
                }
            });
        return () => {
            cancelled = true;
        };
    }, [paths]);

    const archivable = checks.filter(check => check.canArchive);
    const blocked = checks.filter(check => !check.canArchive);

    const report = outcome => {
        if (outcome.archived.length > 0) {
            notify(t('archive:notification.archived', {count: outcome.archived.length}), 'success');
        }

        if (outcome.notLocked.length > 0) {
            notify(t('archive:notification.notLocked', {count: outcome.notLocked.length}), 'warning');
        }

        const notArchived = [...outcome.refused, ...outcome.failed];
        if (notArchived.length === 1) {
            const [item] = notArchived;
            notify(item.error ? describeError(t, item.error) : blockReason(t, item), 'error');
        } else if (notArchived.length > 1) {
            notify(t('archive:notification.notArchived', {count: notArchived.length}), 'error');
        }
    };

    const archive = async () => {
        setPhase('running');
        setProgress({done: 0, total: archivable.length});
        const outcome = await ArchiveService.archiveNodes(
            archivable.map(check => check.path),
            (done, total) => setProgress({done, total})
        );
        report(outcome);
        onDone(outcome.archived.map(item => item.path));
        onClose();
    };

    const close = () => {
        // An archive under way is not interrupted: closing would hide its outcome
        if (phase !== 'running') {
            onClose();
        }
    };

    const renderBody = () => {
        if (phase === 'checking') {
            return (
                <div className={styles.waiting}>
                    <Loader size="small"/>
                    <Typography>{t('archive:dialog.checking')}</Typography>
                </div>
            );
        }

        if (phase === 'running') {
            return (
                <div className={styles.waiting}>
                    <Loader size="small"/>
                    <Typography>{t('archive:dialog.progress', progress)}</Typography>
                </div>
            );
        }

        return (
            <>
                {archivable.length > 0 && (
                    <section className={styles.section}>
                        <Typography>{t('archive:dialog.message.confirm', {count: archivable.length})}</Typography>
                        <NameList items={archivable} renderItem={check => <Typography weight="bold">{nameOf(check)}</Typography>}/>
                        <Typography>
                            {t('archive:dialog.label.to')} <span className={styles.path}>{archivable[0].destinationPreview}</span>
                        </Typography>
                        {archivable.some(isFolder) && (
                            <Typography variant="caption">{t('archive:dialog.message.folder')}</Typography>
                        )}
                        <Typography variant="caption">{t('archive:dialog.message.details')}</Typography>
                    </section>
                )}
                {blocked.length > 0 && (
                    <section className={styles.section}>
                        <Typography weight="bold">{t('archive:dialog.blocked.title', {count: blocked.length})}</Typography>
                        <NameList
                            items={blocked}
                            renderItem={check => (
                                <Typography>
                                    <strong>{nameOf(check)}</strong>: {blockReason(t, check)}
                                </Typography>
                            )}
                        />
                        {blocked.some(check => check.reason === 'published') && (
                            <Typography variant="caption">{t('archive:dialog.message.published.unpublish')}</Typography>
                        )}
                    </section>
                )}
            </>
        );
    };

    const title = phase === 'review' && archivable.length === 0 ?
        t('archive:dialog.title.cannotArchive') :
        t('archive:dialog.title.archive');

    return (
        <Modal isOpen size="medium" onOpenChange={open => !open && close()}>
            <div className={styles.dialog}>
                <ModalHeader title={title}/>
                <ModalBody>
                    <div className={styles.body}>{renderBody()}</div>
                </ModalBody>
                <ModalFooter>
                    <Button
                        label={archivable.length > 0 || phase !== 'review' ? t('archive:button.cancel') : t('archive:button.close')}
                        isDisabled={phase === 'running'}
                        onClick={close}
                    />
                    {phase !== 'checking' && archivable.length > 0 && (
                        <Button
                            variant="default"
                            color="accent"
                            label={blocked.length > 0 ?
                                t('archive:button.archiveOthers', {count: archivable.length}) :
                                t('archive:button.archive')}
                            isDisabled={phase === 'running'}
                            onClick={archive}
                        />
                    )}
                </ModalFooter>
            </div>
        </Modal>
    );
};

ArchiveDialog.propTypes = {
    /** Paths of the content to archive: one, or a multiple selection */
    paths: PropTypes.arrayOf(PropTypes.string).isRequired,
    /** Shows a message to the editor: (message, variant) */
    notify: PropTypes.func.isRequired,
    /** Called with the paths now in the archive, before the dialog closes */
    onDone: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired
};

export default ArchiveDialog;
