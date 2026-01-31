/**
 * MPC Session Manager for coordinating multi-party signing across devices
 * Supports both local browser tab communication and real network communication via WebSocket
 */

import { TSSWallet, TSSTransaction, MPCLogger, Round1Commitment, Round2Signature } from './tss/types';
import { storeWallets, loadWallets } from './storage';
import { 
  MPC通信管理器, 
  getMPCManager, 
  resetMPCManager,
  MPCEvent,
  ParticipantInfo 
} from './mpc-communication';

export interface MPCSession {
  id: string;
  walletId: string;
  transactionId: string;
  status: 'waiting' | 'round1' | 'round2' | 'aggregating' | 'completed' | 'failed';
  participants: ParticipantSession[];
  round1Commitments: { [participantId: string]: Round1Commitment };
  round2Signatures: { [participantId: string]: Round2Signature };
  createdAt: string;
  updatedAt: string;
  useNetwork?: boolean; // Whether using real network communication
}

export interface ParticipantSession {
  id: string;
  name: string;
  publicKey: string;
  round1Complete: boolean;
  round2Complete: boolean;
  lastActivity: string;
}

const SESSION_PREFIX = 'mpc-session-';
const SESSION_LIST_KEY = 'mpc-session-list';

export class MPCSessionManager {
  private static instance: MPCSessionManager;
  private sessions: Map<string, MPCSession> = new Map();
  private listeners: Map<string, (session: MPCSession) => void> = new Map();
  private mpcManager: MPC通信管理器 | null = null;
  private useNetwork: boolean = false;
  private serverUrl: string = 'ws://localhost:8080';

  private constructor() {
    if (typeof window !== 'undefined') {
      this.loadSessions();
      // Listen for storage changes from other tabs
      window.addEventListener('storage', this.handleStorageChange.bind(this));
      // Periodic cleanup of old sessions
      setInterval(() => this.cleanupOldSessions(), 60000); // Every minute
    }
  }

  static getInstance(): MPCSessionManager {
    if (!MPCSessionManager.instance) {
      MPCSessionManager.instance = new MPCSessionManager();
    }
    return MPCSessionManager.instance;
  }

  /**
   * Enable network communication mode
   */
  async enableNetworkMode(serverUrl?: string): Promise<boolean> {
    if (serverUrl) {
      this.serverUrl = serverUrl;
    }
    
    try {
      this.mpcManager = getMPCManager(this.serverUrl);
      await this.mpcManager.connect();
      this.useNetwork = true;
      
      // Set up event listeners
      this.setupNetworkListeners();
      
      MPCLogger.info('Session', 'Network mode enabled', { serverUrl: this.serverUrl });
      return true;
    } catch (error) {
      console.error('Failed to enable network mode:', error);
      this.useNetwork = false;
      return false;
    }
  }

  /**
   * Disable network communication mode
   */
  disableNetworkMode() {
    if (this.mpcManager) {
      this.mpcManager.disconnect();
      this.mpcManager = null;
    }
    this.useNetwork = false;
    MPCLogger.info('Session', 'Network mode disabled');
  }

  /**
   * Set up network event listeners
   */
  private setupNetworkListeners() {
    if (!this.mpcManager) return;

    this.mpcManager.on('participant_joined', (event: MPCEvent) => {
      if (event.participantId) {
        const session = this.mpcManager?.getSessionId() 
          ? this.sessions.get(this.mpcManager.getSessionId()!) 
          : null;
        if (session) {
          this.notifyListeners(session.id, session);
        }
      }
    });

    this.mpcManager.on('round1_received', (event: MPCEvent) => {
      if (event.data && event.participantId) {
        const sessionId = this.mpcManager?.getSessionId();
        if (sessionId) {
          const session = this.sessions.get(sessionId);
          if (session) {
            session.round1Commitments[event.participantId] = event.data;
            session.updatedAt = new Date().toISOString();
            this.notifyListeners(sessionId, session);
          }
        }
      }
    });

    this.mpcManager.on('round2_received', (event: MPCEvent) => {
      if (event.data && event.participantId) {
        const sessionId = this.mpcManager?.getSessionId();
        if (sessionId) {
          const session = this.sessions.get(sessionId);
          if (session) {
            session.round2Signatures[event.participantId] = event.data;
            session.updatedAt = new Date().toISOString();
            this.notifyListeners(sessionId, session);
          }
        }
      }
    });

    this.mpcManager.on('connected', () => {
      MPCLogger.info('Session', 'Connected to signaling server');
    });

    this.mpcManager.on('disconnected', () => {
      MPCLogger.warn('Session', 'Disconnected from signaling server');
    });

    this.mpcManager.on('error', (event: MPCEvent) => {
      MPCLogger.error('Session', 'Network error', event.data);
    });
  }

