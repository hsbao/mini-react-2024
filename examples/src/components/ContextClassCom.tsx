import { Component } from 'react'
import TestContext from '../context'

export default class ContextClassCom extends Component {
  static contextType = TestContext

  handleChange = () => {
    this.context.setName('1234')
  }
  render(){
    return (
      <div className="border">
        <p onClick={this.handleChange}>类组件:{this.context.name}</p>
      </div>
    )
}
}