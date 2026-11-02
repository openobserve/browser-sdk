import type { ClocksState } from '@openobserve/js-core/time'

export interface SessionExpiredEvent {
  endClocks: ClocksState
}
