import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, CircleCheck, History, Copy } from "lucide-react";
import AdminComplaints from "@/components/AdminComplaints";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type VerificationRequest = {
  id: string;
  user_id: string;
  organization_name: string;
  organization_address: string;
  contact_number: string;
  business_id: string;
  proof_image_url: string | null;
  status: string;
  created_at: string;
  profiles: {
    name: string;
    user_type: string;
  };
};

type TransactionData = {
  id: string;
  status: string;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  sender: { name: string };
  receiver: { name: string };
  transaction_books?: { books: { title: string; type: string; owner_id: string } }[];
  transaction_items?: { items: { name: string; type: string; owner_id: string } }[];
};

const AdminPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // States for Filtering and Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roleData, error: roleError } = await supabase
        .from("admins")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleError) throw roleError;

      if (!roleData) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      fetchVerificationRequests();
      fetchTransactions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      navigate("/dashboard");
    }
  };

  const fetchVerificationRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("welfare_verifications")
        .select(`
          *,
          profiles:user_id (
            name,
            user_type
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data as any || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select(`
          id,
          status,
          created_at,
          sender_id,
          receiver_id,
          sender:profiles!sender_id(name),
          receiver:profiles!receiver_id(name),
          transaction_books(books(title, type, owner_id)),
          transaction_items(items(name, type, owner_id))
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransactions(data as any || []);
    } catch (error: any) {
      toast({
        title: "Error fetching transactions",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleVerification = async (requestId: string, userId: string, approve: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: verificationError } = await supabase
        .from("welfare_verifications")
        .update({
          status: approve ? "approved" : "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("id", requestId);

      if (verificationError) throw verificationError;

      if (approve) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ verified: true })
          .eq("id", userId);

        if (profileError) throw profileError;
      }

      toast({
        title: "Success",
        description: `Verification ${approve ? "approved" : "rejected"} successfully`,
      });

      fetchVerificationRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Derived state for filtering transactions
  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = 
      tx.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.sender?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.receiver?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesStatus = statusFilter === "all" || tx.status.toLowerCase() === statusFilter.toLowerCase();
    
    const txTypes = [
      ...(tx.transaction_books?.map((tb) => tb.books?.type) || []),
      ...(tx.transaction_items?.map((ti) => ti.items?.type) || []),
    ].filter(Boolean).map(t => t.toLowerCase());
    
    const matchesType = typeFilter === "all" || txTypes.includes(typeFilter.toLowerCase());

    return matchesSearch && matchesStatus && matchesType;
  });

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background transition-colors">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-8">
          Admin Panel
        </h1>

        <Tabs defaultValue="verifications">
          <TabsList className="mb-8 flex-wrap h-auto bg-slate-100 dark:bg-slate-900 border dark:border-slate-800">
            <TabsTrigger value="verifications" className="flex-1 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100">Verifications</TabsTrigger>
            <TabsTrigger value="complaints" className="flex-1 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100">Complaints</TabsTrigger>
            <TabsTrigger value="transactions" className="flex-1 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100">Transactions</TabsTrigger>
          </TabsList>

          {/* ── VERIFICATIONS TAB ── */}
          <TabsContent value="verifications">
            <h2 className="text-xl md:text-2xl font-bold font-heading flex items-center gap-2 mb-6 dark:text-slate-100">
              <CircleCheck className="h-6 w-6 text-primary dark:text-primary-foreground" />
              Welfare Verifications
            </h2>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground dark:text-slate-400">Loading verification requests...</p>
              </div>
            ) : requests.length === 0 ? (
              <Card className="shadow-sm border-border dark:bg-slate-900 dark:border-slate-800">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground dark:text-slate-400">No verification requests found.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6">
                {requests.map((request) => (
                  <Card key={request.id} className="shadow-sm border-border dark:bg-slate-900 dark:border-slate-800">
                    <CardHeader className="pb-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <CardTitle className="font-heading flex items-center gap-2 flex-wrap dark:text-slate-100">
                            {request.organization_name}
                            <Badge
                              className="shadow-none border-none"
                              variant={
                                request.status === "approved"
                                  ? "default"
                                  : request.status === "rejected"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {request.status}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="dark:text-slate-400">
                            Submitted by: <span className="text-foreground dark:text-slate-200">{request.profiles?.name}</span> on{" "}
                            {new Date(request.created_at).toLocaleDateString()}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground dark:text-slate-300">Address</p>
                          <p className="text-sm text-muted-foreground dark:text-slate-400">{request.organization_address}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground dark:text-slate-300">Contact Number</p>
                          <p className="text-sm text-muted-foreground dark:text-slate-400">{request.contact_number}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground dark:text-slate-300">Business ID</p>
                          <p className="text-sm text-muted-foreground dark:text-slate-400">{request.business_id}</p>
                        </div>
                        {request.proof_image_url && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground dark:text-slate-300">Proof Document</p>
                            <a
                              href={request.proof_image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline dark:text-blue-400"
                            >
                              View Document
                            </a>
                          </div>
                        )}
                      </div>
                      {request.status === "pending" && (
                        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border dark:border-slate-800">
                          <Button
                            onClick={() => handleVerification(request.id, request.user_id, true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600 gap-2 transition-colors flex-1 sm:flex-none"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            onClick={() => handleVerification(request.id, request.user_id, false)}
                            variant="destructive"
                            className="gap-2 bg-rose-600 hover:bg-rose-700 dark:bg-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-900/80 transition-colors flex-1 sm:flex-none"
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── COMPLAINTS TAB ── */}
          <TabsContent value="complaints">
            <AdminComplaints />
          </TabsContent>

          {/* ── TRANSACTIONS TAB ── */}
          <TabsContent value="transactions">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl md:text-2xl font-bold font-heading flex items-center gap-2 dark:text-slate-100">
                <History className="h-6 w-6 text-primary dark:text-primary-foreground" />
                Transaction History
              </h2>
              
              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full md:w-auto">
                <Input
                  placeholder="Search ID or Names..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-[200px] md:w-64 bg-background dark:bg-slate-900 border-border dark:border-slate-800 dark:text-slate-200 focus-visible:ring-primary"
                />
                <div className="flex gap-3 w-full sm:w-auto">
                  <select 
                    className="flex h-10 w-full sm:w-[130px] items-center justify-between rounded-md border border-input bg-background dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800 px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="all">All Types</option>
                    <option value="donate">Donate</option>
                    <option value="exchange">Exchange</option>
                  </select>
                  <select 
                    className="flex h-10 w-full sm:w-[130px] items-center justify-between rounded-md border border-input bg-background dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800 px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="declined">Declined</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="successful">Successful</option>
                  </select>
                </div>
              </div>
            </div>

            {loadingTransactions ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground dark:text-slate-400">Loading transactions...</p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <Card className="shadow-sm dark:bg-slate-900 border-border dark:border-slate-800">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground dark:text-slate-400">No transactions match your search.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm overflow-x-auto dark:bg-slate-900 dark:border-slate-800">
                <Table className="min-w-[850px] w-full">
                  <TableHeader className="bg-muted/50 dark:bg-slate-800/50">
                    <TableRow className="dark:border-slate-800">
                      <TableHead className="w-[110px]">ID</TableHead>
                      <TableHead className="w-[90px]">TYPE</TableHead>
                      <TableHead className="w-[130px]">SENDER</TableHead>
                      <TableHead className="w-[130px]">RECIPIENT</TableHead>
                      <TableHead className="min-w-[240px]">EXCHANGE DETAILS</TableHead>
                      <TableHead className="w-[110px]">DATE & TIME</TableHead>
                      <TableHead className="w-[100px]">STATUS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((tx) => {
                      
                      const exchangeDetails: React.ReactNode[] = [];

                      tx.transaction_books?.forEach((tb, i) => {
                        if (!tb.books) return;
                        const isFromSender = tb.books.owner_id === tx.sender_id;
                        const recipientName = isFromSender ? tx.receiver?.name : tx.sender?.name;
                        
                        exchangeDetails.push(
                          <div key={`b-${i}`} className="flex items-center gap-2 mb-1.5 w-full">
                            <span className="text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 px-2.5 py-0.5 rounded-full border border-transparent dark:border-blue-900/50 truncate flex-1" title={tb.books.title}>
                              📚 {tb.books.title}
                            </span>
                            <span className="text-muted-foreground dark:text-slate-500 text-[10px] font-bold shrink-0">=&gt;</span>
                            <span className="text-[11px] font-semibold text-foreground dark:text-slate-200 truncate shrink-0 max-w-[80px]" title={recipientName}>
                              {recipientName?.split(" ")[0] || "System"}
                            </span>
                          </div>
                        );
                      });

                      tx.transaction_items?.forEach((ti, i) => {
                        if (!ti.items) return;
                        const isFromSender = ti.items.owner_id === tx.sender_id;
                        const recipientName = isFromSender ? tx.receiver?.name : tx.sender?.name;

                        exchangeDetails.push(
                          <div key={`i-${i}`} className="flex items-center gap-2 mb-1.5 w-full">
                            <span className="text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-0.5 rounded-full border border-transparent dark:border-emerald-900/50 truncate flex-1" title={ti.items.name}>
                              📦 {ti.items.name}
                            </span>
                            <span className="text-muted-foreground dark:text-slate-500 text-[10px] font-bold shrink-0">=&gt;</span>
                            <span className="text-[11px] font-semibold text-foreground dark:text-slate-200 truncate shrink-0 max-w-[80px]" title={recipientName}>
                              {recipientName?.split(" ")[0] || "System"}
                            </span>
                          </div>
                        );
                      });

                      return (
                        <TableRow key={tx.id} className="hover:bg-muted/30 dark:hover:bg-slate-800/40 transition-colors dark:border-slate-800">
                          {/* Top-aligned ID (Shortened) */}
                          <TableCell className="align-top pt-4 font-mono text-xs text-muted-foreground dark:text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate w-[65px]" title={tx.id}> {`${tx.id.split('-')[0]}...`}</span>
                              <Copy 
                                className="h-3.5 w-3.5 shrink-0 cursor-pointer hover:text-primary dark:hover:text-primary-foreground transition-colors" 
                                onClick={() => {
                                  navigator.clipboard.writeText(tx.id);
                                  toast({ title: "ID Copied" });
                                }} 
                              />
                            </div>
                          </TableCell>
                          
                          {/* Top-aligned TYPE Badges */}
                          <TableCell className="align-top pt-4 text-left">
                            <div className="flex flex-wrap gap-1">
                              {(() => {
                                const allTypes = [
                                  ...(tx.transaction_books?.map((tb) => tb.books?.type) || []),
                                  ...(tx.transaction_items?.map((ti) => ti.items?.type) || []),
                                ].filter(Boolean);
                                const uniqueTypes = [...new Set(allTypes)];
                                return uniqueTypes.map((type, i) => (
                                  <Badge
                                    key={`${type}-${i}`}
                                    variant="outline"
                                    className={`capitalize border-none px-2 py-0.5 text-[10px] font-medium shadow-none ${
                                      type.toLowerCase() === 'donate'
                                        ? 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                                        : 'bg-indigo-100/80 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-400'
                                    }`}
                                  >
                                    {type}
                                  </Badge>
                                ));
                              })()}
                            </div>
                          </TableCell>
                          
                          {/* Top-aligned SENDER */}
                          <TableCell className="align-top pt-4 font-semibold text-sm text-foreground dark:text-slate-200">
                            <div className="truncate max-w-[120px]" title={tx.sender?.name}>
                              {tx.sender?.name || "System"}
                            </div>
                          </TableCell>
                          
                          {/* Top-aligned RECIPIENT */}
                          <TableCell className="align-top pt-4 font-semibold text-sm text-foreground dark:text-slate-200">
                            <div className="truncate max-w-[120px]" title={tx.receiver?.name}>
                              {tx.receiver?.name || "System"}
                            </div>
                          </TableCell>
                          
                          {/* Top-aligned EXCHANGE DETAILS */}
                          <TableCell className="align-top pt-3">
                            <div className="flex flex-col w-full">
                              {exchangeDetails.length > 0 ? (
                                exchangeDetails
                              ) : (
                                <span className="text-xs italic text-muted-foreground opacity-70">No items</span>
                              )}
                            </div>
                          </TableCell>
                          
                          {/* Top-aligned Date AND Time */}
                          <TableCell className="align-top pt-4 text-xs text-muted-foreground dark:text-slate-400">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-foreground dark:text-slate-300 whitespace-nowrap">
                                {new Date(tx.created_at).toLocaleDateString('en-GB', {
                                  day: '2-digit', month: 'short', year: 'numeric'
                                })}
                              </span>
                              <span className="whitespace-nowrap">
                                {new Date(tx.created_at).toLocaleTimeString('en-US', {
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </TableCell>
                          
                          {/* Top-aligned STATUS */}
                          <TableCell className="align-top pt-3.5">
                            <Badge
                              variant="outline"
                              className={`capitalize px-2.5 py-1 rounded-full text-[10px] font-bold border shadow-none whitespace-nowrap
                              ${tx.status.toLowerCase() === 'successful' || tx.status.toLowerCase() === 'accepted'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50'
                                  : tx.status.toLowerCase() === 'pending'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50'
                                    : tx.status.toLowerCase() === 'initializing'
                                      ? 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                      : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50'}
                              `}
                            >
                              {tx.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPanel;