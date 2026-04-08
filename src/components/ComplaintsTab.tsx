import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Clock, CheckCircle2 } from "lucide-react";

const ComplaintsTab = () => {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [myComplaints, setMyComplaints] = useState<any[]>([]);

  useEffect(() => {
    fetchMyComplaints();
  }, []);

  const fetchMyComplaints = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("complaints")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setMyComplaints(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please login first");

      const { error } = await supabase.from("complaints").insert({
        user_id: user.id,
        subject,
        description,
        status: "open",
      });

      if (error) throw error;

      toast({
        title: "Complaint Submitted",
        description: "An admin will review your message shortly.",
      });

      setSubject("");
      setDescription("");
      fetchMyComplaints();
    } catch (error: any) {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">

      {/* 1. New Complaint Form */}
      <Card className="shadow-card border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-primary" />
            Report an Issue
          </CardTitle>
          <CardDescription>
            Tell us about any problems or feedback you have.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>
              <Input
                placeholder="e.g., Problem with book upload"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="max-w-full"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Please provide details..."
                className="min-h-[120px] max-w-full"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={loading}
                size="sm"
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {loading ? "Submitting..." : "Submit Complaint"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 2. Complaints History */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold font-heading">
          My Support Tickets
        </h3>
        {myComplaints.length === 0 ? (
          <Card className="border-dashed border-muted-foreground/30">
            <CardContent className="py-8 text-center space-y-2">
              <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                You haven't submitted any complaints yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {myComplaints.map((c) => (
              <Card key={c.id} className="bg-card/50">
                <CardContent className="pt-5">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-foreground">
                      {c.subject}
                    </h4>
                    <Badge
                      variant={c.status === "open" ? "secondary" : "default"}
                      className="text-xs"
                    >
                      {c.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {c.description}
                  </p>
                  {c.admin_response ? (
                    <div className="bg-primary/5 p-3 rounded-lg border border-primary/10">
                      <p className="text-xs font-semibold text-primary flex items-center gap-1 mb-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Admin Response
                      </p>
                      <p className="text-sm italic text-foreground">
                        "{c.admin_response}"
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Awaiting admin review...
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ComplaintsTab;