import type { Fiber } from 'react-reconciler/src/ReactInternalTypes'

import { getFiberCurrentPropsFromNode } from '../client/ReactDOMComponentTree'

/**
 * 如果是这些标签且disabled为true，则阻止事件
 * @param tag 标签名
 * @returns 
 */
function isInteractive(tag: string): boolean {
  return (
    tag === "button" ||
    tag === "input" ||
    tag === "select" ||
    tag === "textarea"
  )
}

/**
 * 判断是否阻止事件
 * @param name react事件名 (e.g. `onClick`)
 * @param type 标签名 (e.g. `button`)
 * @param props 当前fiber的props
 * @returns 
 */
function shouldPreventMouseEvent(
  name: string,
  type: string,
  props: any
): boolean {
  switch (name) {
    case "onClick":
    case "onClickCapture":
    case "onDoubleClick":
    case "onDoubleClickCapture":
    case "onMouseDown":
    case "onMouseDownCapture":
    case "onMouseMove":
    case "onMouseMoveCapture":
    case "onMouseUp":
    case "onMouseUpCapture":
    case "onMouseEnter":
      return !!(props.disabled && isInteractive(type))
    default:
      return false
  }
}

/**
 * 根据当前fiber和react事件名获取事件处理函数
 * @param inst 当前fiber
 * @param registrationName react事件名 (e.g. `onClick`)
 */
export default function getListener(
  inst: Fiber,
  registrationName: string
) {
  const stateNode = inst.stateNode
  if (stateNode === null) {
    // Work in progress (ex: onload events in incremental mode).
    return null
  }

  // 因为在ReactFiberCompleteWork的时候，会将fiber的props赋值给stateNode
  // 所以这里可以直接从stateNode中获取props
  const props = getFiberCurrentPropsFromNode(stateNode)
  if (props === null) {
    return null
  }

  const listener = props[registrationName] // 获取事件处理函数 onClick={() => {}}
  if (shouldPreventMouseEvent(registrationName, inst.type, props)) {
    return null
  }

  if (listener && typeof listener !== 'function') {
    throw new Error(
      `Expected \`${registrationName}\` listener to be a function, instead got a value of \`${typeof listener}\` type.`
    )
  }

  return listener
}