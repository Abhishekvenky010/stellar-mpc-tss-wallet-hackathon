/**
 * MPC Signaling Server
 * A simple WebSocket server for coordinating MPC signing sessions
 * 
 * Run with: node server/mpc-signaling-server.js
 * 
 * This server handles:
 * - Session creation and management
 * - Participant discovery and connection
 * - Message routing between participants
 * - Session persistence (in-memory)
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = process.env.PORT || 8080;
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
const REFRESH_SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes for refresh sessions

// In-memory storage for sessions
const sessions = new Map();
const participants = new Map();
const refreshSessions = new Map();
const deviceRegistrations = new Map();

// Create HTTP server for serving static files (optional)
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', sessions: sessions.size }));
    return;
  }
  
  res.writeHead(404);
  res.end('Not Found');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Broadcast to all participants in a session
function broadcastToSession(sessionId, message, excludeDeviceId = null) {
  const session = sessions.get(sessionId);
  if (!session) return;
  
  const messageStr = JSON.stringify(message);
  session.participants.forEach((participant) => {
    if (participant.deviceId !== excludeDeviceId) {
      const ws = participant.ws;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    }
  });
}

// Send to specific participant
function sendToParticipant(deviceId, message) {
  const participant = participants.get(deviceId);
  if (participant && participant.ws.readyState === WebSocket.OPEN) {
    participant.ws.send(JSON.stringify(message));
  }
}

// Create a new session
function createSession(walletPublicKey, threshold) {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  sessions.set(sessionId, {
    id: sessionId,
    walletPublicKey,
    threshold,
    participants: [],
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TIMEOUT
  });
  
  return sessionId;
}

// Add participant to session
function addParticipantToSession(sessionId, participantInfo, ws) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  
  const participant = {
    id: participantInfo.id,
    name: participantInfo.name,
    publicKey: participantInfo.publicKey,
    deviceId: participantInfo.deviceId,
    ws,
    joinedAt: Date.now()
  };
  
  session.participants.push(participant);
  participants.set(participantInfo.deviceId, { ...participant, sessionId });
  
  // Notify other participants
  broadcastToSession(sessionId, {
    type: 'participant_joined',
    sessionId,
    participantId: participant.id,
    data: {
      name: participant.name,
      publicKey: participant.publicKey,
      deviceId: participant.deviceId
    },
    timestamp: new Date().toISOString()
  }, participant.deviceId);
  
  // Send current participants to new participant
  session.participants
    .filter(p => p.deviceId !== participant.deviceId)
    .forEach(p => {
      sendToParticipant(participant.deviceId, {
        type: 'participant_joined',
        sessionId,
        participantId: p.id,
        data: {
          name: p.name,
          publicKey: p.publicKey,
          deviceId: p.deviceId
        },
        timestamp: new Date().toISOString()
      });
    });
  
  return participant;
}

// Remove participant from session
function removeParticipantFromSession(deviceId) {
  const participant = participants.get(deviceId);
  if (!participant) return;
  
  const session = sessions.get(participant.sessionId);
  if (!session) return;
  
  const index = session.participants.findIndex(p => p.deviceId === deviceId);
  if (index > -1) {
    session.participants.splice(index, 1);
  }
  
  participants.delete(deviceId);
  
  // Notify other participants
  broadcastToSession(participant.sessionId, {
    type: 'participant_left',
    sessionId: participant.sessionId,
    participantId: participant.id,
    timestamp: new Date().toISOString()
  });
  
  // Clean up empty sessions
  if (session.participants.length === 0) {
    sessions.delete(participant.sessionId);
  }
}

// Get session info
function getSessionInfo(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  
  return {
    id: session.id,
    walletPublicKey: session.walletPublicKey,
    threshold: session.threshold,
    participantCount: session.participants.length,
    participants: session.participants.map(p => ({
      id: p.id,
      name: p.name,
      publicKey: p.publicKey
    })),
    createdAt: session.createdAt,
    expiresAt: session.expiresAt
  };
}

// Clean up expired sessions
function cleanupExpiredSessions() {
  const now = Date.now();
  sessions.forEach((session, sessionId) => {
    if (session.expiresAt < now) {
      // Notify participants
      broadcastToSession(sessionId, {
        type: 'error',
        sessionId,
        data: { message: 'Session expired' },
        timestamp: new Date().toISOString()
      });
      sessions.delete(sessionId);
    }
  });
}

// Cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

// ============================================================================
// Device Registration & Share Refresh Support
// ============================================================================

/**
 * Create a device registration session
 */
