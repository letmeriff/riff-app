/**
 * PerformanceMonitor Component
 * 
 * Displays real-time performance metrics for the Canvas component.
 * This component helps track rendering performance, memory usage, and
 * other metrics to identify optimization opportunities.
 */

import React, { useEffect, useState } from 'react';
import { PerformanceMetrics, measureRenderPerformance } from '../../../../utils/performance';

export interface PerformanceMonitorProps {
  enabled: boolean;
  metrics: PerformanceMetrics;
  position?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  onMetricsUpdate: (metrics: PerformanceMetrics) => void;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  enabled,
  metrics,
  position = { bottom: 20, right: 20 },
  onMetricsUpdate
}) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  const [stopMeasuring, setStopMeasuring] = useState<(() => void) | null>(null);
  
  // Start/stop performance measurement based on enabled prop
  useEffect(() => {
    if (enabled && !stopMeasuring) {
      // Start measuring performance
      const stopMeasuring = measureRenderPerformance((newMetrics) => {
        // Update parent state via callback
        onMetricsUpdate(newMetrics);
      });
      
      // Store stop function
      setStopMeasuring(() => stopMeasuring);
      
      // Clean up when component unmounts or disabled changes
      return () => {
        stopMeasuring();
        setStopMeasuring(null);
      };
    } else if (!enabled && stopMeasuring) {
      // Stop measuring if disabled
      stopMeasuring();
      setStopMeasuring(null);
    }
  }, [enabled, onMetricsUpdate]);
  
  // Don't render anything if not enabled
  if (!enabled) return null;
  
  // Styles
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    padding: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#fff',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
    zIndex: 1000,
    top: position.top !== undefined ? `${position.top}px` : undefined,
    right: position.right !== undefined ? `${position.right}px` : undefined,
    bottom: position.bottom !== undefined ? `${position.bottom}px` : undefined,
    left: position.left !== undefined ? `${position.left}px` : undefined,
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    userSelect: 'none',
    maxWidth: expanded ? '300px' : '160px',
    maxHeight: expanded ? '300px' : '30px',
    overflow: 'hidden'
  };
  
  const metricRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px'
  };
  
  const labelStyle: React.CSSProperties = {
    marginRight: '10px',
    opacity: 0.8
  };
  
  const valueStyle: React.CSSProperties = {
    fontWeight: 'bold'
  };
  
  // Toggle expanded state
  const toggleExpanded = () => setExpanded(prev => !prev);
  
  // Get color based on performance threshold
  const getPerformanceColor = (fps?: number): string => {
    if (!fps) return '#fff';
    if (fps >= 55) return '#4CAF50'; // Green for good performance
    if (fps >= 30) return '#FFC107'; // Yellow for acceptable performance
    return '#F44336'; // Red for poor performance
  };
  
  return (
    <div style={containerStyle} onClick={toggleExpanded} data-testid="performance-monitor">
      <div style={{ ...metricRowStyle, justifyContent: 'space-between' }}>
        <div style={labelStyle}>
          {expanded ? 'Performance Metrics' : 'FPS:'}
        </div>
        <div 
          style={{ 
            ...valueStyle, 
            color: getPerformanceColor(metrics.frameRate) 
          }}
        >
          {metrics.frameRate ? Math.round(metrics.frameRate) : '--'} FPS
        </div>
      </div>
      
      {expanded && (
        <>
          <div style={metricRowStyle}>
            <div style={labelStyle}>Frame Time:</div>
            <div style={valueStyle}>
              {metrics.renderTime ? metrics.renderTime.toFixed(2) : '--'} ms
            </div>
          </div>
          
          <div style={metricRowStyle}>
            <div style={labelStyle}>Memory:</div>
            <div style={valueStyle}>
              {metrics.memoryUsage ? metrics.memoryUsage.toFixed(1) : '--'} MB
            </div>
          </div>
          
          <div style={metricRowStyle}>
            <div style={labelStyle}>Nodes:</div>
            <div style={valueStyle}>{metrics.nodeCount || 0}</div>
          </div>
          
          <div style={metricRowStyle}>
            <div style={labelStyle}>Edges:</div>
            <div style={valueStyle}>{metrics.edgeCount || 0}</div>
          </div>
          
          <div style={{ fontSize: '10px', marginTop: '10px', opacity: 0.7 }}>
            Click to collapse
          </div>
        </>
      )}
    </div>
  );
};

export default PerformanceMonitor; 