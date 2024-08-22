import type { ReactNodeList } from 'shared/ReactTypes'
import type { FiberRoot } from './ReactInternalTypes'
import { scheduleUpdateOnFiber } from './ReactFiberWorkLoop'

/**
 * 
 * @param element 子节点
 * @param container root容器
 */
export function updateContainer(element: ReactNodeList, container: FiberRoot) {
  //  1. 获取current
  const current = container.current
  current.memoizedState = { element }

  //  2. 调度更新
  scheduleUpdateOnFiber(container, current)
}