import { ReactDOM, Fragment, Component, useReducer, useState, useMemo, useRef, useLayoutEffect, useEffect, createContext, useContext, memo } from './which-react'
// import App from './App.tsx'

const fragment1 = (
  <Fragment key='Fragment_Key'>
    <h3>fragment12</h3>
    <h4>fragment1</h4>
  </Fragment>
)



// ! 1. 创建context
// ! 2. 使用Provider组件，用于向后代组件传递value
const CountContext = createContext(100)

class ClassComponent extends Component {
  static contextType = CountContext
  render() {
    return (
      <div className="class-component">
        <div>{this.context}</div>
      </div>
    )
  }
}

const Child = () => {
  // ! 3. 后代组件消费value，寻找最近且是匹配的Provider组件的value
  const count = useContext(CountContext)

  return (
    <div>
      <div>child 组件</div>

      <div>第一种消费方式：useContext</div>
      <div>{count}</div>

      <div>第二种消费方式：Consumer</div>
      <CountContext.Consumer>
        {
          (value) => <div>{value}</div>
        }
      </CountContext.Consumer>

      <div>第三种消费方式：类组件contextType</div>
      <ClassComponent></ClassComponent>
    </div>
  )
}

const Child2 = ({ count }) => {
  useEffect(() => {
    console.log('memo child useEffect')
  })
  return (
    <div>
      <div>child2 组件</div>
      <div>{count}</div>
    </div>
  )
}

const MemoChild2 = memo<{ count: number }>(Child2, (prevProps, nextProps) => {
  return prevProps.count === nextProps.count
})

const FunctionComponent = () => {
  // const ref = useRef(0)
  // const [count] = useReducer((x: number) => x + 1, 0)
  const [count2, setCount2] = useState(1)
  const [text, setText] = useState('')
  // const arr = count % 2 === 0 ? [0, 1, 2, 3, 4] : [0, 1, 2, 3]
  // const arr = count2 % 2 === 0 ? [0, 1, 2, 3, 4] : [0, 1, 2, 4]

  const handleClick = () => {
    // ref.current = ref.current + 1
    setCount2(count2 + 1)
  }

  useLayoutEffect(() => {
    console.log('useLayoutEffect')
  }, [count2])

  useEffect(() => {
    console.log('useEffect')
  }, [count2])

  // const expensive = useMemo(() => {
  //   console.log('expensive')
  //   let sum = 0
  //   for (let i = 0; i < count2 * 10; i++) {
  //     sum += i
  //   }
  //   return sum
  // }, [count2])

  // const expensive = () => {
  //   console.log('expensive')
  //   let sum = 0
  //   for (let i = 0; i < count2 * 10; i++) {
  //     sum += i
  //   }
  //   return sum
  // }

  return (
    <div className="container">
      {
        /* count % 2 === 0 ? <div onClick={() => {
          setCount()
        }}>
          {count}
        </div> : <div onClick={() => {
          setCount()
        }}>哈哈哈哈</div>*/
      }
      {/* <div onClick={() => {
        setCount()
      }}>
        {count}
      </div> */}
      {/* <div>{expensive}</div> */}

      <input type="text" value={text} onChange={(e) => {
        setText((e.target as HTMLInputElement).value)
      }} />
      <div>{text}</div>
      <div>count: </div>
      <div onClick={handleClick}>
        {count2}
      </div>

      <div>测试memo</div>
      <MemoChild2 count={count2} />
      {/* <CountContext.Provider value={count2}>
        <CountContext.Provider value={count2 + 1}>
          <Child />
        </CountContext.Provider>
        <Child />
      </CountContext.Provider> */}
      {/* <ul>
        {arr.map((item) => <li key={item}>{item}</li>)}
      </ul> */}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <FunctionComponent />
)
