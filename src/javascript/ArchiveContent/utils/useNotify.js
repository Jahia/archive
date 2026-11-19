import {useNotifications} from '@jahia/react-material';

/**
 * Shows a message to the editor the way jContent's own screens do.
 *
 * jContent 3.8 has no `window.jahia.toastDispatcher`: a guarded call to it shows nothing. jContent
 * notifies with `useNotifications` from `@jahia/react-material`, which the host shares (3.0.5 since
 * jContent 3.6) and provides around its routes. The dispatcher stays as a fallback for a host that
 * still has one.
 *
 * Call it in a component rendered by a jContent route or action (an action component), and hand the
 * returned function to dialogs: the function stays valid after the menu that rendered the action closes.
 *
 * @returns {function(string, string=): void} notify(message, variant)
 */
export const useNotify = () => {
    const notifications = useNotifications();
    return (message, variant = 'info') => {
        if (notifications?.notify) {
            notifications.notify(message, ['closeButton']);
            return;
        }

        globalThis.jahia?.toastDispatcher?.add?.({message, variant});
    };
};
