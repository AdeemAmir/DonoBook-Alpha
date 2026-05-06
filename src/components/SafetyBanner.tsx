import React, { useState } from 'react';
import { ShieldAlert, X, MapPin, Phone, Info } from 'lucide-react';

const SafetyBanner = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/50 p-4 transition-all animate-in fade-in slide-in-from-top-2 rounded-lg">
      <div className="max-w-4xl mx-auto flex items-start gap-4">
        <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-full shrink-0">
          <ShieldAlert className="size-5 text-amber-700 dark:text-amber-500" />
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-amber-900 dark:text-amber-400 text-sm">DonoBook Safety Disclaimer</h3>
            <button
              onClick={() => setIsVisible(false)}
              className="text-amber-500 hover:text-amber-700 dark:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex gap-2">
              <MapPin className="size-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200/80 leading-tight">
                <strong className="dark:text-amber-100">No Home Addresses:</strong> Meet only in public places (Libraries, Malls, or Cafes).
              </p>
            </div>

            <div className="flex gap-2">
              <Phone className="size-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200/80 leading-tight">
                <strong className="dark:text-amber-100">Phone Numbers:</strong> Share at your own risk. Use the chat for safer record-keeping.
              </p>
            </div>

            <div className="flex gap-2">
              <Info className="size-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200/80 leading-tight">
                <strong className="dark:text-amber-100">Suspicious Behavior?</strong> If any user asks for sensitive information (passwords, OTPs, personal data), please report them to the admin immediately.
              </p>
            </div>

            <div className="flex gap-2">
              <Info className="size-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200/80 leading-tight">
                <strong className="dark:text-amber-100">Money Requests Warning:</strong> If any user asks you to send money or payment outside the platform, please report them to the admin immediately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Small Card for the Homepage
export const HomeSafetyCard = () => (
  // Updated standard dark mode classes for homepage consistency
  <section className="py-12 bg-white dark:bg-background">
    <div className="max-w-5xl mx-auto px-6">
      <div className="bg-slate-900 dark:bg-slate-800/80 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl border border-transparent dark:border-slate-700">
        <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-4 dark:text-slate-100">Safe & Secure Exchanges</h2>
            <p className="text-slate-400 dark:text-slate-300 mb-6">
              Your safety is our priority. We've built DonoBook to foster a community of trust through verified NGOs and safe exchange practices.
            </p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <div className="size-2 bg-blue-500 dark:bg-blue-400 rounded-full" />
                <span className="dark:text-slate-200">Meet in well-lit public locations</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="size-2 bg-blue-500 dark:bg-blue-400 rounded-full" />
                <span className="dark:text-slate-200">Keep your home address private</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="size-2 bg-blue-500 dark:bg-blue-400 rounded-full" />
                <span className="dark:text-slate-200">Communicate through our encrypted chat</span>
              </li>
            </ul>
          </div>
          <div className="flex justify-center">
            <div className="size-48 bg-blue-600/20 dark:bg-blue-900/30 rounded-full flex items-center justify-center border border-blue-500/30 dark:border-blue-700/30">
              <ShieldAlert className="size-24 text-blue-500 dark:text-blue-400 opacity-80" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default SafetyBanner;