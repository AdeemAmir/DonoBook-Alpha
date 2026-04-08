import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, AlertCircle, CircleCheck } from "lucide-react";
import AdminComplaints from "@/components/AdminComplaints";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const AdminPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
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

      // Check if user has admin role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
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

  const handleVerification = async (requestId: string, userId: string, approve: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update verification status
      const { error: verificationError } = await supabase
        .from("welfare_verifications")
        .update({
          status: approve ? "approved" : "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("id", requestId);

      if (verificationError) throw verificationError;

      // If approved, update profile verified status
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

  if (!isAdmin) {
    return null;
  }

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
          </TabsList>

          <TabsContent value="verifications">
            <h2 className="text-2xl font-bold font-heading flex items-center gap-2 mb-6">
              <CircleCheck className="h-6 w-6 text-primary" />
              Welfare Verifications
            </h2>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  Loading verification requests...
                </p>
              </div>
            ) : requests.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No verification requests found.
                  </p>
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
                            Submitted by: {request.profiles.name} on{" "}
                            {new Date(request.created_at).toLocaleDateString()}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">
                            Address
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {request.organization_address}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">
                            Contact Number
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {request.contact_number}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">
                            Business ID
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {request.business_id}
                          </p>
                        </div>

                        {request.proof_image_url && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              Proof Document
                            </p>

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
                            onClick={() =>
                              handleVerification(request.id, request.user_id, true)
                            }
                            className="bg-primary hover:bg-primary-hover gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Approve
                          </Button>

                          <Button
                            onClick={() =>
                              handleVerification(request.id, request.user_id, false)
                            }
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
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPanel;
