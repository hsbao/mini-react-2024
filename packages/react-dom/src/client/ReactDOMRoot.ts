import type { ReactNodeList } from 'shared/ReactTypes'

import type {
  Container,
  FiberRoot,
} from "react-reconciler/src/ReactInternalTypes"

import { createFiberRoot } from 'react-reconciler/src/ReactFiberRoot'
import { updateContainer } from 'react-reconciler/src/ReactFiberReconciler'
import { listenToAllSupportedEvents } from 'react-dom-bindings/src/event/DOMPluginEventSystem'


type RootType = {
  render: (children: ReactNodeList) => void
  _internalRoot: FiberRoot
}

function ReactDOMRoot(_internalRoot: FiberRoot) {
  this._internalRoot = _internalRoot
}

ReactDOMRoot.prototype.render = function (children: ReactNodeList) {
  updateContainer(children, this._internalRoot)
}

export function createRoot(container: Container) {
  const root: FiberRoot = createFiberRoot(container)

  listenToAllSupportedEvents(container) // 绑定事件

  return new ReactDOMRoot(root)
}

export default { createRoot }