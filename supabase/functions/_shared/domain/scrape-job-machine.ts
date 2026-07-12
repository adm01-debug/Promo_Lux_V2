/**
 * Simple State Machine for Business Workflows
 */

export type ScrapeJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';

type ScrapeJobTransitions = Partial<Record<string, ScrapeJobStatus>>;
type ScrapeJobStateConfig = { on: ScrapeJobTransitions };

export const ScrapeJobStateMachine: {
  initial: ScrapeJobStatus;
  states: Record<ScrapeJobStatus, ScrapeJobStateConfig>;
} = {
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
  return !!state.on[event];
}

export function getNextScrapeJobStatus(current: ScrapeJobStatus, event: string): ScrapeJobStatus | null {
  const state = ScrapeJobStateMachine.states[current];
  if (!state) return null;
  return state.on[event] || null;
}
