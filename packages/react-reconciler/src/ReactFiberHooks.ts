import { isFn } from "shared/utils"
import {
  scheduleUpdateOnFiber,
} from "./ReactFiberWorkLoop"
import type { Fiber, FiberRoot } from "./ReactInternalTypes"
import { HostRoot } from "./ReactWorkTags"
import { Flags, Passive, Update } from "./ReactFiberFlags"
import { HookFlags, HookLayout, HookPassive } from "./ReactHookEffectTags"

import { ReactContext } from "shared/ReactTypes"

type Hook = {
  memoizedState: any
  next: null | Hook
}

let currentlyRenderingFiber: Fiber | null = null // 当前正在工作的函数组件的fiber
let workInProgressHook: Hook | null = null
let currentHook: Hook | null = null

function finishRenderingHooks() {
  currentlyRenderingFiber = null
  currentHook = null
  workInProgressHook = null
}

// 把hooks绑定到fiber上
export function renderWithHooks<Props>(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  props: Props,
): any {
  currentlyRenderingFiber = workInProgress
  workInProgress.memoizedState = null
  workInProgress.updateQueue = null
  const children = Component(props)
  finishRenderingHooks()
  return children
}

// 1. 返回当前useX函数对应的hook
// 2. 构建hook链表
function updateWorkInProgressHook(): Hook {
  let hook: Hook
  const current = currentlyRenderingFiber?.alternate
  if (current) {
    // update阶段
    currentlyRenderingFiber!.memoizedState = current.memoizedState

    if (workInProgressHook != null) {
      workInProgressHook = hook = workInProgressHook.next!
      currentHook = currentHook?.next as Hook
    } else {
      // hook单链表的头结点
      hook = workInProgressHook = currentlyRenderingFiber?.memoizedState
      currentHook = current.memoizedState
    }
  } else {
    // mount阶段
    currentHook = null
    hook = {
      memoizedState: null,
      next: null,
    }

    if (workInProgressHook) {
      workInProgressHook = workInProgressHook.next = hook
    } else {
      // hook单链表的头结点
      workInProgressHook = currentlyRenderingFiber!.memoizedState = hook
    }
  }

  return hook
}


export function useReducer<S, I, A>(
  reducer: ((state: S, action: A) => S) | null,
  initialArg: I,
  init?: (initialArg: I) => S
) {
  // 1.  构建hook链表(mount、update)
  const hook: Hook = updateWorkInProgressHook()

  let initialState: S
  if (init !== undefined) {
    initialState = init(initialArg)
  } else {
    initialState = initialArg as any
  }

  // 2. 区分函数组件是初次挂载还是更新
  if (!currentlyRenderingFiber?.alternate) {
    // mount
    hook.memoizedState = initialState
  }

  //  3. dispatch
  // 这里为什么要使用bind，是因为currentlyRenderingFiber是全局变量，在运行过程中是不断变化的
  // 在函数组件在调用dispatch的时候，会用到currentlyRenderingFiber，所以需要bind当时对应的fiber
  const dispatch = dispatchReducerAction.bind(
    null,
    currentlyRenderingFiber!,
    hook,
    reducer as any
  )

  return [hook.memoizedState, dispatch]
}

// 根据 sourceFiber 找根节点
function getRootForUpdatedFiber(sourceFiber: Fiber): FiberRoot {
  let node = sourceFiber
  let parent = node.return
  while (parent !== null) {
    node = parent
    parent = node.return
  }
  return node.tag === HostRoot ? node.stateNode : null
}

function dispatchReducerAction<S, I, A>(
  fiber: Fiber,
  hook: Hook,
  reducer: ((state: S, action: A) => S) | null,
  action: any
) {
  hook.memoizedState = reducer ? reducer(hook.memoizedState, action) : action

  const root = getRootForUpdatedFiber(fiber)

  fiber.alternate = { ...fiber }
  if (fiber.sibling) {
    fiber.sibling.alternate = fiber.sibling
  }

  // 找到fiber后调度更新
  scheduleUpdateOnFiber(root, fiber, true)
}

// 源码中useState与useReducer对比
// useState,如果state没有改变，不引起组件更新。useReducer不是如此。
// reducer 代表state修改规则，useReducer比较方便服用这个规则
export function useState<S>(initialState: (() => S) | S) {
  const init = isFn(initialState) ? (initialState as any)() : initialState
  return useReducer(null, init)
}

// 检查hook依赖是否变化
export function areHookInputsEqual(
  nextDeps: Array<any>,
  prevDeps: Array<any> | null
): boolean {
  if (prevDeps === null) {
    return false
  }

  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(nextDeps[i], prevDeps[i])) {
      continue
    }
    return false
  }
  return true
}

