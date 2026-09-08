import {Component,type ReactNode} from 'react'

/** Keep a rendering failure local to the page; durable tasks continue on the server. */
export class PageBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){
    if(this.state.failed)return <main className="lp-empty-state" role="alert"><h1>这个页面暂时未能显示</h1><p>已提交的内容仍然保留，可以重新尝试打开。</p><button type="button" onClick={()=>this.setState({failed:false})}>重试显示</button><button type="button" onClick={()=>{location.hash='home'}}>返回首页</button></main>
    return this.props.children
  }
}
