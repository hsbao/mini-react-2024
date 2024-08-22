import type { FiberRoot } from './ReactInternalTypes'
import { Scheduler } from 'scheduler'
import { NormalPriority } from 'scheduler/src/SchedulerPriorities'
import { performConcurrentWorkOnRoot } from './ReactFiberWorkLoop'

export function ensureRootIsScheduled(root: FiberRoot) {
  queueMicrotask(() => {
    scheduleTaskForRootDuringMicrotask(root)
  })
}

function scheduleTaskForRootDuringMicrotask(root: FiberRoot) {
  Scheduler.scheduleCallback(
    NormalPriority,
    performConcurrentWorkOnRoot.bind(null, root)
  )
}