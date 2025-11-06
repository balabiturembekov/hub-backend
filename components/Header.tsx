'use client';

import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { UserAvatar } from '@/components/UserAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell, Settings, LogOut } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function Header() {
  const { currentUser, logout } = useStore();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      // Use window.location.href for full page reload to clear all pending requests
      window.location.href = '/login';
    } catch (error) {
      console.error('Error during logout:', error);
      // Still redirect to login even if logout fails
      window.location.href = '/login';
    }
  };

  if (!currentUser) {
    return (
      <header className="flex h-16 items-center justify-between border-b px-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">HubStaff Demo</h2>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/login')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Login
          </button>
        </div>
      </header>
    );
  }

  return (
    <TooltipProvider>
      <header className="flex h-16 items-center justify-between border-b px-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Dashboard</h2>
        </div>
        <div className="flex items-center gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="relative rounded-full p-2 hover:bg-accent">
                <Bell className="h-5 w-5" />
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Notifications</p>
            </TooltipContent>
          </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full hover:bg-accent">
              <UserAvatar 
                name={currentUser.name}
                avatar={currentUser.avatar}
                size="md"
              />
              <span className="text-sm font-medium">{currentUser.name}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {currentUser.name}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {currentUser.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/profile')}>
              <Settings className="mr-2 h-4 w-4" />
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    </TooltipProvider>
  );
}
