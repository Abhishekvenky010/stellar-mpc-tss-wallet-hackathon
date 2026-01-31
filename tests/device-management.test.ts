/**
 * Tests for Device Management and Share Refresh functionality
 */

import {
  Device,
  DeviceStatus,
  DeviceRegistrationRequest,
  DeviceManagementSession,
  ShareRefreshSession,
  RefreshRound,
  RefreshParticipant,
  ShareRefreshMessage,
  DeviceManagementEvent,
  DeviceManagementEventType,
  DeviceManagementConfig,
  DEFAULT_DEVICE_MANAGEMENT_CONFIG,
  createDeviceRegistrationRequest,
  createShareRefreshRequest,
  isValidDeviceStatus,
  isValidSessionType,
  isValidSessionStatus,
  canDeviceParticipate,
} from '@/lib/tss/device-management';

describe('Device Management Types', () => {
  describe('Device Status', () => {
    it('should validate active status', () => {
      expect(isValidDeviceStatus('active')).toBe(true);
    });

    it('should validate inactive status', () => {
      expect(isValidDeviceStatus('inactive')).toBe(true);
    });

    it('should validate pending status', () => {
      expect(isValidDeviceStatus('pending')).toBe(true);
    });

    it('should validate revoked status', () => {
      expect(isValidDeviceStatus('revoked')).toBe(true);
    });

    it('should reject invalid status', () => {
      expect(isValidDeviceStatus('invalid')).toBe(false);
      expect(isValidDeviceStatus('')).toBe(false);
    });
  });

  describe('Session Type', () => {
    it('should validate device_registration type', () => {
      expect(isValidSessionType('device_registration')).toBe(true);
    });

    it('should validate device_removal type', () => {
      expect(isValidSessionType('device_removal')).toBe(true);
    });

    it('should validate share_refresh type', () => {
      expect(isValidSessionType('share_refresh')).toBe(true);
    });

    it('should validate key_rotation type', () => {
      expect(isValidSessionType('key_rotation')).toBe(true);
    });

    it('should validate recovery type', () => {
      expect(isValidSessionType('recovery')).toBe(true);
    });

    it('should reject invalid session type', () => {
      expect(isValidSessionType('invalid')).toBe(false);
    });
  });

  describe('Session Status', () => {
    it('should validate pending status', () => {
      expect(isValidSessionStatus('pending')).toBe(true);
    });

    it('should validate in_progress status', () => {
      expect(isValidSessionStatus('in_progress')).toBe(true);
    });

    it('should validate completed status', () => {
      expect(isValidSessionStatus('completed')).toBe(true);
    });

    it('should validate failed status', () => {
      expect(isValidSessionStatus('failed')).toBe(true);
    });

    it('should validate cancelled status', () => {
      expect(isValidSessionStatus('cancelled')).toBe(true);
    });

    it('should reject invalid status', () => {
      expect(isValidSessionStatus('invalid')).toBe(false);
    });
  });

  describe('Device Participation', () => {
    it('should allow active current device', () => {
      const device: Device = {
        id: 'device_1',
        name: 'My Device',
        publicKey: 'abc123',
        verifyingShare: 'def456',
        participantId: 1,
        isCurrentDevice: true,
        lastActive: new Date().toISOString(),
        status: 'active',
      };
      expect(canDeviceParticipate(device)).toBe(true);
    });

    it('should not allow inactive device', () => {
      const device: Device = {
        id: 'device_1',
        name: 'My Device',
        publicKey: 'abc123',
        verifyingShare: 'def456',
        participantId: 1,
        isCurrentDevice: true,
        lastActive: new Date().toISOString(),
        status: 'inactive',
      };
      expect(canDeviceParticipate(device)).toBe(false);
    });

    it('should not allow pending device', () => {
      const device: Device = {
        id: 'device_1',
        name: 'My Device',
        publicKey: 'abc123',
        verifyingShare: 'def456',
        participantId: 1,
        isCurrentDevice: false,
        lastActive: new Date().toISOString(),
        status: 'pending',
      };
      expect(canDeviceParticipate(device)).toBe(false);
    });

    it('should not allow revoked device', () => {
      const device: Device = {
        id: 'device_1',
        name: 'My Device',
        publicKey: 'abc123',
        verifyingShare: 'def456',
        participantId: 1,
        isCurrentDevice: true,
        lastActive: new Date().toISOString(),
        status: 'revoked',
      };
      expect(canDeviceParticipate(device)).toBe(false);
    });
  });
});

describe('Device Registration Request', () => {
  it('should create a valid registration request', () => {
    const request = createDeviceRegistrationRequest(
      'wallet_123',
      'My New Device',
      'device_public_key_abc',
      'initiator_device_id'
    );

    expect(request.walletId).toBe('wallet_123');
    expect(request.deviceName).toBe('My New Device');
    expect(request.devicePublicKey).toBe('device_public_key_abc');
    expect(request.requestedBy).toBe('initiator_device_id');
  });
});

