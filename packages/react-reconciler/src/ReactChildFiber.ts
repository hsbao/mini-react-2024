import { Fiber } from './ReactInternalTypes'
import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols"
import { ChildDeletion, Placement } from "./ReactFiberFlags"
import type { ReactElement } from "shared/ReactTypes"
import { isArray } from "shared/utils"
import { HostText } from "./ReactWorkTags"
import { createFiberFromElement, createFiberFromText, createWorkInProgress } from './ReactFiber'

type ChildReconciler = (
  returnFiber: Fiber, // 父fiber
  currentFirstChild: Fiber | null, // 老的fiber的第一个子节点
  newChild: any // 新的子节点
) => Fiber | null

export const reconcileChildFibers: ChildReconciler =
  createChildReconciler(true)
export const mountChildFibers: ChildReconciler = createChildReconciler(false)

// 协调子节点
function createChildReconciler(shouldTrackSideEffects: boolean) {

  function createChild(returnFiber: Fiber, newChild: any): Fiber | null {
    if (isText(newChild)) {
      const textFiber = createFiberFromText(newChild + '')
      textFiber.return = returnFiber
      return textFiber
    }

    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const elementFiber = createFiberFromElement(newChild)
          elementFiber.return = returnFiber
          return elementFiber
        }
      }
    }
    return null
  }

  // 新节点的文本
  function updateTextNode(
    returnFiber: Fiber,
    current: Fiber | null,
    textContent: string
  ) {
    if (current === null || current.tag !== HostText) {
      // 老节点不是文本，则新增
      const created = createFiberFromText(textContent)
      created.return = returnFiber
      return created
    } else {
      // 老节点是文本，当前也是文本，则可以复用
      const existing = useFiber(current, textContent)
      existing.return = returnFiber
      return existing
    }
  }

  // 新节点是元素
  function updateElement(
    returnFiber: Fiber,
    current: Fiber | null,
    element: ReactElement
  ) {
    const elementType = element.type
    if (current !== null && current.elementType === elementType) {
      // 类型相同则进行复用
      const existing = useFiber(current, element.props)
      existing.return = returnFiber
      return existing
    } else {
      // 类型不同则创建新的
      const created = createFiberFromElement(element)
      created.return = returnFiber
      return created
    }
  }

  /**
   * 判断节点是否可以复用
   * @param returnFiber 父fiber
   * @param oldFiber 老的fiber
   * @param newChild 新的子节点
   * @returns 
   */
  function updateSlot(
    returnFiber: Fiber,
    oldFiber: Fiber | null,
    newChild: any
  ) {
    // 判断节点是否可以复用
    const key = oldFiber !== null ? oldFiber.key : null
    if (isText(newChild)) {
      if (key !== null) {
        // 新节点是文本，老节点不是文本，则不可以复用
        return null
      }
      // 有可能可以复用
      return updateTextNode(returnFiber, oldFiber, newChild + "")
    }

    if (typeof newChild === "object" && newChild !== null) {
      if (newChild.key === key) {
        return updateElement(returnFiber, oldFiber, newChild)
      } else {
        return null
      }
    }
    return null
  }

  /**
   * 
   * @param newFiber 新的fiber
   * @param lastPlacedIndex 记录的是新fiber在老fiber上的位置
   * @param newIndex 
   * @returns 
   */
  function placeChild(
    newFiber: Fiber,
    lastPlacedIndex: number,
    newIndex: number
  ) {
    newFiber.index = newIndex
    if (!shouldTrackSideEffects) {
      return lastPlacedIndex
    }
    // 判断节点位置是否发生相对位置变化，是否需要移动
    const current = newFiber.alternate
    if (current !== null) {
      const oldIndex = current.index // 老fiber的位置
      if (oldIndex < lastPlacedIndex) {
        // 0 1 2
        // 0 2 1
        // 节点需要移动位置
        newFiber.flags |= Placement
        return lastPlacedIndex
      } else {
        // 不需要移动位置
        return oldIndex
      }
    } else {
      // alternate没有则表示节点是新增
      newFiber.flags |= Placement
      return lastPlacedIndex
    }
  }

  /**
   * 把剩下的老fiber构建map { 3: fiber, 4: fiber }
   * @param oldFiber 老的fiber
   */
  function mapRemainingChildren(oldFiber: Fiber) {
    const existingChildren: Map<string | number, Fiber> = new Map()
    let existingChild: Fiber | null = oldFiber
    while (existingChild !== null) {
      if (existingChild.key !== null) {
        existingChildren.set(existingChild.key, existingChild)
      } else {
        existingChildren.set(existingChild.index, existingChild)
      }
      existingChild = existingChild.sibling
    }
    return existingChildren
  }

  function updateFromMap(
    existingChildren: Map<string | number, Fiber>,
    returnFiber: Fiber,
    newIdx: number,
    newChild: any
  ): Fiber | null {
    if (isText(newChild)) {
      // 如果是文本，没有key，则通过index去map中查找
      const matchedFiber = existingChildren.get(newIdx) || null
      return updateTextNode(returnFiber, matchedFiber, newChild + "")
    } else if (typeof newChild === "object" && newChild !== null) {
      // 普通的节点，先根据key去匹配，没有key则根据index匹配
      const matchedFiber =
        existingChildren.get(newChild.key === null ? newIdx : newChild.key) ||
        null
      return updateElement(returnFiber, matchedFiber, newChild)
    }

    return null
  }

  /**
   * 协调多个子节点，diff算法的核心
   * @param returnFiber 父fiber
   * @param currentFirstChild 老的fiber的第一个子节点
   * @param newChildren 新的子节点
   * @returns 
   */
  function reconcileChildrenArray(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChildren: Array<any>
  ) {
    let resultFirstChild: Fiber | null = null //  头结点
    let previousNewFiber: Fiber | null = null // 在下面的循环中记录上一个fiber
    let oldFiber = currentFirstChild
    let nextOldFiber = null // oldFiber.sibling 的临时变量
    let newIdx = 0
    let lastPlacedIndex = 0 // 判断新节点在老节点中的位置，如果新节点在老节点中位置靠前，则不需要移动，否则需要移动

    // ! 1. 从左往右遍历，按位置比较，如果可以复用，那就复用。不能复用，退出本轮循环
    // * Vue 1.2 从右往左遍历，按位置比较
    for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
      /**
       * 1. oldFiber.index > newIdx：这里 oldFiber 是旧虚拟 DOM 树中的一个节点，index 是该节点的索引，newIdx 是新虚拟 DOM 树中当前节点的索引。
       * 如果旧节点的索引大于新节点的索引，说明这个旧节点在新树中已经不存在了
       * 需要从旧树中移除。
       * nextOldFiber = oldFiber：将当前 oldFiber 节点赋值给 nextOldFiber
       * 这样 nextOldFiber 就指向了当前需要处理的旧节点。
       * oldFiber = null：将 oldFiber 设置为 null，
       * 表示这个节点已经处理过了，不需要再处理
       * 
       * 2. nextOldFiber = oldFiber.sibling：如果旧节点的索引不大于新节点的索引
       * 说明这个旧节点在新树中仍然存在，只是位置可能发生了变化。
       * 此时，将 oldFiber 的兄弟节点赋值给 nextOldFiber，以便继续处理下一个兄弟节点
       */
      if (oldFiber.index > newIdx) {
        nextOldFiber = oldFiber
        oldFiber = null
      } else {
        nextOldFiber = oldFiber.sibling
      }

      // 判断节点是否可以复用
      const newFiber = updateSlot(returnFiber, oldFiber, newChildren[newIdx])

      if (newFiber === null) {
        if (oldFiber === null) {
          oldFiber = nextOldFiber
        }
        break
      }

      // 更新阶段，如果节点不能复用，需要删除
      if (shouldTrackSideEffects) {
        if (oldFiber && newFiber?.alternate === null) {
          deleteChild(returnFiber, oldFiber)
        }
      }

      // 判断节点在DOM的相对位置是否发生变化
      // old 0 1 2 3 4 --> new 0 2 1 3
      lastPlacedIndex = placeChild(newFiber as Fiber, lastPlacedIndex, newIdx)

      if (previousNewFiber === null) {
        // 第一个节点，不要用newIdx判断，因为有可能有null，而null不是有效fiber
        resultFirstChild = newFiber as Fiber
      } else {
        previousNewFiber.sibling = newFiber as Fiber
      }
      previousNewFiber = newFiber as Fiber

      oldFiber = nextOldFiber
    }


    // ! 2.1 老节点还有，新节点没了。删除剩余的老节点
    if (newIdx === newChildren.length) {
      deleteRemainingChildren(returnFiber, oldFiber)
      return resultFirstChild
    }

    // ! 2.2 新节点还有，老节点没了。剩下的新节点新增就可以了（页面初次渲染的时候也会走这个逻辑）
    if (oldFiber === null) {
      for (; newIdx < newChildren.length; newIdx++) {
        const newFiber = createChild(returnFiber, newChildren[newIdx])
        if (newFiber === null) {
          continue
        }
        //  组件更新阶段，判断在更新前后的位置是否一致，如果不一致，需要移动
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx)
        if (previousNewFiber === null) {
          // 如果为null，说明就是头节点，直接赋值
          resultFirstChild = newFiber
        } else {
          // 不为null，代表已经循环过，所以上一个的sibling就是当前newFiber
          previousNewFiber.sibling = newFiber
        }
        previousNewFiber = newFiber
      }
      return resultFirstChild
    }

    // !2.3 新老节点都还有
    // [0, 1, 2, 3, 4] --> [0, 1, 2, 4]
    // 0,1,2可以复用 剩下 3,4 与 4，也就是新老节点都还有
    const existingChildren = mapRemainingChildren(oldFiber) // 把剩下的老fiber构建map { 3: fiber, 4: fiber }
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = updateFromMap(
        existingChildren,
        returnFiber,
        newIdx,
        newChildren[newIdx]
      )
      if (newFiber !== null) {
        if (shouldTrackSideEffects) {
          // map中的fiber只复用一次，所以复用完之后要删除
          existingChildren.delete(
            newFiber.key === null ? newIdx : newFiber.key
          )
        }

        lastPlacedIndex = placeChild(
          newFiber as Fiber,
          lastPlacedIndex,
          newIdx
        )

        if (previousNewFiber === null) {
          // 第一个节点，不要用newIdx判断，因为有可能有null，而null不是有效fiber
          resultFirstChild = newFiber
        } else {
          previousNewFiber.sibling = newFiber
        }
        previousNewFiber = newFiber
      }
    }

    // !3. 如果新节点已经构建完了，但是老节点还有，删除剩余的老节点
    // 因为map中的fiber复用后就被删除，所以剩下的就是需要删除的fiber
    if (shouldTrackSideEffects) {
      existingChildren.forEach((child) => deleteChild(returnFiber, child))
    }

    return resultFirstChild
  }

  // 给fiber节点添加flags
  function placeSingleChild(newFiber: Fiber) {
    if (shouldTrackSideEffects && newFiber.alternate === null) {
      newFiber.flags |= Placement
    }
    return newFiber
  }

  function reconcileSingleTextNode(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    textContent: string
  ) {
    const created = createFiberFromText(textContent)
    created.return = returnFiber
    return created
  }

  function useFiber(fiber: Fiber, pendingProps: any) {
    const clone = createWorkInProgress(fiber, pendingProps)
    clone.index = 0
    clone.sibling = null
    return clone
  }

  /**
   * 把要删除的子节点添加到父节点的deletions属性中
   * @param returnFiber 当前fiber的父节点
   * @param childToDelete 要删除的子节点
   * @returns 
   */
  const deleteChild = (returnFiber: Fiber, childToDelete: Fiber) => {
    // 初次渲染，没有老节点，所以不需要删除
    if (!shouldTrackSideEffects) {
      return
    }
    const deletions = returnFiber.deletions
    if (deletions === null) {
      returnFiber.deletions = [childToDelete]
      returnFiber.flags |= ChildDeletion
    } else {
      deletions.push(childToDelete)
    }
  }

  /**
   * 删除剩余全部的子节点
   * @param returnFiber 当前fiber的父节点
   * @param currentFirstChild 当前fiber的剩余的全部子节点
   * @returns 
   */
  const deleteRemainingChildren = (returnFiber: Fiber, currentFirstChild: Fiber | null) => {
    // 初次渲染，没有老节点，所以不需要删除
    if (!shouldTrackSideEffects) {
      return
    }
    let childToDelete = currentFirstChild
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete)
      childToDelete = childToDelete.sibling // 老fiber节点是单链表，所以需要循环删除
    }
  }

  // 协调单个节点，对于页面初次渲染，创建fiber，不涉及对比复用老节点
  function reconcileSingleElement(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    element: ReactElement
  ) {
    // 节点复用的条件 1. 同一层级下 2. key相同 3. 类型相同
    const key = element.key
    let child = currentFirstChild

    while (child !== null) {
      if (child.key === key) {
        const elementType = element.type
        if (child.elementType === elementType) {
          // todo 后面其它fiber可以删除了
          const existing = useFiber(child, element.props)
          existing.return = returnFiber
          return existing
        } else {
          // 前提：React不认为同一层级下有两个相同的key值
          deleteRemainingChildren(returnFiber, child) // 删除剩余全部的子节点
          break
        }
      } else {
        // 删除单个节点
        deleteChild(returnFiber, child)
      }

      child = child.sibling  // 老fiber节点是单链表
    }

    let createdFiber = createFiberFromElement(element)
    createdFiber.return = returnFiber
    return createdFiber
  }

  function reconcileChildFibers(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChild: any
  ) {
    // 如果子节点的文本
    if (isText(newChild)) {
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFirstChild, newChild + '')
      )
    }

    // 检查newChild类型，单个节点、文本、数组
    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          return placeSingleChild(
            reconcileSingleElement(returnFiber, currentFirstChild, newChild)
          )
        }
      }
    }

    // 多个子节点
    if (isArray(newChild)) {
      return reconcileChildrenArray(returnFiber, currentFirstChild, newChild)
    }

    return null
  }
  return reconcileChildFibers
}

/**
 * 判断子节点是不是文本
 * @param newChild 
 * @returns 
 */
function isText(newChild: any) {
  return (
    (typeof newChild === "string" && newChild !== "") ||
    typeof newChild === "number"
  )
}