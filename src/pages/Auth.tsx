import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { BookOpen } from "lucide-react";
import Navbar from "@/components/Navbar";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(searchParams.get("mode") === "signup");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    userType: "user" as "user" | "welfare",
    orgName: "",
    address: "",
    contactNumber: "",
    businessId: "",
  });
  const [proofImage, setProofImage] = useState<File | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (event === 'SIGNED_IN' && session) {
        navigate("/dashboard");
      }
    });

    // Listen for login/signup events
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session && !isSignup) {
          navigate("/dashboard");
        }
      }
    );
    return () => {
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    setIsSignup(searchParams.get("mode") === "signup");
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              name: formData.name,
            },
          },
        });

        if (error) throw error;

        if (data.user) {
          // Create profile
          const profileName = formData.userType === "welfare" ? formData.orgName : formData.name;

          const { error: profileError } = await supabase
            .from("profiles")
            .insert([
              {
                id: data.user.id,
                name: profileName,
                user_type: formData.userType,
                organization_name: formData.userType === "welfare" ? formData.orgName : null,
                address: formData.address,
                contact_number: formData.userType === "welfare" ? formData.contactNumber : null,
                business_id: formData.userType === "welfare" ? formData.businessId : null,
              },
            ]);

          if (profileError) {
            // If the error is a "duplicate key" error (code 23505 in Postgres)
            if (profileError.code === '23505') {
              throw new Error("This Organization Registration ID is already registered. Please contact your administrator.");
            }
            throw profileError;
          }

          // If welfare, create verification request
          if (formData.userType === "welfare") {
            let proofImageUrl = null;

            // Upload proof image if provided
            if (proofImage.size > 5 * 1024 * 1024) {
              throw new Error("File must be smaller than 5MB");
            }

            if (proofImage) {
              const fileExt = proofImage.name.split('.').pop();
              const fileName = `${data.user.id}/${Date.now()}.${fileExt}`;

              const { error: uploadError } = await supabase.storage
                .from('verification-proofs')
                .upload(fileName, proofImage);

              if (uploadError) throw uploadError;

              const { data: { publicUrl } } = supabase.storage
                .from('verification-proofs')
                .getPublicUrl(fileName);

              proofImageUrl = publicUrl;
            }

            const { error: verificationError } = await supabase
              .from("welfare_verifications")
              .insert([
                {
                  user_id: data.user.id,
                  organization_name: formData.orgName,
                  organization_address: formData.address,
                  contact_number: formData.contactNumber,
                  business_id: formData.businessId,
                  proof_image_url: proofImageUrl,
                },
              ]);

            if (verificationError) throw verificationError;
          }

          toast({
            title: "Success!",
            description: formData.userType === "welfare"
              ? "Account created! Your verification request is pending approval."
              : "Account created successfully!",
          });
          navigate("/dashboard");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        toast({
          title: "Welcome back!",
          description: "Logged in successfully",
        });
        navigate("/dashboard");
      }
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

  const KARACHI_AREAS = [
    "Gulshan-e-Iqbal", "DHA / Clifton", "North Nazimabad", "Gulistan-e-Jauhar",
    "Saddar", "Malir", "Korangi", "Bahria Town", "PECHS", "Federal B Area",
    "Nazimabad", "Liyari", "Surjani Town", "Orangi", "Baldia", "Other"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light via-background to-secondary/20">
      <Navbar />
      <div className="container mx-auto px-4 py-16 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-card">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <BookOpen className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl font-heading">
              {isSignup ? "Create an account" : "Welcome back"}
            </CardTitle>
            <CardDescription>
              {isSignup
                ? "Enter your information to create your account"
                : "Enter your credentials to access your account"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignup && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="userType">Account Type</Label>
                    <select
                      id="userType"
                      value={formData.userType}
                      onChange={(e) => setFormData({ ...formData, userType: e.target.value as "user" | "welfare" })}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      required
                    >
                      <option value="user">Student/User</option>
                      <option value="welfare">Welfare Organization (NGO)</option>
                    </select>
                  </div>
                  {formData.userType === "user" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          type="text"
                          placeholder="John Doe"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="area">Select Area in Karachi</Label>
                        <select
                          id="area"
                          value={formData.address === "" ? "" : KARACHI_AREAS.includes(formData.address) ? formData.address : "Other"}
                          onChange={(e) => {
                            const val = e.target.value;
                            // If selecting a preset area, update address immediately
                            // If "Other", we leave it for the manual input to fill
                            setFormData({ ...formData, address: val === "Other" ? "" : val });
                          }}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background"
                          required
                        >
                          <option value="" disabled>Choose your location</option>
                          {KARACHI_AREAS.map((area) => (
                            <option key={area} value={area}>{area}</option>
                          ))}
                        </select>
                      </div>

                      {/* MANUAL INPUT - Only shows if 'Other' is selected or a custom area is being typed */}
                      {(formData.address === "" || !KARACHI_AREAS.includes(formData.address)) && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                          <Label htmlFor="manualArea">Please specify your area</Label>
                          <Input
                            id="manualArea"
                            type="text"
                            placeholder="Enter your area name"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            required
                          />
                        </div>
                      )}
                    </>
                  )}
                  {formData.userType === "welfare" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="orgName">Organization Name</Label>
                        <Input
                          id="orgName"
                          type="text"
                          placeholder="Charity Foundation"
                          value={formData.orgName}
                          onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address">NGO Address</Label>
                        <Input
                          id="address"
                          type="text"
                          placeholder="123 Main St, City"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contactNumber">Contact Number</Label>
                        <Input
                          id="contactNumber"
                          type="tel"
                          placeholder="+1234567890"
                          value={formData.contactNumber}
                          onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="businessId">Business ID / Registration Number</Label>
                        <Input
                          id="businessId"
                          type="text"
                          placeholder="BUS123456"
                          value={formData.businessId}
                          onChange={(e) => setFormData({ ...formData, businessId: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="proofImage">NGO Proof Document</Label>
                        <Input
                          id="proofImage"
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => setProofImage(e.target.files?.[0] || null)}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Upload business license or registration certificate
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={formData.userType === "welfare" ? "donation@example.com" : "you@example.com"}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary-hover"
                disabled={loading}
              >
                {loading ? "Loading..." : isSignup ? "Sign Up" : "Login"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              <button
                type="button"
                onClick={() => setIsSignup(!isSignup)}
                className="text-primary hover:underline"
              >
                {isSignup
                  ? "Already have an account? Login"
                  : "Don't have an account? Sign up"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
