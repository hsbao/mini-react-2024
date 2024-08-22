import { Fiber } from 'react-reconciler/src/ReactInternalTypes'
import { DOMEventName } from '../DOMEventNames'
import { accumulateTwoPhaseListeners, AnyNativeEvent, DispatchQueue } from '../DOMPluginEventSystem'
import { EventSystemFlags } from '../EventSystemFlags'
import { registerTwoPhaseEvent } from '../EventRegistry'
import isTextInputElement from '../isTextInputElement'
import { SyntheticEvent } from '../SyntheticEvent'


function registerEvents() {
  registerTwoPhaseEvent('onChange', [
    'change',
    'click',
    'focusin',
    'focusout',
    'input',
    'keydown',
    'keyup',
    'selectionchange',
  ])
}


/**
 * 给dispatchQueue进行赋值
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
  // textarea input， 文本。其它的类型先不考虑
  const targetNode = targetInst ? targetInst.stateNode : null
  if (isTextInputElement(targetNode)) {
    if (domEventName === 'input' || domEventName === 'change') {
      // 判断值是否发生变化，如果没变化，则不触发onChange事件，解决了blur时onChange事件触发两次的问题
      const inst = getInstIfValueChanged(targetInst as Fiber, targetNode)
      if (!inst) {
        return
      }

      const listeners = accumulateTwoPhaseListeners(targetInst, 'onChange')

      if (listeners.length > 0) {
        const event = new SyntheticEvent(
          'onChange',
          'change',
          null,
          nativeEvent,
          nativeEventTarget
        )
        dispatchQueue.push({ event, listeners })
      }
    }
  }
}

function getInstIfValueChanged(
  targetInst: Fiber,
  targetNode: HTMLInputElement
): boolean {
  const oldValue = targetInst.pendingProps.value // 上次渲染的值
  const newValue = targetNode.value // 当前输入框的值
  return oldValue !== newValue
}

export {
  registerEvents,
  extractEvents
}