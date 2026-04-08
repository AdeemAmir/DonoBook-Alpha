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

const Navbar = ({ userProfile }: { userProfile: any }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
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
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminRole(session.user.id);
        subscribeToUnreadMessages(session.user.id);
      } else {
        setIsAdmin(false);
        setUnreadMessages(0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
    // Fetch initial unread count
    fetchUnreadCount(userId);

    // Subscribe to real-time changes
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
          // Refetch unread count on any message change
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
                <Button variant="outline" onClick={handleLogout} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
                
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
        <div className={`${isMenuOpen ? "block" : "hidden"} lg:hidden bg-background p-4`}>
          {user ? (
            <>
              <Button variant="ghost" onClick={() => navigate("/dashboard")} className="w-full text-left mb-2">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <Button variant="ghost" onClick={() => navigate("/conversations")} className="w-full text-left mb-2">
                <MessageSquare className="h-4 w-4 mr-2" />
                Messages
              </Button>
              <Button variant="ghost" onClick={() => navigate("/search-messages")} className="w-full text-left mb-2">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
              <Button variant="ghost" onClick={() => navigate("/assistant")} className="w-full text-left mb-2">
                <Bot className="h-4 w-4 mr-2" />
                Assistant
              </Button>
              {isAdmin && (
                <Button variant="ghost" onClick={() => navigate("/admin")} className="w-full text-left mb-2 text-primary">
                  <User className="h-4 w-4 mr-2" />
                  Admin Panel
                </Button>
              )}
              <Button variant="outline" onClick={handleLogout} className="w-full text-left mb-2">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
              <Button variant="ghost" onClick={toggleTheme} className="w-full text-left mb-2">
                {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                {isDark ? "Light Mode" : "Dark Mode"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={toggleTheme} className="w-full text-left mb-2">
                {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                {isDark ? "Light Mode" : "Dark Mode"}
              </Button>
              <Button variant="ghost" onClick={() => navigate("/auth")} className="w-full text-left mb-2">
                Login
              </Button>
              <Button onClick={() => navigate("/auth?mode=signup")} className="w-full text-left bg-primary hover:bg-primary-hover">
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
