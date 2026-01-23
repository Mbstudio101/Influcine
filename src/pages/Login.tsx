import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import Logo from '../components/Logo';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [hasUsedApp, setHasUsedApp] = useState(false);

  useEffect(() => {
    const hasUsed = localStorage.getItem('influcine_has_used_app');
    if (hasUsed) {
      setHasUsedApp(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      localStorage.setItem('influcine_has_used_app', 'true');
      navigate('/profiles');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Ambience */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          rotate: [0, 90, 0],
          opacity: [0.3, 0.5, 0.3] 
        }}
        transition={{ 
          duration: 20, 
          repeat: Infinity,
          ease: "linear" 
        }}
        className="absolute top-[-20%] left-[-20%] w-[70%] h-[70%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.5, 1],
          rotate: [0, -60, 0],
          opacity: [0.2, 0.4, 0.2] 
        }}
        transition={{ 
          duration: 25, 
          repeat: Infinity,
          ease: "linear",
          delay: 2
        }}
        className="absolute bottom-[-20%] right-[-20%] w-[70%] h-[70%] bg-purple-900/20 blur-[120px] rounded-full pointer-events-none" 
      />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="mb-6 scale-125">
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
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary hover:text-primary-hover font-medium transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
