import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Reply, CheckCircle } from "lucide-react";

const AdminComplaints = () => {
    const { toast } = useToast();
    const [complaints, setComplaints] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [responses, setResponses] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        fetchComplaints();
    }, []);

    const fetchComplaints = async () => {
        const { data, error } = await supabase
            .from("complaints")
            .select(`
        *,
        profiles:user_id (name, user_type)
      `)
            .order("created_at", { ascending: false });

        if (!error) setComplaints(data || []);
        setLoading(false);
    };

    const handleReplyChange = (id: string, text: string) => {
        setResponses((prev) => ({ ...prev, [id]: text }));
    };

    const submitResponse = async (complaintId: string) => {
        const responseText = responses[complaintId];
        if (!responseText?.trim()) return;

        try {
            const { error } = await supabase
                .from("complaints")
                .update({
                    admin_response: responseText,
                    status: "resolved",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", complaintId);

            if (error) throw error;

            toast({ title: "Response Sent", description: "The user has been notified." });
            fetchComplaints(); // Refresh list
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    return (
        <div className="space-y-5 max-w-3xl">
            <h2 className="text-2xl font-bold font-heading flex items-center gap-2">
                <MessageSquare className="h-6 w-6 text-primary" />
                User Complaints
            </h2>

            {loading ? (
                <p className="text-sm text-muted-foreground">Loading complaints...</p>
            ) : complaints.length === 0 ? (
                <p className="text-muted-foreground text-sm">No complaints to show.</p>
            ) : (
                complaints.map((c) => (
                    <Card
                        key={c.id}
                        className={`shadow-sm ${c.status === "resolved"
                                ? "opacity-70"
                                : "border-l-4 border-l-amber-500"
                            }`}
                    >
                        <CardHeader className="pb-2 pt-4 px-4">
                            <div className="flex justify-between items-start gap-3">
                                <div>
                                    <CardTitle className="text-base">{c.subject}</CardTitle>

                                    <CardDescription className="text-xs">
                                        From: {c.profiles?.name} ({c.profiles?.user_type}) •{" "}
                                        {new Date(c.created_at).toLocaleDateString()}
                                    </CardDescription>
                                </div>

                                <Badge
                                    variant={c.status === "open" ? "secondary" : "default"}
                                    className="text-xs"
                                >
                                    {c.status}
                                </Badge>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-3 px-4 pb-4">
                            <p className="text-sm bg-muted p-2 rounded-md italic">
                                "{c.description}"
                            </p>

                            {c.status === "open" ? (
                                <div className="space-y-2">
                                    <Textarea
                                        placeholder="Write your response..."
                                        className="min-h-[80px]"
                                        value={responses[c.id] || ""}
                                        onChange={(e) =>
                                            handleReplyChange(c.id, e.target.value)
                                        }
                                    />

                                    <Button
                                        onClick={() => submitResponse(c.id)}
                                        size="sm"
                                        className="gap-2"
                                    >
                                        <Reply className="h-4 w-4" />
                                        Resolve
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-sm border-t pt-2">
                                    <p className="font-semibold text-primary flex items-center gap-1 text-xs">
                                        <CheckCircle className="h-3 w-3" />
                                        Admin Response
                                    </p>

                                    <p className="text-muted-foreground text-sm">
                                        "{c.admin_response}"
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))
            )}
        </div>
    );
};

export default AdminComplaints;