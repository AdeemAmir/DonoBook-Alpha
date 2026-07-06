import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BookOpen, User, LogOut, MessageSquare, Bot, Search, Home, Menu, X, Sun, Moon, LayoutDashboard, Settings, PackageCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/hooks/useTheme";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Navbar = ({ userProfile: propUserProfile }: { userProfile?: any }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<any>(propUserProfile || null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { isDark, toggleTheme } = useTheme();

  const [pendingHandoverCount, setPendingHandoverCount] = useState(0);
  const [showHandoverModal, setShowHandoverModal] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminRole(session.user.id);
        subscribeToUnreadMessages(session.user.id);
        fetchPendingHandoverCount(session.user.id);
        if (!propUserProfile) fetchUserProfile(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminRole(session.user.id);
        subscribeToUnreadMessages(session.user.id);
        fetchPendingHandoverCount(session.user.id);
        if (!propUserProfile) fetchUserProfile(session.user.id);
      } else {
        setIsAdmin(false);
        setUnreadMessages(0);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [propUserProfile]);

  useEffect(() => {
    if (propUserProfile) {
      setProfile(propUserProfile);
    }
  }, [propUserProfile]);

  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (!error && data) {
      setProfile(data);
    }
  };

  const checkAdminRole = async (userId: string) => {
    const { data } = await supabase
      .from("admins")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    setIsAdmin(!!data);
  };

  const subscribeToUnreadMessages = (userId: string) => {
    fetchUnreadCount(userId);

    const channel = supabase
      .channel(`user_messages-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_messages',
          filter: `receiver_id=eq.${userId}`
        },
        () => {
          fetchUnreadCount(userId);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  const fetchUnreadCount = async (userId: string) => {
    const { count, error } = await supabase
      .from("user_messages")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", userId)
      .eq("read", false);

    if (!error) {
      setUnreadMessages(count || 0);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Logged out successfully",
      });
      navigate("/");
      window.location.reload();
    }
  };

  const getInitials = (name?: string) => {
    return name ? name.charAt(0).toUpperCase() : <User className="h-4 w-4" />;
  };

  const fetchPendingHandoverCount = async (userId: string) => {
    // Check both books and items where user is the receiver
    const { count, error } = await supabase
      .from("transactions")
      .select('id', { count: "exact", head: true }) // head: true makes it faster if you only need the count
      .eq("receiver_id", userId)
      .eq("status", "accepted");

    const totalPending = count || 0;
    setPendingHandoverCount(totalPending);

    // Popup Logic: Check if there are pending items AND if not snoozed
    if (totalPending > 0) {
      const snoozeDate = localStorage.getItem('snooze_handover_popup');
      const isSnoozed = snoozeDate && new Date(snoozeDate) > new Date();

      if (!isSnoozed) {
        setShowHandoverModal(true);
      }
    }
  };

  // Handle Snooze
  const handleSnooze = () => {
    const snoozeUntil = new Date();
    snoozeUntil.setDate(snoozeUntil.getDate() + 7); // 7 days from now
    localStorage.setItem('snooze_handover_popup', snoozeUntil.toISOString());
    setShowHandoverModal(false);
  };

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.4, 0, 1] }}
      className="sticky top-0 z-50 bg-background/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-border dark:border-slate-800 shadow-sm transition-colors"
    >
      <div className="container mx-auto px-4 py-4 relative">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-smooth">
            {/* <div className="dark:bg-white rounded-full dark:p-1 flex items-center justify-center transition-colors">
              <img src="/logo_1.png" alt="Book" className="h-10 w-10 object-contain" />
            </div> */}
            <img src="/logo_1.png" alt="Book" className="h-12 w-12" />
            <span className="text-2xl font-heading font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              DonoBook
            </span>
          </Link>

          {/* Menu icon for mobile & tablet (Shows below lg breakpoint) */}
          <div className="lg:hidden flex items-center">
            <Button variant="ghost" onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2">
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-4">
            {user ? (
              <>
                <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
                  <Home className="h-4 w-4" />
                  Home
                </Button>
                <Button variant="ghost" onClick={() => navigate("/dashboard")} className="gap-2 relative">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                  {pendingHandoverCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center border-2 border-background">
                      {pendingHandoverCount}
                    </span>
                  )}
                </Button>
                <Button variant="ghost" onClick={() => navigate("/conversations")} className="gap-2 relative">
                  <MessageSquare className="h-4 w-4" />
                  Messages
                  {unreadMessages > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {unreadMessages}
                    </span>
                  )}
                </Button>
                <Button variant="ghost" onClick={() => navigate("/assistant")} className="gap-2">
                  <Bot className="h-4 w-4" />
                  Assistant
                </Button>
                {isAdmin && (
                  <Button variant="ghost" onClick={() => navigate("/admin")} className="gap-2 text-primary dark:text-primary-foreground">
                    <User className="h-4 w-4" />
                    Admin Panel
                  </Button>
                )}

                <div className="flex items-center gap-2 px-2 border-l border-r border-border dark:border-slate-700">
                  <Switch
                    checked={isDark}
                    onCheckedChange={toggleTheme}
                  />
                  {isDark ? (
                    <Sun className="h-4 w-4 text-slate-300" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </div>

                {/* Profile Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full border border-border dark:border-slate-700">
                      <Avatar>
                        {/* Add User Image URL here when available: <AvatarImage src={profile?.image_url} /> */}
                        <AvatarFallback className="bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground">
                          {getInitials(profile?.name)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 dark:bg-slate-900 dark:border-slate-800" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none dark:text-slate-200">{profile?.name || "User"}</p>
                        <p className="text-xs leading-none text-muted-foreground dark:text-slate-400">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="dark:bg-slate-800" />
                    <DropdownMenuItem onClick={() => navigate("/dashboard?tab=settings")} className="cursor-pointer dark:hover:bg-slate-800 dark:text-slate-200">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Edit Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="dark:bg-slate-800" />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:bg-destructive/10 dark:text-rose-400 dark:focus:bg-rose-950/50">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={isDark}
                    onCheckedChange={toggleTheme}
                  />
                  {isDark ? (
                    <Sun className="h-4 w-4 text-slate-300" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </div>
                <Button variant="ghost" onClick={() => navigate("/auth")} className="dark:text-slate-200 dark:hover:bg-slate-800">
                  Login
                </Button>
                <Button onClick={() => navigate("/auth?mode=signup")} className="bg-primary hover:bg-primary-hover text-white">
                  Sign Up
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Navigation Menu */}
      <div className={`${isMenuOpen ? "block" : "hidden"} lg:hidden bg-background dark:bg-slate-900 p-4 border-t border-border dark:border-slate-800 shadow-lg absolute top-full left-0 w-full transition-colors`}>
        {user ? (
          <>
            {/* Mobile Profile Header */}
            <div className="flex items-center gap-3 px-2 py-4 mb-2 border-b border-border dark:border-slate-800">
              <Avatar>
                <AvatarFallback className="bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground">
                  {getInitials(profile?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium dark:text-slate-200">{profile?.name || "User"}</span>
                <span className="text-xs text-muted-foreground dark:text-slate-400">{user.email}</span>
              </div>
            </div>
            <Button variant="ghost" onClick={() => { navigate("/dashboard"); setIsMenuOpen(false); }} className="w-full text-left justify-start mb-1 dark:text-slate-200 dark:hover:bg-slate-800">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Button variant="ghost" onClick={() => { navigate("/conversations"); setIsMenuOpen(false); }} className="w-full text-left justify-start mb-1 relative dark:text-slate-200 dark:hover:bg-slate-800">
              <MessageSquare className="h-4 w-4 mr-2" />
              Messages
              {unreadMessages > 0 && (
                <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadMessages}
                </span>
              )}
            </Button>
            <Button variant="ghost" onClick={() => { navigate("/search-messages"); setIsMenuOpen(false); }} className="w-full text-left justify-start mb-1 dark:text-slate-200 dark:hover:bg-slate-800">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button variant="ghost" onClick={() => { navigate("/assistant"); setIsMenuOpen(false); }} className="w-full text-left justify-start mb-1 dark:text-slate-200 dark:hover:bg-slate-800">
              <Bot className="h-4 w-4 mr-2" />
              Assistant
            </Button>
            <Button variant="ghost" onClick={() => { navigate("/dashboard?tab=settings"); setIsMenuOpen(false); }} className="w-full text-left justify-start mb-1 dark:text-slate-200 dark:hover:bg-slate-800">
              <Settings className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
            {isAdmin && (
              <Button variant="ghost" onClick={() => { navigate("/admin"); setIsMenuOpen(false); }} className="w-full text-left justify-start mb-1 text-primary dark:text-primary-foreground dark:hover:bg-slate-800">
                <User className="h-4 w-4 mr-2" />
                Admin Panel
              </Button>
            )}
            <Button variant="ghost" onClick={toggleTheme} className="w-full text-left justify-start mb-1 border-t border-border dark:border-slate-800 rounded-none pt-4 mt-2 dark:text-slate-200 dark:hover:bg-slate-800">
              {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
              {isDark ? "Light Mode" : "Dark Mode"}
            </Button>
            <Button variant="ghost" onClick={handleLogout} className="w-full text-left justify-start text-destructive hover:text-destructive hover:bg-destructive/10 dark:text-rose-400 dark:hover:bg-rose-950/50">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={toggleTheme} className="w-full text-left justify-start mb-2 dark:text-slate-200 dark:hover:bg-slate-800">
              {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
              {isDark ? "Light Mode" : "Dark Mode"}
            </Button>
            <Button variant="ghost" onClick={() => { navigate("/auth"); setIsMenuOpen(false); }} className="w-full text-left justify-start mb-2 dark:text-slate-200 dark:hover:bg-slate-800">
              Login
            </Button>
            <Button onClick={() => { navigate("/auth?mode=signup"); setIsMenuOpen(false); }} className="w-full text-left justify-start bg-primary hover:bg-primary-hover text-white">
              Sign Up
            </Button>
          </>
        )}
      </div>
      {/* Handover Reminder Popup */}
      <AlertDialog open={showHandoverModal} onOpenChange={setShowHandoverModal}>
        <AlertDialogContent className="dark:bg-slate-900 border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-500">
              <PackageCheck className="h-5 w-5" />
              Pending Confirmations
            </AlertDialogTitle>
            <AlertDialogDescription className="dark:text-slate-400">
              You have <strong>{pendingHandoverCount}</strong> item(s) that you've received but haven't confirmed yet.
              Please confirm them to help donors complete their listings!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSnooze}
              className="text-muted-foreground hover:text-white hogver:bg-muted/50 dark:text-state-400 dark:hover:bg-slate-800"
            >
              Snooze for 7 days
            </Button>
            <div className="flex gap-2">
              <AlertDialogCancel onClick={() => setShowHandoverModal(false)}>
                Later
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-primary hover:bg-primary/90"
                onClick={() => {
                  setShowHandoverModal(false);
                  navigate("/dashboard?tab=history");
                }}
              >
                Go to Dashboard
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.nav>
  );
};

export default Navbar;