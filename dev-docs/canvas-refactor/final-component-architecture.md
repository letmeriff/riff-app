# Final Canvas Component Architecture

## Architecture Diagram

```
CanvasPage (Container)
├── CanvasErrorBoundary
│   └── Canvas (ReactFlow Wrapper)
│       ├── ReactFlow Core Components
│       │   ├── Background
│       │   ├── Controls
│       │   └── MiniMap
│       ├── ChatNode (Custom Node)
│       ├── CanvasToolbar
│       │   ├── ZoomControls
│       │   ├── NodeCreationTools
│       │   └── ViewTools
│       ├── CollaborationOverlay
│       │   ├── UserCursors
│       │   └── SyncStatus
│       ├── NodeControls
│       │   ├── ContentEditor
│       │   └── NodeSettings
│       └── PerformanceMonitor
```

## Component Relationships

### Container Component

- **CanvasPage**: The main container component that coordinates all canvas functionality
  - Integrates all hooks into a cohesive user experience
  - Manages error handling with CanvasErrorBoundary
  - Controls feature flags for progressive enhancement
  - Provides a stable container for all canvas subcomponents

### Core Components

- **Canvas**: The ReactFlow wrapper component
  - Optimized with React.memo to prevent unnecessary re-renders
  - Provides consistent interface for ReactFlow
  - Manages background, controls, and minimap
  - Displays status indicators for offline and read-only modes

- **CanvasToolbar**: Toolbar for canvas manipulation
  - Provides zoom controls, node creation tools, and view tools
  - Offers buttons for common canvas operations
  - Adapts to different states (read-only, offline)
  
- **CollaborationOverlay**: Visualization of collaboration features
  - Displays user cursors and typing indicators
  - Shows synchronization status and offline mode
  - Provides visual feedback for collaborative editing

- **NodeControls**: Interface for node manipulation
  - Allows editing node content
  - Provides node customization options
  - Shows node relationships and connections

- **PerformanceMonitor**: Tool for monitoring canvas performance
  - Tracks render times, memory usage, and other metrics
  - Provides debug information for development
  - Can be toggled via feature flags

- **CanvasErrorBoundary**: Error handling component
  - Catches and displays errors in the canvas
  - Provides graceful degradation
  - Offers retry functionality for recoverable errors

## State Management

The refactored canvas uses custom hooks for state management:

- **useCanvasNodes**: Manages node data and operations
- **useCanvasEdges**: Handles edge data and operations
- **useYjsIntegration**: Coordinates real-time collaboration
- **useCanvasUI**: Manages UI state like selections and viewport

These hooks provide clear interfaces for accessing and manipulating canvas state, with separation of concerns for improved maintainability and testability.

## Data Flow

### Node Creation Flow

1. User clicks the "Add Node" button in CanvasToolbar
2. CanvasToolbar triggers handleAddNode in CanvasPage 
3. CanvasPage calls createNode from useCanvasNodes
4. useCanvasNodes creates the node locally
5. useYjsIntegration synchronizes the node to the Yjs document
6. The new node is rendered in the Canvas

### Node Selection Flow

1. User clicks on a node in the Canvas
2. Canvas triggers handleNodeClick in CanvasPage
3. CanvasPage updates the selected node ID in useCanvasUI
4. NodeControls updates to show the selected node's content
5. If onNodeSelect prop is provided, it's called with the node data

### Content Update Flow

1. User edits content in NodeControls
2. NodeControls triggers handleContentChange in CanvasPage
3. CanvasPage calls updateNodeContent from useCanvasNodes
4. useCanvasNodes updates the node data locally
5. useYjsIntegration synchronizes the changes to the Yjs document
6. Canvas re-renders with the updated content

## Feature Flags

The implementation uses feature flags for progressive enhancement:

- **ENABLE_PERFORMANCE_MONITORING**: Toggles the PerformanceMonitor
- **ENABLE_VIRTUALIZATION**: Enables node virtualization for performance
- **ENABLE_ERROR_REPORTING**: Controls error reporting behavior

These flags allow for gradual adoption of new features and easier testing.

## Error Handling

The canvas implements robust error handling:

1. CanvasErrorBoundary catches errors at the component level
2. Each handler in CanvasPage has try/catch blocks
3. Errors are logged and stored in state
4. Users are presented with helpful error messages
5. Critical functionality remains usable when possible

## Performance Optimizations

Several optimizations improve canvas performance:

1. **Component Memoization**: React.memo prevents unnecessary re-renders
2. **Hook Memoization**: useMemo and useCallback optimize functions and values
3. **Virtualization**: Only visible nodes are rendered when enabled
4. **Optimized Yjs Integration**: Changes are batched for efficiency
5. **Custom Throttling**: Event handlers use throttling for high-frequency events

## CSS Module Structure

CSS is organized using CSS Modules:

- **CanvasPage.module.css**: Styles for the container component
- **Canvas.module.css**: Styles for the ReactFlow wrapper
- **Component-specific modules**: Each subcomponent has its own module

This approach provides style encapsulation and prevents CSS conflicts.

## Testing Strategy

Components are tested with a comprehensive strategy:

1. **Unit Tests**: Each component and hook is tested in isolation
2. **Integration Tests**: Component interactions are verified
3. **Snapshot Tests**: UI regressions are caught early
4. **Performance Tests**: Key metrics are monitored

Test utilities provide mock implementations of ReactFlow and Yjs.

## Future Enhancements

Planned future enhancements include:

1. Advanced node virtualization with viewport-based rendering
2. Improved offline support with conflict resolution
3. Enhanced collaboration features like comments and suggestions
4. Better accessibility for keyboard navigation
5. Expanded mobile support with responsive design 