  /**
   * Create a new MPC signing session
   */
  async createSession(wallet: TSSWallet, transaction: TSSTransaction): Promise<MPCSession> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const participants: ParticipantSession[] = wallet.participants.map(p => ({
      id: p.id,
      name: p.id,
      publicKey: p.publicKey.toString(),
      round1Complete: false,
      round2Complete: false,
      lastActivity: new Date().toISOString()
    }));

    const session: MPCSession = {
      id: sessionId,
      walletId: wallet.config.publicKey.toString(),
      transactionId: transaction.id,
      status: 'waiting',
      participants,
      round1Commitments: {},
      round2Signatures: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      useNetwork: this.useNetwork
    };

    this.sessions.set(sessionId, session);
    this.saveSession(session);

    // If using network mode, join the session on the signaling server
    if (this.useNetwork && this.mpcManager) {
      const participantInfo: ParticipantInfo = {
        id: 'coordinator',
        name: 'Coordinator',
        publicKey: wallet.config.publicKey.toString(),
        deviceId: this.mpcManager.getDeviceId(),
        connected: true
      };
      await this.mpcManager.joinSession(sessionId, participantInfo);
    }

    MPCLogger.info('Session', 'MPC session created', {
      sessionId,
      participantCount: participants.length,
      walletId: wallet.config.publicKey.toString().slice(0, 8),
      useNetwork: this.useNetwork
    });

