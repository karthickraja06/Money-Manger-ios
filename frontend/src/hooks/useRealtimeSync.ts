import { useEffect, useRef, useCallback } from 'react';
import { getSyncChanges, getSyncStats } from '../services/api';

/**
 * Hook for real-time data synchronization polling
 * Polls the backend for changes at regular intervals
 */
export const useRealtimeSync = (
  onChangesDetected?: (changes: any[]) => void,
  pollIntervalMs: number = 10000 // Poll every 10 seconds
) => {
  const lastSyncTimestamp = useRef<number>(Date.now());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  const startPolling = useCallback(() => {
    if (isPollingRef.current) return; // Already polling

    isPollingRef.current = true;
    console.log('[Sync] Starting real-time sync polling');

    const poll = async () => {
      try {
        const result = await getSyncChanges(lastSyncTimestamp.current);

        if (result && result.changes && result.changes.length > 0) {
          console.log(`[Sync] Detected ${result.changes.length} changes`, result);
          lastSyncTimestamp.current = result.current_timestamp;

          if (onChangesDetected) {
            onChangesDetected(result.changes);
          }
        }
      } catch (error) {
        console.warn('[Sync] Polling error:', error instanceof Error ? error.message : String(error));
        // Continue polling even if there's an error
      }
    };

    // Initial poll
    poll();

    // Set up recurring polls
    pollingIntervalRef.current = setInterval(poll, pollIntervalMs);
  }, [pollIntervalMs, onChangesDetected]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      isPollingRef.current = false;
      console.log('[Sync] Stopped real-time sync polling');
    }
  }, []);

  const getSyncStatus = useCallback(async () => {
    try {
      return await getSyncStats(lastSyncTimestamp.current);
    } catch (error) {
      console.warn('[Sync] Failed to get sync stats:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      stopPolling();
    };
  }, [stopPolling]);

  return {
    startPolling,
    stopPolling,
    getSyncStatus,
    lastSyncTimestamp: lastSyncTimestamp.current,
  };
};

export default useRealtimeSync;
