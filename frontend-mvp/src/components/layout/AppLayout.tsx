'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Home,
    Briefcase,
    Users,
    MessageSquare,
    Calendar,
    FileText,
    Search,
    Plus,
    Settings,
    HelpCircle,
    LogOut,
    ChevronRight,
    ChevronDown,
    Sparkles,
    Clock,
    X,
    Menu,
    LayoutGrid,
    Mail,
    ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// Types
interface RecentRole {
    session_id: string;
    role_title: string;
    candidates_count: number;
    created_at: string;
}

interface NavItem {
    id: string;
    label: string;
    icon: React.ElementType;
    href: string;
    badge?: number;
    description: string;
}

// ================================================================
// DONNA MASCOT
// ================================================================
const DonnaMascot = ({
    size = 'sm',
    isHovered = false,
}: {
    size?: 'sm' | 'md' | 'lg';
    isHovered?: boolean;
}) => {
    const sizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' };
    const iconSizes = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' };

    return (
        <motion.div
            className={cn(
                sizes[size],
                'rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 relative overflow-hidden'
            )}
            animate={isHovered ? { scale: 1.05 } : { scale: 1 }}
            transition={{ duration: 0.2 }}
        >
            <Sparkles className={cn(iconSizes[size], 'text-white')} />
        </motion.div>
    );
};

// ================================================================
// CLEAN TOOLTIP CONTENT
// ================================================================
const CleanTooltip = ({
    label,
    description,
    badge,
    side = 'right',
}: {
    label: string;
    description: string;
    badge?: number;
    side?: 'top' | 'right' | 'bottom' | 'left';
}) => {
    return (
        <TooltipContent
            side={side}
            className="bg-slate-800 border-slate-700 px-3 py-2 max-w-[180px]"
            sideOffset={8}
        >
            <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-white text-sm">{label}</span>
                {badge && badge > 0 && (
                    <Badge className="bg-indigo-500/20 text-indigo-300 text-xs px-1.5 h-5">
                        {badge}
                    </Badge>
                )}
            </div>
            <p className="text-xs text-slate-400">{description}</p>
        </TooltipContent>
    );
};

// ================================================================
// NAV ITEM BUTTON
// ================================================================
const NavItemButton = ({
    item,
    isActive,
    isCollapsed,
}: {
    item: NavItem;
    isActive: boolean;
    isCollapsed: boolean;
}) => {
    const Icon = item.icon;

    const content = (
        <Link
            href={item.href}
            className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            )}
        >
            <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-indigo-400')} />

            {!isCollapsed && (
                <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && item.badge > 0 && (
                        <Badge
                            variant="secondary"
                            className={cn(
                                'text-xs px-1.5 py-0.5 min-w-[20px] justify-center',
                                isActive
                                    ? 'bg-indigo-500/20 text-indigo-300'
                                    : 'bg-white/10 text-slate-300'
                            )}
                        >
                            {item.badge}
                        </Badge>
                    )}
                </>
            )}
        </Link>
    );

    if (isCollapsed) {
        return (
            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>{content}</TooltipTrigger>
                <CleanTooltip
                    label={item.label}
                    description={item.description}
                    badge={item.badge}
                />
            </Tooltip>
        );
    }

    return (
        <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>{content}</TooltipTrigger>
            <CleanTooltip
                label={item.label}
                description={item.description}
                badge={item.badge}
            />
        </Tooltip>
    );
};

// ================================================================
// RECENT ROLE ITEM
// ================================================================
const RecentRoleItem = ({
    role,
    isActive,
    isCollapsed,
}: {
    role: RecentRole;
    isActive: boolean;
    isCollapsed: boolean;
}) => {
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / 86400000);
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    };

    const content = (
        <Link
            href={`/results/${role.session_id}`}
            className={cn(
                'group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200',
                isActive
                    ? 'bg-indigo-500/10 border border-indigo-500/20'
                    : 'hover:bg-white/5 border border-transparent'
            )}
        >
            <div
                className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0 transition-colors',
                    isActive ? 'bg-indigo-400' : 'bg-slate-600 group-hover:bg-indigo-400'
                )}
            />
            {!isCollapsed && (
                <div className="flex-1 min-w-0">
                    <p
                        className={cn(
                            'truncate font-medium',
                            isActive ? 'text-indigo-300' : 'text-slate-300 group-hover:text-white'
                        )}
                    >
                        {role.role_title || 'Untitled Role'}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                        <span>{role.candidates_count} candidates</span>
                        <span>•</span>
                        <span>{formatDate(role.created_at)}</span>
                    </p>
                </div>
            )}
        </Link>
    );

    if (isCollapsed) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>{content}</TooltipTrigger>
                <TooltipContent side="right" className="bg-slate-800 border-slate-700">
                    <p className="font-medium text-white">{role.role_title || 'Untitled Role'}</p>
                    <p className="text-xs text-slate-400">{role.candidates_count} candidates</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    return content;
};

