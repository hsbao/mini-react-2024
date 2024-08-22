export type Heap<T extends Node> = Array<T>
export type Node = {
  id: number // 任务的唯一标识
  sortIndex: number // 排序的依据
}

/**
 * 比较函数
 * @param a 
 * @param b 
 * @returns 
 */
function compare(a: Node, b: Node) {
  const diff = a.sortIndex - b.sortIndex
  return diff !== 0 ? diff : a.id - b.id
}

/**
 * 获取堆顶元素
 * @param heap 堆
 * @returns 
 */
export function peek<T extends Node>(heap: Heap<T>): T | null {
  return heap.length === 0 ? null : heap[0]
}

/**
 * 给堆添加元素
 * @param heap 堆
 * @param node 节点
 */
export function push<T extends Node>(heap: Heap<T>, node: T): void {
  const index = heap.length
  // 1. 把新加的node节点放到堆的最后
  heap.push(node)
  // 2. 调整最小堆，从下往上堆化
  siftUp(heap, node, index)
}

/**
 * 从下往上堆化
 * @param heap 堆
 * @param node 节点
 * @param i 最后一个节点的索引
 */
function siftUp<T extends Node>(heap: Heap<T>, node: T, i: number): void {
  let index = i  // 1. 从最后一个下标开始
  while (index > 0) {
    const parentIndex = (index - 1) >>> 1 // 2. 从最后一个下标开始，获取它的父节点下标
    const parent = heap[parentIndex]  // 3. 根据父节点下标获取父节点
    if (compare(parent, node) > 0) {
      // 子节点更小，和父节点交换
      heap[parentIndex] = node
      heap[index] = parent
      index = parentIndex // 和父节点交换位置后，需更新对比的下标继续往上调整
    } else {
      return // 父节点比子节点小，说明已经满足最小堆，结束循环
    }
  }
}

/**
 * 删除堆顶元素
 * @param heap 
 * @returns 
 */
export function pop<T extends Node>(heap: Heap<T>): T | null {
  if (heap.length === 0) {
    return null
  }
  const first = heap[0] // 1. 获取堆顶元素
  const last = heap.pop()! // 2. 获取堆的最后一个元素
  if (first !== last) { // 证明heap中有2个或者更多个元素
    heap[0] = last // 3 把最后⼀个元素覆盖堆顶元素
    siftDown(heap, last, 0) // 4 然后从堆顶往下调整最⼩堆
  }
  return first
}

/**
 * 从上往下堆化: 其实就是检查每个⼦堆的结构，确保最⼩值在⽗节点，不满⾜就交换⽗与左或者⽗与右
 * @param heap 堆
 * @param node 节点
 * @param i 节点的索引
 */
function siftDown<T extends Node>(heap: Heap<T>, node: T, i: number): void {
  let index = i
  const length = heap.length // 获取堆⼤⼩
  const halfLength = length >>> 1 // ⼆叉树⼦树总⼼节点的索引
  while (index < halfLength) { // 
    const leftIndex = (index + 1) * 2 - 1 // 获取左⼦节点的索引
    const left = heap[leftIndex]
    const rightIndex = leftIndex + 1
    const right = heap[rightIndex]
    if (compare(left, node) < 0) {
      // 左⼦节点小于根节点，然后比较左⼦节点和右⼦节点
      if (rightIndex < length && compare(right, left) < 0) {
        heap[index] = right // 右⼦节点存在，且右⼦节点小于左⼦节点，则把右⼦节点放到当前节点的位置
        heap[rightIndex] = node // 把当前节点放到右⼦节点的位置
        index = rightIndex
      } else {
        heap[index] = left // left更小或者right不存在，则把左⼦节点放到当前节点的位置
        heap[leftIndex] = node // 把当前节点放到左⼦节点的位置
        index = leftIndex
      }
    } else if (rightIndex < length && compare(right, node) < 0) {
      // left>=node && right<node
      heap[index] = right
      heap[rightIndex] = node
      index = rightIndex
    } else {
      // 根节点最小，不需要调整
      return
    }
  }
}