function createDeviceRegistrationSession(walletId, deviceInfo, initiatorDeviceId) {
  const sessionId = `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  refreshSessions.set(sessionId, {
    id: sessionId,
    type: 'device_registration',
    walletId,
    deviceInfo,
    initiatorDeviceId,
    status: 'pending',
    participants: [],
    createdAt: Date.now(),
    expiresAt: Date.now() + REFRESH_SESSION_TIMEOUT
  });
  
  return sessionId;
}

/**
 * Create a share refresh session
 */
function createShareRefreshSession(walletId, initiatorDeviceId, reason, participants) {
  const sessionId = `refresh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  refreshSessions.set(sessionId, {
    id: sessionId,
    type: 'share_refresh',
    walletId,
    initiatorDeviceId,
    reason,
    participants: participants.map(p => ({
      deviceId: p,
      status: 'pending',
      round1Data: null,
      round2Data: null
    })),
    currentRound: 'round1',
    status: 'in_progress',
    createdAt: Date.now(),
    expiresAt: Date.now() + REFRESH_SESSION_TIMEOUT
  });
  
  return sessionId;
}

/**
 * Update participant status in refresh session
 */
function updateRefreshParticipant(sessionId, deviceId, round, data) {
  const session = refreshSessions.get(sessionId);
  if (!session) return false;
  
  const participant = session.participants.find(p => p.deviceId === deviceId);
  if (!participant) return false;
  
  if (round === 'round1') {
    participant.round1Data = data;
    participant.status = 'round1_done';
  } else if (round === 'round2') {
    participant.round2Data = data;
    participant.status = 'completed';
  }
  
  return true;
}

/**
 * Check if refresh session is complete
 */
function checkRefreshSessionComplete(sessionId) {
  const session = refreshSessions.get(sessionId);
  if (!session) return false;
  
  const completedCount = session.participants.filter(p => p.status === 'completed').length;
  const requiredCount = Math.ceil(session.participants.length / 2); // Threshold
  
  if (completedCount >= requiredCount) {
    session.status = 'completed';
    return true;
  }
  
  return false;
}

/**
 * Get refresh session info
 */
function getRefreshSessionInfo(sessionId) {
  const session = refreshSessions.get(sessionId);
  if (!session) return null;
  
  return {
    id: session.id,
    type: session.type,
    walletId: session.walletId,
    status: session.status,
    currentRound: session.currentRound,
    participantCount: session.participants.length,
    completedCount: session.participants.filter(p => p.status === 'completed').length,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt
  };
}

/**
 * Broadcast to specific refresh session participants
 */
function broadcastToRefreshSession(sessionId, message, excludeDeviceId = null) {
  const session = refreshSessions.get(sessionId);
  if (!session) return;
  
  const messageStr = JSON.stringify(message);
  session.participants.forEach((participant) => {
    if (excludeDeviceId && participant.deviceId === excludeDeviceId) return;
    
    const participantInfo = participants.get(participant.deviceId);
    if (participantInfo && participantInfo.ws.readyState === WebSocket.OPEN) {
      participantInfo.ws.send(messageStr);
    }
  });
}

/**
 * Clean up expired refresh sessions
 */
function cleanupExpiredRefreshSessions() {
  const now = Date.now();
  refreshSessions.forEach((session, sessionId) => {
    if (session.expiresAt < now) {
      // Notify participants
      broadcastToRefreshSession(sessionId, {
        type: 'refresh_session_expired',
        sessionId,
        data: { message: 'Refresh session expired' },
        timestamp: new Date().toISOString()
      });
      refreshSessions.delete(sessionId);
    }
  });
}

