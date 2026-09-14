import {registry} from '@jahia/ui-extender';
import register from './AdminPanel.register';

export default function registerArchiveCallback() {
    registry.add('callback', 'archive', {
        targets: ['jahiaApp-init:60'],
        callback: register
    });
}
