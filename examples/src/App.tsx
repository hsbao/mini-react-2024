import { useState } from 'react'
import ContextChild from './components/ContextChild'
import ContextClassCom from './components/ContextClassCom'
import TestContext from './context'

function App() {
  const [name, setName] = useState('haha')

  // const changeName = (newVal: string) => {
  //   setName(newVal)     
  // }

  return (
    <>
    <TestContext.Provider value={{ name, setName }}>
      <ContextChild />
      <ContextClassCom />
    </TestContext.Provider>
      <ContextChild />
    </>
  )
}

export default App
