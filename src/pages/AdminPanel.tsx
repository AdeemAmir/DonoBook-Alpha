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
  transaction_books?: { books: { title: string; type: string } }[];
  transaction_items?: { items: { name: string; type: string } }[];
};

const AdminPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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
          transaction_books(books(title, type)),
          transaction_items(items(name, type))
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

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-heading font-bold text-foreground mb-8">
          Admin Panel
        </h1>

        <Tabs defaultValue="verifications">
          <TabsList className="mb-8">
            <TabsTrigger value="verifications">Verifications</TabsTrigger>
            <TabsTrigger value="complaints">Complaints</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="verifications">
            <h2 className="text-2xl font-bold font-heading flex items-center gap-2 mb-6">
              <CircleCheck className="h-6 w-6 text-primary" />
              Welfare Verifications
            </h2>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading verification requests...</p>
              </div>
            ) : requests.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No verification requests found.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6">
                {requests.map((request) => (
                  <Card key={request.id} className="shadow-card">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <CardTitle className="font-heading flex items-center gap-2 flex-wrap">
                            {request.organization_name}
                            <Badge
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
                          <CardDescription>
                            Submitted by: {request.profiles?.name} on{" "}
                            {new Date(request.created_at).toLocaleDateString()}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">Address</p>
                          <p className="text-sm text-muted-foreground">{request.organization_address}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">Contact Number</p>
                          <p className="text-sm text-muted-foreground">{request.contact_number}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">Business ID</p>
                          <p className="text-sm text-muted-foreground">{request.business_id}</p>
                        </div>
                        {request.proof_image_url && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">Proof Document</p>
                            <a
                              href={request.proof_image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline"
                            >
                              View Document
                            </a>
                          </div>
                        )}
                      </div>
                      {request.status === "pending" && (
                        <div className="flex items-center gap-3 pt-2 border-t border-border">
                          <Button
                            onClick={() => handleVerification(request.id, request.user_id, true)}
                            className="bg-primary hover:bg-primary-hover gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            onClick={() => handleVerification(request.id, request.user_id, false)}
                            variant="destructive"
                            className="gap-2"
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

          <TabsContent value="complaints">
            <AdminComplaints />
          </TabsContent>

          <TabsContent value="transactions">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold font-heading flex items-center gap-2">
                <History className="h-6 w-6 text-primary" />
                Transaction History
              </h2>
            </div>
            {loadingTransactions ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading transactions...</p>
              </div>
            ) : transactions.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No transactions found.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[150px]">TRANSACTION ID</TableHead>
                      <TableHead className="w-[150px]">TRANSACTION TYPE</TableHead>
                      <TableHead>SENDER</TableHead>
                      <TableHead>RECIPIENT</TableHead>
                      <TableHead>PRODUCTS</TableHead>
                      <TableHead>DATE</TableHead>
                      <TableHead>STATUS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-mono text-xs text-muted-foreground flex items-center gap-2">
                          {tx.id.slice(0, 8)}...
                          <Copy className="h-3 w-3 cursor-pointer hover:text-primary" onClick={() => {
                            navigator.clipboard.writeText(tx.id);
                            toast({ title: "ID Copied" });
                          }} />
                        </TableCell>
                        <TableCell className="text-left">
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
                                className={`capitalize border-none px-2 py-0.5 text-[10px] font-medium mr-1 ${
                                  type.toLowerCase() === 'donate'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-blue-50 text-blue-700'
                                }`}
                              >
                                {type}
                              </Badge>
                            ));
                          })()}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {tx.sender?.name || "System"}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {tx.receiver?.name || "System"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {tx.transaction_books?.map((tb, i) => (
                              <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full w-fit">
                                Book: {tb.books?.title}
                              </span>
                            ))}
                            {tx.transaction_items?.map((ti, i) => (
                              <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full w-fit">
                                Item: {ti.items?.name}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`capitalize px-3 py-1 rounded-full text-[11px] font-medium border-none
                            ${tx.status.toLowerCase() === 'successful' || tx.status.toLowerCase() === 'accepted'
                                ? 'bg-green-100 text-green-700'
                                : tx.status.toLowerCase() === 'pending'
                                  ? 'bg-yellow-100 text-yellow-900'
                                  : tx.status.toLowerCase() === 'initializing'
                                    ? 'bg-slate-100 text-slate-900'
                                    : 'bg-red-100 text-red-700'}
                          `}
                          >
                            {tx.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
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