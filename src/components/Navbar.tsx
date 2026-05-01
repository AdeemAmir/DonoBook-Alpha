import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BookOpen, User, LogOut, MessageSquare, Bot, Search, Home, Menu, X, Sun, Moon, LayoutDashboard, Settings } from "lucide-react";
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

const Navbar = ({ userProfile: propUserProfile }: { userProfile?: any }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<any>(propUserProfile || null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isMobile = useIsMobile();
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminRole(session.user.id);
        subscribeToUnreadMessages(session.user.id);
        if (!propUserProfile) fetchUserProfile(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminRole(session.user.id);
        subscribeToUnreadMessages(session.user.id);
        if (!propUserProfile) fetchUserProfile(session.user.id);
      } else {
        setIsAdmin(false);
        setUnreadMessages(0);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
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
    }
  };

  const getInitials = (name?: string) => {
    return name ? name.charAt(0).toUpperCase() : <User className="h-4 w-4" />;
  };

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.4, 0, 1] }}
      className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border shadow-soft"
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-smooth">
            <img src="/logo_1.png" alt="Book" className="h-12 w-12" />
            <span className="text-2xl font-heading font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              DonoBook
            </span>
          </Link>

          {/* Menu icon for mobile */}
          {isMobile && (
            <div className="lg:hidden">
              <Button variant="ghost" onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-0">
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          )}

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-4">
            {user ? (
              <>
                <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
                  <Home className="h-4 w-4" />
                  Home
                </Button>
                <Button variant="ghost" onClick={() => navigate("/dashboard")} className="gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
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
                  <Button variant="ghost" onClick={() => navigate("/admin")} className="gap-2 text-primary">
                    <User className="h-4 w-4" />
                    Admin Panel
                  </Button>
                )}
                
                <div className="flex items-center gap-2 px-2 border-l border-r border-border">
                  <Switch
                    checked={isDark}
                    onCheckedChange={toggleTheme}
                  />
                  {isDark ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </div>

                {/* Profile Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full border border-border">
                      <Avatar>
                        {/* Add User Image URL here when available: <AvatarImage src={profile?.image_url} /> */}
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(profile?.name)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{profile?.name || "User"}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/dashboard?tab=settings")} className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Edit Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:bg-destructive/10">
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
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </div>
                <Button variant="ghost" onClick={() => navigate("/auth")}>
                  Login
                </Button>
                <Button onClick={() => navigate("/auth?mode=signup")} className="bg-primary hover:bg-primary-hover">
                  Sign Up
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobile && (
        <div className={`${isMenuOpen ? "block" : "hidden"} lg:hidden bg-background p-4 border-t shadow-lg`}>
          {user ? (
            <>
              {/* Mobile Profile Header */}
              <div className="flex items-center gap-3 px-2 py-4 mb-2 border-b">
                <Avatar>
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(profile?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-medium">{profile?.name || "User"}</span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
              <Button variant="ghost" onClick={() => { navigate("/dashboard"); setIsMenuOpen(false); }} className="w-full text-left justify-start mb-1">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <Button variant="ghost" onClick={() => { navigate("/conversations"); setIsMenuOpen(false); }} className="w-full text-left justify-start mb-1 relative">
                <MessageSquare className="h-4 w-4 mr-2" />
                Messages
                {unreadMessages > 0 && (
                  <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadMessages}
                  </span>
                )}
              </Button>
              <Button variant="ghost" onClick={() => { navigate("/search-messages"); setIsMenuOpen(false); }} className="w-full text-left justify-start mb-1">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
              <Button variant="ghost" onClick={() => { navigate("/assistant"); setIsMenuOpen(false); }} className="w-full text-left justify-start mb-1">
                <Bot className="h-4 w-4 mr-2" />
                Assistant
              </Button>
              <Button variant="ghost" onClick={() => { navigate("/dashboard?tab=settings"); setIsMenuOpen(false); }} className="w-full text-left justify-start mb-1">
                <Settings className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
              {isAdmin && (
                <Button variant="ghost" onClick={() => { navigate("/admin"); setIsMenuOpen(false); }} className="w-full text-left justify-start mb-1 text-primary">
                  <User className="h-4 w-4 mr-2" />
                  Admin Panel
                </Button>
              )}
              <Button variant="ghost" onClick={toggleTheme} className="w-full text-left justify-start mb-1 border-t rounded-none pt-4 mt-2">
                {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                {isDark ? "Light Mode" : "Dark Mode"}
              </Button>
              <Button variant="ghost" onClick={handleLogout} className="w-full text-left justify-start text-destructive hover:text-destructive hover:bg-destructive/10">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={toggleTheme} className="w-full text-left justify-start mb-2">
                {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                {isDark ? "Light Mode" : "Dark Mode"}
              </Button>
              <Button variant="ghost" onClick={() => { navigate("/auth"); setIsMenuOpen(false); }} className="w-full text-left justify-start mb-2">
                Login
              </Button>
              <Button onClick={() => { navigate("/auth?mode=signup"); setIsMenuOpen(false); }} className="w-full text-left justify-start bg-primary hover:bg-primary-hover">
                Sign Up
              </Button>
            </>
          )}
        </div>
      )}
    </motion.nav>
  );
};

export default Navbar;