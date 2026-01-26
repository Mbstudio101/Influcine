import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Mail, Lock, Loader2, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';
import Focusable from '../components/Focusable';
import { useToast } from '../context/toast';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [hasUsedApp, setHasUsedApp] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [customIp, setCustomIp] = useState('');
  const [showIpInput, setShowIpInput] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const hasUsed = localStorage.getItem('influcine_has_used_app');
    if (hasUsed) {
      setHasUsedApp(true);
    }
  }, []);

  useEffect(() => {
    const id = crypto.randomUUID();
    setSessionId(id);

    const channel = supabase.channel(`login-handshake:${id}`)
      .on('broadcast', { event: 'token' }, async (payload) => {
        if (payload.payload.access_token && payload.payload.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: payload.payload.access_token,
            refresh_token: payload.payload.refresh_token,
          });
          
          if (!error) {
            localStorage.setItem('influcine_has_used_app', 'true');
            showToast('Signed in on this device', 'success');
            navigate('/profiles');
          } else {
            console.error('Failed to complete QR login:', error);
            showToast('Failed to complete QR login. Please try again.', 'error');
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate, showToast]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      localStorage.setItem('influcine_has_used_app', 'true');
      showToast('Signed in successfully', 'success');
      navigate('/profiles');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to login';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-black flex flex-col items-center justify-center p-4 overflow-hidden touch-none overscroll-none drag-region">
      {/* Cinematic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-[#1a1a1a] via-black to-black z-0" />
      
      {/* Animated Nebulas - "Breathtaking" Ambience */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3],
          rotate: [0, 45, 0]
        }}
        transition={{ 
          duration: 15, 
          repeat: Infinity,
          ease: "easeInOut" 
        }}
        className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary/30 blur-[100px] rounded-full pointer-events-none mix-blend-screen" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.5, 0.2],
          rotate: [0, -45, 0]
        }}
        transition={{ 
          duration: 20, 
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
        className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-900/40 blur-[100px] rounded-full pointer-events-none mix-blend-screen" 
      />
      
      {/* Film Grain Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-1" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} 
      />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-4xl bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl relative z-10 overflow-hidden flex flex-col md:flex-row no-drag"
      >
        {/* Left Side: Form */}
        <div className="flex-1 p-8 md:p-12 border-b md:border-b-0 md:border-r border-white/10">
          <div className="flex flex-col items-center md:items-start mb-8">
            <div className="mb-6 scale-125 md:self-start">
              <Logo size="lg" showText={false} />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{hasUsedApp ? 'Welcome Back' : 'Welcome'}</h1>
            <p className="text-gray-400">{hasUsedApp ? 'Sign in to continue to Influcine' : 'Sign in to start watching'}</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg mb-6 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-300 ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
                <Focusable
                  as="input"
                  type="email"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all"
                  activeClassName="ring-2 ring-primary border-transparent bg-white/10"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-300 ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
                <Focusable
                  as="input"
                  type="password"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all"
                  activeClassName="ring-2 ring-primary border-transparent bg-white/10"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <Focusable
              as="button"
              type="submit"
              disabled={loading}
              onClick={() => handleSubmit()}
              className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              activeClassName="ring-4 ring-primary/50 scale-[1.02]"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
            </Focusable>
          </form>

          <div className="mt-8 text-center md:text-left">
            <p className="text-gray-400 text-sm">
              Don't have an account?{' '}
              <Focusable 
                as={Link} 
                to="/signup" 
                className="text-primary hover:text-primary-hover font-medium transition-colors px-2 py-1 rounded focus:outline-none"
                activeClassName="bg-primary/20 ring-2 ring-primary"
              >
                Create one
              </Focusable>
            </p>
          </div>
        </div>

        {/* Right Side: QR Code Login */}
        <div className="w-full md:w-80 bg-black/20 p-8 flex flex-col items-center justify-center text-center border-l border-white/5">
          <div className="bg-white p-4 rounded-xl shadow-lg mb-6 relative group">
             {/* QR Code */}
            <QRCodeSVG 
              value={customIp ? `http://${customIp}:5173/activate?code=${sessionId}` : `${window.location.origin}/activate?code=${sessionId}`}
              size={180}
              level="H"
              includeMargin={false}
            />
            
            {/* Scan Icon Overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
               <Smartphone className="text-primary drop-shadow-lg" size={48} />
            </div>
          </div>
          
          <h3 className="text-xl font-bold text-white mb-2">Scan to Sign In</h3>
          <p className="text-sm text-gray-400 mb-2 max-w-[200px]">
            Use your phone's camera to sign in instantly without typing.
          </p>

          <button 
            onClick={() => setShowIpInput(!showIpInput)} 
            className="text-xs text-gray-500 hover:text-white underline mb-4 transition-colors"
          >
            {showIpInput ? 'Hide Network Settings' : 'Trouble scanning?'}
          </button>

          {showIpInput && (
            <div className="mb-4 w-full animate-in fade-in slide-in-from-top-2">
              <input 
                type="text" 
                value={customIp}
                placeholder="e.g. 192.168.1.X" 
                className="w-full bg-black/40 text-white text-xs p-2 rounded border border-white/10 focus:border-primary focus:outline-none transition-colors text-center"
                onChange={(e) => setCustomIp(e.target.value)}
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Enter your computer's local IP address if 'localhost' doesn't work.
              </p>
            </div>
          )}
          
          <div className="bg-white/5 rounded-lg p-3 w-full border border-white/10">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Session ID</p>
            <p className="text-sm font-mono font-bold text-primary tracking-widest break-all">
              {sessionId ? sessionId.substring(0, 8).toUpperCase() : 'LOADING...'}
            </p>
          </div>
          
          <p className="text-[10px] text-gray-600 mt-6">
            * Requires internet connection. Open the camera app on your phone.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
