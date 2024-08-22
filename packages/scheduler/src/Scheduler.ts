/*
 * @Descripttion: 实现一个单线程任务调度器
 */
import { getCurrentTime } from "shared/utils"
import { peek, pop, push } from "./SchedulerMinHeap"
import {
  PriorityLevel,
  NormalPriority,
  IdlePriority,
  ImmediatePriority,
  LowPriority,
  UserBlockingPriority,
  NoPriority,
} from "./SchedulerPriorities"
import {
  lowPriorityTimeout,
  maxSigned31BitInt,
  normalPriorityTimeout,
  userBlockingPriorityTimeout,
} from "./SchedulerFeatureFlags"

type Callback = (arg: boolean) => Callback | null | undefined

export type Task = {
  id: number
  callback: Callback | null
  priorityLevel: PriorityLevel
  startTime: number
  expirationTime: number
  sortIndex: number
}


let startTime = -1 // 记录时间切片的起始值，时间戳
let frameInterval = 5 // 时间切片，这是个时间段 5ms

//标记task的唯一性
let taskIdCounter = 1

// 任务池，最小堆
const taskQueue: Array<Task> = [] // 没有延迟的任务
const timerQueue: Array<Task> = [] // 有延迟的任务

let currentTask: Task | null = null // 当前正在执行的任务
let currentPriorityLevel: PriorityLevel = NoPriority // 当前正在执行的任务的优先级


let isHostCallbackScheduled = false // 主线程是否在调度
let isPerformingWork = false // 是否有 work 在执行
let isMessageLoopRunning = false // 是否有创建宏任务
let isHostTimeoutScheduled = false // 是否有任务在倒计时
let taskTimeoutID = -1

/**
 * 判断是否需要中断任务，何时交还控制权给主线程
 * @returns true 表示需要中断任务，false 表示不需要中断
 */
function shouldYieldToHost() {
  const timeElapsed = getCurrentTime() - startTime
  if (timeElapsed < frameInterval) {
    return false
  }
  return true
}

function requestHostTimeout(
  callback: (currentTime: number) => void,
  ms: number
) {
  taskTimeoutID = setTimeout(() => {
    callback(getCurrentTime())
  }, ms)
}

// delay任务处理逻辑
function cancelHostTimeout() {
  clearTimeout(taskTimeoutID)
  taskTimeoutID = -1
}

/**
 * 任务调度器的入口函数：新任务进入调度器
 * @param priorityLevel 优先级
 * @param callback 需要执行的任务
 * @param options 延迟时间
 */
