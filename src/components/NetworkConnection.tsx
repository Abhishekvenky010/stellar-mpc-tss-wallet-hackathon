'use client';

import { useState, useEffect } from 'react';
import { sessionManager } from '@/lib/session';

interface NetworkConnectionProps {
  onConnectionChange?: (connected: boolean) => void;
}

export default function NetworkConnection({ onConnectionChange }: NetworkConnectionProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [serverUrl, setServerUrl] = useState('ws://localhost:8080');
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check initial connection status
    setIsConnected(sessionManager.isConnected());
    
    // Set up polling for connection status
    const interval = setInterval(() => {
      const connected = sessionManager.isConnected();
      setIsConnected(connected);
      onConnectionChange?.(connected);
    }, 2000);

    return () => clearInterval(interval);
  }, [onConnectionChange]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const success = await sessionManager.enableNetworkMode(serverUrl);
      setIsConnected(success);
      onConnectionChange?.(success);
      
      if (!success) {
        setError('Failed to connect. Make sure the signaling server is running.');
      }
    } catch (err) {
      setError(`Connection error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsConnected(false);
      onConnectionChange?.(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    sessionManager.disableNetworkMode();
    setIsConnected(false);
    onConnectionChange?.(false);
  };

  return (
    <div className="card rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${
            isConnected 
              ? 'bg-green-400 animate-pulse' 
              : isConnecting 
                ? 'bg-yellow-400 animate-pulse'
                : 'bg-gray-500'
          }`}></div>
          <div>
            <h4 className="text-white font-medium">
              {isConnected 
                ? '🟢 Connected to Network' 
                : isConnecting 
                  ? '🟡 Connecting...' 
                  : '⚪ Offline Mode'
              }
            </h4>
            <p className="text-sm text-gray-400">
              {isConnected 
                ? 'Participants can join from any device' 
                : 'All activity stays on this device'
              }
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              className="btn-secondary px-4 py-2 text-sm text-white rounded-lg"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="btn-primary px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
          )}
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Signaling Server URL
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="ws://localhost:8080"
              className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 input-field"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Run the signaling server: <code className="text-gray-400">node server/mpc-signaling-server.js</code>
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Connection Info */}
      {isConnected && (
        <div className="mt-4 p-3 bg-white/5 rounded-lg">
          <p className="text-xs text-gray-400">
            <strong className="text-gray-300">Server:</strong> {serverUrl}<br/>
            <strong className="text-gray-300">Mode:</strong> Multi-device network communication enabled
          </p>
        </div>
      )}
    </div>
  );
}
