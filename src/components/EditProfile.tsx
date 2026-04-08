import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const KARACHI_AREAS = [
  "Gulshan-e-Iqbal", "DHA / Clifton", "North Nazimabad", "Gulistan-e-Jauhar",
  "Saddar", "Malir", "Korangi", "Bahria Town", "PECHS", "Federal B Area", "Other"
];

export const EditProfile = ({ profile, onSave }: { profile: any, onSave: () => void }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: profile?.name || "",
    address: profile?.address || "",
    contact_number: profile?.contact_number || "",
    organization_name: profile?.organization_name || "",
  });

  const isWelfare = profile.user_type === 'welfare';

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: formData.name,
          address: formData.address,
          contact_number: formData.contact_number,
          organization_name: isWelfare ? formData.organization_name : null,
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast({ title: "Profile Updated", description: "Your changes have been saved." });
      onSave();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header section outside card */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          {/* Avatar icon */}
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isWelfare
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a4 4 0 00-5.356-3.712M9 20H4v-2a4 4 0 015.356-3.712M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              }
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {isWelfare ? 'Organization Profile' : 'Personal Profile'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Update your {isWelfare ? 'organization details' : 'personal information'} below
            </p>
          </div>
        </div>
        {/* Subtle divider */}
        <div className="mt-4 h-px bg-border/60" />
      </div>

      <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <form onSubmit={handleUpdate} className="space-y-5">

            {/* Name Field */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                {isWelfare ? 'Admin Name' : 'Full Name'}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <Input
                  className="pl-9 h-10 rounded-lg border-border/70 focus:border-primary transition-colors"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={isWelfare ? 'Enter admin name' : 'Enter your full name'}
                />
              </div>
            </div>

            {/* Welfare Only: Organization Name */}
            {isWelfare && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Organization Name</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </span>
                  <Input
                    className="pl-9 h-10 rounded-lg border-border/70 focus:border-primary transition-colors"
                    value={formData.organization_name}
                    onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                    placeholder="Enter organization name"
                  />
                </div>
              </div>
            )}

            {/* Address Field */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                {profile.user_type === 'user' ? 'Area in Karachi' : 'Office Address'}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                {profile.user_type === 'user' ? (
                  <select
                    value={KARACHI_AREAS.includes(formData.address) ? formData.address : "Other"}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full pl-9 pr-4 h-10 border border-border/70 rounded-lg bg-background text-sm focus:outline-none focus:border-primary transition-colors appearance-none"
                  >
                    {KARACHI_AREAS.map(area => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    className="pl-9 h-10 rounded-lg border-border/70 focus:border-primary transition-colors"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Enter office address"
                  />
                )}
                {/* Dropdown chevron for select */}
                {profile.user_type === 'user' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                )}
              </div>
            </div>

            {/* Contact Number */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Contact Number</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </span>
                <Input
                  type="tel"
                  className="pl-9 h-10 rounded-lg border-border/70 focus:border-primary transition-colors"
                  value={formData.contact_number}
                  onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                  placeholder="+92 300 0000000"
                />
              </div>
            </div>

            {/* Divider before submit */}
            <div className="pt-1 pb-0.5">
              <div className="h-px bg-border/50" />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-11 rounded-lg font-medium text-sm tracking-wide transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving changes…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Update Profile
                </span>
              )}
            </Button>

          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditProfile