import type { DOMEventName } from './DOMEventNames'
import * as SimpleEventPlugin from './plugins/SimpleEventPlugin'
import * as ChangeEventPlugin from './plugins/ChangeEventPlugin'
import { allNativeEvents } from './EventRegistry'
import { Fiber } from 'react-reconciler/src/ReactInternalTypes'

import {
  EventSystemFlags,
  IS_CAPTURE_PHASE,
  SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS,
} from './EventSystemFlags'
import { addEventBubbleListener, addEventCaptureListener } from './EventListener'
import { createEventListenerWrapperWithPriority } from './ReactDOMEventListener'
import { ReactSyntheticEvent } from './ReactSyntheticEventType'
import { HostComponent } from 'react-reconciler/src/ReactWorkTags'
import getListener from './getListener'

export type AnyNativeEvent = Event | KeyboardEvent | MouseEvent | TouchEvent

export type DispatchListener = {
  instance: null | Fiber
  listener: Function
  currentTarget: EventTarget
}

// 合成事件的类型
type DispatchEntry = {
  event: ReactSyntheticEvent
  listeners: Array<DispatchListener>
}

export type DispatchQueue = Array<DispatchEntry>

// 普通事件注册，如click, drag, drop等
SimpleEventPlugin.registerEvents()
// change事件注册
ChangeEventPlugin.registerEvents()

// 需要分别附加到媒体元素的事件列表
export const mediaEventTypes: Array<DOMEventName> = [
  'abort',
  'canplay',
  'canplaythrough',
  'durationchange',
  'emptied',
  'encrypted',
  'ended',
  'error',
  'loadeddata',
  'loadedmetadata',
  'loadstart',
  'pause',
  'play',
  'playing',
  'progress',
  'ratechange',
  'resize',
  'seeked',
  'seeking',
  'stalled',
  'suspend',
  'timeupdate',
  'volumechange',
  'waiting',
]

/**
 * 我们不应该将这些事件委托给容器，而是应该直接在实际的目标元素上设置它们
 * 这主要是因为这些事件在DOM中的冒泡行为并不一致。
 * 
 * 为了减少字节数，我们将上述媒体事件数组插入到这个 Set 中
 * 注意：'error' 事件并不是一个独占的媒体事件，也可能发生在其他元素上。我们不会重复这个事件，而是直接从媒体事件数组中取出。
 */
export const nonDelegatedEvents: Set<DOMEventName> = new Set([
  'cancel',
  'close',
  'invalid',
  'load',
  'scroll',
  'scrollend',
  'toggle',
  ...mediaEventTypes,
])

// 事件绑定
const listeningMarker = '_reactListening' + Math.random().toString(36).slice(2)
export function listenToAllSupportedEvents(rootContainerElement: EventTarget) {
  // 防止重复绑定
  if (!(rootContainerElement as any)[listeningMarker]) {
    (rootContainerElement as any)[listeningMarker] = true

    allNativeEvents.forEach((domEventName) => {
      // selectionchange 另外特殊处理
      if (domEventName !== 'selectionchange') {
        /**
         * 捕获、冒泡阶段都绑定事件
         * 有些事件在DOM上冒泡行为不一致，这些事件就不做事件委托
         */
        if (!nonDelegatedEvents.has(domEventName)) {
          listenToNativeEvent(domEventName, false, rootContainerElement) // 冒泡阶段
        }
        listenToNativeEvent(domEventName, true, rootContainerElement) // 捕获阶段
      }
    })
  }
}

/**
 * 
 * @param targetContainer 事件绑定目标
 * @param domEventName 事件名称
 * @param eventSystemFlags 事件系统标记（是否标记为捕获）
 * @param isCapturePhaseListener 是否在捕获阶段绑定事件
 */
function addTrappedEventListener(
  targetContainer: EventTarget,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  isCapturePhaseListener: boolean
) {
  // ! 1. 获取对应事件，事件定义在ReactDOMEventListener.js中
  // 如DiscreteEventPriority对应dispatchDiscreteEvent，ContinuousEventPriority对应dispatchContinuousEvent
  let listener = createEventListenerWrapperWithPriority(
    targetContainer,
    domEventName,
    eventSystemFlags
  )

  let isPassiveListener: boolean = false // 解决页面滚动Passive控制台警告
  if (
    domEventName === 'touchstart' ||
    domEventName === 'touchmove' ||
    domEventName === 'wheel'
  ) {
    isPassiveListener = true
  }

  // ! 2. 绑定事件
  if (isCapturePhaseListener) {
    addEventCaptureListener(targetContainer, domEventName, listener, isPassiveListener)
  } else {
    addEventBubbleListener(targetContainer, domEventName, listener, isPassiveListener)
  }
}

