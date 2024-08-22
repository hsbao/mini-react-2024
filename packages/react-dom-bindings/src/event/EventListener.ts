/**
 * 冒泡事件绑定
 * @param target 事件目标
 * @param eventType 事件类型
 * @param listener 事件处理函数
 * @param passive 标记是否被动 解决页面滚动，鼠标滚轮滑动Passive控制台警告
 * @returns listener
 */
export function addEventBubbleListener(
  target: EventTarget,
  eventType: string,
  listener: Function,
  passive: boolean
) {
  target.addEventListener(eventType, listener as any, {
    capture: false,
    passive,
  })
  return listener
}

/**
 * 捕获事件绑定
 * @param target 事件目标
 * @param eventType 事件类型
 * @param listener 事件处理函数
 * @param passive  标记是否被动 解决页面滚动，鼠标滚轮滑动Passive控制台警告
 * @returns listener
 */
export function addEventCaptureListener(
  target: EventTarget,
  eventType: string,
  listener: Function,
  passive: boolean
) {
  target.addEventListener(eventType, listener as any, {
    capture: true,
    passive,
  })
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