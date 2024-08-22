import { Fiber } from 'react-reconciler/src/ReactInternalTypes'

const randomKey = Math.random().toString(36).slice(2)
const internalInstanceKey = '__reactFiber$' + randomKey
const internalPropsKey = '__reactProps$' + randomKey

/**
 * 在ReactFiberCompleteWork中，会调用这个方法，将Fiber存到对应的DOM节点上
 * @param hostInst Fiber
 * @param node DOM节点
 */
export function precacheFiberNode(hostInst: Fiber, node: Element | Text): void {
  (node as any)[internalInstanceKey] = hostInst
}

/**
 * 在dispatchEvent中，会调用这个方法，根据DOM节点获取Fiber
 * @param targetNode DOM节点
 * @returns FIber
 */
export function getClosestInstanceFromNode(targetNode: Node): null | Fiber {
  let targetInst = (targetNode as any)[internalInstanceKey]
  if (targetInst) {
    // Don't return HostRoot or SuspenseComponent here.
    return targetInst
  }
  return null
}


/**
 * 在ReactFiberCompleteWork中，会调用这个方法，将props存到对应的DOM节点上
 * @param node DOM节点
 * @param props 新的props
 */
export function updateFiberProps(node: Element | Text, props: any): void {
  (node as any)[internalPropsKey] = props
}

/**
 * 在accumulateSinglePhaseListeners中，会调用这个方法，根据DOM节点获取对应的props
 * @param targetNode DOM节点
 * @returns props
 */
export function getFiberCurrentPropsFromNode(node: Element | Text) {
  return (node as any)[internalPropsKey] || null
}