export function listenToNativeEvent(
  domEventName: DOMEventName, // 事件名称
  isCapturePhaseListener: boolean, // 是否在捕获阶段绑定事件
  target: EventTarget // 事件绑定目标
): void {
  let eventSystemFlags = 0
  if (isCapturePhaseListener) {
    eventSystemFlags |= IS_CAPTURE_PHASE // 捕获阶段标记
  }
  addTrappedEventListener(
    target,
    domEventName,
    eventSystemFlags,
    isCapturePhaseListener
  )
}

/**
 * @param dispatchQueue 事件队列
 * @param domEventName 事件名称 
 * @param targetInst 当前事件触发的Fiber节点
 * @param nativeEvent 事件event对象
 * @param nativeEventTarget 事件触发的DOM节点
 * @param eventSystemFlags 事件系统标志，用于判断是捕获还是冒泡
 * @param targetContainer 事件绑定的容器，17以前是document，17以后是root节点
 */
export function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: null | Fiber,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: null | EventTarget,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget
) {
  SimpleEventPlugin.extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer
  )

  // 如果这样直接调用，在input输入的时候，会触发两次onChange事件，所以要加上判断
  // 这个判断意思是不是捕获阶段才触发
  if ((eventSystemFlags & SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS) === 0) {
    ChangeEventPlugin.extractEvents(
      dispatchQueue,
      domEventName,
      targetInst,
      nativeEvent,
      nativeEventTarget,
      eventSystemFlags,
      targetContainer
    )
  }
}

/**
 * 积累事件，通过targetFiber -> rootFiber累积所有fiber和listeners。
 * @param targetFiber 事件触发的Fiber节点
 * @param reactName react事件名称 onClick
 * @param nativeEventType 事件类型 click
 * @param inCapturePhase 是否在捕获阶段
 * @param accumulateTargetOnly 
 * @param nativeEvent 原生事件event对象
 * @returns 
 */
export function accumulateSinglePhaseListeners(
  targetFiber: Fiber | null,
  reactName: string | null,
  nativeEventType: string,
  inCapturePhase: boolean,
  accumulateTargetOnly: boolean,
  nativeEvent: AnyNativeEvent
): Array<DispatchListener> {
  const captureName = reactName !== null ? reactName + 'Capture' : null
  // react事件名称，如冒泡onClick, 捕获onClickCapture
  const reactEventName = inCapturePhase ? captureName : reactName
  let listeners: Array<DispatchListener> = []

  let instance = targetFiber

  // 通过target -> root累积所有fiber和listeners。
  // 从触发事件的Fiber节点开始向上遍历,直到根节点，查找所有listeners
  // 因为捕获阶段阶段，会从祖先元素，依次向下传播
  // 而冒泡阶段，会从子元素，依次向上传播
  // 所以需要从触发事件的Fiber节点开始向上遍历，找到所有listeners
  // 然后在dispatchEvent中，根据事件传播方向，按不同顺序执行listeners
  while (instance !== null) {
    const { stateNode, tag } = instance
    // 处理位于HostComponents（即原生dom,如 <div> 元素）上的listeners
    if (tag === HostComponent && stateNode !== null) {
      // 根据当前的fiber和react事件名称，获取对应的listener
      // 如on* listeners, i.e. onClick or onClickCapture
      const listener = getListener(instance, reactEventName as string)
      if (listener != null) {
        listeners.push({
          instance,
          listener,
          currentTarget: stateNode,
        })
      }
    }

    // 如果是 scroll 事件，或者是 scrollend 事件，那么只会在冒泡阶段触发
    // 如果只是为target累积事件，那么我们就不会继续通过 React Fiber 树传播以查找其它listeners。
    if (accumulateTargetOnly) {
      break
    }

    instance = instance.return
  }

  return listeners
}

/**
 * 处理change事件，支持冒泡、捕获
 * @param targetFiber 事件触发的Fiber节点
 * @param reactName react事件名称 onChange
 */
export function accumulateTwoPhaseListeners(
  targetFiber: Fiber | null,
  reactName: string | null
): Array<DispatchListener> {
  const captureName = reactName !== null ? reactName + 'Capture' : null

  let listeners: Array<DispatchListener> = []
  let instance = targetFiber
  while (instance !== null) {
    const { stateNode, tag } = instance
    if (tag === HostComponent && stateNode !== null) {
      // 获取捕获阶段的listener
      const captureListener = getListener(instance, captureName as string)
      if (captureListener != null) {
        listeners.unshift({
          instance,
          listener: captureListener,
          currentTarget: stateNode,
        })
      }
      // 获取冒泡阶段的listener
      const bubbleListener = getListener(instance, reactName as string)
      if (bubbleListener != null) {
        listeners.push({
          instance,
          listener: bubbleListener,
          currentTarget: stateNode,
        })
      }
    }
    instance = instance.return // 向上遍历
  }

  return listeners
}