import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import App from "./App.jsx";
import { Loader2, LogOut } from "lucide-react";

const BURGUNDY = "#6E1E24";

export default function AuthGate() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        setProfile(error ? null : data);
        setProfileLoading(false);
      });
  }, [session]);

  const signInGoogle = () => {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = () => supabase.auth.signOut();

  if (session === undefined) {
    return (
      <div className="flex items-center justify-center h-screen gap-2 text-gray-500" dir="rtl">
        <Loader2 className="animate-spin" size={18} /> جاري التحميل...
      </div>
    );
  }

  if (!session) {
    return (
      <div
        className="flex flex-col items-center justify-center h-screen gap-4 px-6 text-center"
        dir="rtl"
        style={{ fontFamily: "Arial, sans-serif" }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-white text-sm"
          style={{ background: BURGUNDY }}
        >
          ZARO
        </div>
        <div className="text-lg font-bold" style={{ color: BURGUNDY }}>
          ZARO Business System
        </div>
        <button
          onClick={signInGoogle}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border font-semibold text-sm hover:bg-gray-50"
        >
          تسجيل الدخول بحساب جوجل
        </button>
      </div>
    );
  }

  if (profileLoading || profile === null) {
    return (
      <div className="flex items-center justify-center h-screen gap-2 text-gray-500" dir="rtl">
        <Loader2 className="animate-spin" size={18} /> جاري التحميل...
      </div>
    );
  }

  if (profile.role === "pending") {
    return (
      <div
        className="flex flex-col items-center justify-center h-screen gap-3 text-center px-6"
        dir="rtl"
        style={{ fontFamily: "Arial, sans-serif" }}
      >
        <div className="text-lg font-bold" style={{ color: BURGUNDY }}>
          في انتظار الموافقة
        </div>
        <div className="text-sm text-gray-500 max-w-sm">
          حسابك ({profile.email}) اتسجل بنجاح، بس محتاج موافقة صاحب النظام قبل ما تقدر تدخل. تواصل معاه لتفعيل حسابك.
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1 text-xs text-gray-400 mt-2 hover:text-gray-600"
        >
          <LogOut size={13} /> تسجيل خروج
        </button>
      </div>
    );
  }

  return <App role={profile.role} email={profile.email} onSignOut={signOut} />;
}
