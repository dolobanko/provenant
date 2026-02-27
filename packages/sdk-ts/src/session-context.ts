/**
 * Singleton AsyncLocalStorage for propagating the active Provenant session ID
 * across async boundaries within a `prov.withSession(...)` block.
 *
 * Exported so advanced users can integrate with frameworks that need to
 * propagate async context manually (e.g. express middleware).
 */
import { AsyncLocalStorage } from 'async_hooks';

export const _activeSession = new AsyncLocalStorage<string>();
