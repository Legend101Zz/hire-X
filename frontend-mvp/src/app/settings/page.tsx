'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    User,
    Mail,
    Lock,
    Bell,
    Globe,
    Palette,
    Shield,
    Save,
    Check,
    AlertCircle,
    Eye,
    EyeOff,
    Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import AppLayout from '@/components/layout/AppLayout';
import { GridBackground } from '@/components/ui/GridBackground';

// ================================================================
// SETTINGS SECTION COMPONENT
// ================================================================
const SettingsSection = ({
    icon: Icon,
    title,
    description,
    children,
}: {
    icon: React.ElementType;
    title: string;
    description: string;
    children: React.ReactNode;
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50 backdrop-blur-md"
        >
            <div className="flex items-start gap-4 mb-6">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    <p className="text-sm text-slate-400 mt-0.5">{description}</p>
                </div>
            </div>
            {children}
        </motion.div>
    );
};

// ================================================================
// INPUT FIELD COMPONENT
// ================================================================
const InputField = ({
    label,
    type = 'text',
    value,
    onChange,
    placeholder,
    disabled = false,
    icon: Icon,
}: {
    label: string;
    type?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    icon?: React.ElementType;
}) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">{label}</label>
            <div className="relative">
                {Icon && (
                    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                )}
                <input
                    type={isPassword ? (showPassword ? 'text' : 'password') : type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={cn(
                        'w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500',
                        'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        Icon && 'pl-10',
                        isPassword && 'pr-10'
                    )}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                )}
            </div>
        </div>
    );
};

