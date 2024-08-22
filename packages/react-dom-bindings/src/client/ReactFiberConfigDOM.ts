import {
  DefaultEventPriority,
  EventPriority,
} from 'react-reconciler/src/ReactEventPriorities'

import { getEventPriority } from '../event/ReactDOMEventListener'

export function getCurrentEventPriority(): EventPriority {
  const currentEvent = window.event
  if (currentEvent === undefined) {
    return DefaultEventPriority // ? sy 页面初次渲染
  }
  return getEventPriority(currentEvent.type as any)
}