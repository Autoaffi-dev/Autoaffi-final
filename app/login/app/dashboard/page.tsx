'use client';
import { useEffect, useState } from "react";
import axios from "axios";

type Suggestion = { caption:string, affiliate:{ provider:string, product_title:string, affiliate_url:string }};

export default function Dashboard(){
  const [user,setUser] = useState<any>(null);
  const [prompt,setPrompt] = useState('');
  const [suggestions,setSuggestions] = useState<Suggestion[]>([]);
  const [loading,setLoading] = useState(false);

  useEffect(()=> {
    const raw = localStorage.getItem('autoaffi_user');
    if(!raw) { window.location.href = '/login'; return; }
    setUser(JSON.parse(raw));
  },[]);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/openai/generate', { originalCaption: prompt, platform: 'instagram', followerCount: 1200 });
      setSuggestions(res.data.suggestions);
    } catch(e){
      alert('Error generating. Using fallback.');
    } finally { setLoading(false); }
  };

  const createLink = async (s:Suggestion) => {
    const res = await axios.post('/api/affiliate/generate', { provider: s.affiliate.provider, product_title: s.affiliate.product_title });
    alert('Link created: ' + (res.data.url||'mock-link'));
  };

  return (
    <main style={{minHeight:'100vh'}}>
      <div className="container">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h2>Welcome, {user?.name}</h2>
          <a href="/"><button className="btn">Home</button></a>
        </div>

        <div className="card" style={{marginTop:20}}>
          <h3>Create a post</h3>
          <textarea placeholder="Write a short idea for a post..." value={prompt} onChange={(e)=>setPrompt(e.target.value)} style={{width:'100%',height:100}} />
          <div style={{marginTop:10}}>
            <button onClick={generate} className="btn btn-primary">{loading?'Generating...':'Get affiliate suggestions'}</button>
          </div>
        </div>

        <div style={{marginTop:16}}>
          {suggestions.map((s,i)=>(
            <div key={i} className="card" style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <strong>{s.affiliate.product_title}</strong>
                  <div style={{fontSize:13,color:'#666'}}>{s.caption}</div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>createLink(s)} className="btn btn-primary">Use link</button>
                  <a href={s.affiliate.affiliate_url} target="_blank" rel="noreferrer"><button className="btn">Preview</button></a>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}