import { isNum, isStr } from 'shared/utils'
import { mountChildFibers, reconcileChildFibers } from './ReactChildFiber'
import { Fiber } from './ReactInternalTypes'
import { ClassComponent, ContextConsumer, ContextProvider, Fragment, FunctionComponent, HostComponent, HostRoot, HostText } from './ReactWorkTags'
import { renderWithHooks } from './ReactFiberHooks'
import { pushProvider, readContext } from './ReactFiberNewContext'

function shouldSetTextContent(type: string, props: any): boolean {
  return (
    type === "textarea" ||
    type === "noscript" ||
    isStr(props.children) ||
    isNum(props.children) ||
    (typeof props.dangerouslySetInnerHTML === "object" &&
      props.dangerouslySetInnerHTML !== null &&
      props.dangerouslySetInnerHTML.__html != null)
  )
}

// 1. 处理当前fiber，因为不同组件对应的fiber处理方式不同，
// 2. 返回子节点child(而且是第一个子节点)
export function beginWork(
  current: Fiber | null,
  workInProgress: Fiber
): Fiber | null {
  switch (workInProgress.tag) {
    case HostRoot:
      return updateHostRoot(current, workInProgress)
    case HostComponent:
      return updateHostComponent(current, workInProgress)
    case HostText:
      return updateHostText(current, workInProgress)
    case Fragment:
      return updateHostFragment(current, workInProgress)
    case ClassComponent:
      return updateClassComponent(current, workInProgress)
    case FunctionComponent:
      return updateFunctionComponent(current, workInProgress)
    case ContextProvider:
      return updateContextProvider(current, workInProgress)
    case ContextConsumer:
      return updateContextConsumer(current, workInProgress)
  }

  throw new Error(
    `Unknown unit of work tag (${workInProgress.tag}). This error is likely caused by a bug in ` +
    "React. Please file an issue."
  )
}

/**
 * 根fiber是不需要更新。只需要协调它的子节点，且返回子节点child
 * @param current 根fiber
 * @param workInProgress 正在执行的work
 */
function updateHostRoot(current: Fiber | null, workInProgress: Fiber) {
  // 在ReactFiberReconciler.ts 的 updateContainer 方法中，存在了memoizedState的element中
  const nextChildren = workInProgress.memoizedState.element

  reconcileChildren(current, workInProgress, nextChildren)

  // 如果是更新阶段，current.child应该是workInProgress.child
  if (current) {
    current.child = workInProgress.child
  }

  return workInProgress.child
}

// 处理原生标签：如div、span...
// 在初次渲染的时候，会调用reconcileChildren
// r如果是更新阶段，有可能会进行reconcileChildren，也有可能是bailout
function updateHostComponent(current: Fiber | null, workInProgress: Fiber) {
  const { type, pendingProps } = workInProgress

  const isDirectTextChild = shouldSetTextContent(type, pendingProps) // 是否是文本节点
  // 如果原生标签只有一个文本，这个时候文本不会再生成fiber节点，而是当做这个原生标签的属性
  if (isDirectTextChild) {
    return null
  }

  const nextChildren = pendingProps.children // 因为是初次渲染，所以子节点要从pendingProps上获取
  reconcileChildren(current, workInProgress, nextChildren)

  return workInProgress.child
}

// 文本没有子节点，不需要协调
function updateHostText(current: Fiber | null, workInProgress: Fiber) {
  return null
}

function updateHostFragment(current: Fiber | null, workInProgress: Fiber) {
  const nextChildren = workInProgress.pendingProps.children
  reconcileChildren(current, workInProgress, nextChildren)

  return workInProgress.child
}

/**
 * class 组件
 * @param current 
 * @param workInProgress 
 */
function updateClassComponent(current: Fiber | null, workInProgress: Fiber) {
  const { type, pendingProps } = workInProgress

  const context = type.contextType // 获取类组件的context
  const newValue = readContext(context) // 获取context的value值

  let instance = workInProgress.stateNode
  if (current === null) {
    instance = new type(pendingProps)  // 类组件的type是构造函数，所以需要new
    workInProgress.stateNode = instance
  }
  instance.context = newValue // 设置context的值

  const children = instance.render() // 类组件要渲染的内容是render方法返回的
  reconcileChildren(current, workInProgress, children)
  return workInProgress.child
}

/**
 * 函数组件
 * @param current 
 * @param workInProgress 
 * @returns 
 */
function updateFunctionComponent(current: Fiber | null, workInProgress: Fiber) {
  const { type, pendingProps } = workInProgress
  // const children = type(pendingProps) // 函数组件要渲染的内容是函数返回的
  const children = renderWithHooks(current, workInProgress, type, pendingProps) // 管理hooks逻辑
  reconcileChildren(current, workInProgress, children)
  return workInProgress.child
}

/**
 * content Privider组件
 * @param current 
 * @param workInProgress 
 */
function updateContextProvider(current: Fiber | null, workInProgress: Fiber) {
  /**
   * type是Provider组件
   * 
   * context.Provider = {
   * $$typeof: REACT_PROVIDER_TYPE,
   *   _context: context,
   * }
   * 
   * 所以context是type._context
   * pendingProps.value则是在使用Provider组件的时候传入的value
   */
  const context = workInProgress.type._context
  const value = workInProgress.pendingProps.value

  /**
   * 1. stack(push)，记录下context、value
   * 2. 后代组件消费
   * 3. 消费完后出栈(pop)
   */
  pushProvider(context, value)

  // Privider组件的子节点是在pendingProps.children
  reconcileChildren(
    current,
    workInProgress,
    workInProgress.pendingProps.children
  )
  return workInProgress.child
}

function updateContextConsumer(current: Fiber | null, workInProgress: Fiber) {
  /**
   * type是Consumer组件
   * 
   * context.Consumer = context
   */
  const context = workInProgress.type
  const newValue = readContext(context) // 消费context的值

  const render = workInProgress.pendingProps.children // Consumer组件的子节点是一个函数，并且这个函数接收context的value值
  const newChildren = render(newValue)

  reconcileChildren(current, workInProgress, newChildren)
  return workInProgress.child
}

/**
 * 协调子节点，构建新的fiber树
 * @param current 可以看做是老的fiber
 * @param workInProgress 
 * @param nextChildren 子节点（原生标签，文本等）
 */
function reconcileChildren(current: Fiber | null, workInProgress: Fiber, nextChildren: any) {
  if (current === null) {
    // 初次挂载
    workInProgress.child = mountChildFibers(workInProgress, null, nextChildren)
  } else {
    // 更新
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child,
      nextChildren
    )
  }
}