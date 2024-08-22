import { REACT_MEMO_TYPE } from 'shared/ReactSymbols'

/**
 * memo组件
 * @param type 组件
 * @param compare 比较函数
 */
export function memo<Props>(
  type: any,
  compare?: (prevProps: Props, nextProps: Props) => boolean
) {
  const elementType = {
    $$typeof: REACT_MEMO_TYPE,
    type,
    compare: compare === undefined ? null : compare,
  }
  return elementType
}