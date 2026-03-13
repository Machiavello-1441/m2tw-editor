import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { EDBProvider } from './components/edb/EDBContext';
import { RefDataProvider } from './components/edb/RefDataContext';
import { Castle, Download, Home, Map } from 'lucide-react';

const navItems = [
  { name: 'Home', icon: Home, page: 'Home' },
  { name: 'EDB Editor', icon: Castle, page: 'EDBEditor' },
  { name: 'Campaign Map', icon: Map, page: 'CampaignMap' },
  { name: 'Export', icon: Download, page: 'Export' },
];

export default function Layout({ children, currentPageName }) {
  return (
    <RefDataProvider>
      <EDBProvider>
        <div className="dark min-h-screen bg-background flex">
          <nav className="w-16 lg:w-56 border-r border-border bg-card flex flex-col shrink-0">
            <div className="p-3 lg:p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Castle className="w-4 h-4 text-primary" />
                </div>
                <div className="hidden lg:block">
                  <h1 className="text-sm font-bold text-foreground leading-none">M2TW</h1>
                  <p className="text-[10px] text-muted-foreground">Mod Editor</p>
                </div>
              </div>
            </div>
            <div className="flex-1 p-2 space-y-1">
              {navItems.map(item => {
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                      ${isActive
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="hidden lg:block">{item.name}</span>
                  </Link>
                );
              })}
            </div>
            <div className="p-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground text-center hidden lg:block">
                Based on Ultimate Docudemons 2.0
              </p>
            </div>
          </nav>

          <main className="flex-1 min-h-screen overflow-auto">
            {children}
          </main>
        </div>
      </EDBProvider>
    </RefDataProvider>
  );
}