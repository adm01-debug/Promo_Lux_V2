/**
 * Simple State Machine for Business Workflows
 */

export type ScrapeJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';

export const ScrapeJobStateMachine = {
  initial: 'pending',
  states: {
    pending: {
      on: { START: 'running' }
    },
    running: {
      on: { 
        COMPLETE: 'completed',
        FAIL: 'failed',
        PAUSE: 'paused'
      }
    },
    paused: {
      on: { RESUME: 'running' }
    },
    completed: {
      on: {} // Terminal
    },
    failed: {
      on: { RETRY: 'pending' }
    }
  }
};

export function canTransitionScrapeJob(current: ScrapeJobStatus, event: string): boolean {
  const state = ScrapeJobStateMachine.states[current];
  if (!state) return false;
  return !!(state as any).on[event];
}

export function getNextScrapeJobStatus(current: ScrapeJobStatus, event: string): ScrapeJobStatus | null {
  const state = ScrapeJobStateMachine.states[current];
  if (!state) return null;
  return (state as any).on[event] || null;
}
