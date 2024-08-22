import { isNum, isStr } from 'shared/utils'
import { Fiber } from './ReactInternalTypes'
import { ClassComponent, ContextConsumer, ContextProvider, Fragment, FunctionComponent, HostComponent, HostRoot, HostText, MemoComponent, SimpleMemoComponent } from './ReactWorkTags'
import { popProvider } from './ReactFiberNewContext'
import { registrationNameDependencies } from 'react-dom-bindings/src/event/EventRegistry'
import { precacheFiberNode, updateFiberProps } from 'react-dom-bindings/src/client/ReactDOMComponentTree'


export function completeWork(
  current: Fiber | null,
  workInProgress: Fiber
): Fiber | null {
  const newProps = workInProgress.pendingProps

  switch (workInProgress.tag) {
    case FunctionComponent:
    case ClassComponent:
    case Fragment:
    case ContextConsumer:
    case MemoComponent:
    case SimpleMemoComponent:
    case HostRoot: {
      return null
    }
    case ContextProvider: {
      // 说明Provider组件被使用了,所以需要把当前Provider的context和value从栈里删除
      popProvider(workInProgress.type._context)
      return null
    }
    case HostComponent: {
      // 原生标签，type是标签名
      const { type } = workInProgress
      if (current !== null && workInProgress.stateNode !== null) {
        // update
        updateHostComponent(current, workInProgress, type, newProps)
      } else {
        // mount
        // 1. 创建真实dom
        const instance = document.createElement(type)
        // 2. 初始化dom属性
        finalizeInitialChildren(instance, null, newProps)
        // 3. 把子dom挂载到父dom上
        appendAllChildren(instance, workInProgress)
        workInProgress.stateNode = instance
      }
      // 4. 将Fiber存到对应的DOM节点上,事件派发的时候需要用
      // 在事件派发的时候，需要通过DOM节点找到对应的Fiber，从而找到对应的listener
      precacheFiberNode(workInProgress, workInProgress.stateNode as Element)

      // 5. 将newProps存到对应的DOM节点上,事件派发的时候需要用
      // 在事件派发的时候，需要通过DOM节点找到对应的props，从而找到对应的listener
      updateFiberProps(workInProgress.stateNode, newProps)
      return null
    }
    case HostText: {
      workInProgress.stateNode = document.createTextNode(newProps)
      precacheFiberNode(workInProgress, workInProgress.stateNode as Element)
      updateFiberProps(workInProgress.stateNode, newProps)
      return null
    }
  }

  throw new Error(
    `Unknown unit of work tag (${workInProgress.tag}). This error is likely caused by a bug in ` +
    "React. Please file an issue."
  )
}

// 初始化/更新属性
function finalizeInitialChildren(
  domElement: Element,
  prevProps: any,
  nextProps: any
) {
  // 遍历老的props
  for (const propKey in prevProps) {
    const prevProp = prevProps[propKey]
    if (propKey === 'children') {
      if (isStr(prevProp) || isNum(prevProp)) {
        domElement.textContent = ''
      }
    } else {
      // if (propKey === 'onClick') {
      //   domElement.removeEventListener('click', prevProp)
      // }
      if (registrationNameDependencies[propKey]) { // 事件处理
        // domElement.removeEventListener('click', prevProp)
      } else {
        if (!(prevProp in nextProps)) {
          (domElement as any)[propKey] = ''
        }
      }
    }
  }

  // 遍历新的props
  for (const propKey in nextProps) {
    const nextProp = nextProps[propKey]
    if (propKey === "children") {
      if (isStr(nextProp) || isNum(nextProp)) {
        domElement.textContent = nextProp + ''// 属性
      }
    } else {
      // if (propKey === 'onClick') {
      //   domElement.removeEventListener('click', prevProp)
      // }
      if (registrationNameDependencies[propKey]) { // 事件处理
        // domElement.removeEventListener('click', prevProp)
      } else {
        (domElement as any)[propKey] = nextProp
      }
    }
  }
}

function updateHostComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  type: string,
  newProps: any
) {
  if (current?.memoizedProps === newProps) {
    return
  }
  finalizeInitialChildren(
    workInProgress.stateNode as Element,
    current?.memoizedProps,
    newProps
  )
}

// fiber.stateNode是DOM节点
export function isHost(fiber: Fiber): boolean {
  return fiber.tag === HostComponent || fiber.tag === HostText
}

function appendAllChildren(parent: Element, workInProgress: Fiber) {
  let nodeFiber = workInProgress.child // 链表结构，处理完还要看是否有兄弟节点
  while (nodeFiber !== null) {
    if (isHost(nodeFiber)) {
      parent.appendChild(nodeFiber.stateNode) // nodeFiber.stateNode是DOM节点
    } else if (nodeFiber.child !== null) {
      // 这里是fragment节点的情况，它不是一个DOM节点，但是它有子节点
      // 所以就处理它的子节点
      nodeFiber = nodeFiber.child
      continue
    }

    // 兄弟节点为null，则会向上寻找父节点，但是也不能无限往上找
    // 当向上找到的父节点为当前workInProgress时就要结束了
    if (nodeFiber === workInProgress) {
      return
    }

    // 兄弟节点为null，则把nodeFiber设置为父节点
    while (nodeFiber.sibling === null) {
      if (nodeFiber.return === null || nodeFiber.return === workInProgress) {
        return
      }
      nodeFiber = nodeFiber.return
    }

    // 兄弟节点不是null，则处理兄弟节点
    nodeFiber = nodeFiber.sibling
  }
}