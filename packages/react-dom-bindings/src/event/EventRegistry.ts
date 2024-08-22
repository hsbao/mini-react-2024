import type { DOMEventName } from './DOMEventNames'

// 记录所有注册的原生事件
export const allNativeEvents: Set<DOMEventName> = new Set()

// React事件与原生事件的映射关系 { onClick: [click] }
export const registrationNameDependencies: {
  [registrationName: string]: Array<DOMEventName>
} = {}

export function registerDirectEvent(
  registrationName: string,
  dependencies: Array<DOMEventName>
) {
  registrationNameDependencies[registrationName] = dependencies
  for (let i = 0; i < dependencies.length; i++) {
    allNativeEvents.add(dependencies[i])
  }
}

export function registerTwoPhaseEvent(
  registrationName: string, // react事件名称，如onClick
  dependencies: Array<DOMEventName> // 原生事件名称，如click
): void {
  registerDirectEvent(registrationName, dependencies) // 冒泡阶段
  registerDirectEvent(registrationName + "Capture", dependencies) // 捕获阶段
}