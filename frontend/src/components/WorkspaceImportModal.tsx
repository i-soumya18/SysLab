/**
 * Workspace Import Modal Component
 * Handles workspace import functionality with file upload and validation
 */

import React, { useState, useRef } from 'react';
import { WorkspaceApiService } from '../services/workspaceApi';
import type { WorkspaceExportFormat, WorkspaceImportValidation } from '../services/workspaceApi';

interface WorkspaceImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (workspace: any) => void;
  userId: string;
}

export const WorkspaceImportModal: React.FC<WorkspaceImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  userId
}) => {
  const [exportData, setExportData] = useState<WorkspaceExportFormat | null>(null);
  const [validation, setValidation] = useState<WorkspaceImportValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setExportData(null);
    setValidation(null);
    setWorkspaceName('');
    setWorkspaceDescription('');
    setError(null);
    setIsValidating(false);
    setIsImporting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setValidation(null);
    setExportData(null);

    try {
      const fileContent = await WorkspaceApiService.readFileContent(file);
      const parsedData = WorkspaceApiService.parseExportFile(fileContent);
      
      setExportData(parsedData);
      setWorkspaceName(parsedData.workspace.name);
      setWorkspaceDescription(parsedData.workspace.description || '');
      
      // Auto-validate the file
      await validateImport(parsedData);
    } catch (err: any) {
      setError(err.message || 'Failed to parse import file');
    }
  };

  const validateImport = async (data: WorkspaceExportFormat) => {
    setIsValidating(true);
    setError(null);

    try {
      const validationResult = await WorkspaceApiService.validateWorkspaceImport(data);
      setValidation(validationResult);
    } catch (err: any) {
      setError(err.message || 'Failed to validate import data');
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!exportData || !validation?.isValid) return;

    setIsImporting(true);
    setError(null);

    try {
      const result = await WorkspaceApiService.importWorkspace({
        name: workspaceName,
        description: workspaceDescription,
        userId,
        exportData
      });

      if (result.workspace) {
        onImportSuccess(result.workspace);
        handleClose();
      } else {
        setError('Import failed: No workspace data returned');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to import workspace');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        width: '600px',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
            Import Workspace
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666'
            }}
          >
            ×
          </button>
        </div>

        {/* File Upload Section */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#333'
          }}>
            Select Export File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
          <p style={{
            margin: '4px 0 0 0',
            fontSize: '12px',
            color: '#666'
          }}>
            Select a JSON export file from another workspace
          </p>
        </div>

        {/* Workspace Details */}
        {exportData && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                Workspace Name
              </label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                Description (Optional)
              </label>
              <textarea
                value={workspaceDescription}
                onChange={(e) => setWorkspaceDescription(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>
        )}

        {/* Validation Results */}
        {isValidating && (
          <div style={{
            padding: '12px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            marginBottom: '20px'
          }}>
            <p style={{ margin: 0, fontSize: '14px' }}>
              Validating import data...
            </p>
          </div>
        )}

        {validation && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              padding: '12px',
              backgroundColor: validation.isValid ? '#d4edda' : '#f8d7da',
              border: `1px solid ${validation.isValid ? '#c3e6cb' : '#f5c6cb'}`,
              borderRadius: '4px',
              marginBottom: '12px'
            }}>
              <h4 style={{
                margin: '0 0 8px 0',
                fontSize: '14px',
                color: validation.isValid ? '#155724' : '#721c24'
              }}>
                {validation.isValid ? 'Validation Passed' : 'Validation Failed'}
              </h4>
              <div style={{ fontSize: '12px' }}>
                <p style={{ margin: '0 0 4px 0' }}>
                  Components: {validation.summary.componentCount}
                </p>
                <p style={{ margin: '0' }}>
                  Connections: {validation.summary.connectionCount}
                </p>
              </div>
            </div>

            {validation.errors.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <h5 style={{
                  margin: '0 0 8px 0',
                  fontSize: '14px',
                  color: '#721c24'
                }}>
                  Errors:
                </h5>
                <ul style={{
                  margin: 0,
                  paddingLeft: '20px',
                  fontSize: '12px',
                  color: '#721c24'
                }}>
                  {validation.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div>
                <h5 style={{
                  margin: '0 0 8px 0',
                  fontSize: '14px',
                  color: '#856404'
                }}>
                  Warnings:
                </h5>
                <ul style={{
                  margin: 0,
                  paddingLeft: '20px',
                  fontSize: '12px',
                  color: '#856404'
                }}>
                  {validation.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            marginBottom: '20px',
            color: '#721c24',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            onClick={handleClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!validation?.isValid || isImporting || !workspaceName.trim()}
            style={{
              padding: '8px 16px',
              backgroundColor: validation?.isValid && workspaceName.trim() ? '#28a745' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: validation?.isValid && workspaceName.trim() ? 'pointer' : 'not-allowed',
              fontSize: '14px'
            }}
          >
            {isImporting ? 'Importing...' : 'Import Workspace'}
          </button>
        </div>
      </div>
    </div>
  );
};