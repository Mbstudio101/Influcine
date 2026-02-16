import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, User, Settings, Library, LogOut, Users, Calendar } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { db } from '../db';
import { format } from 'date-fns';
import clsx from 'clsx';
import TitleBar from './TitleBar';
import Logo from './Logo';
import Focusable from './Focusable';
import { useToast } from '../context/toast';
import { usePlayer } from '../context/PlayerContext';
import { Avatar } from './Avatars';

interface LayoutProps {
  children: React.ReactNode;
}

const NavItem = ({
  to,
  icon: Icon,
  label,
  active,
  onClick,
  customIcon,
}: {
  to?: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick?: () => void;
  customIcon?: React.ReactNode;
}) => {
  const navigate = useNavigate();

  const handleInteract = () => {
    if (onClick) onClick();
    if (to) navigate(to);
  };

  return (
    <Focusable
      onClick={handleInteract}
      className={clsx(
        'relative h-11 w-11 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer border',
        active
          ? 'bg-linear-to-br from-[#ff4fa3] via-[#ff7ab6] to-[#7d7bff] text-white border-[rgba(255,255,255,0.45)] shadow-[0_10px_24px_rgba(255,79,163,0.35)]'
          : 'bg-[#0f172a]/65 text-slate-100 border-white/15 hover:border-white/35 hover:bg-white/10'
      )}
      activeClassName="ring-2 ring-primary scale-105"
      aria-label={label}
      title={label}
    >
      {customIcon || <Icon size={18} className="min-w-[18px]" />}
    </Focusable>
  );
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, profile } = useAuth();
  const { showToast } = useToast();
  const { state } = usePlayer();
  const isPlayerFull = state.mode === 'full';

  useEffect(() => {
    const checkReminders = async () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      const today = format(new Date(), 'yyyy-MM-dd');
      const dueReminders = await db.reminders.where('releaseDate').equals(today).toArray();

      if (dueReminders.length > 0) {
        const title = dueReminders.length === 1
          ? `Release Today: ${dueReminders[0].title}`
          : `${dueReminders.length} Releases Today!`;

        const body = dueReminders.length === 1
          ? 'Check it out in your calendar.'
          : dueReminders.map(r => r.title).slice(0, 3).join(', ') + (dueReminders.length > 3 ? '...' : '');

        new Notification(title, { body });
      }
    };

    checkReminders();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      showToast('You have been signed out.', 'info');
      navigate('/login');
    } catch (error) {
      console.error('Failed to logout:', error);
      showToast('Failed to logout. Please try again.', 'error');
    }
  };

  return (
    <div className="flex h-screen bg-background text-text overflow-hidden flex-col">
      <TitleBar className="left-0 right-0" />

      {!isPlayerFull && (
        <aside className="fixed left-4 top-1/2 -translate-y-1/2 z-[220] hidden md:flex">
          <div className="w-14 rounded-[1.8rem] border border-white/15 bg-[#060b15]/80 backdrop-blur-2xl p-2.5 flex flex-col items-center gap-2 shadow-[0_20px_45px_rgba(2,8,23,0.7)]">
            <div className="mb-1" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
              <Logo size="sm" showText={false} className="opacity-85" />
            </div>

            <NavItem to="/browse" icon={Home} label="Home" active={location.pathname === '/browse' || location.pathname === '/'} />
            <NavItem to="/search" icon={Search} label="Search" active={location.pathname === '/search'} />
            <NavItem to="/watchlist" icon={Library} label="My Library" active={location.pathname === '/watchlist'} />
            <NavItem to="/calendar" icon={Calendar} label="Calendar" active={location.pathname === '/calendar'} />

            <div className="w-7 h-px bg-white/15 my-1" />

            <NavItem icon={Users} label="Switch Profile" active={false} onClick={() => navigate('/profiles')} />
            <NavItem
              to="/profile"
              icon={User}
              label="Profile"
              active={location.pathname === '/profile'}
              customIcon={
                <div className="w-9 h-9 rounded-full overflow-hidden border border-white/30">
                  <Avatar id={profile?.avatarId || 'human-m-1'} />
                </div>
              }
            />
            <NavItem to="/settings" icon={Settings} label="Settings" active={location.pathname === '/settings'} />
            <NavItem icon={LogOut} label="Log Out" active={false} onClick={handleLogout} />
          </div>
        </aside>
      )}

      <div className={clsx('flex flex-1 relative overflow-hidden pt-10', !isPlayerFull && 'md:ml-[5.5rem]')}>
        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;