export function useMemo<T>(nextCreate: () => T, deps: any[]): T {
  const hook = updateWorkInProgressHook()
  const nextDeps = deps === undefined ? null : deps
  const prevState = hook.memoizedState // 上一次的值

  // 上一次有值并且有依赖项
  if (prevState !== null && nextDeps !== null) {
    const [prevValue, prevDeps] = prevState
    if (areHookInputsEqual(nextDeps, prevDeps)) {
      return prevValue // 如果依赖项没有变化，返回上一次的值
    }
  }
  const nextValue = nextCreate()
  hook.memoizedState = [nextValue, nextDeps] // 保存新的值和依赖项
  return nextValue
}

// useCallback和useMemo区别：useCallback返回一个函数，useMemo返回一个值
export function useCallback<T>(callback: T, deps: Array<any> | void | null): T {
  const hook = updateWorkInProgressHook()
  const nextDeps = deps === undefined ? null : deps
  const prevState = hook.memoizedState
  // 上一次有值并且有依赖项
  if (prevState !== null) {
    if (nextDeps !== null) {
      const prevDeps = prevState[1]
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        return prevState[0]  // 依赖项没有变化，返回上一次缓存的callback
      }
    }
  }
  hook.memoizedState = [callback, nextDeps]
  return callback
}

/**
 * useRef 是⼀个 React Hook，它能帮助引⽤⼀个不需要渲染组件的值
 * 常⻅使⽤：⽤于缓存⼀个值，如果不修改，这个值在函数组件卸载之前都指向同⼀个地址
 * @param initialValue 初始值
 * @returns 
 */
export function useRef<T>(initialValue: T): { current: T } {
  const hook = updateWorkInProgressHook()

  // 如果是初次渲染，memoizedState为null，则初始化一个对象  {current: initialValue}
  if (currentHook === null) {
    hook.memoizedState = { current: initialValue }
  }
  return hook.memoizedState
}

/**
 * useEffect与useLayoutEffect的区别：
 * 1. 使用不同的flags和HookFlags进行标记
 * 2. 存储结构一样，但是effect和destroy函数的执行时机不同
 * 3. useLayoutEffect 在所有 DOM 变更之后（在浏览器重新绘制之前）同步触发。可以使⽤它来读取 DOM 布局并同步触发重渲染，有可能会避免阻塞视觉更新
 * 4. useEffect 会在组件渲染到屏幕之后延迟执⾏ effect
 */
export function useLayoutEffect(create: () => (() => void) | void, deps: Array<any> | void | null) {
  return updateEffectImpl(Update, HookLayout, create, deps)
}

export function useEffect(create: () => (() => void) | void, deps: Array<any> | void | null) {
  return updateEffectImpl(Passive, HookPassive, create, deps)
}

type Effect = {
  tag: HookFlags
  create: () => (() => void) | void
  deps: Array<any> | void | null
  next: null | Effect
}

// 存储 effect
function updateEffectImpl(
  fiberFlags: Flags,
  hookFlags: HookFlags,
  create: () => (() => void) | void,
  deps: Array<any> | void | null
) {
  const hook = updateWorkInProgressHook()

  const nextDeps = deps === undefined ? null : deps

  if (currentHook !== null) {
    if (nextDeps !== null) {
      const prevDeps = currentHook.memoizedState.deps
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        return
      }
    }
  }

  currentlyRenderingFiber!.flags |= fiberFlags // 给当前fiber打上effect的Flags标记
  hook.memoizedState = pushEffect(hookFlags, create, nextDeps) // 将effect添加到effect链表中
}

/**
 * 1. 保存effect 2. 构建effect链表
 * @param hookFlags hook的标记
 * @param create callback函数
 * @param deps 依赖项
 */
function pushEffect(hookFlags: HookFlags, create: () => (() => void) | void, deps: Array<any> | void | null): Effect {
  const effect: Effect = {
    tag: hookFlags,
    create,
    deps,
    next: null,
  }
  // 获取当前fiber的updateQueue
  let updateQueue = currentlyRenderingFiber!.updateQueue

  // 需要构建一个单项循环链表

  if (updateQueue === null) {
    // updateQueue为null，说明当前的effect是第一个effect，需要初始化updateQueue
    updateQueue = {
      lastEffect: null,
    }
    currentlyRenderingFiber!.updateQueue = updateQueue // 将updateQueue挂载到当前fiber上

    // updateQueue.lastEffect = effect.next = effect;
    effect.next = effect // 将effect的next指向自己，形成循环链表
    updateQueue.lastEffect = effect // 将updateQueue的lastEffect指向effect
  } else {
    // updateQueue不为null，说明当前的effect不是第一个effect，需要将当前effect添加到链表的末尾
    const lastEffect = updateQueue.lastEffect // 获取updateQueue的末尾节点lastEffect
    const firstEffect = lastEffect.next // 因为的单项循环链表，所以尾节点的next就是第一个effect

    // 重新构建循环链表
    lastEffect.next = effect // 将尾节点的next指向当前effect
    effect.next = firstEffect // 将当前effect的next指向第一个effect

    updateQueue.lastEffect = effect // 将updateQueue的lastEffect指向当前effect
  }

  return effect
}

export function useContext(context: any) {
  return context._currentValue
}