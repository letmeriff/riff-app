import React, { useEffect, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

const ConnectionStatus: React.FC = () => {
  const { connectionStatus } = useSocket();
  const [supabaseStatus, setSupabaseStatus] = useState<string>('unknown');
  const [isExpanded, setIsExpanded] = useState(false);

  // Check Supabase connection periodically
  useEffect(() => {
    const checkSupabaseConnection = async () => {
      try {
        // Simple health check
        const startTime = Date.now();
        await fetch('https://wezijqqdnoezwaqtybzo.supabase.co/rest/v1/', {
          headers: {
            apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlemlqcXFkbm9lendhcXR5YnpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1NTAyNDUsImV4cCI6MjA1ODEyNjI0NX0.28i4EDB4-B5BZDJkfSnD-GMzz4iXTyQPDc_45d8c79o'
          }
        });
        const pingTime = Date.now() - startTime;
        setSupabaseStatus(`connected (${pingTime}ms)`);
      } catch (error) {
        console.error('Supabase connection error:', error);
        setSupabaseStatus('disconnected');
      }
    };

    checkSupabaseConnection();
    const interval = setInterval(checkSupabaseConnection, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'connected':
        return '#4CAF50'; // Green
      case 'connecting':
        return '#FFC107'; // Yellow
      case 'disconnected':
      case 'error':
        return '#F44336'; // Red
      default:
        return '#9E9E9E'; // Grey
    }
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div 
      style={{ 
        cursor: 'pointer', 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start'
      }}
      onClick={toggleExpand}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div 
          style={{ 
            width: '10px', 
            height: '10px', 
            borderRadius: '50%', 
            background: getStatusColor(connectionStatus),
            marginRight: '5px'
          }} 
        />
        <span>
          {connectionStatus === 'connected' ? 'Online' : 
           connectionStatus === 'connecting' ? 'Connecting...' : 
           connectionStatus === 'disconnected' ? 'Offline' :
           'Connection Error'}
        </span>
      </div>

      {isExpanded && (
        <div style={{ 
          marginTop: '5px', 
          fontSize: '12px', 
          padding: '5px', 
          background: '#f5f5f5',
          borderRadius: '3px',
          maxWidth: '200px'
        }}>
          <div>Socket.IO: {connectionStatus}</div>
          <div>Supabase: {supabaseStatus}</div>
          <div>WebSocket Support: {window.WebSocket ? 'Yes' : 'No'}</div>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus; 