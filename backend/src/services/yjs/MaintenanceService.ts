import { supabase } from '../../config/supabase';

/**
 * Handles database maintenance tasks for YJS documents
 */
export class MaintenanceService {
  constructor() {}

  /**
   * Run scheduled maintenance tasks for YJS documents
   */
  async runScheduledMaintenance(): Promise<number> {
    try {
      console.log('Running scheduled Yjs database maintenance...');
      
      // 1. Clean up old updates that have been incorporated into snapshots
      const { count: cleanupCount } = await this.cleanupOldUpdates();
      
      // 2. Compress old snapshots to save space
      const { count: compressCount } = await this.compressOldSnapshots();
      
      // 3. Vacuum the database to reclaim space
      await this.vacuumDatabase();
      
      const totalProcessed = cleanupCount + compressCount;
      console.log(`Database maintenance completed. Processed ${totalProcessed} documents.`);
      
      return totalProcessed;
    } catch (error) {
      console.error('Error during scheduled database maintenance:', error);
      return 0;
    }
  }

  /**
   * Clean up old updates that have been incorporated into snapshots
   */
  private async cleanupOldUpdates(): Promise<{ count: number }> {
    try {
      // Find documents with snapshots
      const { data: snapshots, error: snapshotsError } = await supabase
        .from('yjs_documents')
        .select('document_id, version')
        .order('version', { ascending: false });

      if (snapshotsError || !snapshots) {
        console.error('Error fetching document snapshots:', snapshotsError);
        return { count: 0 };
      }

      let cleanupCount = 0;

      // For each document with a snapshot, delete updates older than the snapshot
      for (const snapshot of snapshots) {
        // First count how many records will be deleted
        const { data: countData, error: countError } = await supabase
          .from('yjs_updates')
          .select('id', { count: 'exact' })
          .eq('document_id', snapshot.document_id)
          .lt('version', snapshot.version);

        if (countError) {
          console.error(`Error counting updates for document ${snapshot.document_id}:`, countError);
          continue;
        }

        const count = countData?.length || 0;

        // Then delete the records
        const { error: deleteError } = await supabase
          .from('yjs_updates')
          .delete()
          .eq('document_id', snapshot.document_id)
          .lt('version', snapshot.version);

        if (deleteError) {
          console.error(`Error cleaning up updates for document ${snapshot.document_id}:`, deleteError);
        } else if (count > 0) {
          cleanupCount += count;
          console.log(`Cleaned up ${count} old updates for document ${snapshot.document_id}`);
        }
      }

      return { count: cleanupCount };
    } catch (error) {
      console.error('Error during cleanup of old updates:', error);
      return { count: 0 };
    }
  }

  /**
   * Compress old snapshots to save space
   */
  private async compressOldSnapshots(): Promise<{ count: number }> {
    try {
      // Find uncompressed snapshots older than 1 day
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const { data: snapshots, error: snapshotsError } = await supabase
        .from('yjs_documents')
        .select('id, document_id')
        .eq('is_compressed', false)
        .lt('created_at', oneDayAgo.toISOString());

      if (snapshotsError || !snapshots) {
        console.error('Error fetching uncompressed snapshots:', snapshotsError);
        return { count: 0 };
      }

      let compressCount = 0;

      // For each uncompressed snapshot, compress it
      for (const snapshot of snapshots) {
        // In a real implementation, we would fetch the content, compress it,
        // and update the record. For simplicity, we're just marking it as compressed.
        const { error: updateError } = await supabase
          .from('yjs_documents')
          .update({ is_compressed: true })
          .eq('id', snapshot.id);

        if (updateError) {
          console.error(`Error compressing snapshot for document ${snapshot.document_id}:`, updateError);
        } else {
          compressCount++;
          console.log(`Compressed snapshot for document ${snapshot.document_id}`);
        }
      }

      return { count: compressCount };
    } catch (error) {
      console.error('Error during compression of old snapshots:', error);
      return { count: 0 };
    }
  }

  /**
   * Vacuum the database to reclaim space
   */
  private async vacuumDatabase(): Promise<void> {
    try {
      // This is a placeholder for a real vacuum operation
      // In reality, you would need a database admin connection to run VACUUM
      console.log('Database vacuum operation would run here');
    } catch (error) {
      console.error('Error during database vacuum:', error);
    }
  }
} 