// Cleanup refresh sessions every 5 minutes
setInterval(cleanupExpiredRefreshSessions, 5 * 60 * 1000);

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('New connection');
  let deviceId = null;
  let currentSessionId = null;
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'join': {
          const { sessionId, participantId, data: participantData } = message;
          deviceId = participantData.deviceId;
          currentSessionId = sessionId;
          
          addParticipantToSession(sessionId, {
            id: participantId,
            name: participantData.name,
            publicKey: participantData.publicKey,
            deviceId: participantData.deviceId
          }, ws);
          
          // Send session info to joining participant
          const sessionInfo = getSessionInfo(sessionId);
          sendToParticipant(deviceId, {
            type: 'session_info',
            sessionId,
            data: sessionInfo,
            timestamp: new Date().toISOString()
          });
          break;
        }
        
        case 'leave': {
          const { sessionId, participantId } = message;
          if (deviceId) {
            removeParticipantFromSession(deviceId);
          }
          currentSessionId = null;
          break;
        }
        
        case 'round1_data': {
          const { sessionId, participantId, data: commitment } = message;
          broadcastToSession(sessionId, message, deviceId);
          break;
        }
        
        case 'round2_data': {
          const { sessionId, participantId, data: signature } = message;
          broadcastToSession(sessionId, message, deviceId);
          break;
        }
        
        case 'signature_ready': {
          const { sessionId, participantId } = message;
          broadcastToSession(sessionId, message, deviceId);
          break;
        }
        
        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          break;
        }
        
        // ============================================================================
        // Device Registration Messages
        // ============================================================================
        
        case 'register_device_request': {
          const { walletId, deviceInfo } = message;
          const sessionId = createDeviceRegistrationSession(walletId, deviceInfo, deviceId);
          
          sendToParticipant(deviceId, {
            type: 'register_device_response',
            sessionId,
            data: { success: true },
            timestamp: new Date().toISOString()
          });
          
          // Broadcast to existing session participants for approval
          const session = sessions.get(currentSessionId);
          if (session) {
            broadcastToSession(currentSessionId, {
              type: 'device_registration_request',
              sessionId,
              data: { walletId, deviceInfo },
              timestamp: new Date().toISOString()
            });
          }
          break;
        }
        
        case 'register_device_approve': {
          const { registrationSessionId, approved } = message;
          const registrationSession = refreshSessions.get(registrationSessionId);
          
          if (registrationSession) {
            if (approved) {
              registrationSession.status = 'approved';
              // Send approval to initiator
              sendToParticipant(registrationSession.initiatorDeviceId, {
                type: 'device_registration_approved',
                sessionId: registrationSessionId,
                data: { canProceed: true },
                timestamp: new Date().toISOString()
              });
            } else {
              registrationSession.status = 'rejected';
              sendToParticipant(registrationSession.initiatorDeviceId, {
                type: 'device_registration_rejected',
                sessionId: registrationSessionId,
                data: { reason: 'Rejected by participant' },
                timestamp: new Date().toISOString()
              });
            }
          }
          break;
        }
        
        // ============================================================================
        // Share Refresh Messages
        // ============================================================================
        
        case 'refresh_init': {
          const { walletId, reason, participants } = message;
          const sessionId = createShareRefreshSession(walletId, deviceId, reason, participants);
          
          // Notify all participants to join the refresh session
          participants.forEach(participantDeviceId => {
            sendToParticipant(participantDeviceId, {
              type: 'refresh_invitation',
              sessionId,
              data: { walletId, reason, initiator: deviceId },
              timestamp: new Date().toISOString()
            });
          });
          
          sendToParticipant(deviceId, {
            type: 'refresh_init_response',
            sessionId,
            data: { success: true },
            timestamp: new Date().toISOString()
          });
          break;
        }
        
        case 'refresh_join': {
          const { refreshSessionId } = message;
          const refreshSession = refreshSessions.get(refreshSessionId);
          
          if (refreshSession && refreshSession.status === 'in_progress') {
            // Add participant to refresh session
            const participant = refreshSession.participants.find(p => p.deviceId === deviceId);
            if (participant) {
              participant.status = 'joined';
              
              // Notify other participants
              broadcastToRefreshSession(refreshSessionId, {
                type: 'refresh_participant_joined',
                sessionId: refreshSessionId,
                data: { deviceId },
                timestamp: new Date().toISOString()
              }, deviceId);
              
              // Send current session state to joining participant
              sendToParticipant(deviceId, {
                type: 'refresh_session_state',
                sessionId: refreshSessionId,
                data: getRefreshSessionInfo(refreshSessionId),
                timestamp: new Date().toISOString()
              });
            }
          }
          break;
        }
        
        case 'refresh_round1': {
          const { refreshSessionId, data: commitment } = message;
          const refreshSession = refreshSessions.get(refreshSessionId);
          
          if (refreshSession && refreshSession.currentRound === 'round1') {
            updateRefreshParticipant(refreshSessionId, deviceId, 'round1', commitment);
            
            // Broadcast commitment to other participants
            broadcastToRefreshSession(refreshSessionId, {
              type: 'refresh_round1_data',
              sessionId: refreshSessionId,
              fromDeviceId: deviceId,
              data: commitment,
              timestamp: new Date().toISOString()
            });
            
            // Check if we can proceed to round 2
            const readyCount = refreshSession.participants.filter(
              p => p.status === 'round1_done' || p.status === 'completed'
            ).length;
            const threshold = Math.ceil(refreshSession.participants.length / 2);
            
            if (readyCount >= threshold) {
              refreshSession.currentRound = 'round2';
              
              broadcastToRefreshSession(refreshSessionId, {
                type: 'refresh_start_round2',
                sessionId: refreshSessionId,
                data: { threshold, readyCount },
                timestamp: new Date().toISOString()
              });
            }
          }
          break;
        }
        
        case 'refresh_round2': {
          const { refreshSessionId, data: signatureShare } = message;
          const refreshSession = refreshSessions.get(refreshSessionId);
          
          if (refreshSession && refreshSession.currentRound === 'round2') {
            updateRefreshParticipant(refreshSessionId, deviceId, 'round2', signatureShare);
            
            // Broadcast signature share to other participants
            broadcastToRefreshSession(refreshSessionId, {
              type: 'refresh_round2_data',
              sessionId: refreshSessionId,
              fromDeviceId: deviceId,
              data: signatureShare,
              timestamp: new Date().toISOString()
            });
            
            // Check if refresh is complete
            if (checkRefreshSessionComplete(refreshSessionId)) {
              broadcastToRefreshSession(refreshSessionId, {
                type: 'refresh_completed',
                sessionId: refreshSessionId,
                data: { success: true },
                timestamp: new Date().toISOString()
              });
            }
          }
          break;
        }
        
        case 'refresh_cancel': {
          const { refreshSessionId, reason } = message;
          const refreshSession = refreshSessions.get(refreshSessionId);
          
          if (refreshSession) {
            refreshSession.status = 'cancelled';
            
            broadcastToRefreshSession(refreshSessionId, {
              type: 'refresh_cancelled',
              sessionId: refreshSessionId,
              data: { reason },
              timestamp: new Date().toISOString()
            });
          }
          break;
        }
        
        // ============================================================================
        // Device Removal Messages
        // ============================================================================
        
        case 'remove_device_request': {
          const { walletId, targetDeviceId, reason } = message;
          
          // Notify session participants about removal request
          const session = sessions.get(currentSessionId);
          if (session) {
            broadcastToSession(currentSessionId, {
              type: 'device_removal_request',
              data: { walletId, targetDeviceId, reason, requestedBy: deviceId },
              timestamp: new Date().toISOString()
            });
          }
          
          sendToParticipant(deviceId, {
            type: 'remove_device_response',
            data: { success: true, message: 'Removal request sent' },
            timestamp: new Date().toISOString()
          });
          break;
        }
        
        case 'remove_device_confirm': {
          const { walletId, targetDeviceId, confirmed } = message;
          
          if (confirmed) {
            // Trigger share refresh to redistribute shares
            const session = sessions.get(currentSessionId);
            if (session) {
              const remainingParticipants = session.participants
                .filter(p => p.deviceId !== targetDeviceId)
                .map(p => p.deviceId);
              
              if (remainingParticipants.length >= 2) {
                createShareRefreshSession(walletId, deviceId, 'device_change', remainingParticipants);
              }
            }
            
            sendToParticipant(targetDeviceId, {
              type: 'device_removed',
              data: { walletId, message: 'Device removed from wallet' },
              timestamp: new Date().toISOString()
            });
          }
          break;
        }
        
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'Invalid message format' },
        timestamp: new Date().toISOString()
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('Connection closed');
    if (deviceId) {
      removeParticipantFromSession(deviceId);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`MPC Signaling Server running on port ${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  wss.close(() => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});
