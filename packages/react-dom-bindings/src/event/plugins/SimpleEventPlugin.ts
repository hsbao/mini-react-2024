import { Fiber } from 'react-reconciler/src/ReactInternalTypes'
import { registerSimpleEvents, topLevelEventsToReactNames } from '../DOMEventProperties'
import { accumulateSinglePhaseListeners, AnyNativeEvent, DispatchQueue } from '../DOMPluginEventSystem'
import type { DOMEventName } from '../DOMEventNames'
import { EventSystemFlags, IS_CAPTURE_PHASE } from '../EventSystemFlags'
import { SyntheticEvent, SyntheticMouseEvent } from '../SyntheticEvent'

/**
 *  给dispatchQueue进行赋值
 * @param dispatchQueue 事件队列
 * @param domEventName 事件名称 click 
 * @param targetInst 当前事件触发的Fiber节点
 * @param nativeEvent 事件event对象
 * @param nativeEventTarget 事件触发的DOM节点
 * @param eventSystemFlags 事件系统标志，用于判断是捕获还是冒泡
 * @param targetContainer 事件绑定的容器，17以前是document，17以后是root节点
 */
function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: null | Fiber,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: null | EventTarget,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget
): void {
  // click -> onClick
  const reactName = topLevelEventsToReactNames.get(domEventName)
  if (reactName === undefined) {
    return
  }

  let SyntheticEventCtor = SyntheticEvent

  switch (domEventName) {
    case "click":
      // Firefox creates a click event on right mouse clicks. This removes the
      // unwanted click events.
      // TODO: Fixed in https://phabricator.services.mozilla.com/D26793. Can
      // probably remove.
      if ((nativeEvent as any).button === 2) {
        return
      }
    /* falls through */
    case "auxclick":
    case "dblclick":
    case "mousedown":
    case "mousemove":
    case "mouseup":
    // TODO: Disabled elements should not respond to mouse events
    /* falls through */
    case "mouseout":
    case "mouseover":
    case "contextmenu":
      SyntheticEventCtor = SyntheticMouseEvent
      break
  }

  const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0 // 判断是否是捕获阶段

  // 如果是 scroll 事件，或者是 scrollend 事件，那么只会在冒泡阶段触发
  const accumulateTargetOnly =
    !inCapturePhase &&
    (domEventName === 'scroll' || domEventName === 'scrollend')

  const listeners = accumulateSinglePhaseListeners(
    targetInst,
    reactName,
    nativeEvent.type,
    inCapturePhase,
    accumulateTargetOnly,
    nativeEvent
  )

  if (listeners.length > 0) {
    // 创建合成事件对象
    const event = new SyntheticEventCtor(
      reactName,
      domEventName,
      null,
      nativeEvent,
      nativeEventTarget
    )
    dispatchQueue.push({ event, listeners })
  }
}

export { registerSimpleEvents as registerEvents, extractEvents }