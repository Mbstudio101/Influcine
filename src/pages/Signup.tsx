import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import Logo from '../components/Logo';
import Focusable from '../components/Focusable';
import { useToast } from '../context/toast';

const isTVEnvironment = typeof navigator !== 'undefined' && /AFT|Amazon|Android TV|BRAVIA|SMART-TV/i.test(navigator.userAgent);

const Signup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (password !== confirmPassword) {
      const message = 'Passwords do not match';
      showToast(message, 'error');
      return;
    }
    
    setLoading(true);
    try {
      await signup(email, password);
      // Wait a bit for AuthContext to update via Supabase listener
      setTimeout(() => {
          showToast('Account created. Let’s set up your profile.', 'success');
          navigate('/profiles', { state: { fromLogin: true } });
      }, 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create account';
      showToast(message, 'error');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isTVEnvironment) return;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full bg-black flex flex-col items-center justify-start pt-16 md:pt-24 p-4 overflow-clip touch-none overscroll-none drag-region">
      {isTVEnvironment ? (
        <div className="absolute inset-0 bg-black z-0" />
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-[#1a1a1a] via-black to-black z-0" />
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/30 blur-[100px] rounded-full pointer-events-none mix-blend-screen" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-900/40 blur-[100px] rounded-full pointer-events-none mix-blend-screen" />
        </>
      )}

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md bg-black/40 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10 no-drag"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="mb-6 scale-125">
            <Logo size="lg" showText={false} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
          <p className="text-gray-400">Join Influcine today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
          <div className="space-y-1">
            <label htmlFor="signup-email" className="text-sm font-medium text-gray-300 ml-1">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
              <Focusable
                as="input"
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
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
            <label htmlFor="signup-password" className="text-sm font-medium text-gray-300 ml-1">Password</label>
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
              <Focusable
                as="input"
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all"
                activeClassName="ring-2 ring-primary border-transparent bg-white/10"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="signup-confirm-password" className="text-sm font-medium text-gray-300 ml-1">Confirm Password</label>
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
              <Focusable
                as="input"
                id="signup-confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
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
            className="w-full bg-primary hover:bg-primary-hover text-white font-bold h-12 rounded-xl transition-all shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            activeClassName="ring-4 ring-primary/50 scale-[1.02]"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Create Account'}
          </Focusable>
        </form>

        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            Already have an account?{' '}
            <Focusable 
              as={Link} 
              to="/login" 
              className="text-primary hover:text-primary-hover font-medium transition-colors px-2 py-1 rounded focus:outline-none"
              activeClassName="bg-primary/20 ring-2 ring-primary"
            >
              Sign In
            </Focusable>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;
