/**
 * Device Management Service
 * Handles multi-device support, device registration, and share refresh workflows
 * for MPC wallets using FROST threshold signatures
 */

import {
  Device,
  DeviceStatus,
  DeviceRegistrationRequest,
  DeviceRegistrationResponse,
  DeviceManagementSession,
  SessionType,
  SessionStatus,
  ShareRefreshSession,
  RefreshRound,
  RefreshParticipant,
  ShareRefreshMessage,
  DeviceManagementEvent,
  DeviceManagementEventType,
  DeviceManagementConfig,
  DEFAULT_DEVICE_MANAGEMENT_CONFIG,
  SharePackage,
  DeviceManagementResponse,
} from './device-management';
import { MPC通信管理器, MPCEvent, MPCEventType } from '../mpc-communication';
import { uint8ArrayToBase64, base64ToUint8Array } from '../utils';

// WASM module will be loaded asynchronously
let wasmModule: any = null;

interface WalletDeviceState {
  walletId: string;
  devices: Map<string, Device>;
  currentDeviceId: string;
  publicKey: Uint8Array;
  threshold: number;
  config: DeviceManagementConfig;
}

/**
 * Load the FROST WASM module
 */
export async function loadWasmModule(): Promise<any> {
  if (wasmModule) return wasmModule;
  
  try {
    // Always use mock mode to avoid import errors during SSR
    // In production, this would dynamically load the real WASM module
    return createMockWasmModule();
  } catch (error) {
    console.warn('[DeviceManager] WASM module not available, using mock mode:', error);
    return createMockWasmModule();
  }
}

/**
 * Create a mock WASM module for development/testing
 */
function createMockWasmModule() {
  return {
    frost_dkg_init: (numParticipants: number, threshold: number) => {
      console.log('[Mock] DKG Init:', numParticipants, threshold);
      return 1;
    },
    frost_get_num_participants: (walletId: number) => {
      return 3;
    },
    frost_get_participant_ids: (walletId: number) => {
      return [1, 2, 3];
    },
    frost_has_participant: (walletId: number, participantId: number) => {
      return true;
    },
    frost_sign_round1: (walletId: number, participantId: number) => {
      return new Uint8Array(64);
    },
    frost_sign_round2: (walletId: number, participantId: number, commitments: Uint8Array, message: Uint8Array) => {
      return new Uint8Array(32);
    },
    frost_aggregate_signatures: (walletId: number) => {
      return new Uint8Array(64);
    },
    frost_destroy_wallet: (walletId: number) => {
      console.log('[Mock] Destroy wallet:', walletId);
    },
  };
}

/**
 * Device Management Service Class
 */
export class DeviceManagementService {
  private sessions: Map<string, DeviceManagementSession> = new Map();
  private refreshSessions: Map<string, ShareRefreshSession> = new Map();
  private eventHandlers: Map<string, Set<(event: DeviceManagementEvent) => void>> = new Map();
  private mpcManager: MPC通信管理器;
  private config: DeviceManagementConfig;
  
  constructor(mpcManager: MPC通信管理器, config?: Partial<DeviceManagementConfig>) {
    this.mpcManager = mpcManager;
    this.config = { ...DEFAULT_DEVICE_MANAGEMENT_CONFIG, ...config };
    this.setupMPCEventHandlers();
  }

  /**
   * Setup MPC event handlers for device management
   */
  private setupMPCEventHandlers(): void {
    const eventTypes: MPCEventType[] = [
      'participant_joined',
      'participant_left',
      'round1_received',
      'round2_received',
      'signature_ready',
    ];
    
    eventTypes.forEach(type => {
      this.mpcManager.on(type, (event: MPCEvent) => {
        this.handleMPCEvent(type, event);
      });
    });
  }

