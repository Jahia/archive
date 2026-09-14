import {registerArchiveAction, registerRestoreArchiveAction} from './ArchiveContent';
import registerArchiveManager from './ArchiveManager/registerArchiveManager';
import i18next from 'i18next';

export default async function registerArchiveExtensions() {
    await i18next.loadNamespaces('archive');

    registerArchiveAction();
    registerRestoreArchiveAction();
    registerArchiveManager();
}
