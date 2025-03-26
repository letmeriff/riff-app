/**
 * @deprecated This file is a forwarding module for the legacy crdtPositionAdapter
 * The actual implementation has been moved to frontend/src/legacy/crdtPositionAdapter.ts
 * This file is maintained for backward compatibility and will be removed in future releases.
 */

import crdtPositionAdapter, { initCRDTAdapter } from '../legacy/crdtPositionAdapter';

// Re-export the adapter and initialization function
export default crdtPositionAdapter;
export { initCRDTAdapter }; 