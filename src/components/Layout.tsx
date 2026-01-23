import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, User, Settings, Library, LogOut, Users } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import clsx from 'clsx';
import TitleBar from './TitleBar';
import Logo from './Logo';
import Focusable from './Focusable';

interface LayoutProps {
  children: React.ReactNode;
}

const NavItem = ({ to, icon: Icon, label, active, onClick }: { to?: string; icon: React.ElementType; label: string; active: boolean; onClick?: () => void }) => {
  const navigate = useNavigate();
  
  const content = (
    <>
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full shadow-[0_0_12px_rgba(124,58,237,0.5)]" />
      )}
      <Icon size={24} className={clsx("transition-transform duration-300 min-w-[24px]", active ? "scale-110 text-primary" : "group-hover/item:scale-110")} />
      <span className="font-medium tracking-wide whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 -translate-x-4 group-hover:translate-x-0 transform">
        {label}
      </span>
    </>
  );

  const className = clsx(
    'flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group/item relative overflow-hidden w-full text-left cursor-pointer',
    active ? 'bg-primary/20 text-white' : 'text-textSecondary hover:text-white hover:bg-white/10'
  );

  const handleInteract = () => {
    if (onClick) onClick();
    if (to) navigate(to);
  };

  return (
    <Focusable 
      onClick={handleInteract} 
      className={className}
      activeClassName="ring-2 ring-primary bg-white/10 z-10"
    >
      {content}
    </Focusable>
  );
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const dragStyle: React.CSSProperties & { WebkitAppRegion?: string } = { WebkitAppRegion: 'drag' };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  return (
    <div className="flex h-screen bg-background text-text overflow-hidden flex-col">
      {/* Sidebar - Fixed to Top-Left */}
      <div className="fixed left-0 top-0 bottom-0 z-110 w-20 hover:w-64 bg-black/80 backdrop-blur-2xl border-r border-white/5 flex flex-col transition-all duration-300 group">
        <div className="h-10 flex items-center px-4 overflow-hidden shrink-0" style={dragStyle}>
           <Logo 
             size="sm" 
             className="group-hover:scale-110 transition-transform duration-300"
             textClassName="opacity-0 group-hover:opacity-100 transition-opacity duration-300 -translate-x-4 group-hover:translate-x-0 transform pl-3"
           />
        </div>

        <nav className="flex-1 px-3 py-6 space-y-3 overflow-y-auto scrollbar-hide">
          <NavItem to="/" icon={Home} label="Home" active={location.pathname === '/'} />
          <NavItem to="/search" icon={Search} label="Search" active={location.pathname === '/search'} />
          <NavItem to="/watchlist" icon={Library} label="My Library" active={location.pathname === '/watchlist'} />
        </nav>

        <div className="p-3 border-t border-white/5 space-y-3 mb-4 shrink-0">
          <NavItem 
            icon={Users} 
            label="Switch Profile" 
            active={false} 
            onClick={() => navigate('/profiles')}
          />
          <NavItem to="/profile" icon={User} label="Profile" active={location.pathname === '/profile'} />
          <NavItem to="/settings" icon={Settings} label="Settings" active={location.pathname === '/settings'} />
          <NavItem 
            icon={LogOut} 
            label="Log Out" 
            active={false} 
            onClick={handleLogout}
          />
        </div>
      </div>

      <TitleBar />
      
      <div className="flex flex-1 relative overflow-hidden ml-20">
        {/* Main Content */}
        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;
