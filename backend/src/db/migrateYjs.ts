import fs from 'fs';
import path from 'path';
import { supabase } from '../config/supabase';

/**
 * Apply Yjs-related database migrations
 */
async function applyYjsMigrations() {
  try {
    console.log('Applying Yjs database migrations...');
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'migrations', '01_yjs_tables.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the SQL commands
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSql });
    
    if (error) {
      console.error('Error applying Yjs migrations:', error);
      return false;
    }
    
    console.log('Yjs database migrations applied successfully');
    return true;
  } catch (error) {
    console.error('Exception applying Yjs migrations:', error);
    return false;
  }
}

export default applyYjsMigrations; 