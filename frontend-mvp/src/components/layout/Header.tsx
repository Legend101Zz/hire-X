'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { User, LogOut, Search, Bookmark, History, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { useState } from 'react';

export default function Header() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const [isHovering, setIsHovering] = useState(false);

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    const navItems = [
        { name: 'Search', href: '/', icon: Search },
        { name: 'Saved', href: '/shortlist', icon: Bookmark },
        { name: 'History', href: '/history', icon: History },
    ];

    return (
        <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 z-50 shadow-sm"
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/">
                        <motion.div
                            className="flex items-center space-x-2 cursor-pointer"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">N</span>
                            </div>
                            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                NeuralLeap Hire
                            </span>
                        </motion.div>
                    </Link>

                    {/* Navigation */}
                    <div className="flex items-center space-x-1">
                        {navItems.map((item, index) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;

                            return (
                                <motion.div
                                    key={item.name}
                                    initial={{ opacity: 0, y: -20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                >
                                    <Link href={item.href}>
                                        <motion.div
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            className={`relative px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${isActive
                                                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md'
                                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                                }`}
                                        >
                                            <Icon className="w-4 h-4" />
                                            <span className="hidden sm:inline">{item.name}</span>

                                            {isActive && (
                                                <motion.div
                                                    layoutId="activeTab"
                                                    className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg -z-10"
                                                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                                />
                                            )}
                                        </motion.div>
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* User Menu */}
                    <div className="flex items-center space-x-3">
                        {/* User Info */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            whileHover={{ scale: 1.03 }}
                            className="flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg px-3 py-2 border border-blue-100"
                            onMouseEnter={() => setIsHovering(true)}
                            onMouseLeave={() => setIsHovering(false)}
                        >
                            <motion.div
                                animate={{
                                    scale: isHovering ? [1, 1.1, 1] : 1,
                                }}
                                transition={{ duration: 0.5 }}
                                className="relative"
                            >
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                    <User className="w-4 h-4 text-white" />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                            </motion.div>

                            <div className="hidden md:block">
                                <p className="text-sm font-semibold text-gray-800">
                                    {user?.username || 'User'}
                                </p>
                                <p className="text-xs text-gray-500">Recruiter</p>
                            </div>
                        </motion.div>

                        {/* Settings */}
                        <motion.button
                            whileHover={{ scale: 1.1, rotate: 90 }}
                            whileTap={{ scale: 0.9 }}
                            className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                        >
                            <Settings className="w-4 h-4 text-gray-600" />
                        </motion.button>

                        {/* Logout */}
                        <motion.button
                            onClick={handleLogout}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="w-10 h-10 bg-gradient-to-br from-red-50 to-red-100 rounded-lg flex items-center justify-center hover:from-red-100 hover:to-red-200 transition-all group"
                            title="Logout"
                        >
                            <LogOut className="w-4 h-4 text-red-600" />
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* Animated gradient line */}
            <motion.div
                className="h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            />
        </motion.div>
    );
}