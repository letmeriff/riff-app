import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://wezijqqdnoezwaqtybzo.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlemlqcXFkbm9lendhcXR5YnpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1NTAyNDUsImV4cCI6MjA1ODEyNjI0NX0.28i4EDB4-B5BZDJkfSnD-GMzz4iXTyQPDc_45d8c79o';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10, // Limit subscription messages per second
    },
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Create a channel with debug enabled for better error reporting
const channel = supabase.channel('system', {
  config: {
    broadcast: { self: true },
  },
});

// Subscribe to connection state changes
channel
  .on('system', { event: 'online' }, () => {
    console.log('Supabase Realtime: Connected');
  })
  .on('system', { event: 'offline' }, () => {
    console.warn('Supabase Realtime: Disconnected, attempting to reconnect...');
  })
  .on('system', { event: 'error' }, (error) => {
    console.error('Supabase Realtime error:', error);
  })
  .subscribe((status) => {
    console.log(`Supabase channel status: ${status}`);
  });
