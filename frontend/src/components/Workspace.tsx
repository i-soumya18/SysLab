/**
 * Workspace Component - Main application workspace
 * Combines the component palette and canvas with drag-and-drop functionality
 */

import React, { useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Canvas } from './Canvas';
import { ComponentPalette } from './ComponentPalette';
import { StatusBar } from './StatusBar';
import { WorkspaceImportModal } from './WorkspaceImportModal';
import { WorkspaceApiService } from '../services/workspaceApi';
import type { Component } from '../types';

export const Workspace: React.FC = () => {
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [componentCount, setComponentCount] = useState<number>(0);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [currentWorkspaceId] = useState<string>('demo-workspace-id'); // TODO: Replace with actual workspace ID
  const [currentUserId] = useState<string>('demo-user-id'); // TODO: Replace with actual user ID

  const handleComponentAdd = (component: Component) => {
    console.log('Component added:', component);
  };

  const handleComponentSelect = (component: Component | null) => {
    setSelectedComponent(component);
    console.log('Component selected:', component);
  };

  const handleComponentUpdate = (component: Component) => {
    console.log('Component updated:', component);
  };

  const handleComponentDelete = (componentId: string) => {
    console.log('Component deleted:', componentId);
  };

  const handleComponentCountChange = (count: number) => {
    setComponentCount(count);
  };

  const handleExportWorkspace = async () => {
    try {
      await WorkspaceApiService.downloadWorkspaceExport(
        currentWorkspaceId,
        currentUserId,
        'System Design Simulator User'
      );
    } catch (error: any) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error.message}`);
    }
  };

  const handleImportSuccess = (workspace: any) => {
    console.log('Workspace imported successfully:', workspace);
    alert(`Workspace "${workspace.name}" imported successfully!`);
    // TODO: Reload the workspace or update the UI with the imported workspace
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div style={{
        display: 'flex',
        height: '100vh',
        backgroundColor: '#f5f5f5',
        fontFamily: 'Arial, sans-serif'
      }}>
        {/* Component Palette */}
        <div style={{
          width: '220px',
          backgroundColor: '#fff',
          borderRight: '1px solid #e0e0e0',
          padding: '10px'
        }}>
          <ComponentPalette />
        </div>
        {/* Component Palette */}
        <div style={{
          width: '220px',
          backgroundColor: '#fff',
          borderRight: '1px solid #e0e0e0',
          padding: '10px'
        }}>
          <ComponentPalette />
        </div>

        {/* Main Canvas Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '20px'
        }}>
          {/* Toolbar */}
          <div style={{
            height: '60px',
            backgroundColor: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            marginBottom: '20px',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h1 style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#333'
            }}>
              System Design Simulator
            </h1>
            
            <div style={{
              display: 'flex',
              gap: '10px'
            }}>
              <button
                onClick={() => setIsImportModalOpen(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Import Workspace
              </button>
              <button
                onClick={handleExportWorkspace}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ffc107',
                  color: '#212529',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Export Workspace
              </button>
              <button style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                Save Workspace
              </button>
              <button style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                Run Simulation
              </button>
            </div>
          </div>

          {/* Canvas Container */}
          <div style={{
            flex: 1,
            display: 'flex',
            gap: '20px'
          }}>
            {/* Canvas */}
            <div style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start'
            }}>
              <Canvas
                width={1000}
                height={600}
                onComponentAdd={handleComponentAdd}
                onComponentSelect={handleComponentSelect}
                onComponentUpdate={handleComponentUpdate}
                onComponentDelete={handleComponentDelete}
                onComponentCountChange={handleComponentCountChange}
              />
            </div>

            {/* Properties Panel */}
            <div style={{
              width: '300px',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '20px'
            }}>
              <h3 style={{
                margin: '0 0 16px 0',
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                Properties
              </h3>
              
              {selectedComponent ? (
                <div>
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>
                      Component Details
                    </h4>
                    <p style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>
                      {selectedComponent.metadata.name}
                    </p>
                    <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
                      {selectedComponent.metadata.description}
                    </p>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>
                      Configuration
                    </h4>
                    <div style={{ fontSize: '12px', color: '#333' }}>
                      <div style={{ marginBottom: '4px' }}>
                        <strong>Capacity:</strong> {selectedComponent.configuration.capacity}
                      </div>
                      <div style={{ marginBottom: '4px' }}>
                        <strong>Latency:</strong> {selectedComponent.configuration.latency}ms
                      </div>
                      <div style={{ marginBottom: '4px' }}>
                        <strong>Failure Rate:</strong> {(selectedComponent.configuration.failureRate * 100).toFixed(3)}%
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>
                      Position
                    </h4>
                    <div style={{ fontSize: '12px', color: '#333' }}>
                      <div style={{ marginBottom: '4px' }}>
                        <strong>X:</strong> {selectedComponent.position.x}px
                      </div>
                      <div>
                        <strong>Y:</strong> {selectedComponent.position.y}px
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{
                  color: '#666',
                  fontSize: '14px',
                  fontStyle: 'italic'
                }}>
                  Select a component to view its properties
                </p>
              )}
            </div>
          </div>

          {/* Status Bar */}
          <div style={{ marginTop: '10px' }}>
            <StatusBar
              selectedComponent={selectedComponent}
              componentCount={componentCount}
            />
          </div>
        </div>
      </div>

      {/* Import Modal */}
      <WorkspaceImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
        userId={currentUserId}
      />
    </DndProvider>
  );
};