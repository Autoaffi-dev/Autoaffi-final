'use client';
import { useRouter } from "next/navigation";

export default function LoginPage(){
  const router = useRouter();
  const handle = () => {
    // mock login - in v4 replace with NextAuth / Supabase auth
    localStorage.setItem('autoaffi_user', JSON.stringify({name:'Beta Tester', email:'tester@example.com'}));
    router.push('/dashboard');
  };
  return (
    <main style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div className="card" style={{width:420,textAlign:'center'}}>
        <h2>Join AutoAffi Beta</h2>
        <p>Quick access for testers — no password required.</p>
        <button onClick={handle} className="btn btn-primary">Enter Beta</button>
      </div>
    </main>
  );
}