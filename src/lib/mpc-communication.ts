/**
 * MPC Communication Layer
 * Handles real-time communication between participants for distributed signing
 * Uses WebSocket for signaling and data exchange
 */

import { MPCSession, ParticipantSession } from '@/lib/tss/types';
import { Round1Commitment, Round2Signature } from '@/lib/tss/types';

export interface MPCMessage {
  type: 'join' | 'leave' | 'round1_data' | 'round2_data' | 'signature_ready' | 'error';
  sessionId: string;
  participantId: string;
  data?: any;
  timestamp: string;
}

export interface ParticipantInfo {
  id: string;
  name: string;
  publicKey: string;
  deviceId: string;
  connected: boolean;
}

// Event types for subscription
export type MPCEventType = 
  | 'participant_joined'
  | 'participant_left'
  | 'round1_received'
  | 'round2_received'
  | 'signature_ready'
  | 'error'
  | 'connected'
  | 'disconnected';

export interface MPCEvent {
  type: MPCEventType;
  data?: any;
  participantId?: string;
}

type EventCallback = (event: MPCEvent) => void;

/**
 * MPC Communication Manager
 * Handles WebSocket connection and message routing
 */
export class MPC通信管理器 {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private deviceId: string;
  private sessionId: string | null = null;
  private eventHandlers: Map<MPCEventType, EventCallback[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(serverUrl: string = 'ws://localhost:8080') {
    this.serverUrl = serverUrl;
    this.deviceId = this.generateDeviceId();
  }

  /**
   * Generate a unique device ID
   */
  private generateDeviceId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Connect to the signaling server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          console.log('[MPC] Connected to signaling server');
          this.reconnectAttempts = 0;
          this.emit('connected', {});
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: MPCMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[MPC] Failed to parse message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('[MPC] Disconnected from signaling server');
          this.emit('disconnected', {});
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('[MPC] WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect to the server
   */
  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`[MPC] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch(console.error);
      }, delay);
    } else {
      console.error('[MPC] Max reconnect attempts reached');
      this.emit('error', { message: 'Connection lost. Please refresh the page.' });
    }
  }

  /**
   * Disconnect from the signaling server
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Join a signing session
   */
  async joinSession(sessionId: string, participant: ParticipantInfo): Promise<void> {
    this.sessionId = sessionId;
    
    const message: MPCMessage = {
      type: 'join',
      sessionId,
      participantId: participant.id,
      data: {
        name: participant.name,
        publicKey: participant.publicKey,
        deviceId: this.deviceId
      },
      timestamp: new Date().toISOString()
    };

    this.send(message);
  }

  /**
   * Leave a signing session
   */
  leaveSession(sessionId: string, participantId: string) {
    const message: MPCMessage = {
      type: 'leave',
      sessionId,
      participantId,
      timestamp: new Date().toISOString()
    };

    this.send(message);
    this.sessionId = null;
  }

  /**
   * Broadcast Round 1 commitment to all participants
   */
  broadcastRound1(sessionId: string, participantId: string, commitment: Round1Commitment) {
    const message: MPCMessage = {
      type: 'round1_data',
      sessionId,
      participantId,
      data: commitment,
      timestamp: new Date().toISOString()
    };

    this.send(message);
  }

  /**
   * Broadcast Round 2 signature share to all participants
   */
  broadcastRound2(sessionId: string, participantId: string, signature: Round2Signature) {
    const message: MPCMessage = {
      type: 'round2_data',
      sessionId,
      participantId,
      data: signature,
      timestamp: new Date().toISOString()
    };

    this.send(message);
  }

  /**
   * Send signature ready notification
   */
  sendSignatureReady(sessionId: string, participantId: string) {
    const message: MPCMessage = {
      type: 'signature_ready',
      sessionId,
      participantId,
      timestamp: new Date().toISOString()
    };

    this.send(message);
  }

  /**
   * Send a message through WebSocket
   */
  private send(message: MPCMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[MPC] WebSocket not connected, message queued');
      // In production, implement message queuing
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: MPCMessage) {
    switch (message.type) {
      case 'join':
        this.emit('participant_joined', message.data, message.participantId);
        break;
      case 'leave':
        this.emit('participant_left', {}, message.participantId);
        break;
      case 'round1_data':
        this.emit('round1_received', message.data, message.participantId);
        break;
      case 'round2_data':
        this.emit('round2_received', message.data, message.participantId);
        break;
      case 'signature_ready':
        this.emit('signature_ready', {}, message.participantId);
        break;
      case 'error':
        this.emit('error', message.data);
        break;
    }
  }

  /**
   * Subscribe to events
   */
  on(type: MPCEventType, callback: EventCallback) {
    const handlers = this.eventHandlers.get(type) || [];
    handlers.push(callback);
    this.eventHandlers.set(type, handlers);
  }

  /**
   * Unsubscribe from events
   */
  off(type: MPCEventType, callback: EventCallback) {
    const handlers = this.eventHandlers.get(type) || [];
    const index = handlers.indexOf(callback);
    if (index > -1) {
      handlers.splice(index, 1);
      this.eventHandlers.set(type, handlers);
    }
  }

  /**
   * Emit an event to subscribers
   */
  private emit(type: MPCEventType, data: any, participantId?: string) {
    const handlers = this.eventHandlers.get(type) || [];
    const event: MPCEvent = { type, data, participantId };
    handlers.forEach(callback => callback(event));
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Get device ID
   */
  getDeviceId(): string {
    return this.deviceId;
  }
}

// Singleton instance
let mpcManager: MPC通信管理器 | null = null;

/**
 * Get or create the MPC communication manager singleton
 */
export function getMPCManager(serverUrl?: string): MPC通信管理器 {
  if (!mpcManager && serverUrl) {
    mpcManager = new MPC通信管理器(serverUrl);
  }
  if (!mpcManager) {
    mpcManager = new MPC通信管理器();
  }
  return mpcManager;
}

/**
 * Reset the MPC manager (for testing or reconnection)
 */
export function resetMPCManager() {
  if (mpcManager) {
    mpcManager.disconnect();
    mpcManager = null;
  }
}
