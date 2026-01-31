'use client';

import { useState, useEffect } from 'react';
import { TSSWallet, TSSTransaction } from '@/lib/tss/types';
import { sessionManager, MPCSession, ParticipantSession } from '@/lib/session';
import { MPCLogger } from '@/lib/tss/types';
import { frostSignRound1, frostSignRound2, frostAggregate } from '@/lib/signer/frost_signer';
import { Round1Commitment, Round2Signature } from '@/lib/tss/types';

interface MPCSimulatorProps {
  wallet: TSSWallet;
  transaction: TSSTransaction;
  onSigningComplete: () => void;
}

export default function MPCSimulator({ wallet, transaction, onSigningComplete }: MPCSimulatorProps) {
  const [session, setSession] = useState<MPCSession | null>(null);
  const [currentParticipant, setCurrentParticipant] = useState<ParticipantSession | null>(null);
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [signingStep, setSigningStep] = useState<'select-role' | 'round1' | 'round2' | 'complete'>('select-role');

  useEffect(() => {
    // Check if there's already an active session for this transaction
    const activeSessions = sessionManager.getActiveSessions();
    const existingSession = activeSessions.find(s => s.transactionId === transaction.id);

    if (existingSession) {
      setSession(existingSession);
      setSigningStep(getStepFromSessionStatus(existingSession));
    }
  }, [transaction.id]);

  const getStepFromSessionStatus = (session: MPCSession): typeof signingStep => {
    switch (session.status) {
      case 'waiting': return 'select-role';
      case 'round1': return 'round1';
      case 'round2': return 'round2';
      case 'completed': return 'complete';
      default: return 'select-role';
    }
  };

  const createSession = async () => {
    try {
      const newSession = await sessionManager.createSession(wallet, transaction);
      setSession(newSession);
      setIsCoordinator(true);
      setSigningStep('round1');

      // Listen for session updates
      const unsubscribe = sessionManager.onSessionUpdate(newSession.id, (updatedSession) => {
        setSession(updatedSession);
        setSigningStep(getStepFromSessionStatus(updatedSession));

        if (updatedSession.status === 'completed') {
          onSigningComplete();
          unsubscribe();
        }
      });

      MPCLogger.info('MPC', 'Session created for distributed signing', {
        sessionId: newSession.id,
        participantCount: newSession.participants.length
      });
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const joinAsParticipant = async (participantId: string) => {
    if (!session) return;

    try {
      const updatedSession = await sessionManager.joinSession(session.id, participantId);
      if (updatedSession) {
        const participant = updatedSession.participants.find(p => p.id === participantId);
        setCurrentParticipant(participant || null);
        setSession(updatedSession);
        setSigningStep('round1');
      }
    } catch (error) {
      console.error('Failed to join session:', error);
    }
  };

  const performRound1 = async () => {
    if (!currentParticipant || !session) return;

    try {
      const participantIndex = parseInt(currentParticipant.id);
      // Use the wallet ID from the participant's keyShare instead of hardcoded 1
      const walletId = (currentParticipant as any).walletId || 1;
      const commitment = await frostSignRound1(walletId, participantIndex);
      await sessionManager.updateParticipantProgress(session.id, currentParticipant.id, 1, true, commitment);

      MPCLogger.round1('Participant completed Round 1', {
        participantId: currentParticipant.id,
        sessionId: session.id,
        walletId
      });
    } catch (error) {
      console.error('Round 1 failed:', error);
    }
  };

  const performRound2 = async () => {
    if (!currentParticipant || !session) return;

    try {
      const participantIndex = parseInt(currentParticipant.id);
      // Use the wallet ID from the participant's keyShare instead of hardcoded 1
      const walletId = (currentParticipant as any).walletId || 1;
      const commitments = Object.values(session.round1Commitments) as Round1Commitment[];
      const messageHash = new Uint8Array((transaction as any).hash());
      const signature = await frostSignRound2(walletId, participantIndex, commitments, messageHash);
      await sessionManager.updateParticipantProgress(session.id, currentParticipant.id, 2, true, undefined, signature);

      MPCLogger.round2('Participant completed Round 2', {
        participantId: currentParticipant.id,
        sessionId: session.id,
        walletId
      });
    } catch (error) {
      console.error('Round 2 failed:', error);
    }
  };

  if (!session) {
    return (
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-4">
            🚀 Start Distributed MPC Signing
          </h3>
          <p className="text-gray-400 mb-6">
            This will create a signing session that can be joined by multiple participants across different browser tabs or devices.
          </p>
          <button
            onClick={createSession}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white btn-primary"
          >
            Create MPC Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Session Info */}
      <div className="card rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">MPC Signing Session</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Session ID:</span>
            <div className="font-mono text-gray-300">{session.id.slice(0, 12)}...</div>
          </div>
          <div>
            <span className="text-gray-400">Status:</span>
            <div className="capitalize text-white">{session.status}</div>
          </div>
          <div>
            <span className="text-gray-400">Participants:</span>
            <div className="text-white">{session.participants.length}</div>
          </div>
        </div>
      </div>

      {/* Participant Selection */}
      {signingStep === 'select-role' && !currentParticipant && (
        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            👥 Choose Your Participant Role
          </h3>
          <p className="text-gray-400 mb-6">
            In a real MPC system, each participant would be on a separate device. Here, select which participant you want to simulate.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {session.participants.map((participant) => (
              <button
                key={participant.id}
                onClick={() => joinAsParticipant(participant.id)}
                className="p-4 border-2 border-white/20 rounded-xl hover:border-amber-500/50 hover:bg-amber-500/10 transition-all duration-300"
              >
                <div className="text-lg font-semibold text-white">{participant.name}</div>
                <div className="text-sm text-gray-400">Click to join as this participant</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Round 1 */}
      {signingStep === 'round1' && currentParticipant && (
        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            🔐 Round 1: Generate Commitments
          </h3>
          <p className="text-gray-400 mb-6">
            You are participating as <strong className="text-green-400">{currentParticipant.name}</strong>.
            Generate your cryptographic commitment for this signing round.
          </p>

          {/* Progress of all participants */}
          <div className="mb-6">
            <h4 className="font-medium text-white mb-3">Participant Progress:</h4>
            <div className="space-y-2">
              {session.participants.map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{p.name}</span>
                  <div className={`w-3 h-3 rounded-full ${p.round1Complete ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`}></div>
                </div>
              ))}
            </div>
          </div>

          {!currentParticipant.round1Complete ? (
            <button
              onClick={performRound1}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white btn-secondary"
            >
              Generate Commitment
            </button>
          ) : (
            <div className="text-green-400 font-medium">
              ✅ Commitment generated! Waiting for other participants...
            </div>
          )}
        </div>
      )}

      {/* Round 2 */}
      {signingStep === 'round2' && currentParticipant && (
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            ✍️ Round 2: Generate Signature Shares
          </h3>
          <p className="text-gray-400 mb-6">
            All participants have completed Round 1. Now generate your signature share.
          </p>

          {/* Progress of all participants */}
          <div className="mb-6">
            <h4 className="font-medium text-white mb-3">Participant Progress:</h4>
            <div className="space-y-2">
              {session.participants.map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{p.name}</span>
                  <div className={`w-3 h-3 rounded-full ${p.round2Complete ? 'bg-blue-400 animate-pulse' : 'bg-gray-600'}`}></div>
                </div>
              ))}
            </div>
          </div>

          {!currentParticipant.round2Complete ? (
            <button
              onClick={performRound2}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white btn-accent"
            >
              Generate Signature Share
            </button>
          ) : (
            <div className="text-blue-400 font-medium">
              ✅ Signature share generated! Waiting for aggregation...
            </div>
          )}
        </div>
      )}

      {/* Complete */}
      {signingStep === 'complete' && (
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white mb-4">
              🎉 MPC Signing Complete!
            </h3>
            <p className="text-gray-400 mb-6">
              All participants have successfully contributed to the signature.
              The transaction will now be submitted to the Stellar network.
            </p>
            <div className="text-sm text-gray-500">
              This demonstrates true multi-party computation where each participant
              maintains their own secret share and contributes to the final signature
              without ever revealing their private key.
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="card rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          📋 How to Test Real MPC
        </h3>
        <div className="text-sm text-gray-400 space-y-2">
          <p><strong className="text-white">1.</strong> Open this page in multiple browser tabs</p>
          <p><strong className="text-white">2.</strong> In each tab, select a different participant (Alice, Bob, Charlie)</p>
          <p><strong className="text-white">3.</strong> Each tab will independently perform their cryptographic operations</p>
          <p><strong className="text-white">4.</strong> Watch as the signature is built collectively across all participants</p>
          <p><strong className="text-white">5.</strong> This simulates how real MPC works across different devices/networks</p>
        </div>
      </div>
    </div>
  );
}