function scheduleCallback(
  priorityLevel: PriorityLevel,
  callback: Callback,
  options?: { delay: number }
) {
  const currentTime = getCurrentTime()
  let startTime

  if (typeof options === 'object' && options !== null) {
    let delay = options.delay
    if (typeof delay === 'number' && delay > 0) {
      // 有效的延迟时间
      startTime = currentTime + delay
    } else {
      // 无效的延迟时间，则和正常任务一样
      startTime = currentTime
    }
  } else {
    // 无延迟的任务
    startTime = currentTime
  }

  let timeout: number
  switch (priorityLevel) {
    case ImmediatePriority:
      // 立即超时，SVVVVIP
      timeout = -1
      break
    case UserBlockingPriority:
      timeout = userBlockingPriorityTimeout
      break
    case IdlePriority:
      // 永不超时
      timeout = maxSigned31BitInt
      break
    case LowPriority:
      timeout = lowPriorityTimeout
      break
    case NormalPriority:
    default:
      timeout = normalPriorityTimeout
      break
  }

  const expirationTime = startTime + timeout // 过期时间，理论上的任务执行时间
  const newTask: Task = {
    id: taskIdCounter++, // 任务的唯一标识
    callback, // 需要执行的任务
    priorityLevel, // 优先级
    startTime: currentTime, // 任务开始执行的时间
    expirationTime, // 任务过期时间
    sortIndex: -1, // 任务的排序依据，最小堆的排序依据
  }

  if (startTime > currentTime) { // 说明是有延迟的任务
    // 延迟任务在timerQueue到达开始时间之后，就会被推入taskQueue
    // 所以延迟任务的sortIndex是根据startTime来排序
    newTask.sortIndex = startTime
    push(timerQueue, newTask)

    // 延迟任务经过倒计时，到了startTime的时间，就被推入taskQueue，而不是立马执行

    // 如果当前taskQueue已经没有任务可执行了，并且延迟队列有任务，则需要倒计时
    if (peek(taskQueue) === null && newTask === peek(timerQueue)) {
      if (isHostTimeoutScheduled) {
        // newTask 才是堆顶任务，才应该最先到达执行时间
        // newTask应该被倒计时，但是其他任务也被倒计时了，说明有问题，则需要取消之前的倒计时
        cancelHostTimeout() // 如果有其他延迟任务在倒计时
      } else {
        isHostTimeoutScheduled = true
      }
      requestHostTimeout(handleTimeout, startTime - currentTime)
    }
  } else {
    newTask.sortIndex = expirationTime // 以过期时间为基准进行排序，过期时间小的优先级高
    push(taskQueue, newTask) // 推入最小堆任务队列

    // 判断js主线程是否在调度，如果没有，则开始任务调度
    if (!isHostCallbackScheduled && !isPerformingWork) {
      isHostCallbackScheduled = true
      requestHostCallback()
    }
  }
}

/**
 * 主线程调度函数
 */
function requestHostCallback() {
  if (!isMessageLoopRunning) {
    isMessageLoopRunning = true
    schedulePerformWorkUntilDeadline()
  }
}

/**
 * 线程调度函数
 */
function performWorkUntilDeadline() {
  // 如果线程正在运行，则需要获取起始时间，并在时间切片5ms内执行任务
  if (isMessageLoopRunning) {
    const currentTime = getCurrentTime()
    startTime = currentTime
    let hasMoreWork = true
    try {
      hasMoreWork = flushWork(currentTime)
    } finally {
      if (hasMoreWork) {
        // 如果还有任务没执行完，则继续任务调度
        schedulePerformWorkUntilDeadline()
      } else {
        isMessageLoopRunning = false
      }
    }
  }
}

const channel = new MessageChannel() // 使用消息通道创建宏任务
const port = channel.port2
channel.port1.onmessage = performWorkUntilDeadline

/**
 * scheduleCallback加入新任务后，开始任务调度
 */
function schedulePerformWorkUntilDeadline() {
  port.postMessage(null) // 发送消息触发port1.onmessage： performWorkUntilDeadline
}

function flushWork(initialTime: number) {
  isHostCallbackScheduled = false
  isPerformingWork = true // 标记当前正在执行Work
  let previousPriorityLevel = currentPriorityLevel // 记录当前正在执行的任务的优先级
  try {
    return workLoop(initialTime)
  } finally {
    currentTask = null
    currentPriorityLevel = previousPriorityLevel
    isPerformingWork = false
  }
}

/**
 * 有很多task，每个task都有一个callback，callback执行完了，就执行下一个task
 * 一个work就是一个时间切片内执行的一些task
 * 时间切片要循环，就是work要循环(loop)
 * @param initialTime 
 * @returns 返回true，表示还有任务没有执行完，需要继续执行
 */
