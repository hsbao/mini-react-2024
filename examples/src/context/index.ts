import { createContext } from 'react'

const TestContext = createContext({
  name: '默认值',
  setName: (newVal: string) => {
    console.log('changeName', newVal)
  }  //提供方法，在子组件中可以调用修改context
})

export default TestContext