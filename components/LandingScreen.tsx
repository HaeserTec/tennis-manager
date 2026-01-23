import React, { useState } from 'react';
import { ArrowRight, Lock, User, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Client } from '@/lib/playbook';
import { PlaybookDiagramV2 } from '@/components/PlaybookDiagramV2';
import { supabase } from '@/lib/supabase';

interface LandingScreenProps {
  clients: Client[];
  onCoachLogin: () => void;
  onClientLogin: (clientId: string) => void;
}

export function LandingScreen({ clients, onCoachLogin, onClientLogin }: LandingScreenProps) {
  const [view, setView] = useState<'selection' | 'coach-auth' | 'client-auth'>('selection');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleCoachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (authMode === 'signup') {
         const { data, error: authError } = await supabase.auth.signUp({
            email,
            password,
         });
         if (authError) throw authError;
         if (data.user) {
            setSuccessMsg('Account created! Please check your email to confirm.');
            setAuthMode('login'); // Switch back to login
         }
      } else {
         const { data, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
         });

         if (authError) throw authError;

         if (data.user) {
            onCoachLogin();
         }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClientSelect = (id: string) => {
     // In a real app, we would ask for a password here too
     onClientLogin(id);
  };

  return (
    <div className="midnight min-h-screen bg-background text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Ambience (Tennis Court) */}
      <div className="absolute inset-0 z-0 opacity-20 blur-[1px] pointer-events-none select-none">
         <PlaybookDiagramV2 showHeader={false} fill={true} disablePersistence={true} isBackground={true} />
      </div>

      <div className="w-full max-w-md z-10 space-y-8 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Logo / Header */}
        <div className="text-center space-y-2">
           <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full animate-pulse" />
              <img
                src="/vgta-icon.svg"
                alt="VGTA"
                className="relative w-20 h-20 rounded-2xl ring-1 ring-white/10 shadow-2xl"
              />
           </div>
           <h1 className="text-3xl font-bold tracking-tight">VGTA</h1>
           <p className="text-slate-400">High Performance Academy</p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
           
           {view === 'selection' && (
              <div className="space-y-4">
                 <button 
                    onClick={() => setView('client-auth')}
                    className="w-full group relative flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/50 transition-all text-left"
                 >
                    <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                       <User className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                       <h3 className="font-bold text-lg text-white group-hover:text-primary transition-colors">Athlete / Parent</h3>
                       <p className="text-xs text-slate-400">View schedules & progress</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                 </button>

                 <button 
                    onClick={() => setView('coach-auth')}
                    className="w-full group relative flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all text-left"
                 >
                    <div className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                       <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                       <h3 className="font-bold text-lg text-white group-hover:text-slate-200 transition-colors">Coach Access</h3>
                       <p className="text-xs text-slate-400">Manage academy & drills</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                 </button>
              </div>
           )}

           {view === 'coach-auth' && (
              <form onSubmit={handleCoachSubmit} className="space-y-4">
                 <div className="text-center">
                    <h3 className="text-lg font-bold">{authMode === 'login' ? 'Coach Login' : 'Create Account'}</h3>
                    <p className="text-xs text-slate-400 mt-1">{authMode === 'login' ? 'Enter your credentials' : 'Join the coaching staff'}</p>
                 </div>
                 
                 <div className="space-y-3">
                    {successMsg && <div className="p-2 bg-green-500/20 border border-green-500/30 rounded text-center text-xs text-green-300">{successMsg}</div>}
                    
                    <div className="space-y-1">
                       <Input 
                          name="email"
                          id="email"
                          autoComplete="email"
                          type="email" 
                          placeholder="Email" 
                          className="bg-slate-950/50 border-white/10 h-10 font-medium focus-visible:ring-primary"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setError(''); }}
                          autoFocus
                       />
                    </div>
                    <div className="space-y-1">
                       <Input 
                          name="password"
                          id="password"
                          autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                          type="password" 
                          placeholder="Password" 
                          className="bg-slate-950/50 border-white/10 h-10 font-medium focus-visible:ring-primary"
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setError(''); }}
                       />
                    </div>
                    {error && <p className="text-center text-red-400 text-xs font-medium animate-in slide-in-from-top-1">{error}</p>}
                 </div>

                 <div className="flex gap-3 pt-2">
                    <Button type="button" variant="ghost" className="flex-1" onClick={() => setView('selection')}>Back</Button>
                    <Button type="submit" disabled={loading} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
                        {loading ? '...' : (authMode === 'login' ? 'Enter' : 'Sign Up')}
                    </Button>
                 </div>
                 
                 <div className="text-center pt-2">
                    <button 
                       type="button"
                       onClick={() => { setAuthMode(m => m === 'login' ? 'signup' : 'login'); setError(''); setSuccessMsg(''); }}
                       className="text-[10px] text-slate-400 hover:text-white underline underline-offset-2"
                    >
                       {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
                    </button>
                 </div>
              </form>
           )}

           {view === 'client-auth' && (
              <div className="space-y-6">
                 <div className="text-center">
                    <h3 className="text-lg font-bold">Select Account</h3>
                    <p className="text-xs text-slate-400 mt-1">Choose your family profile</p>
                 </div>

                 <div className="space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar -mr-2 pr-2">
                    {clients.length > 0 ? (
                       clients.map(client => (
                          <button
                             key={client.id}
                             onClick={() => handleClientSelect(client.id)}
                             className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-primary/30 transition-all text-left group"
                          >
                             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                                {client.name.charAt(0)}
                             </div>
                             <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{client.name}</div>
                                <div className="text-[10px] text-slate-500 truncate">{client.email}</div>
                             </div>
                             <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                          </button>
                       ))
                    ) : (
                       <div className="text-center py-8 text-xs text-slate-500">
                          No active accounts found.<br/>Please contact the academy.
                       </div>
                    )}
                 </div>

                 <Button variant="ghost" className="w-full" onClick={() => setView('selection')}>Back</Button>
              </div>
           )}

        </div>
        
        {/* Footer */}
        <p className="text-center text-[10px] text-slate-600 font-medium">
           &copy; {new Date().getFullYear()} Von Gericke Tennis Academy &bull; v1.0.4
        </p>
      </div>
    </div>
  );
}