function workLoop(initialTime: number): boolean {
  let currentTime = initialTime

  // 在正常的任务调度前，先看看延迟任务是否有任务到达开始执行的时间
  // 如果有，则推入taskQueue队列中一起进行任务的调度
  advanceTimers(currentTime)

  currentTask = peek(taskQueue) // 获取最小堆顶任务
  while (currentTask !== null) {
    // 如果任务过期时间大于当前时间，并且当前时间大于时间切片，则需要中断任务，交还主线程
    if (currentTask.expirationTime > currentTime && shouldYieldToHost()) {
      break
    }
    const callback = currentTask.callback // 获取任务回调函数
    if (typeof callback === 'function') {
      currentTask.callback = null // 任务执行完，则从任务队列中删除
      currentPriorityLevel = currentTask.priorityLevel
      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime // 判断是否过期
      const continuationCallback = callback(didUserCallbackTimeout) // 执行任务
      currentTime = getCurrentTime()
      if (typeof continuationCallback === 'function') {
        currentTask.callback = continuationCallback // 表示上一次任务还没执行完，需要保留且需再次执行
        advanceTimers(currentTime)
        return true
      } else {
        // 表示任务执行完，则从任务队列中删除，但是需先判断是不是堆顶元素，如果是堆顶元素，则从任务队列中删除
        // 如果不是堆顶任务，则不处理，因为上面已经设置currentTask.callback = null，最终会自动删除
        if (currentTask === peek(taskQueue)) {
          pop(taskQueue)
        }
        advanceTimers(currentTime)
      }
    } else {
      pop(taskQueue) // 如果不是有效的任务，则表示在堆顶，需从任务队列中删除
    }

    currentTask = peek(taskQueue) // 继续下一个任务的调度
  }

  // 经过循环，如果还有任务没执行完，则表示还有任务需要继续调度
  if (currentTask !== null) {
    return true
  } else {
    // 这里表示当前任务队列已经没有任务了，但是延迟任务还有任务，则需要倒计时
    const firstTimer = peek(timerQueue)
    if (firstTimer !== null) {
      requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime)
    }
    return false
  }
}

/**
 * 取消某个任务，由于最小堆没法直接删除，因此只能初步把 task.callback 设置为null
 * 因为在任务调度过程中，这个任务经过最小堆化，会逐渐位于堆顶，这个时候就可以删掉了
 */
function cancelCallback() {
  currentTask!.callback = null
}

/**
 * 获取当前正在执行任务的优先级
 * @returns 
 */
function getCurrentPriorityLevel(): PriorityLevel {
  return currentPriorityLevel
}

/**
 * 根据当前时间和延迟任务的开始时间，判断延迟任务是否已经到达开始时间
 * 如果已经到达开始时间，就把延迟任务从timerQueue中推入taskQueue
 * 推入taskQueue后则开始正常的任务调度
 * @param currentTime 
 * @returns 
 */
function advanceTimers(currentTime: number) {
  let timer = peek(timerQueue)
  while (timer !== null) {
    if (timer.callback === null) {
      pop(timerQueue)  // 无效的任务，直接从延迟任务队列中删除
    } else if (timer.startTime <= currentTime) {
      pop(timerQueue) // 有效的任务，说明延迟任务已经到达开始时间，可以推入taskQueue
      timer.sortIndex = timer.expirationTime // taskQueue以过期时间为基准进行排序，过期时间小的优先级高
      push(taskQueue, timer)
    } else {
      return
    }
    timer = peek(timerQueue)
  }
}

function handleTimeout(currentTime: number) {
  isHostTimeoutScheduled = false
  advanceTimers(currentTime)

  // 继续判断主线程是不是空闲的
  if (!isHostCallbackScheduled) {
    if (peek(taskQueue) !== null) {
      isHostCallbackScheduled = true
      requestHostCallback() // 又开始调度任务
    } else {
      // 如果主线程没有任务了，则继续判断延迟任务，开始延迟任务的倒计时
      const firstTimer = peek(timerQueue)
      if (firstTimer !== null) {
        requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime)
      }
    }
  }
}


export {
  ImmediatePriority,
  UserBlockingPriority,
  NormalPriority,
  IdlePriority,
  LowPriority,
  scheduleCallback,
  cancelCallback,
  getCurrentPriorityLevel,
  shouldYieldToHost as shouldYield,
}