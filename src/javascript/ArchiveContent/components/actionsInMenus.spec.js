import {beforeEach, describe, expect, it, vi} from 'vitest';

// The actions' hooks and imports, replaced so each component can be called as a plain function
const checks = {current: {loading: false, checksResult: false}};
vi.mock('react', async () => {
    const actual = await vi.importActual('react');
    return {...actual, default: actual, useContext: () => ({render: vi.fn(), destroy: vi.fn()})};
});
vi.mock('react-apollo', () => ({useApolloClient: () => ({})}));
vi.mock('@jahia/data-helper', () => ({useNodeChecks: () => checks.current}));
vi.mock('@jahia/ui-extender', () => ({ComponentRendererContext: {}, registry: {addOrReplace: vi.fn()}}));
vi.mock('@jahia/moonstone', () => ({Archive: () => null, Unarchive: () => null}));
vi.mock('../dialogs/ArchiveDialog', () => ({default: () => null}));
vi.mock('../dialogs/RestoreDialog', () => ({default: () => null}));
vi.mock('../utils/archiveUtils', () => ({ARCHIVABLE_TYPES: [], NOT_ARCHIVABLE_PATHS: []}));
vi.mock('../utils/refresh', () => ({refreshAfterMove: vi.fn()}));
vi.mock('../utils/useNotify', () => ({useNotify: () => vi.fn()}));

const {ArchiveContentAction} = await import('./ArchiveContentAction');
const {RestoreArchiveAction} = await import('./RestoreArchiveAction');

const Render = () => null;
const Loading = () => null;

// The menus of jContent show their items once none is loading: an action that rendered Loading must
// render Render afterwards, hidden or not. Returning null left every right-click and row menu on
// grey placeholders wherever the action was hidden (1.2.0 and 1.2.1).
describe.each([
    ['ArchiveContentAction', ArchiveContentAction],
    ['RestoreArchiveAction', RestoreArchiveAction]
])('%s in a jContent menu', (_, action) => {
    const run = () => action({path: '/sites/s/contents/folder', render: Render, loading: Loading, id: 'x'});

    beforeEach(() => {
        checks.current = {loading: false, checksResult: false};
    });

    it('renders Loading while its checks run', () => {
        checks.current = {loading: true};
        expect(run().type).toBe(Loading);
    });

    it('hides itself through Render where its checks fail', () => {
        const element = run();
        expect(element).toBeTruthy();
        expect(element.type).toBe(Render);
        expect(element.props.isVisible).toBe(false);
    });

    it('shows itself where its checks pass', () => {
        checks.current = {loading: false, checksResult: true};
        const element = run();
        expect(element.type).toBe(Render);
        expect(element.props.isVisible).toBe(true);
    });
});
