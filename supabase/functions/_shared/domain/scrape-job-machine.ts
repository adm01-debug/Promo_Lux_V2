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

type TransitionMap = Record<string, ScrapeJobStatus | undefined>;

export function canTransitionScrapeJob(current: ScrapeJobStatus, event: string): boolean {
  const state = ScrapeJobStateMachine.states[current];
  if (!state) return false;
  return !!(state.on as TransitionMap)[event];
}

export function getNextScrapeJobStatus(current: ScrapeJobStatus, event: string): ScrapeJobStatus | null {
  const state = ScrapeJobStateMachine.states[current];
  if (!state) return null;
  return (state.on as TransitionMap)[event] || null;
}
