import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, Play, Monitor, Smartphone, Tv, X } from 'lucide-react';
import Logo from '../components/Logo';

const Landing: React.FC = () => {
  const downloadUrl = "#"; // TODO: Replace with actual download URL
  const [isPlaying, setIsPlaying] = useState(false);
  
  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30 overflow-x-hidden overflow-y-auto">
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[120px] rounded-full opacity-40" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 blur-[120px] rounded-full opacity-40" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-md border-b border-white/5 bg-black/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-6">
            <Link 
              to="/login" 
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link 
              to="/signup" 
              className="bg-primary hover:bg-primary-hover text-white text-sm font-bold px-5 py-2.5 rounded-full transition-all shadow-lg hover:shadow-primary/25"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block py-1 px-3 rounded-full bg-white/10 border border-white/10 text-primary text-xs font-bold tracking-wider mb-6">
              AVAILABLE NOW
            </span>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight bg-linear-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Cinema in Your Pocket.<br />
              And on Your Wall.
            </h1>
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Experience unlimited entertainment with Influcine. Stream your favorite movies and shows in 4K HDR, anywhere you go.
            </p>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-16">
              <a 
                href={downloadUrl}
                className="group relative px-8 py-4 bg-white text-black rounded-full font-bold text-lg flex items-center gap-3 hover:bg-gray-100 transition-all shadow-xl hover:shadow-white/10"
              >
                <Download className="w-5 h-5" />
                <span>Download App</span>
                <span className="absolute -top-2 -right-2 bg-primary text-white text-[10px] px-2 py-0.5 rounded-full animate-bounce">
                  FREE
                </span>
              </a>
              <Link 
                to="/login"
                className="px-8 py-4 bg-white/10 border border-white/10 backdrop-blur-sm text-white rounded-full font-bold text-lg flex items-center gap-3 hover:bg-white/20 transition-all"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Open Web Player</span>
              </Link>
            </div>
          </motion.div>

          {/* App Preview */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative mx-auto max-w-5xl"
          >
            <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent z-10" />
            <div 
              className={`rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-primary/10 bg-[#0f0f0f] aspect-video flex relative group select-none ${!isPlaying ? 'cursor-pointer' : ''}`}
              onClick={() => !isPlaying && setIsPlaying(true)}
            >
              {isPlaying ? (
                <div className="w-full h-full relative">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    src="https://www.youtube.com/embed/qEvM9CROPfM?autoplay=1&rel=0&modestbranding=1" 
                    title="Influcine Preview" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                    allowFullScreen
                    className="w-full h-full"
                  />
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsPlaying(false);
                    }}
                    className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-colors z-20"
                  >
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <>
                  {/* Mock App Interface */}
                  
                  {/* Sidebar */}
                  <div className="w-16 md:w-20 bg-black/40 border-r border-white/5 flex flex-col items-center py-6 gap-6 z-20 backdrop-blur-md">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/20 flex items-center justify-center mb-2">
                       <div className="w-4 h-4 md:w-5 md:h-5 bg-primary rounded-full" />
                    </div>
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-colors ${i === 1 ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5'}`}>
                        <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-current opacity-50" />
                      </div>
                    ))}
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 flex flex-col relative">
                     {/* Hero Section with Gradient */}
                     <div className="h-[65%] w-full bg-linear-to-br from-indigo-900/20 via-purple-900/20 to-black relative p-6 md:p-8 flex flex-col justify-end">
                        <div className="absolute inset-0 bg-linear-to-t from-[#0f0f0f] via-[#0f0f0f]/20 to-transparent" />
                        
                        <div className="relative z-10 max-w-lg">
                          <div className="w-20 h-5 md:w-24 md:h-6 bg-primary/80 rounded mb-3 md:mb-4 backdrop-blur-sm" />
                          <div className="h-8 md:h-12 w-3/4 bg-white/10 rounded-lg mb-3 md:mb-4 backdrop-blur-md" />
                          <div className="flex gap-3">
                            <div className="px-4 md:px-6 py-2 bg-white text-black rounded-lg font-bold text-xs md:text-sm flex items-center gap-2">
                              <div className="w-0 h-0 border-t-4 md:border-t-[5px] border-t-transparent border-l-[6px] md:border-l-8 border-l-black border-b-4 md:border-b-[5px] border-b-transparent" />
                              Play
                            </div>
                            <div className="px-4 md:px-6 py-2 bg-white/10 text-white rounded-lg font-bold text-xs md:text-sm backdrop-blur-md">More Info</div>
                          </div>
                        </div>
                     </div>

                     {/* Continue Watching Row */}
                     <div className="flex-1 bg-[#0f0f0f] p-4 md:p-6">
                        <div className="h-3 md:h-4 w-24 md:w-32 bg-white/10 rounded mb-3 md:mb-4" />
                        <div className="flex gap-3 md:gap-4 overflow-hidden">
                           {[1,2,3,4].map(i => (
                              <div key={i} className="w-32 md:w-48 aspect-video rounded-lg bg-white/5 border border-white/5 relative overflow-hidden group/card">
                                 <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent" />
                                 <div className="absolute bottom-2 left-2 right-2 h-1 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary w-2/3" />
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>

                  {/* Overlay Play Button (Pulsing) */}
                  <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 backdrop-blur-[1px] group-hover:backdrop-blur-none transition-all duration-500">
                     <div className="w-16 h-16 md:w-24 md:h-24 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20 shadow-2xl group-hover:scale-110 transition-transform duration-300">
                        <Play className="w-8 h-8 md:w-10 md:h-10 text-white fill-white ml-1" />
                     </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </main>

      {/* Features Grid */}
      <section className="relative z-10 py-24 bg-linear-to-b from-black to-gray-900/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Monitor size={32} />}
              title="Cross-Platform"
              description="Seamlessly switch between your TV, computer, and mobile devices. Your progress syncs automatically."
            />
            <FeatureCard 
              icon={<Tv size={32} />}
              title="Built for TV"
              description="Enjoy a fully optimized 10-foot UI designed specifically for large screens and remote controls."
            />
            <FeatureCard 
              icon={<Smartphone size={32} />}
              title="Mobile Ready"
              description="Take your library with you. Download content for offline viewing on iOS and Android."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 border-t border-white/5 bg-black">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <Logo size="sm" />
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} Influcine. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

  const FeatureCard: React.FC<{ icon: React.ReactNode, title: string, description: string }> = ({ icon, title, description }) => (
    <div className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:scale-105 duration-300 group cursor-default">
      <div className="text-primary mb-4 group-hover:scale-110 transition-transform duration-300">{icon}</div>
      <h3 className="text-xl font-bold mb-3 group-hover:text-white transition-colors">{title}</h3>
      <p className="text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">{description}</p>
    </div>
  );

export default Landing;
