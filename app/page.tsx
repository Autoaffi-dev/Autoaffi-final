import Link from "next/link";

export default function HomePage(){
  return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div className="container card" style={{display:'flex',gap:24,alignItems:'center'}}>
        <div style={{flex:1}}>
          <h1 style={{fontSize:36,color:'#043351'}}>Automate your affiliate income ✨</h1>
          <p style={{fontSize:18,color:'#08394a'}}>AutoAffi writes captions, finds the right affiliate offers and schedules posts — so creators can focus on content.</p>
          <div style={{marginTop:16,display:'flex',gap:12}}>
            <Link href="/login"><button className="btn btn-primary">Join Beta (Free)</button></Link>
            <a href="#demo"><button className="btn btn-ghost">Watch Demo</button></a>
            <a href="/hero-still.svg" download="autoaffi-still.svg"><button className="btn" style={{background:'#06b6d4',color:'#fff'}}>Download Still</button></a>
          </div>
        </div>

        <div style={{width:420}}>
          <div id="demo" style={{width:'100%',borderRadius:12,overflow:'hidden',background:'#000'}}>
            <video src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" autoPlay loop muted playsInline style={{width:'100%'}}/>
          </div>
        </div>
      </div>
    </main>
  );
}