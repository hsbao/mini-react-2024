/*
 * @Descripttion: 定义react事件优先级
 */

import {
  DefaultLane,
  IdleLane,
  InputContinuousLane,
  Lane,
  Lanes,
  NoLane,
  SyncLane,
  getHighestPriorityLane,
  includesNonIdleWork,
} from "./ReactFiberLane"

export type EventPriority = Lane

export const DiscreteEventPriority: EventPriority = SyncLane
export const ContinuousEventPriority: EventPriority = InputContinuousLane
export const DefaultEventPriority: EventPriority = DefaultLane // 页面初次渲染的lane 32
export const IdleEventPriority: EventPriority = IdleLane

let currentUpdatePriority: EventPriority = NoLane

// 获取当前更新优先级
export function getCurrentUpdatePriority(): EventPriority {
  return currentUpdatePriority
}

// 设置当前更新优先级
export function setCurrentUpdatePriority(newPriority: EventPriority) {
  currentUpdatePriority = newPriority
}

export function isHigherEventPriority(
  a: EventPriority,
  b: EventPriority
): boolean {
  return a !== 0 && a < b
}

// 根据优先级最高的lane，返回对应的 EventPriority
export function lanesToEventPriority(lanes: Lanes): EventPriority {
  // 根据优先级最高的lane，返回对应的 EventPriority。这里对应Scheduler包中的优先级
  const lane = getHighestPriorityLane(lanes)
  if (!isHigherEventPriority(DiscreteEventPriority, lane)) {
    return DiscreteEventPriority
  }
  if (!isHigherEventPriority(ContinuousEventPriority, lane)) {
    return ContinuousEventPriority
  }
  if (includesNonIdleWork(lane)) {
    return DefaultEventPriority
  }
  return IdleEventPriority
}