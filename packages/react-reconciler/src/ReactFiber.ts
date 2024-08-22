import type { ReactElement } from 'shared/ReactTypes'
import { NoFlags } from './ReactFiberFlags'
import { NoLanes } from './ReactFiberLane'
import type { Fiber } from './ReactInternalTypes'
import { isFn, isStr } from "shared/utils"
import { ClassComponent, ContextConsumer, ContextProvider, Fragment, FunctionComponent, HostComponent, HostText, IndeterminateComponent, WorkTag } from './ReactWorkTags'
import { REACT_CONTEXT_TYPE, REACT_FRAGMENT_TYPE, REACT_PROVIDER_TYPE } from 'shared/ReactSymbols'


// 创建一个fiber
export function createFiber(
  tag: WorkTag,
  pendingProps: any,
  key: null | string
): Fiber {
  return new FiberNode(tag, pendingProps, key)
}


function FiberNode(tag: WorkTag, pendingProps: any, key: null | string) {
  // 标记fiber的类型，即描述的组件类型，如原生标签、函数组件、类组件、Fragment等。这里参考ReactWorkTags.js
  this.tag = tag
  // 定义组件在当前层级下的唯一性
  // 标记组件在当前层级下的的唯一性

  this.key = key
  // 组件类型
  this.elementType = null
  // 组件类型
  this.type = null
  // 不同的组件的  stateNode 定义也不同
  // 原生标签：string
  // 类组件：实例
  this.stateNode = null

  // Fiber
  this.return = null
  this.child = null
  this.sibling = null
  // 记录了节点在兄弟节点中的位置下标，用于diff时候判断节点是否需要发生移动
  this.index = 0

  this.pendingProps = pendingProps
  this.memoizedProps = null

  // 不同的组件的 memoizedState 指代也不同
  // 函数组件 hook0
  // 类组件 state
  this.memoizedState = null

  // Effects
  this.flags = NoFlags

  // 缓存fiber
  this.alternate = null

  // 记录要删除的子节点
  this.deletions = null

  this.updateQueue = null

  this.lanes = NoLanes
  this.childLanes = NoLanes
}

// 根据 ReactElement 创建Fiber
export function createFiberFromElement(element: ReactElement) {
  const { type, key } = element
  const pendingProps = element.props
  const fiber = createFiberFromTypeAndProps(type, key, pendingProps)
  return fiber
}

// 根据文本内容创建Fiber
export function createFiberFromText(content: string): Fiber {
  const fiber = createFiber(HostText, content, null)
  return fiber
}

/**
 * 根据 Type & Props 创建fiber
 * @param type
 * @param key 
 * @param pendingProps 
 * @returns 
 */
export function createFiberFromTypeAndProps(
  type: any,
  key: null | string,
  pendingProps: any
) {
  let fiberTag: WorkTag = IndeterminateComponent
  if (isFn(type)) { // 函数组件、类组件
    if (type.prototype?.isReactComponent) {
      fiberTag = ClassComponent
    } else {
      fiberTag = FunctionComponent
    }
  } else if (isStr(type)) { // 原生组件
    fiberTag = HostComponent
  } else if (type === REACT_FRAGMENT_TYPE) { // Fragment
    fiberTag = Fragment
  } else if (type.$$typeof === REACT_PROVIDER_TYPE) { // context provider
    fiberTag = ContextProvider
  } else if (type.$$typeof === REACT_CONTEXT_TYPE) { // context consumer
    fiberTag = ContextConsumer
  }
  const fiber = createFiber(fiberTag, pendingProps, key)
  fiber.elementType = type
  fiber.type = type
  return fiber
}

/**
 * 根据 current 创建 workInProgress，其中保存了 current 的所有属性
 * @param current 
 * @param pendingProps 
 * @returns 
 */
export function createWorkInProgress(current: Fiber, pendingProps: any): Fiber {
  let workInProgress = current.alternate

  // 没有则新建一个fiber
  // 会再次赋值到workInProgress和current Fiber的alternate上
  if (workInProgress === null) {
    workInProgress = createFiber(current.tag, pendingProps, current.key)
    workInProgress.elementType = current.elementType
    workInProgress.type = current.type
    workInProgress.stateNode = current.stateNode

    workInProgress.alternate = current
    current.alternate = workInProgress
  } else {
    // 如果有则更新值
    workInProgress.pendingProps = pendingProps
    workInProgress.type = current.type
    workInProgress.flags = NoFlags
  }

  workInProgress.flags = current.flags
  workInProgress.childLanes = current.childLanes
  workInProgress.lanes = current.lanes

  workInProgress.child = current.child
  workInProgress.memoizedProps = current.memoizedProps
  workInProgress.memoizedState = current.memoizedState
  workInProgress.updateQueue = current.updateQueue

  workInProgress.sibling = current.sibling
  workInProgress.index = current.index

  return workInProgress
}