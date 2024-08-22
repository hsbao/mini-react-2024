import { createFiber } from "./ReactFiber"
import { NoLanes } from "./ReactFiberLane"
import type { Container, Fiber, FiberRoot } from "./ReactInternalTypes"
import { HostRoot } from "./ReactWorkTags"

/**
 * 创建并返回 FiberRoot
 * @param containerInfo 根容器 document.getElementById('root')
 * @returns 
 */
export function createFiberRoot(containerInfo: Container): FiberRoot {
  const root: FiberRoot = new FiberRootNode(containerInfo) // 创建root
  const uninitializedFiber: Fiber = createFiber(HostRoot, null, null) // 创建fiber

  /**
   * 循环构造 root 与 uninitializedFiber
   */
  root.current = uninitializedFiber  // root.current 是 Fiber
  uninitializedFiber.stateNode = root  // uninitializedFiber.stateNode 是根 FiberRoot
  return root
}

export function FiberRootNode(containerInfo: Container) {
  this.containerInfo = containerInfo
  this.current = null
  this.finishedWork = null
  this.pendingLanes = NoLanes
}
