import { isHost } from './ReactFiberCompleteWork'
import { ChildDeletion, Passive, Placement, Update } from './ReactFiberFlags'
import { HookFlags, HookLayout, HookPassive } from './ReactHookEffectTags'
import type { Fiber, FiberRoot } from './ReactInternalTypes'
import { FunctionComponent, HostComponent, HostRoot, HostText } from './ReactWorkTags'

export function commitMutationEffects(root: FiberRoot, finishedWork: Fiber | null) {
  if (finishedWork) {
    recursivelyTraverseMutationEffects(root, finishedWork)
    commitReconciliationEffects(finishedWork)
  }

}

function recursivelyTraverseMutationEffects(
  root: FiberRoot,
  parentFiber: Fiber
) {
  let child = parentFiber.child
  // 遍历单链表
  while (child !== null) {
    commitMutationEffects(root, child)
    child = child.sibling
  }
}

// 提交协调的产生的effects，比如flags，Placement、Update、ChildDeletion
function commitReconciliationEffects(finishedWork: Fiber) {
  // 在render阶段协调子节点时，ReactChildFiber.ts文件中的placeSingleChild设置了flags
  const flags = finishedWork.flags

  // 页面初次渲染 新增插入 appendChild
  if (flags & Placement) {
    commitPlacement(finishedWork)
    finishedWork.flags &= ~Placement // 清除Placement
  }

  // 删除节点
  if (flags & ChildDeletion) {
    const parentFiber = isHostParent(finishedWork) ? finishedWork : getHostParentFiber(finishedWork)
    const parentDom = parentFiber.stateNode
    commitDeletion(finishedWork.deletions!, parentDom)
    finishedWork.flags &= ~ChildDeletion
    finishedWork.deletions = null
  }

  // 处理函数组件layout effect的执行(同步执行，所以可能阻塞后面的任务，影响性能)
  if (flags & Update) {
    if (finishedWork.tag === FunctionComponent) {
      commitHookEffectListMount(HookLayout, finishedWork) // 执行useLayoutEffect的回调
      finishedWork.flags &= ~Update // 清除Update
    }
  }
}

/**
 * 执行useLayoutEffect或者useEffect的回调
 * @param hookFlags hookFlags标识
 * @param finishedWork 函数组件fiber
 */
function commitHookEffectListMount(hookFlags: HookFlags, finishedWork: Fiber) {
  const updateQueue = finishedWork.updateQueue
  let lastEffect = updateQueue!.lastEffect
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next // 从尾节点获取头节点，然后从第一个effect开始
    let effect = firstEffect
    do {
      if ((effect.tag & hookFlags) === hookFlags) {
        const create = effect.create
        create()
      }
      effect = effect.next
    } while (effect !== firstEffect) // 循环链表，直到回到第一个effect时结束循环
  }
}

/**
 * 执行useEffect的回调
 * @param finishedWork 函数组件fiber
 */
export function flushPassiveEffects(finishedWork: Fiber) {
  // !1. 遍历子节点，检查子节点，因为子组件可能也有useEffect
  recursivelyTraversePassiveMountEffects(finishedWork)
  // !2. 如果有passive effects，执行~
  commitPassiveEffects(finishedWork)
}

function recursivelyTraversePassiveMountEffects(finishedWork: Fiber) {
  let child = finishedWork.child
  while (child !== null) {
    // !1. 遍历子节点，检查子节点，因为子组件可能也有useEffect
    recursivelyTraversePassiveMountEffects(child)
    // !2. 如果有passive effects，执行~
    commitPassiveEffects(finishedWork)
    child = child.sibling
  }
}

function commitPassiveEffects(finishedWork: Fiber) {
  if (finishedWork.tag === FunctionComponent) {
    if (finishedWork.flags & Passive) {
      commitHookEffectListMount(HookPassive, finishedWork)
      finishedWork.flags &= ~Passive
    }
  }
}

function commitPlacement(finishedWork: Fiber) {
  // 插入⽗dom
  if (finishedWork.stateNode && isHost(finishedWork)) {
    const parentFiber = getHostParentFiber(finishedWork)
    let parentDom = parentFiber.stateNode // 获取⽗dom节点
    if (parentDom.containerInfo) {
      parentDom = parentDom.containerInfo
    }
    // parentDom.appendChild(finishedWork.stateNode) // diff的时候，如果节点发生移动，这样会导致dom位置不对
    // 所以遍历fiber，寻找finishedWork的兄弟节点，并且这个sibling有dom节点，且是更新的节点。在本轮不发生移动
    const before = getHostSibling(finishedWork)
    insertOrAppendPlacementNode(finishedWork, before, parentDom)
  } else {
    // fragment
    let child = finishedWork.child
    while (child !== null) {
      commitPlacement(child)
      child = child.sibling
    }
  }
}

function insertOrAppendPlacementNode(
  node: Fiber,
  before: Element,
  parent: Element
) {
  if (before) {
    parent.insertBefore(getStateNode(node), before)
  } else {
    parent.appendChild(getStateNode(node))
  }
}

function getHostSibling(fiber: Fiber) {
  let node: Fiber = fiber
  sibling: while (1) {
    // 如果没有兄弟节点，则向上查找，如果没有return，则结果循环
    while (node.sibling === null) {
      if (node.return === null || isHostParent(node.return)) {
        return null
      }
      node = node.return
    }

    node = node.sibling

    while (!isHost(node)) {
      // Placement表示的是新增节点，所以需要跳过新增节点
      if (node.flags & Placement) {
        continue sibling
      }
      if (node.child === null) {
        continue sibling
      } else {
        node = node.child
      }
    }

    // HostComponent|HostText
    if (!(node.flags & Placement)) {
      return node.stateNode
    }
  }
}

/**
 * 根据fiber获取它的原生dom
 * @param fiber 
 * @returns 
 */
function getStateNode(fiber: Fiber) {
  let node = fiber
  while (1) {
    if (isHost(node) && node.stateNode) {
      return node.stateNode
    }
    node = node.child as Fiber
  }
}

/**
 * 删除节点
 * @param deletions 需要删除的fiber
 * @param parentDOM 父dom
 */
function commitDeletion(
  deletions: Array<Fiber>,
  parentDOM: Element | Document | DocumentFragment
) {
  deletions.forEach((deletion) => {
    parentDOM.removeChild(getStateNode(deletion))
  })
}

// 检查fiber是不是原生标签或者根节点
function isHostParent(fiber: Fiber): boolean {
  return fiber.tag === HostComponent || fiber.tag === HostRoot
}

/**
 * 根据fiber获取它的原生父dom
 * @param fiber
 * @returns 
 */
function getHostParentFiber(fiber: Fiber): Fiber {
  let parent = fiber.return
  while (parent !== null) {
    if (isHostParent(parent)) {
      return parent
    }
    // 有可能是函数组件，那则需要继续往上找父dom
    parent = parent.return
  }
  throw new Error(
    "Expected to find a host parent. This error is likely caused by a bug " +
    "in React. Please file an issue."
  )
}