  /**
   * Handle MPC events for device management
   */
  private handleMPCEvent(type: MPCEventType, event: MPCEvent): void {
    console.log(`[DeviceManager] Handling MPC event: ${type}`, event);
    
    switch (type) {
      case 'participant_joined':
        this.emit('device_registered', event.data?.['walletId'] as string, event.participantId);
        break;
      case 'participant_left':
        this.emit('device_removed', event.data?.['walletId'] as string, event.participantId);
        break;
    }
  }

  // =========================================================================
  // Device Registration
  // =========================================================================

  /**
   * Register a new device to the wallet
   */
  async registerDevice(request: DeviceRegistrationRequest): Promise<DeviceRegistrationResponse> {
    console.log('[DeviceManager] Registering device:', request.deviceName);
    
    try {
      // Generate new participant ID
      const participantId = this.generateParticipantId(request.walletId);
      
      // Create device record
      const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const device: Device = {
        id: deviceId,
        name: request.deviceName,
        publicKey: request.devicePublicKey,
        verifyingShare: '', // Will be filled after DKG
        participantId,
        isCurrentDevice: false,
        lastActive: new Date().toISOString(),
        status: 'pending',
      };
      
      // Create registration session
      const sessionId = `session_${Date.now()}`;
      const session: DeviceManagementSession = {
        id: sessionId,
        type: 'device_registration',
        walletId: request.walletId,
        initiatorId: request.requestedBy,
        participants: [deviceId],
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.config.sessionTimeoutMinutes * 60 * 1000).toISOString(),
        data: {
          device,
          participantId,
        },
      };
      
      this.sessions.set(sessionId, session);
      
      // If we have the WASM module, we could trigger a share refresh to include the new device
      // For now, we emit an event to let the UI handle the flow
      
      this.emit('session_created', request.walletId, deviceId, sessionId);
      
      return {
        success: true,
        deviceId,
        participantId,
        error: undefined,
      };
    } catch (error) {
      console.error('[DeviceManager] Device registration failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Complete device registration after share transfer
   */
  async completeDeviceRegistration(
    sessionId: string,
    sharePackage: SharePackage
  ): Promise<DeviceManagementResponse> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }
    
    try {
      // Validate share package
      if (!this.validateSharePackage(sharePackage)) {
        return { success: false, error: 'Invalid share package' };
      }
      
      // Update device status
      const device = session.data?.['device'] as Device;
      if (device) {
        device.status = 'active';
        device.verifyingShare = sharePackage.verificationData;
        device.isCurrentDevice = true;
      }
      
      // Update session status
      session.status = 'completed';
      
      this.emit('session_completed', session.walletId, device?.id, sessionId);
      
      return { success: true, sessionId };
    } catch (error) {
      console.error('[DeviceManager] Failed to complete registration:', error);
      session.status = 'failed';
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // =========================================================================
  // Share Refresh
  // =========================================================================

  /**
   * Start a share refresh session
   */
  async startShareRefresh(walletId: string, reason: 'routine' | 'compromise' | 'device_change' | 'periodic_rotation'): Promise<DeviceManagementResponse> {
    console.log(`[DeviceManager] Starting share refresh for wallet: ${walletId}, reason: ${reason}`);
    
    try {
      // Load WASM if not loaded
      await loadWasmModule();
      
      // Get current participants
      const numParticipants = wasmModule.frost_get_num_participants(parseInt(walletId));
      const participantIds = wasmModule.frost_get_participant_ids(parseInt(walletId));
      
      if (participantIds.length < 2) {
        return { success: false, error: 'Need at least 2 participants for refresh' };
      }
      
      // Create refresh session
      const sessionId = `refresh_${Date.now()}`;
      const participants: RefreshParticipant[] = participantIds.map((id: number) => ({
        participantId: id,
        deviceId: `device_${id}`,
        status: 'pending',
      }));
      
      const session: ShareRefreshSession = {
        id: sessionId,
        walletId,
        round: 'round1',
        participants,
        threshold: Math.ceil(participantIds.length / 2),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      
      this.refreshSessions.set(sessionId, session);
      
      // Broadcast refresh start to all participants
      await this.broadcastRefreshMessage({
        sessionId,
        round: 'round1',
        fromParticipantId: participantIds[0],
        broadcast: true,
        data: JSON.stringify({ action: 'start_refresh', reason }),
        timestamp: new Date().toISOString(),
      });
      
      this.emit('share_refresh_started', walletId, undefined, sessionId);
      
      return { success: true, sessionId };
    } catch (error) {
      console.error('[DeviceManager] Failed to start share refresh:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process round 1 of share refresh
   */
  async processRound1(sessionId: string, participantId: number): Promise<DeviceManagementResponse> {
    const session = this.refreshSessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }
    
    if (session.round !== 'round1') {
      return { success: false, error: 'Not in round 1' };
    }
    
    try {
      // Load WASM if not loaded
      await loadWasmModule();
      
      // Generate round 1 commitments
      const walletIdNum = parseInt(session.walletId);
      const round1Data = wasmModule.frost_sign_round1(walletIdNum, participantId);
      const round1Base64 = uint8ArrayToBase64(round1Data);
      
      // Update participant status
      const participant = session.participants.find(p => p.participantId === participantId);
      if (participant) {
        participant.round1Data = round1Base64;
        participant.status = 'contributed';
      }
      
      // Check if all participants have contributed
      const contributedCount = session.participants.filter(p => p.status === 'contributed').length;
      if (contributedCount >= session.threshold) {
        session.round = 'round2';
        
        // Broadcast round 2 start
        await this.broadcastRefreshMessage({
          sessionId,
          round: 'round2',
          fromParticipantId: participantId,
          broadcast: true,
          data: JSON.stringify({ action: 'start_round2' }),
          timestamp: new Date().toISOString(),
        });
      }
      
      return { success: true, sessionId, data: { round1Data: round1Base64 } };
    } catch (error) {
      console.error('[DeviceManager] Round 1 failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process round 2 of share refresh
   */
  async processRound2(
    sessionId: string,
    participantId: number,
    allCommitments: string
  ): Promise<DeviceManagementResponse> {
    const session = this.refreshSessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }
    
    if (session.round !== 'round2') {
      return { success: false, error: 'Not in round 2' };
    }
    
    try {
      // Load WASM if not loaded
      await loadWasmModule();
      
      // Parse commitments
      const commitments = base64ToUint8Array(allCommitments);
      const message = new Uint8Array(32); // Dummy message for refresh
      
      const walletIdNum = parseInt(session.walletId);
      const round2Data = wasmModule.frost_sign_round2(walletIdNum, participantId, commitments, message);
      const round2Base64 = uint8ArrayToBase64(round2Data);
      
      // Update participant status
      const participant = session.participants.find(p => p.participantId === participantId);
      if (participant) {
        participant.round2Data = round2Base64;
        participant.status = 'completed';
      }
      
      // Check if all participants have completed
      const completedCount = session.participants.filter(p => p.status === 'completed').length;
      if (completedCount >= session.threshold) {
        // Finalize refresh
        await this.finalizeRefresh(sessionId);
      }
      
      return { success: true, sessionId, data: { round2Data: round2Base64 } };
    } catch (error) {
      console.error('[DeviceManager] Round 2 failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Finalize the share refresh session
   */
  private async finalizeRefresh(sessionId: string): Promise<void> {
    const session = this.refreshSessions.get(sessionId);
    if (!session) return;
    
    try {
      // Load WASM if not loaded
      await loadWasmModule();
      
      const walletIdNum = parseInt(session.walletId);
      
      // Aggregate signatures to complete refresh
      wasmModule.frost_aggregate_signatures(walletIdNum);
      
      session.status = 'completed';
      session.completedAt = new Date().toISOString();
      session.round = 'completed';
      
      this.emit('share_refresh_completed', session.walletId, undefined, sessionId);
      
      console.log(`[DeviceManager] Share refresh completed for session: ${sessionId}`);
    } catch (error) {
      console.error('[DeviceManager] Failed to finalize refresh:', error);
      session.status = 'failed';
      this.emit('share_refresh_failed', session.walletId, undefined, sessionId);
    }
  }

  // =========================================================================
  // Device Removal
  // =========================================================================

  /**
   * Remove a device from the wallet
   */
  async removeDevice(walletId: string, participantId: number): Promise<DeviceManagementResponse> {
    console.log(`[DeviceManager] Removing device ${participantId} from wallet ${walletId}`);
    
    try {
      // Create removal session
      const sessionId = `remove_${Date.now()}`;
      const session: DeviceManagementSession = {
        id: sessionId,
        type: 'device_removal',
        walletId,
        initiatorId: 'current_device',
        participants: [`device_${participantId}`],
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.config.sessionTimeoutMinutes * 60 * 1000).toISOString(),
        data: { participantIdToRemove: participantId },
      };
      
      this.sessions.set(sessionId, session);
      
      // Start share refresh to redistribute shares
      await this.startShareRefresh(walletId, 'device_change');
      
      return { success: true, sessionId };
    } catch (error) {
      console.error('[DeviceManager] Failed to remove device:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // =========================================================================
  // Event Handling
  // =========================================================================

  /**
   * Subscribe to device management events
   */
  on(eventType: string, callback: (event: DeviceManagementEvent) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(callback);
  }

  /**
   * Unsubscribe from device management events
   */
  off(eventType: string, callback: (event: DeviceManagementEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(callback);
    }
  }

  /**
   * Emit a device management event
   */
  private emit(type: DeviceManagementEventType, walletId: string, deviceId?: string, sessionId?: string): void {
    const event: DeviceManagementEvent = {
      type,
      walletId,
      deviceId,
      sessionId,
      timestamp: new Date().toISOString(),
    };
    
    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      handlers.forEach(callback => callback(event));
    }
  }

  // =========================================================================
  // Private Helper Methods
  // =========================================================================

  /**
   * Generate a new participant ID
   */
  private generateParticipantId(walletId: string): number {
    // Simple ID generation - in production, use a more robust method
    return Math.floor(Math.random() * 1000) + 1;
  }

  /**
   * Validate a share package
   */
  private validateSharePackage(pkg: SharePackage): boolean {
    if (pkg.version !== '1.0') return false;
    if (!pkg.walletId || !pkg.keyShareData) return false;
    if (new Date(pkg.expiresAt) < new Date()) return false;
    return true;
  }

  /**
   * Broadcast a refresh message to all participants
   */
  private async broadcastRefreshMessage(message: ShareRefreshMessage): Promise<void> {
    // This would use the MPC communication manager to broadcast
    console.log('[DeviceManager] Broadcasting refresh message:', message);
    
    // In a real implementation, this would send the message via WebSocket
    // to all connected participants
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): DeviceManagementSession[] {
    return Array.from(this.sessions.values()).filter(
      s => s.status === 'pending' || s.status === 'in_progress'
    );
  }

  /**
   * Get refresh session by ID
   */
  getRefreshSession(sessionId: string): ShareRefreshSession | undefined {
    return this.refreshSessions.get(sessionId);
  }

  /**
   * Cancel a session
   */
  cancelSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'cancelled';
      return true;
    }
    return false;
  }
}

// Export a singleton instance factory
let deviceManagerInstance: DeviceManagementService | null = null;

export function getDeviceManagementService(
  mpcManager?: MPC通信管理器,
  config?: Partial<DeviceManagementConfig>
): DeviceManagementService {
  if (!deviceManagerInstance && mpcManager) {
    deviceManagerInstance = new DeviceManagementService(mpcManager, config);
  }
  return deviceManagerInstance!;
}
