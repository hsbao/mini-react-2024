/**
 * 冒泡事件绑定
 * @param target 事件目标
 * @param eventType 事件类型
 * @param listener 事件处理函数
 * @returns listener
 */
export function addEventBubbleListener(
  target: EventTarget,
  eventType: string,
  listener: Function
) {
  target.addEventListener(eventType, listener as any, false)
  return listener
}

/**
 * 捕获事件绑定
 * @param target 事件目标
 * @param eventType 事件类型
 * @param listener 事件处理函数
 * @returns listener
 */
export function addEventCaptureListener(
  target: EventTarget,
  eventType: string,
  listener: Function
) {
  target.addEventListener(eventType, listener as any, true)
  return listener
}

/**
 * 移除事件绑定
 * @param target 事件目标
 * @param eventType 事件类型
 * @param listener 事件处理函数
 * @param capture 是否捕获
 */
export function removeEventListener(
  target: EventTarget,
  eventType: string,
  listener: Function,
  capture: boolean
) {
  target.removeEventListener(eventType, listener as any, capture)
}