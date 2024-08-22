import { createWorkInProgress } from './ReactFiber'
import { beginWork } from './ReactFiberBeginWork'
import { commitMutationEffects, flushPassiveEffects } from './ReactFiberCommitWork'
import { Scheduler } from "scheduler"
import { NormalPriority } from "scheduler/src/SchedulerPriorities"
import { completeWork } from './ReactFiberCompleteWork'
import { ensureRootIsScheduled } from './ReactFiberRootScheduler'
import type { Fiber, FiberRoot } from './ReactInternalTypes'
import { claimNextTransitionLane, Lane, NoLane } from './ReactFiberLane'
import { getCurrentUpdatePriority } from './ReactEventPriorities'
import { getCurrentEventPriority } from 'react-dom-bindings/src/client/ReactFiberConfigDOM'

type ExecutionContext = number

export const NoContext = /*             */ 0b000
const BatchedContext = /*               */ 0b001
export const RenderContext = /*         */ 0b010
export const CommitContext = /*         */ 0b100

// Describes where we are in the React execution stack
let executionContext: ExecutionContext = NoContext

let workInProgress: Fiber | null = null // 当前工作的fiber
let workInProgressRoot: FiberRoot | null = null // 当前的根节点

export function scheduleUpdateOnFiber(root: FiberRoot, fiber: Fiber, isSync?: boolean) {
  workInProgressRoot = root
  workInProgress = fiber

  if (isSync) {
    queueMicrotask(() => performConcurrentWorkOnRoot(root))
  } else {
    /**
     * 每次 root: FiberRoot 接收 update 的时候，这个函数都会被调⽤。
     * 1. 确保 root 在 root 调度中
     * 2. 确保有⼀个待处理的微任务来处理根调度
     */
    ensureRootIsScheduled(root)
  }
}

export function performConcurrentWorkOnRoot(root: FiberRoot) {
  // 1. 开始render阶段, 构建fiber树VDOM（其中包括beginWork和completeWork两个重点阶段）
  renderRootSync(root)

  console.log(
    "%c [ render阶段结束，即将开始commit阶段 ]-31",
    "font-size:13px; background:pink; color:#bf2c9f;",
    root
  )

  const finishedWork = root.current.alternate
  root.finishedWork = finishedWork // 记录要提交的work

  // 2. commit, VDOM->DOM
  commitRoot(root)
}

function renderRootSync(root: FiberRoot) {
  // 1. render阶段开始
  const prevExecutionContext = executionContext
  executionContext |= RenderContext //  使用或运算表示进入render阶段

  // 2. 初始化
  prepareFreshStack(root)

  // 3. 深度优先：遍历构建fiber树
  workLoopSync()

  // 4. render结束，重置当前状态和当前当前的根节点
  executionContext = prevExecutionContext
  workInProgressRoot = null
}

/**
 * 初始化：从root开始
 * 初始化 workInProgressRoot 、 workInProgress 等值
 * @param root 
 * @returns 
 */
function prepareFreshStack(root: FiberRoot): Fiber {
  root.finishedWork = null // 表示提交阶段要提交的work，初始值为null

  workInProgressRoot = root // 表示从root开始构建fiber树

  // 表示从哪个fiber开始，所以要创建一个fiber
  // 此时root.current是表示root的fiber
  // 然后就根据root.current创建一个正在开始工作的fiber
  const rootWorkInProgress = createWorkInProgress(root.current, null) // Fiber
  if (workInProgress === null) {
    workInProgress = rootWorkInProgress // Fiber
  }

  return rootWorkInProgress
}

function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress)
  }
}

/**
 * 执行一个fiber
 * @param unitOfWork 当前正在执行的fiber
 */
function performUnitOfWork(unitOfWork: Fiber) {
  const current = unitOfWork.alternate // 记录老fiber

  // 1. beginWork
  // 1.1 执行自己
  // 1.2 (协调，bailout)返回子节点
  let next = beginWork(current, unitOfWork)

  // 把pendingProps更新到memoizedProps
  unitOfWork.memoizedProps = unitOfWork.pendingProps

  if (next === null) { // 表示当前的fiber没有产生新的work，则完成当前fiber的work
    // 2. 完成当前fiber的work，根据深度优先，再次处理别的
    completeUnitOfWork(unitOfWork)
  } else {
    workInProgress = next // 继续处理下一个fiber的work
  }
}

/**
 * 完成当前fiber的work，根据深度优先遍历
 * 先处理子节点
 * 如果没有子节，则处理兄弟节点
 * 如果没有兄弟节点，则根据父节点处理叔叔节点...依次类推
 * @param unitOfWork 当前正在执行的fiber
 */
function completeUnitOfWork(unitOfWork: Fiber) {
  let completedWork = unitOfWork
  do {
    const current = completedWork.alternate // 记录老fiber
    const returnFiber = completedWork.return // 父fiber

    let next = completeWork(current, completedWork)

    // 有子节点
    if (next !== null) {
      workInProgress = next
      return
    }

    // 如果没有子节，则处理兄弟节点
    const siblingFiber = completedWork.sibling
    if (siblingFiber !== null) {
      workInProgress = siblingFiber
      return
    }

    // 如果没有兄弟节点，则从父节点开始处理叔叔节点
    completedWork = returnFiber as Fiber
    workInProgress = completedWork
  } while (completedWork !== null)
}

function commitRoot(root: FiberRoot) {
  // 1. commit阶段开始
  const prevExecutionContext = executionContext
  executionContext |= CommitContext  //  使用或运算表示进入commit阶段

  // 2 mutation阶段, 渲染DOM树
  commitMutationEffects(root, root.finishedWork as Fiber)

  // 2.2 passive effect阶段，执行 passive effect（通过调度器异步执行useEffect）
  Scheduler.scheduleCallback(NormalPriority, () => {
    flushPassiveEffects(root.finishedWork as Fiber)
  })

  // 3. commit结束
  executionContext = prevExecutionContext
  workInProgressRoot = null
}

/**
 * 获取紧急更新的lane
 */
export function requestUpdateLane(): Lane {
  const updateLane: Lane = getCurrentUpdatePriority() // 获取当前更新优先级
  if (updateLane !== NoLane) {
    return updateLane
  }
  const eventLane: Lane = getCurrentEventPriority()
  return eventLane
}

let workInProgressDeferredLane: Lane = NoLane // 非紧急更新的lane

/**
 * 获取非紧急更新的lane
 */
export function requestDeferredLane(): Lane {
  if (workInProgressDeferredLane === NoLane) {
    workInProgressDeferredLane = claimNextTransitionLane()
  }
  return workInProgressDeferredLane
}