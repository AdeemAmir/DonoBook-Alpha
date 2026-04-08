import React, { useState } from 'react';
import { ShieldAlert, X, MapPin, Phone, Info } from 'lucide-react';

const SafetyBanner = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-100 p-4 transition-all animate-in fade-in slide-in-from-top-2 rounded-lg">
      <div className="max-w-4xl mx-auto flex items-start gap-4">
        <div className="bg-amber-100 p-2 rounded-full shrink-0">
          <ShieldAlert className="size-5 text-amber-700" />
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-amber-900 text-sm">DonoBook Safety Disclaimer</h3>
            <button
              onClick={() => setIsVisible(false)}
              className="text-amber-500 hover:text-amber-700 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex gap-2">
              <MapPin className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-tight">
                <strong>No Home Addresses:</strong> Meet only in public places (Libraries, Malls, or Cafes).
              </p>
            </div>

            <div className="flex gap-2">
              <Phone className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-tight">
                <strong>Phone Numbers:</strong> Share at your own risk. Use the chat for safer record-keeping.
              </p>
            </div>

            <div className="flex gap-2">
              <Info className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-tight">
                <strong>Suspicious Behavior?</strong> If any user asks for sensitive information (passwords, OTPs, personal data), please report them to the admin immediately.
              </p>
            </div>

            <div className="flex gap-2">
              <Info className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-tight">
                <strong>Money Requests Warning:</strong> If any user asks you to send money or payment outside the platform, please report them to the admin immediately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Small Card for the Homepage
const HomeSafetyCard = () => (
  <section className="py-12 bg-white">
    <div className="max-w-5xl mx-auto px-6">
      <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-4">Safe & Secure Exchanges</h2>
            <p className="text-slate-400 mb-6">
              Your safety is our priority. We've built DonoBook to foster a community of trust through verified NGOs and safe exchange practices.
            </p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <div className="size-2 bg-blue-500 rounded-full" />
                <span>Meet in well-lit public locations</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="size-2 bg-blue-500 rounded-full" />
                <span>Keep your home address private</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="size-2 bg-blue-500 rounded-full" />
                <span>Communicate through our encrypted chat</span>
              </li>
            </ul>
          </div>
          <div className="flex justify-center">
            <div className="size-48 bg-blue-600/20 rounded-full flex items-center justify-center border border-blue-500/30">
              <ShieldAlert className="size-24 text-blue-500 opacity-80" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default SafetyBanner