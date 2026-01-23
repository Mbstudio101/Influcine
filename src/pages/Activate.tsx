import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Check, Loader2, Monitor, AlertCircle, LogIn } from 'lucide-react';

const Activate: React.FC = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error' | 'not-logged-in'>('idle');

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setStatus('not-logged-in');
    }
  };

  const handleConnect = async () => {
    if (!code) return;
    setStatus('sending');
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      setStatus('not-logged-in');
      return;
    }

    const channel = supabase.channel(`login-handshake:${code}`);
    
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.send({
          type: 'broadcast',
          event: 'token',
          payload: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          },
        });
        
        setStatus('success');
        supabase.removeChannel(channel);
      }
    });
  };

  if (!code) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="text-white">Invalid activation code.</div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-gray-900 p-8 rounded-2xl max-w-sm w-full text-center border border-white/10">
        <div className="mx-auto bg-primary/20 w-16 h-16 rounded-full flex items-center justify-center mb-6">
           <Monitor className="text-primary" size={32} />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">Connect to TV</h2>
        
        {status === 'not-logged-in' ? (
          <>
             <p className="text-gray-400 mb-8">
               You need to be signed in on this device to approve the TV login.
             </p>
             <Link 
                to={`/login?redirect=/activate?code=${code}`}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-primary/25 flex items-center justify-center gap-2"
             >
                <LogIn size={20} />
                Sign In First
             </Link>
          </>
        ) : status === 'success' ? (
          <>
             <p className="text-gray-400 mb-8">
               Your TV should be logging in now.
             </p>
             <div className="bg-green-500/20 text-green-400 p-4 rounded-xl flex items-center justify-center gap-2">
                <Check size={20} />
                <span>Connected! You can close this.</span>
             </div>
          </>
        ) : (
          <>
            <p className="text-gray-400 mb-8">
              Click below to sign in on your TV using your current account.
            </p>
            <button 
              onClick={handleConnect}
              disabled={status === 'sending'}
              className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {status === 'sending' ? <Loader2 className="animate-spin" /> : 'Confirm Login'}
            </button>
          </>
        )}
        
        {status === 'error' && (
             <div className="mt-4 text-red-400 text-sm flex items-center justify-center gap-2">
                 <AlertCircle size={16} />
                 Failed to find session. Please sign in again.
             </div>
        )}
      </div>
    </div>
  );
};

export default Activate;