describe('Share Refresh Request', () => {
  it('should create a valid refresh request with all fields', () => {
    const request = createShareRefreshRequest(
      'wallet_123',
      'routine',
      [1, 2, 3],
      4
    );

    expect(request.walletId).toBe('wallet_123');
    expect(request.reason).toBe('routine');
    expect(request.participants).toEqual([1, 2, 3]);
    expect(request.newParticipantId).toBe(4);
  });

  it('should create a valid refresh request without optional field', () => {
    const request = createShareRefreshRequest(
      'wallet_123',
      'device_change',
      [1, 2]
    );

    expect(request.walletId).toBe('wallet_123');
    expect(request.reason).toBe('device_change');
    expect(request.participants).toEqual([1, 2]);
    expect(request.newParticipantId).toBeUndefined();
  });

  it('should accept all reason types', () => {
    const reasons: Array<'routine' | 'compromise' | 'device_change' | 'periodic_rotation'> = [
      'routine',
      'compromise',
      'device_change',
      'periodic_rotation',
    ];

    reasons.forEach((reason) => {
      const request = createShareRefreshRequest('wallet_123', reason, [1, 2]);
      expect(request.reason).toBe(reason);
    });
  });
});

describe('Default Configuration', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_DEVICE_MANAGEMENT_CONFIG.maxDevices).toBe(5);
    expect(DEFAULT_DEVICE_MANAGEMENT_CONFIG.refreshIntervalDays).toBe(90);
    expect(DEFAULT_DEVICE_MANAGEMENT_CONFIG.requireAllDevicesForRecovery).toBe(false);
    expect(DEFAULT_DEVICE_MANAGEMENT_CONFIG.allowRemoteRegistration).toBe(true);
    expect(DEFAULT_DEVICE_MANAGEMENT_CONFIG.sessionTimeoutMinutes).toBe(30);
    expect(DEFAULT_DEVICE_MANAGEMENT_CONFIG.shareTransferExpiryMinutes).toBe(60);
  });

  it('should be a valid configuration object', () => {
    const config: DeviceManagementConfig = DEFAULT_DEVICE_MANAGEMENT_CONFIG;
    
    expect(typeof config.maxDevices).toBe('number');
    expect(typeof config.refreshIntervalDays).toBe('number');
    expect(typeof config.requireAllDevicesForRecovery).toBe('boolean');
    expect(typeof config.allowRemoteRegistration).toBe('boolean');
    expect(typeof config.sessionTimeoutMinutes).toBe('number');
    expect(typeof config.shareTransferExpiryMinutes).toBe('number');
  });
});

describe('ShareRefreshSession', () => {
  it('should create a valid refresh session structure', () => {
    const session: ShareRefreshSession = {
      id: 'refresh_123',
      walletId: 'wallet_123',
      round: 'round1',
      participants: [
        {
          participantId: 1,
          deviceId: 'device_1',
          status: 'pending',
        },
        {
          participantId: 2,
          deviceId: 'device_2',
          status: 'contributed',
          round1Data: 'base64_encoded_data',
        },
      ],
      threshold: 2,
      status: 'in_progress',
      createdAt: new Date().toISOString(),
    };

    expect(session.id).toBe('refresh_123');
    expect(session.walletId).toBe('wallet_123');
    expect(session.round).toBe('round1');
    expect(session.participants.length).toBe(2);
    expect(session.threshold).toBe(2);
    expect(session.status).toBe('in_progress');
  });

  it('should allow all refresh round values', () => {
    const rounds: RefreshRound[] = ['round1', 'round2', 'completed'];

    rounds.forEach((round) => {
      const session: ShareRefreshSession = {
        id: 'refresh_123',
        walletId: 'wallet_123',
        round,
        participants: [],
        threshold: 2,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      expect(session.round).toBe(round);
    });
  });

  it('should allow all participant status values', () => {
    const statuses: Array<'pending' | 'contributed' | 'completed'> = [
      'pending',
      'contributed',
      'completed',
    ];

    statuses.forEach((status) => {
      const participant: RefreshParticipant = {
        participantId: 1,
        deviceId: 'device_1',
        status,
      };
      expect(participant.status).toBe(status);
    });
  });
});

describe('DeviceManagementEvent', () => {
  it('should create a valid event structure', () => {
    const event: DeviceManagementEvent = {
      type: 'device_registered',
      walletId: 'wallet_123',
      deviceId: 'device_456',
      sessionId: 'session_789',
      timestamp: new Date().toISOString(),
    };

    expect(event.type).toBe('device_registered');
    expect(event.walletId).toBe('wallet_123');
    expect(event.deviceId).toBe('device_456');
    expect(event.sessionId).toBe('session_789');
    expect(typeof event.timestamp).toBe('string');
  });

  it('should allow all event types', () => {
    const eventTypes: DeviceManagementEventType[] = [
      'device_registered',
      'device_removed',
      'device_status_changed',
      'share_refresh_started',
      'share_refresh_completed',
      'share_refresh_failed',
      'session_created',
      'session_updated',
      'session_completed',
    ];

    eventTypes.forEach((type) => {
      const event: DeviceManagementEvent = {
        type,
        walletId: 'wallet_123',
        timestamp: new Date().toISOString(),
      };
      expect(event.type).toBe(type);
    });
  });
});
