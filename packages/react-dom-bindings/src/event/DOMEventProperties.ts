/*
 * @Descripttion: 事件优先级记录
 */

import type { DOMEventName } from './DOMEventNames'
import { registerTwoPhaseEvent } from './EventRegistry'

export const topLevelEventsToReactNames: Map<DOMEventName, string | null> =
  new Map()

const simpleEventPluginEvents = [
  "abort",
  "auxClick",
  "cancel",
  "canPlay",
  "canPlayThrough",
  "click",
  "close",
  "contextMenu",
  "copy",
  "cut",
  "drag",
  "dragEnd",
  "dragEnter",
  "dragExit",
  "dragLeave",
  "dragOver",
  "dragStart",
  "drop",
  "durationChange",
  "emptied",
  "encrypted",
  "ended",
  "error",
  "gotPointerCapture",
  "input",
  "invalid",
  "keyDown",
  "keyPress",
  "keyUp",
  "load",
  "loadedData",
  "loadedMetadata",
  "loadStart",
  "lostPointerCapture",
  "mouseDown",
  "mouseMove",
  "mouseOut",
  "mouseOver",
  "mouseUp",
  "paste",
  "pause",
  "play",
  "playing",
  "pointerCancel",
  "pointerDown",
  "pointerMove",
  "pointerOut",
  "pointerOver",
  "pointerUp",
  "progress",
  "rateChange",
  "reset",
  "resize",
  "seeked",
  "seeking",
  "stalled",
  "submit",
  "suspend",
  "timeUpdate",
  "touchCancel",
  "touchEnd",
  "touchStart",
  "volumeChange",
  "scroll",
  "scrollEnd",
  "toggle",
  "touchMove",
  "waiting",
  "wheel",
]

function registerSimpleEvent(domEventName: DOMEventName, reactName: string) {
  // 把原生事件和react事件做一个映射 { click: 'onClick' }
  topLevelEventsToReactNames.set(domEventName, reactName)

  registerTwoPhaseEvent(reactName, [domEventName]) // 注册两个阶段（捕获和冒泡）的事件
}

export function registerSimpleEvents() {
  // click -> onClick
  for (let i = 0; i < simpleEventPluginEvents.length; i++) {
    const eventName = simpleEventPluginEvents[i]
    const domEventName = eventName.toLowerCase() as DOMEventName
    const capitalizedEvent = eventName[0].toUpperCase() + eventName.slice(1)
    registerSimpleEvent(domEventName, "on" + capitalizedEvent)
  }

  registerSimpleEvent("dblclick", "onDoubleClick")
  registerSimpleEvent("focusin", "onFocus")
  registerSimpleEvent("focusout", "onBlur")
}