// ================================================================
// SUPPORT POPUP - CLEANER VERSION
// ================================================================
const SupportPopup = ({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) => {
    if (!isOpen) return null;

    const contacts = [
        {
            name: 'Mrigesh Thakur',
            role: 'Technical Support',
            email: 'mrigeshthakur11@gmail.com',
            phone: '+91 96198 29501',
            primary: true,
        },
    ];

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                onClick={onClose}
            />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold text-white">Get Support</h2>
                                <p className="text-sm text-white/70 mt-0.5">We're here to help</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                        {/* Info Banner */}
                        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                            <p className="text-sm text-slate-300">
                                Having trouble or need assistance? Reach out to our team directly.
                                We typically respond within a few hours.
                            </p>
                        </div>

                        {/* Contact Cards */}
                        <div className="space-y-3">
                            {contacts.map((contact) => (
                                <div
                                    key={contact.name}
                                    className={cn(
                                        'p-4 rounded-xl border transition-all',
                                        contact.primary
                                            ? 'border-indigo-500/30 bg-indigo-500/5'
                                            : 'border-slate-700/50 bg-slate-800/30'
                                    )}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="font-semibold text-white">{contact.name}</h3>
                                            <p className="text-xs text-slate-400">{contact.role}</p>
                                        </div>
                                        {contact.primary && (
                                            <Badge className="bg-indigo-500/20 text-indigo-300 border-0 text-xs">
                                                Primary
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="space-y-2">

                                        <a href={`mailto:${contact.email}`}
                                            className="flex items-center gap-3 text-sm text-slate-300 hover:text-indigo-400 transition-colors group"
                                        >
                                            <Mail className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 flex-shrink-0" />
                                            <span className="truncate">{contact.email}</span>
                                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                                        </a>
                                        {contact.phone && (

                                            <a href={`tel:${contact.phone}`}
                                                className="flex items-center gap-3 text-sm text-slate-300 hover:text-indigo-400 transition-colors"
                                            >
                                                <span className="text-slate-500 flex-shrink-0">📞</span>
                                                <span>{contact.phone}</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div >

                    {/* Footer */}
                    < div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50" >
                        <p className="text-xs text-slate-500 text-center">
                            Available Monday - Saturday, 9 AM - 7 PM IST
                        </p>
                    </ div>
                </motion.div >
            </div >
        </>
    );
};

// ================================================================
// MAIN APP LAYOUT
// ================================================================
interface AppLayoutProps {
    children: React.ReactNode;
    recentRoles?: RecentRole[];
    unreadCount?: number;
    interviewCount?: number;
}

export default function AppLayout({
    children,
    recentRoles = [],
    unreadCount = 0,
    interviewCount = 0,
}: AppLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, logout } = useAuth();

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showRecentRoles, setShowRecentRoles] = useState(true);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isSupportOpen, setIsSupportOpen] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [logoHovered, setLogoHovered] = useState(false);

    const userMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        try {
            await logout();
            router.push('/login');
        } catch (error) {
            console.error('Logout error:', error);
            router.push('/login');
        }
    };

    const firstName = user?.username?.split('@')[0] || 'there';

    // Navigation items with clear descriptions
    const navItems: NavItem[] = [
        {
            id: 'home',
            label: 'Home',
            icon: Home,
            href: '/dashboard',
            description: 'Dashboard overview and quick actions',
        },
        {
            id: 'roles',
            label: 'My Roles',
            icon: Briefcase,
            href: '/dashboard?view=roles',
            description: 'All your active hiring projects',
        },
        {
            id: 'candidates',
            label: 'Candidates',
            icon: Users,
            href: '/pipeline',
            description: 'View all candidates in your pipeline',
        },
        {
            id: 'responses',
            label: 'Responses',
            icon: MessageSquare,
            href: '/dashboard?view=responses',
            badge: unreadCount,
            description: 'Messages and replies from candidates',
        },
        {
            id: 'interviews',
            label: 'Interviews',
            icon: Calendar,
            href: '/dashboard?view=interviews',
            badge: interviewCount,
            description: 'Scheduled and completed interviews',
        },
        {
            id: 'reports',
            label: 'Reports',
            icon: FileText,
            href: '/deep-dive/list',
            description: 'Detailed candidate analysis reports',
        },
    ];

    const isNavActive = (item: NavItem) => {
        if (item.id === 'candidates' && pathname.startsWith('/pipeline')) {
            return true;
        }
        if (item.id === 'home' && pathname === '/dashboard' && !window.location.search) {
            return true;
        }
        if (item.href.includes('?view=')) {
            const viewParam = new URLSearchParams(item.href.split('?')[1]).get('view');
            const currentView = new URLSearchParams(window.location.search).get('view');
            return pathname === '/dashboard' && viewParam === currentView;
        }
        if (item.id === 'reports' && pathname.startsWith('/deep-dive')) {
            return true;
        }
        return false;
    };

    const isRoleActive = (sessionId: string) => {
        return pathname.includes(sessionId);
    };

    // Sidebar content
    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            {/* Header with Logo */}
            <div className={cn('p-4 border-b border-slate-800', isCollapsed && 'px-2')}>
                <Link
                    href="/dashboard"
                    className={cn('flex items-center', isCollapsed ? 'justify-center' : 'gap-3')}
                    onMouseEnter={() => setLogoHovered(true)}
                    onMouseLeave={() => setLogoHovered(false)}
                >
                    <DonnaMascot size="sm" isHovered={logoHovered} />
                    {!isCollapsed && (
                        <span className="font-bold text-lg text-white tracking-tight">NeuraLeap</span>
                    )}
                </Link>
            </div>

            {/* New Search Button */}
            <div className={cn('p-4', isCollapsed && 'p-2')}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            onClick={() => router.push('/search')}
                            className={cn(
                                'w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 shadow-lg shadow-indigo-500/20',
                                isCollapsed ? 'px-2' : ''
                            )}
                        >
                            <Plus className="h-4 w-4" />
                            {!isCollapsed && <span className="ml-2">New Search</span>}
                        </Button>
                    </TooltipTrigger>
                    {isCollapsed && (
                        <TooltipContent side="right" className="bg-slate-800 border-slate-700">
                            <p className="font-medium">Start a new search</p>
                        </TooltipContent>
                    )}
                </Tooltip>
            </div>

            {/* Main Navigation */}
            <nav className={cn('flex-1 overflow-y-auto px-3 space-y-1', isCollapsed && 'px-2')}>
                {!isCollapsed && (
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 flex items-center gap-2">
                        <LayoutGrid className="h-3 w-3" />
                        Menu
                    </p>
                )}
                {navItems.map((item) => (
                    <NavItemButton
                        key={item.id}
                        item={item}
                        isActive={isNavActive(item)}
                        isCollapsed={isCollapsed}
                    />
                ))}

                {/* Recent Roles Section */}
                {recentRoles.length > 0 && (
                    <div className="mt-6">
                        {!isCollapsed && (
                            <button
                                onClick={() => setShowRecentRoles(!showRecentRoles)}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <Clock className="h-3.5 w-3.5" />
                                    Recent Roles
                                </span>
                                <motion.div
                                    animate={{ rotate: showRecentRoles ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <ChevronDown className="h-4 w-4" />
                                </motion.div>
                            </button>
                        )}

                        <AnimatePresence>
                            {(showRecentRoles || isCollapsed) && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-1 overflow-hidden"
                                >
                                    {recentRoles.slice(0, isCollapsed ? 3 : 5).map((role) => (
                                        <RecentRoleItem
                                            key={role.session_id}
                                            role={role}
                                            isActive={isRoleActive(role.session_id)}
                                            isCollapsed={isCollapsed}
                                        />
                                    ))}
                                    {!isCollapsed && recentRoles.length > 5 && (
                                        <Link
                                            href="/dashboard?view=roles"
                                            className="flex items-center gap-2 px-3 py-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                                        >
                                            View all roles
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </Link>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </nav>

            {/* Bottom Section */}
            <div className={cn('p-4 border-t border-slate-800 space-y-3', isCollapsed && 'p-2')}>
                {/* Settings & Support */}
                <div className={cn('flex items-center', isCollapsed ? 'flex-col gap-2' : 'gap-4')}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Link
                                href="/settings"
                                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                            >
                                <Settings className="h-4 w-4" />
                                {!isCollapsed && 'Settings'}
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent side={isCollapsed ? 'right' : 'top'} className="bg-slate-800 border-slate-700">
                            <p className="font-medium">Settings</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => setIsSupportOpen(true)}
                                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                            >
                                <HelpCircle className="h-4 w-4" />
                                {!isCollapsed && 'Support'}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side={isCollapsed ? 'right' : 'top'} className="bg-slate-800 border-slate-700">
                            <p className="font-medium">Get help</p>
                        </TooltipContent>
                    </Tooltip>
                </div>

                {/* User Profile */}
                <div className="relative" ref={userMenuRef}>
                    <button
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className={cn(
                            'w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors',
                            isCollapsed && 'justify-center'
                        )}
                    >
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-semibold text-sm">
                                {firstName.substring(0, 2).toUpperCase()}
                            </span>
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 text-left min-w-0">
                                <p className="text-sm font-medium text-white truncate">{firstName}</p>
                                <p className="text-xs text-slate-400 truncate">{user?.email || 'User'}</p>
                            </div>
                        )}
                    </button>

                    {/* User Menu Dropdown */}
                    <AnimatePresence>
                        {isUserMenuOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className={cn(
                                    'absolute bottom-full mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden',
                                    isCollapsed ? 'left-full ml-2 w-48' : 'left-0 right-0'
                                )}
                            >
                                <div className="p-2 border-b border-slate-700">
                                    <p className="text-xs text-slate-400 px-2">Signed in as</p>
                                    <p className="text-sm font-medium text-white px-2 truncate">{user?.email}</p>
                                </div>
                                <div className="p-1.5">
                                    <Link
                                        href="/settings"
                                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                                    >
                                        <Settings className="h-4 w-4" />
                                        Settings
                                    </Link>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Sign Out
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Collapse Toggle */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="hidden lg:flex w-full items-center justify-center p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                    <motion.div
                        animate={{ rotate: isCollapsed ? 0 : 180 }}
                        transition={{ duration: 0.2 }}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </motion.div>
                </button>
            </div>

            {/* Support Popup */}
            <AnimatePresence>
                {isSupportOpen && (
                    <SupportPopup isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
                )}
            </AnimatePresence>
        </div>
    );

    return (
        <TooltipProvider>
            <div className="min-h-screen bg-slate-950 text-white flex">
                {/* Desktop Sidebar */}
                <aside
                    className={cn(
                        'hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-slate-900/80 backdrop-blur-xl border-r border-slate-800 z-40 transition-all duration-300',
                        isCollapsed ? 'w-[72px]' : 'w-64'
                    )}
                >
                    <SidebarContent />
                </aside>

                {/* Mobile Header */}
                <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 z-40 flex items-center px-4">
                    <button
                        onClick={() => setIsMobileSidebarOpen(true)}
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                    <div className="flex items-center gap-2 ml-3">
                        <DonnaMascot size="sm" />
                        <span className="font-bold text-white">NeuraLeap</span>
                    </div>
                    <div className="ml-auto">
                        <Button
                            size="sm"
                            onClick={() => router.push('/search')}
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </header>

                {/* Mobile Sidebar Overlay */}
                <AnimatePresence>
                    {isMobileSidebarOpen && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                                onClick={() => setIsMobileSidebarOpen(false)}
                            />
                            <motion.aside
                                initial={{ x: '-100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '-100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                className="lg:hidden fixed left-0 top-0 h-screen w-64 bg-slate-900 border-r border-slate-800 z-50"
                            >
                                <SidebarContent />
                            </motion.aside>
                        </>
                    )}
                </AnimatePresence>

                {/* Main Content */}
                <main
                    className={cn(
                        'flex-1 min-h-screen transition-all duration-300',
                        isCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64',
                        'pt-14 lg:pt-0'
                    )}
                >
                    {children}
                </main>
            </div>
        </TooltipProvider>
    );
}