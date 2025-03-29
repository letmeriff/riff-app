import { supabase } from '../config/supabase';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script to apply Yjs table migrations
 *
 * Usage:
 * ts-node src/scripts/apply-yjs-migration.ts
 */

async function applyMigration(filePath: string): Promise<void> {
  try {
    console.log(`Applying migration from ${filePath}...`);
    const sql = fs.readFileSync(filePath, 'utf8');

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error(`Error applying migration: ${error.message}`);
      throw error;
    }

    console.log(`Migration from ${filePath} applied successfully.`);
  } catch (err) {
    console.error(`Failed to apply migration: ${err}`);
    process.exit(1);
  }
}

async function main() {
  // Get all migration files
  const migrationsDir = path.join(__dirname, '../../sql/migrations');
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  console.log(`Found ${migrationFiles.length} migration files.`);

  // Apply migrations in order
  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    await applyMigration(filePath);
  }

  console.log('All migrations applied successfully.');
}

main().catch(console.error);
