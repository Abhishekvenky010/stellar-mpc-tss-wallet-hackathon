/**
 * Device Management Component
 * Provides UI for managing multi-device support in MPC wallets
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Device, DeviceStatus, ShareRefreshSession } from '@/lib/tss/device-management';
import { DeviceManagementService } from '@/lib/tss/device-management-service';
import { MPC通信管理器 } from '@/lib/mpc-communication';

interface DeviceManagerProps {
  walletId: string;
  currentDeviceId: string;
  currentParticipantId: number;
  mpcManager: MPC通信管理器;
  onDeviceAdded?: (device: Device) => void;
  onDeviceRemoved?: (deviceId: string) => void;
  onRefreshCompleted?: () => void;
}

export default function DeviceManager({
  walletId,
  currentDeviceId,
  currentParticipantId,
  mpcManager,
  onDeviceAdded,
  onDeviceRemoved,
  onRefreshCompleted,
}: DeviceManagerProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [refreshSessions, setRefreshSessions] = useState<ShareRefreshSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [refreshReason, setRefreshReason] = useState<'routine' | 'compromise' | 'device_change' | 'periodic_rotation'>('routine');

  // Initialize device management service
  const [deviceManager] = useState(() => {
    const service = new DeviceManagementService(mpcManager);
    
    // Set up event handlers
    service.on('device_registered', (event) => {
      console.log('Device registered:', event);
      if (event.deviceId) {
        // Refresh device list
        fetchDevices();
      }
    });
    
    service.on('device_removed', (event) => {
      console.log('Device removed:', event);
      if (event.deviceId) {
        setDevices(prev => prev.filter(d => d.id !== event.deviceId));
        onDeviceRemoved?.(event.deviceId);
      }
    });
    
    service.on('share_refresh_completed', (event) => {
      console.log('Share refresh completed:', event);
      setIsLoading(false);
      setShowRefreshModal(false);
      onRefreshCompleted?.();
    });
    
    service.on('share_refresh_failed', (event) => {
      console.error('Share refresh failed:', event);
      setError('Share refresh failed. Please try again.');
      setIsLoading(false);
    });
    
    return service;
  });

  // Fetch connected devices
  const fetchDevices = useCallback(async () => {
    try {
      // In a real implementation, this would fetch from the server
      // For now, we'll use the device manager's session info
      const sessions = deviceManager.getActiveSessions();
      // Update devices state based on session data
      setDevices(prev => prev);
    } catch (err) {
      console.error('Failed to fetch devices:', err);
      setError('Failed to fetch devices');
    }
  }, [deviceManager]);

  // Add new device
  const handleAddDevice = async () => {
    if (!newDeviceName.trim()) {
      setError('Please enter a device name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Generate a key pair for the new device
      const newDevicePublicKey = await generateDeviceKeyPair();
      
      const response = await deviceManager.registerDevice({
        walletId,
        deviceName: newDeviceName,
        devicePublicKey: newDevicePublicKey,
        requestedBy: currentDeviceId,
      });

      if (response.success && response.participantId) {
        // Device registered, now trigger share refresh to include it
        setShowAddDevice(false);
        setNewDeviceName('');
        
        // Prompt user to start share refresh
        if (confirm('Device registered! Would you like to start a share refresh to activate the new device?')) {
          setShowRefreshModal(true);
        }
        
        onDeviceAdded?.({
          id: response.deviceId!,
          name: newDeviceName,
          publicKey: newDevicePublicKey,
          verifyingShare: '',
          participantId: response.participantId!,
          isCurrentDevice: false,
          lastActive: new Date().toISOString(),
          status: 'pending',
        });
      } else {
        setError(response.error || 'Failed to register device');
      }
    } catch (err) {
      console.error('Failed to add device:', err);
      setError(err instanceof Error ? err.message : 'Failed to add device');
    } finally {
      setIsLoading(false);
    }
  };

  // Remove device
  const handleRemoveDevice = async (deviceId: string, participantId: number) => {
    if (!confirm('Are you sure you want to remove this device? This will require a share refresh.')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await deviceManager.removeDevice(walletId, participantId);
      
      if (response.success) {
        setDevices(prev => prev.filter(d => d.id !== deviceId));
        onDeviceRemoved?.(deviceId);
      } else {
        setError(response.error || 'Failed to remove device');
      }
    } catch (err) {
      console.error('Failed to remove device:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove device');
    } finally {
      setIsLoading(false);
    }
  };

  // Start share refresh
  const handleStartRefresh = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await deviceManager.startShareRefresh(walletId, refreshReason);
      
      if (response.success) {
        // Wait for refresh to complete
        // The event handler will update the state
        setShowRefreshModal(false);
      } else {
        setError(response.error || 'Failed to start share refresh');
      }
    } catch (err) {
      console.error('Failed to start refresh:', err);
      setError(err instanceof Error ? err.message : 'Failed to start refresh');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate a key pair for a new device
  async function generateDeviceKeyPair(): Promise<string> {
    // In a real implementation, this would use Web Crypto API
    // to generate an Ed25519 key pair
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'Ed25519',
      },
      true,
      ['sign', 'verify']
    );
    
    // Export public key to base64
    const exportedKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    return Buffer.from(exportedKey).toString('base64');
  }

  // Check active refresh sessions
  useEffect(() => {
    const checkRefreshSessions = setInterval(() => {
      // Update refresh sessions list
      const activeSessions = deviceManager.getActiveSessions()
        .filter(s => s.type === 'share_refresh')
        .map(s => ({
          id: s.id,
          walletId: s.walletId,
          round: 'round1' as const,
          participants: [],
          threshold: 2,
          status: s.status as 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled',
          createdAt: s.createdAt,
        }));
      
      setRefreshSessions(activeSessions);
    }, 5000);

    return () => clearInterval(checkRefreshSessions);
  }, [deviceManager]);

  // Get status color
  const getStatusColor = (status: DeviceStatus): string => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-gray-400';
      case 'pending': return 'bg-yellow-500';
      case 'revoked': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="device-manager p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Device Management</h2>
      
      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {/* Device List */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Connected Devices</h3>
        <div className="space-y-2">
          {devices.length === 0 ? (
            <p className="text-gray-500">No devices connected</p>
          ) : (
            devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(device.status)}`} />
                  <div>
                    <p className="font-medium">{device.name}</p>
                    <p className="text-sm text-gray-500">
                      Participant #{device.participantId}
                      {device.isCurrentDevice && ' (This device)'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {device.id !== currentDeviceId && (
                    <button
                      onClick={() => handleRemoveDevice(device.id, device.participantId)}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                      disabled={isLoading}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Active Refresh Sessions */}
      {refreshSessions.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 rounded">
          <h3 className="text-sm font-semibold text-blue-700 mb-2">Active Refresh Sessions</h3>
          {refreshSessions.map((session) => (
            <div key={session.id} className="text-sm text-blue-600">
              Session {session.id.slice(-8)} - {session.status}
            </div>
          ))}
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={() => setShowAddDevice(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={isLoading}
        >
          Add Device
        </button>
        <button
          onClick={() => setShowRefreshModal(true)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          disabled={isLoading}
        >
          Refresh Shares
        </button>
      </div>
      
      {/* Add Device Modal */}
      {showAddDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Add New Device</h3>
            <input
              type="text"
              placeholder="Device Name"
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowAddDevice(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDevice}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading ? 'Adding...' : 'Add Device'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Refresh Modal */}
      {showRefreshModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Refresh Shares</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will generate new share material for all devices. 
              This is recommended periodically or after device changes.
            </p>
            <label className="block mb-2 text-sm font-medium">Reason:</label>
            <select
              value={refreshReason}
              onChange={(e) => setRefreshReason(e.target.value as typeof refreshReason)}
              className="w-full p-2 border border-gray-300 rounded mb-4"
            >
              <option value="routine">Routine Refresh</option>
              <option value="periodic_rotation">Periodic Rotation</option>
              <option value="device_change">Device Change</option>
              <option value="compromise">Potential Compromise</option>
            </select>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowRefreshModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleStartRefresh}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                disabled={isLoading}
              >
                {isLoading ? 'Starting...' : 'Start Refresh'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-40">
          <div className="bg-white p-4 rounded shadow">
            <p className="text-gray-700">Processing...</p>
          </div>
        </div>
      )}
    </div>
  );
}
