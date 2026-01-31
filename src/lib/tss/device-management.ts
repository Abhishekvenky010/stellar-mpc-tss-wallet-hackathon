/**
 * Device Management Types for MPC Wallet
 * Handles multi-device support, device registration, and share refresh workflows
 */

import { uint8ArrayToBase64, base64ToUint8Array } from '../utils';

// ============================================================================
// Device Management Types
// ============================================================================

/**
 * Represents a device that participates in the MPC wallet
 */
export interface Device {
  id: string;
  name: string;
  publicKey: string;
  verifyingShare: string;
  participantId: number;
  isCurrentDevice: boolean;
  lastActive: string;
  status: DeviceStatus;
}

export type DeviceStatus = 'active' | 'inactive' | 'pending' | 'revoked';

/**
 * Device registration request for adding a new device
 */
export interface DeviceRegistrationRequest {
  walletId: string;
  deviceName: string;
  devicePublicKey: string;
  requestedBy: string;
}

/**
 * Device registration response
 */
export interface DeviceRegistrationResponse {
  success: boolean;
  deviceId?: string;
  participantId?: number;
  sharePackage?: SharePackage;
  error?: string;
}

/**
 * Share package for device-to-device transfer
 */
export interface SharePackage {
  version: '1.0';
  walletId: string;
  walletPublicKey: string;
  senderId: string;
  participantId: number;
  keyShareData: string; // Base64 encoded
  verificationData: string; // Base64 encoded
  nonce: string; // For security
  expiresAt: string;
  signature: string; // Proof of authorization
}

/**
 * Device management session for coordination
 */
export interface DeviceManagementSession {
  id: string;
  type: SessionType;
  walletId: string;
  initiatorId: string;
  participants: string[];
  status: SessionStatus;
  createdAt: string;
  expiresAt: string;
  data?: Record<string, unknown>;
}

export type SessionType = 
  | 'device_registration'
  | 'device_removal'
  | 'share_refresh'
  | 'key_rotation'
  | 'recovery';

export type SessionStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ============================================================================
// Share Refresh Types
// ============================================================================

/**
 * Share refresh request
 */
export interface ShareRefreshRequest {
  walletId: string;
  reason: 'routine' | 'compromise' | 'device_change' | 'periodic_rotation';
  participants: number[];
  newParticipantId?: number;
}

/**
 * Share refresh session data
 */
export interface ShareRefreshSession {
  id: string;
  walletId: string;
  round: RefreshRound;
  participants: RefreshParticipant[];
  threshold: number;
  status: SessionStatus;
  createdAt: string;
  completedAt?: string;
}

export type RefreshRound = 'round1' | 'round2' | 'completed';

export interface RefreshParticipant {
  participantId: number;
  deviceId: string;
  round1Data?: string; // Base64 encoded commitments
  round2Data?: string; // Base64 encoded partial signatures
  status: 'pending' | 'contributed' | 'completed';
}

/**
 * Share refresh message for inter-device communication
 */
export interface ShareRefreshMessage {
  sessionId: string;
  round: RefreshRound;
  fromParticipantId: number;
  toParticipantId?: number;
  broadcast: boolean;
  data: string; // Base64 encoded
  timestamp: string;
}

// ============================================================================
// Device Management Events
// ============================================================================

export type DeviceManagementEventType =
  | 'device_registered'
  | 'device_removed'
  | 'device_status_changed'
  | 'share_refresh_started'
  | 'share_refresh_completed'
  | 'share_refresh_failed'
  | 'session_created'
  | 'session_updated'
  | 'session_completed';

export interface DeviceManagementEvent {
  type: DeviceManagementEventType;
  walletId: string;
  deviceId?: string;
  sessionId?: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface DeviceManagementConfig {
  maxDevices: number;
  refreshIntervalDays: number;
  requireAllDevicesForRecovery: boolean;
  allowRemoteRegistration: boolean;
  sessionTimeoutMinutes: number;
  shareTransferExpiryMinutes: number;
}

// ============================================================================
// Response Types
// ============================================================================

export interface DeviceManagementResponse {
  success: boolean;
  sessionId?: string;
  data?: Record<string, unknown>;
  error?: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_DEVICE_MANAGEMENT_CONFIG: DeviceManagementConfig = {
  maxDevices: 5,
  refreshIntervalDays: 90,
  requireAllDevicesForRecovery: false,
  allowRemoteRegistration: true,
  sessionTimeoutMinutes: 30,
  shareTransferExpiryMinutes: 60,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate device status
 */
export function isValidDeviceStatus(status: string): status is DeviceStatus {
  return ['active', 'inactive', 'pending', 'revoked'].includes(status);
}

/**
 * Validate session type
 */
export function isValidSessionType(typeStr: string): typeStr is SessionType {
  return ['device_registration', 'device_removal', 'share_refresh', 'key_rotation', 'recovery'].includes(typeStr);
}

/**
 * Validate session status
 */
export function isValidSessionStatus(status: string): status is SessionStatus {
  return ['pending', 'in_progress', 'completed', 'failed', 'cancelled'].includes(status);
}

/**
 * Check if device can participate in operations
 */
export function canDeviceParticipate(device: Device): boolean {
  return device.status === 'active' && device.isCurrentDevice;
}

/**
 * Create a device registration request
 */
export function createDeviceRegistrationRequest(
  walletId: string,
  deviceName: string,
  devicePublicKey: string,
  requestedBy: string
): DeviceRegistrationRequest {
  return {
    walletId,
    deviceName,
    devicePublicKey,
    requestedBy,
  };
}

/**
 * Create a share refresh request
 */
export function createShareRefreshRequest(
  walletId: string,
  reason: ShareRefreshRequest['reason'],
  participants: number[],
  newParticipantId?: number
): ShareRefreshRequest {
  return {
    walletId,
    reason,
    participants,
    newParticipantId,
  };
}
