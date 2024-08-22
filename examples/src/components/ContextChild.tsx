import { useContext } from 'react'
import TestContext from '../context'


const ContextChild = () => {
  const { name, setName } = useContext(TestContext)
  return (
    <div>
      <p onClick={() => setName('hongshibao111')}>{name}</p>
      <TestContext.Consumer>
        {
          (ctx) => {
            return <div onClick={() => setName('Consumer 修改name')}>Consumer组件: {ctx.name}</div>
          }
        }
      </TestContext.Consumer>
    </div>
  );
}

export default ContextChild;