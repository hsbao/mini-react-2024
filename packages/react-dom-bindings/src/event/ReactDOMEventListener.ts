/*
 * @Descripttion: 派发事件相关代码
 */

import {
  ContinuousEventPriority, DefaultEventPriority, DiscreteEventPriority, IdleEventPriority, getCurrentUpdatePriority,
  setCurrentUpdatePriority, type EventPriority
} from "react-reconciler/src/ReactEventPriorities"
import type { DOMEventName } from './DOMEventNames'

import { invokeGuardedCallbackAndCatchFirstError } from 'shared/ReactErrorUtils'

import * as Scheduler from 'scheduler'
import {
  IdlePriority,
  ImmediatePriority,
  LowPriority,
  NormalPriority,
  UserBlockingPriority,
} from 'scheduler/src/SchedulerPriorities'

import type {
  DispatchListener,
  AnyNativeEvent,
  DispatchQueue
} from './DOMPluginEventSystem'
import { extractEvents } from './DOMPluginEventSystem'

import { EventSystemFlags, IS_CAPTURE_PHASE } from "./EventSystemFlags"
import { getClosestInstanceFromNode } from "../client/ReactDOMComponentTree"
import { ReactSyntheticEvent } from "./ReactSyntheticEventType"
import { Fiber } from "react-reconciler/src/ReactInternalTypes"

/**
 * 根据事件名称获取事件优先级
 * @param domEventName 事件名称
 * @returns 
 */
export function getEventPriority(domEventName: DOMEventName): EventPriority {
  switch (domEventName) {
    // Used by SimpleEventPlugin:
    case "cancel":
    case "click":
    case "close":
    case "contextmenu":
    case "copy":
    case "cut":
    case "auxclick":
    case "dblclick":
    case "dragend":
    case "dragstart":
    case "drop":
    case "focusin":
    case "focusout":
    case "input":
    case "invalid":
    case "keydown":
    case "keypress":
    case "keyup":
    case "mousedown":
    case "mouseup":
    case "paste":
    case "pause":
    case "play":
    case "pointercancel":
    case "pointerdown":
    case "pointerup":
    case "ratechange":
    case "reset":
    case "resize":
    case "seeked":
    case "submit":
    case "touchcancel":
    case "touchend":
    case "touchstart":
    case "volumechange":
    // Used by polyfills: (fall through)
    case "change":
    case "selectionchange":
    case "textInput":
    case "compositionstart":
    case "compositionend":
    case "compositionupdate":
    // Only enableCreateEventHandleAPI: (fall through)
    case "beforeblur":
    case "afterblur":
    // Not used by React but could be by user code: (fall through)
    case "beforeinput":
    case "blur":
    case "fullscreenchange":
    case "focus":
    case "hashchange":
    case "popstate":
    case "select":
    case "selectstart":
      return DiscreteEventPriority
    case "drag":
    case "dragenter":
    case "dragexit":
    case "dragleave":
    case "dragover":
    case "mousemove":
    case "mouseout":
    case "mouseover":
    case "pointermove":
    case "pointerout":
    case "pointerover":
    case "scroll":
    case "toggle":
    case "touchmove":
    case "wheel":
    // Not used by React but could be by user code: (fall through)
    case "mouseenter":
    case "mouseleave":
    case "pointerenter":
    case "pointerleave":
      return ContinuousEventPriority
    case "message": {
      // 我们可能在调度器回调中。
      // 最终，这种机制将被替换为检查本机调度器上的当前优先级。
      const schedulerPriority = Scheduler.getCurrentPriorityLevel()
      switch (schedulerPriority) {
        case ImmediatePriority:
          return DiscreteEventPriority
        case UserBlockingPriority:
          return ContinuousEventPriority
        case NormalPriority:
        case LowPriority:
          return DefaultEventPriority
        case IdlePriority:
          return IdleEventPriority
        default:
          return DefaultEventPriority
      }
    }
    default:
      return DefaultEventPriority
  }
}

/**
 * 根据事件名称，创建不同优先级的监听函数
 * @param targetContainer 事件绑定的容器
 * @param domEventName 事件名称
 * @param eventSystemFlags 事件系统标志
 * @returns 
 */
export function createEventListenerWrapperWithPriority(
  targetContainer: EventTarget,
  domEventName: DOMEventName,
  eventSystemFlags: number
): Function {
  /**
   * 根据事件名称，获取优先级
   * 比如click、input、drop等对应 DiscreteEventPriority
   * drag、scroll等对应 ContinuousEventPriority，
   */
  const eventPriority = getEventPriority(domEventName)
  let listenerWrapper

  switch (eventPriority) {
    case DiscreteEventPriority:
      listenerWrapper = dispatchDiscreteEvent
      break
    case ContinuousEventPriority:
      listenerWrapper = dispatchContinuousEvent
      break
    case DefaultEventPriority:
    default:
      listenerWrapper = dispatchEvent
      break
  }

  return listenerWrapper.bind(
    null,
    domEventName,
    eventSystemFlags,
    targetContainer
  )
}