    return session;
  }

  /**
   * Join an existing MPC session as a participant
   */
  async joinSession(sessionId: string, participantId: string): Promise<MPCSession | null> {
    const session = this.sessions.get(sessionId) || this.loadSession(sessionId);
    if (!session) return null;

    // Update participant activity
    const participant = session.participants.find(p => p.id === participantId);
    if (participant) {
      participant.lastActivity = new Date().toISOString();
      session.updatedAt = new Date().toISOString();
      this.saveSession(session);
    }

    // If using network mode, join the session on the signaling server
    if (this.useNetwork && this.mpcManager) {
      const participantInfo: ParticipantInfo = {
        id: participantId,
        name: participantId,
        publicKey: participant?.publicKey || '',
        deviceId: this.mpcManager.getDeviceId(),
        connected: true
      };
      await this.mpcManager.joinSession(sessionId, participantInfo);
    }

    MPCLogger.info('Session', 'Participant joined session', {
      sessionId,
      participantId,
      useNetwork: this.useNetwork
    });

    return session;
  }

  /**
   * Update participant progress in signing rounds
   */
  async updateParticipantProgress(
    sessionId: string,
    participantId: string,
    round: 1 | 2,
    complete: boolean,
    commitment?: Round1Commitment,
    signature?: Round2Signature
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const participant = session.participants.find(p => p.id === participantId);
    if (!participant) return;

    if (round === 1) {
      participant.round1Complete = complete;
      if (commitment) {
        if (!session.round1Commitments) session.round1Commitments = {};
        session.round1Commitments[participantId] = commitment;
        
        // Broadcast to network if using network mode
        if (this.useNetwork && this.mpcManager) {
          this.mpcManager.broadcastRound1(sessionId, participantId, commitment);
        }
      }
    } else if (round === 2) {
      participant.round2Complete = complete;
      if (signature) {
        if (!session.round2Signatures) session.round2Signatures = {};
        session.round2Signatures[participantId] = signature;
        
        // Broadcast to network if using network mode
        if (this.useNetwork && this.mpcManager) {
          this.mpcManager.broadcastRound2(sessionId, participantId, signature);
        }
      }
    }

    participant.lastActivity = new Date().toISOString();
    session.updatedAt = new Date().toISOString();

    // Check if all participants completed the round
    this.checkRoundCompletion(session);

    this.saveSession(session);
    this.notifyListeners(sessionId, session);

    MPCLogger.info('Session', `Participant ${participantId} ${complete ? 'completed' : 'started'} round ${round}`, {
      sessionId,
      participantId,
      round,
      useNetwork: this.useNetwork
    });
  }

  /**
   * Update session status
   */
  async updateSessionStatus(sessionId: string, status: MPCSession['status']): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = status;
    session.updatedAt = new Date().toISOString();

    this.saveSession(session);
    this.notifyListeners(sessionId, session);

    MPCLogger.info('Session', `Session status updated to ${status}`, { sessionId, status });
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): MPCSession | null {
    return this.sessions.get(sessionId) || this.loadSession(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): MPCSession[] {
    return Array.from(this.sessions.values()).filter(session =>
      session.status !== 'completed' && session.status !== 'failed'
    );
  }

  /**
   * Listen for session updates
   */
  onSessionUpdate(sessionId: string, callback: (session: MPCSession) => void): () => void {
    this.listeners.set(sessionId, callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(sessionId);
    };
  }

  /**
   * Check if all participants completed a signing round
   */
  private checkRoundCompletion(session: MPCSession): void {
    const allRound1Complete = session.participants.every(p => p.round1Complete);
    const allRound2Complete = session.participants.every(p => p.round2Complete);

    if (allRound1Complete && session.status === 'round1') {
      this.updateSessionStatus(session.id, 'round2');
    } else if (allRound2Complete && session.status === 'round2') {
      this.updateSessionStatus(session.id, 'aggregating');
    }
  }

  /**
   * Handle storage changes from other tabs
   */
  private handleStorageChange(event: StorageEvent): void {
    if (typeof window === 'undefined') return;

    if (event.key?.startsWith(SESSION_PREFIX)) {
      const sessionId = event.key.replace(SESSION_PREFIX, '');
      const session = this.loadSession(sessionId);
      if (session) {
        this.sessions.set(sessionId, session);
        this.notifyListeners(sessionId, session);
      }
    }
  }

  /**
   * Save session to storage
   */
  private saveSession(session: MPCSession): void {
    if (typeof window === 'undefined') return;

    localStorage.setItem(`${SESSION_PREFIX}${session.id}`, JSON.stringify(session));

    // Update session list
    const sessionList = this.getSessionList();
    if (!sessionList.includes(session.id)) {
      sessionList.push(session.id);
      localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(sessionList));
    }
  }

  /**
   * Load session from storage
   */
  private loadSession(sessionId: string): MPCSession | null {
    if (typeof window === 'undefined') return null;

    try {
      const data = localStorage.getItem(`${SESSION_PREFIX}${sessionId}`);
      if (!data) return null;
      const parsed = JSON.parse(data);
      return {
        ...parsed,
        round1Commitments: parsed.round1Commitments || {},
        round2Signatures: parsed.round2Signatures || {}
      } as MPCSession;
    } catch {
      return null;
    }
  }

  /**
   * Load all sessions from storage
   */
  private loadSessions(): void {
    if (typeof window === 'undefined') return;

    const sessionList = this.getSessionList();
    sessionList.forEach(sessionId => {
      const session = this.loadSession(sessionId);
      if (session) {
        this.sessions.set(sessionId, session);
      }
    });
  }

  /**
   * Get list of all session IDs
   */
  private getSessionList(): string[] {
    if (typeof window === 'undefined') return [];

    try {
      const data = localStorage.getItem(SESSION_LIST_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Notify listeners of session updates
   */
  private notifyListeners(sessionId: string, session: MPCSession): void {
    const listener = this.listeners.get(sessionId);
    if (listener) {
      listener(session);
    }
  }

  /**
   * Clean up old/inactive sessions
   */
  private cleanupOldSessions(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    const sessionsToRemove: string[] = [];

    this.sessions.forEach((session, sessionId) => {
      const sessionAge = now - new Date(session.createdAt).getTime();

      // Check if participants exist and have activity data
      const lastActivity = session.participants && session.participants.length > 0
        ? Math.max(...session.participants.map(p => new Date(p.lastActivity).getTime()))
        : now;

      // Remove sessions older than 24 hours or with no activity for 1 hour
      if (sessionAge > maxAge || (now - lastActivity) > 3600000) {
        sessionsToRemove.push(sessionId);
      }
    });

    sessionsToRemove.forEach(sessionId => {
      // Leave network session if applicable
      if (this.useNetwork && this.mpcManager) {
        this.mpcManager.leaveSession(sessionId, 'coordinator');
      }
      
      this.sessions.delete(sessionId);
      localStorage.removeItem(`${SESSION_PREFIX}${sessionId}`);
    });

    if (sessionsToRemove.length > 0) {
      const sessionList = this.getSessionList().filter(id => !sessionsToRemove.includes(id));
      localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(sessionList));
    }
  }

  /**
   * Check if using network mode
   */
  isUsingNetwork(): boolean {
    return this.useNetwork;
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.mpcManager?.isConnected() || false;
  }
}

// Export singleton instance
export const sessionManager = MPCSessionManager.getInstance();