// ================================================================
// TOGGLE SWITCH COMPONENT
// ================================================================
const ToggleSwitch = ({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) => {
    return (
        <div className="flex items-center justify-between py-3">
            <div>
                <p className="text-sm font-medium text-white">{label}</p>
                {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={cn(
                    'relative w-11 h-6 rounded-full transition-colors',
                    checked ? 'bg-indigo-500' : 'bg-slate-600'
                )}
            >
                <motion.div
                    animate={{ x: checked ? 20 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md"
                />
            </button>
        </div>
    );
};

// ================================================================
// MAIN SETTINGS PAGE
// ================================================================
export default function SettingsPage() {
    const router = useRouter();
    const { user, token } = useAuth();

    // Profile state
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Notification preferences
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [responseAlerts, setResponseAlerts] = useState(true);
    const [interviewReminders, setInterviewReminders] = useState(true);
    const [weeklyDigest, setWeeklyDigest] = useState(false);

    // UI state
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load user data
    useEffect(() => {
        if (user) {
            setFullName(user.full_name || user.username || '');
            setEmail(user.email || '');
        }
    }, [user]);

    const handleSaveProfile = async () => {
        setIsSaving(true);
        setError(null);
        setSaveSuccess(false);

        try {
            // TODO: Implement API call to update profile
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulated delay
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            setError('Failed to save changes. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            // TODO: Implement API call to change password
            await new Promise((resolve) => setTimeout(resolve, 1000));
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            setError('Failed to change password. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <AppLayout>
            <GridBackground>
                <div className="max-w-3xl mx-auto px-6 py-8">
                    {/* Header */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
                        <p className="text-lg text-slate-400">Manage your account and preferences</p>
                    </motion.div>

                    {/* Success/Error Messages */}
                    {saveSuccess && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3"
                        >
                            <Check className="h-5 w-5 text-emerald-400" />
                            <p className="text-sm text-emerald-300">Changes saved successfully!</p>
                        </motion.div>
                    )}

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3"
                        >
                            <AlertCircle className="h-5 w-5 text-rose-400" />
                            <p className="text-sm text-rose-300">{error}</p>
                        </motion.div>
                    )}

                    <div className="space-y-6">
                        {/* Profile Section */}
                        <SettingsSection
                            icon={User}
                            title="Profile"
                            description="Your personal information"
                        >
                            <div className="space-y-4">
                                <InputField
                                    label="Full Name"
                                    value={fullName}
                                    onChange={setFullName}
                                    placeholder="Enter your full name"
                                    icon={User}
                                />
                                <InputField
                                    label="Email Address"
                                    type="email"
                                    value={email}
                                    onChange={setEmail}
                                    placeholder="Enter your email"
                                    icon={Mail}
                                    disabled
                                />
                                <p className="text-xs text-slate-500">
                                    Email cannot be changed. Contact support if needed.
                                </p>

                                <div className="pt-4">
                                    <Button
                                        onClick={handleSaveProfile}
                                        disabled={isSaving}
                                        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 mr-2" />
                                                Save Changes
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </SettingsSection>

                        {/* Security Section */}
                        <SettingsSection
                            icon={Shield}
                            title="Security"
                            description="Manage your password and security settings"
                        >
                            <div className="space-y-4">
                                <InputField
                                    label="Current Password"
                                    type="password"
                                    value={currentPassword}
                                    onChange={setCurrentPassword}
                                    placeholder="Enter current password"
                                    icon={Lock}
                                />
                                <InputField
                                    label="New Password"
                                    type="password"
                                    value={newPassword}
                                    onChange={setNewPassword}
                                    placeholder="Enter new password"
                                    icon={Lock}
                                />
                                <InputField
                                    label="Confirm New Password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={setConfirmPassword}
                                    placeholder="Confirm new password"
                                    icon={Lock}
                                />

                                <div className="pt-4">
                                    <Button
                                        onClick={handleChangePassword}
                                        disabled={isSaving || !currentPassword || !newPassword}
                                        variant="outline"
                                        className="border-slate-600 hover:bg-slate-800"
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Updating...
                                            </>
                                        ) : (
                                            'Update Password'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </SettingsSection>

                        {/* Notifications Section */}
                        <SettingsSection
                            icon={Bell}
                            title="Notifications"
                            description="Control how we contact you"
                        >
                            <div className="divide-y divide-slate-700/50">
                                <ToggleSwitch
                                    label="Email Notifications"
                                    description="Receive updates via email"
                                    checked={emailNotifications}
                                    onChange={setEmailNotifications}
                                />
                                <ToggleSwitch
                                    label="Candidate Response Alerts"
                                    description="Get notified when candidates reply"
                                    checked={responseAlerts}
                                    onChange={setResponseAlerts}
                                />
                                <ToggleSwitch
                                    label="Interview Reminders"
                                    description="Get reminded before scheduled interviews"
                                    checked={interviewReminders}
                                    onChange={setInterviewReminders}
                                />
                                <ToggleSwitch
                                    label="Weekly Digest"
                                    description="Receive a weekly summary of your hiring activity"
                                    checked={weeklyDigest}
                                    onChange={setWeeklyDigest}
                                />
                            </div>
                        </SettingsSection>

                        {/* Account Info */}
                        <SettingsSection
                            icon={Globe}
                            title="Account"
                            description="Your account details"
                        >
                            <div className="space-y-4">
                                <div className="flex items-center justify-between py-3">
                                    <div>
                                        <p className="text-sm font-medium text-white">Account Status</p>
                                        <p className="text-xs text-slate-400">Your current plan</p>
                                    </div>
                                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                        Active
                                    </Badge>
                                </div>

                                <div className="flex items-center justify-between py-3">
                                    <div>
                                        <p className="text-sm font-medium text-white">Member Since</p>
                                        <p className="text-xs text-slate-400">When you joined</p>
                                    </div>
                                    <p className="text-sm text-slate-300">
                                        {user?.created_at
                                            ? new Date(user.created_at).toLocaleDateString('en-IN', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                            })
                                            : 'Unknown'}
                                    </p>
                                </div>

                                <Separator className="bg-slate-700/50" />

                                <div className="pt-2">
                                    <p className="text-xs text-slate-500">
                                        Need to delete your account?{' '}
                                        <button className="text-rose-400 hover:text-rose-300 transition-colors">
                                            Contact Support
                                        </button>
                                    </p>
                                </div>
                            </div>
                        </SettingsSection>
                    </div>
                </div>
            </GridBackground>
        </AppLayout>
    );
}