/**
 * 根据事件优先级不同触发不同的事件派发
 * @param domEventName 事件名称
 * @param eventSystemFlags 事件系统标志
 * @param container 事件绑定的容器，17以前是document，17以后是root节点
 * @param nativeEvent 事件event对象
 */
function dispatchDiscreteEvent(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  container: EventTarget,
  nativeEvent: AnyNativeEvent
) {
  // ! 1. 记录上一次的事件优先级
  const previousPriority = getCurrentUpdatePriority()
  try {
    // !2. 设置当前事件优先级为DiscreteEventPriority
    setCurrentUpdatePriority(DiscreteEventPriority)
    // !3. 调用dispatchEvent，执行事件
    dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent)
  } finally {
    // !4. 恢复
    setCurrentUpdatePriority(previousPriority)
  }
}

// 根据事件优先级不同触发不同的事件派发
function dispatchContinuousEvent(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  container: EventTarget,
  nativeEvent: AnyNativeEvent
) {
  const previousPriority = getCurrentUpdatePriority()
  try {
    setCurrentUpdatePriority(ContinuousEventPriority)
    dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent)
  } finally {
    setCurrentUpdatePriority(previousPriority)
  }
}

/**
 * 事件派发统一入口
 * @param domEventName 事件名称
 * @param eventSystemFlags 事件系统标志，用于判断是捕获还是冒泡
 * @param targetContainer 事件绑定的容器，17以前是document，17以后是root节点
 * @param nativeEvent 事件event对象
 */
export function dispatchEvent(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget,
  nativeEvent: AnyNativeEvent
) {
  const nativeEventTarget = nativeEvent.target // 根据事件对象，获取事件触发的DOM节点

  // ! 1. 根据DOM节点获取对应的fiber节点
  const return_targetInst = getClosestInstanceFromNode(nativeEventTarget as any)

  const dispatchQueue: DispatchQueue = []

  // 给dispatchQueue添加事件
  extractEvents(
    dispatchQueue,
    domEventName,
    return_targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer
  )

  processDispatchQueue(dispatchQueue, eventSystemFlags)
}

function processDispatchQueueItemsInOrder(
  event: ReactSyntheticEvent,
  dispatchListeners: Array<DispatchListener>,
  inCapturePhase: boolean
): void {
  let prevInstance: Fiber | null = null

  if (inCapturePhase) {
    // 捕获阶段，从上往下执行
    for (let i = dispatchListeners.length - 1; i >= 0; i--) {
      const { instance, currentTarget, listener } = dispatchListeners[i]
      if (prevInstance !== instance && event.isPropagationStopped()) {
        return
      }
      executeDispatch(event, listener, currentTarget)
      prevInstance = instance
    }
  } else {
    // 冒泡阶段，从下往上执行
    for (let i = 0; i < dispatchListeners.length; i++) {
      const { instance, currentTarget, listener } = dispatchListeners[i]
      if (prevInstance !== instance && event.isPropagationStopped()) {
        return
      }
      executeDispatch(event, listener, currentTarget)
      prevInstance = instance
    }
  }
}

/**
 * 遍历事件队列，执行事件
 * @param dispatchQueue 事件派发队列
 * @param eventSystemFlags 事件系统标志，用于判断是捕获还是冒泡
 */
export function processDispatchQueue(
  dispatchQueue: DispatchQueue,
  eventSystemFlags: EventSystemFlags
) {
  const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0 // 判断是否是捕获阶段
  for (let i = 0; i < dispatchQueue.length; i++) {
    const { event, listeners } = dispatchQueue[i]
    processDispatchQueueItemsInOrder(event, listeners, inCapturePhase)
  }
}

/**
 * 执行事件
 * @param event 合成事件对象
 * @param listener 事件处理函数
 * @param currentTarget 事件触发的DOM节点
 */
function executeDispatch(
  event: ReactSyntheticEvent,
  listener: Function,
  currentTarget: EventTarget
): void {
  const type = event.type || "unknown-event"
  // listener(event) //执行事件处理函数

  // 调用这个是因为在react中，会加一个错误处理机制，如果事件处理函数执行出错，会捕获错误，然后执行错误处理函数
  invokeGuardedCallbackAndCatchFirstError(type, listener, undefined, event)
}