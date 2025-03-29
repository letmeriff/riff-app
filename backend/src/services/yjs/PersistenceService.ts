import * as Y from 'yjs';
import {
  storeYjsDocument,
  storeYjsUpdate,
  createDocumentSnapshot,
} from '../yjsService';
import { DocumentManager } from './DocumentManager';

const SNAPSHOT_INTERVAL = 5 * 60 * 1000; // Create snapshots every 5 minutes

/**
 * Handles YJS document persistence and snapshots
 */
export class PersistenceService {
  constructor(private documentManager: DocumentManager) {}

  /**
   * Store an update for a document
   */
  async storeUpdate(
    documentId: string,
    update: Uint8Array,
    clientId: number | string
  ): Promise<void> {
    const version = Date.now(); // Use timestamp as version for simplicity
    await storeYjsUpdate(documentId, update, clientId.toString(), version);
  }

  /**
   * Create a snapshot of a document
   */
  async createSnapshot(documentId: string, doc: Y.Doc): Promise<void> {
    const snapshot = Y.encodeStateAsUpdate(doc);
    const version = Date.now();
    await storeYjsDocument(documentId, snapshot, version);
    console.log(`Created snapshot for document ${documentId}`);
  }

  /**
   * Setup periodic snapshot creation for a document
   */
  setupPeriodicSnapshots(documentId: string): void {
    // Setup timer callback
    const snapshotCallback = async (): Promise<void> => {
      try {
        // Get document
        const doc = await this.documentManager.getDocument(documentId);
        
        // Get subscribers to check if document is active
        const subscribers = this.documentManager.getSubscribers(documentId);
        
        // Only create snapshot if there are active subscribers
        if (subscribers && subscribers.size > 0) {
          console.log(`Creating periodic snapshot for document ${documentId}`);
          await createDocumentSnapshot(documentId, doc);
        }
      } catch (err) {
        console.error(`Error creating periodic snapshot for document ${documentId}:`, err);
      }
    };
    
    // Set up the timer
    this.documentManager.setupSnapshotTimer(
      documentId,
      snapshotCallback,
      SNAPSHOT_INTERVAL
    );
  }

  /**
   * Setup document change handlers for persistence
   */
  setupDocumentChangeHandlers(doc: Y.Doc, documentId: string): void {
    let updateTimeout: NodeJS.Timeout | null = null;
    let updatePending = false;
    const DEBOUNCE_WAIT = 2000;

    // Handle document updates
    doc.on('update', async (update: Uint8Array, origin: unknown) => {
      // Store update in the database
      const clientId = typeof origin === 'number' ? origin : doc.clientID;
      await this.storeUpdate(documentId, update, clientId);

      // Debounce full document state persistence
      if (!updateTimeout) {
        updateTimeout = setTimeout(async () => {
          if (updatePending) {
            // Create a snapshot of the full document
            await this.createSnapshot(documentId, doc);
            updatePending = false;
            updateTimeout = null;
          }
        }, DEBOUNCE_WAIT);
      }
      updatePending = true;
    });

    // Setup periodic snapshots
    this.setupPeriodicSnapshots(documentId);
  }
} 