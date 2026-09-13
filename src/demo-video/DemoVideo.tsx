import {useRef,useState} from 'react'
import brand from '../pages/auth-assets/brand.svg'

const media=`${import.meta.env.BASE_URL}media/project-demo-35f7c6c565c7`

/** Public static media: no session, API request, upload or per-viewer resource. */
export function DemoVideo(){
  const video=useRef<HTMLVideoElement>(null)
  const [failed,setFailed]=useState(false)
  return <main className="demo-video-page">
    <header className="demo-video-header">
      <a className="demo-video-back" href={`${import.meta.env.BASE_URL}#intro`} target="_top"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12"/></svg><span>返回介绍</span></a>
      <h1>演示视频</h1>
      <a className="demo-video-brand" href={`${import.meta.env.BASE_URL}#intro`} target="_top" aria-label="问山 ThreadPeak，返回介绍"><img src={brand} alt="问山"/><span>ThreadPeak</span></a>
    </header>
    <section className="demo-video-player" aria-label="项目介绍视频">
      <video ref={video} controls playsInline preload="none" poster={`${media}.jpg`} src={`${media}.mp4`} aria-label="项目介绍 · 男声配音版" onError={()=>setFailed(true)} onLoadedData={()=>setFailed(false)}>
        当前浏览器不支持视频播放。
      </video>
      {failed&&<div className="demo-video-error" role="alert"><p>视频暂时未能加载。</p><button onClick={()=>{setFailed(false);video.current?.load()}}>重新加载</button></div>}
    </section>
  </main>
}
