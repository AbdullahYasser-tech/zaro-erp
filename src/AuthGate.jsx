import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import App from "./App.jsx";
import { Loader2, LogOut } from "lucide-react";

const BURGUNDY = "#6E1E24";

export default function AuthGate() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [mode, setMode] = useState("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setProfileError("");
      return;
    }
    setProfileLoading(true);
    setProfileError("");
    supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) setProfileError("تعذر تحميل صلاحيات الحساب. سجّل الخروج ثم حاول مرة أخرى.");
        setProfile(error ? null : data);
        setProfileLoading(false);
      });
  }, [session]);

  const submitAuth = async (event) => {
    event.preventDefault();
    setAuthMessage("");
    setAuthLoading(true);
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName.trim() } } });
    setAuthLoading(false);
    if (result.error) {
      setAuthMessage(result.error.message === "Invalid login credentials" ? "البريد الإلكتروني أو كلمة المرور غير صحيحة." : result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setAuthMessage("تم إنشاء الحساب. راجع بريدك الإلكتروني لتأكيده، ثم سجّل الدخول. سيحتاج الحساب أيضًا إلى موافقة الأونر.");
      setMode("signin");
    }
  };

  const signInGoogle = () => supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  const signOut = () => supabase.auth.signOut();

  if (session === undefined) {
    return <Loading />;
  }

  if (!session) {
    const isSignUp = mode === "signup";
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6" dir="rtl" style={{ fontFamily: "Arial, sans-serif" }}>
        <form onSubmit={submitAuth} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: BURGUNDY }}>ZARO</div>
            <h1 className="text-lg font-bold" style={{ color: BURGUNDY }}>{isSignUp ? "إنشاء حساب جديد" : "تسجيل الدخول"}</h1>
            <p className="mt-1 text-xs text-gray-500">ZARO Business System</p>
          </div>
          {isSignUp && <label className="block text-sm text-gray-700">الاسم الكامل<input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>}
          <label className="block text-sm text-gray-700">البريد الإلكتروني<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="name@example.com" dir="ltr" /></label>
          <label className="block text-sm text-gray-700">كلمة المرور<input required type="password" minLength="8" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="8 أحرف على الأقل" dir="ltr" /></label>
          {authMessage && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{authMessage}</p>}
          <button disabled={authLoading} className="w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" style={{ background: BURGUNDY }}>{authLoading ? "جارٍ التنفيذ..." : isSignUp ? "إنشاء الحساب" : "دخول"}</button>
          <button type="button" onClick={() => { setMode(isSignUp ? "signin" : "signup"); setAuthMessage(""); }} className="w-full text-xs font-semibold" style={{ color: BURGUNDY }}>{isSignUp ? "لديك حساب بالفعل؟ سجّل الدخول" : "ليس لديك حساب؟ أنشئ حسابًا"}</button>
          <div className="relative py-1 text-center text-xs text-gray-400 before:absolute before:inset-x-0 before:top-1/2 before:border-t"><span className="relative bg-white px-2">أو</span></div>
          <button type="button" onClick={signInGoogle} className="w-full rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50">دخول بحساب جوجل</button>
          {isSignUp && <p className="text-center text-xs text-gray-500">بعد إنشاء الحساب، يوافق الأونر عليه ويحدد صلاحياته.</p>}
        </form>
      </main>
    );
  }

  if (profileLoading) return <Loading />;
  if (profileError) {
    return <Message title="تعذر الدخول" text={profileError} onClick={signOut} action="تسجيل الخروج" />;
  }
  if (profile?.role === "pending") {
    return <Message title="في انتظار الموافقة" text={`حسابك (${profile.email}) تم إنشاؤه بنجاح، ويحتاج إلى موافقة صاحب النظام وتحديد الصلاحية قبل الدخول.`} onClick={signOut} action="تسجيل الخروج" />;
  }
  return profile ? <App role={profile.role} email={profile.email} onSignOut={signOut} /> : <Loading />;
}

function Loading() {
  return <div className="flex h-screen items-center justify-center gap-2 text-gray-500" dir="rtl"><Loader2 className="animate-spin" size={18} /> جارٍ التحميل...</div>;
}

function Message({ title, text, onClick, action }) {
  return <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center" dir="rtl" style={{ fontFamily: "Arial, sans-serif" }}><h1 className="text-lg font-bold" style={{ color: BURGUNDY }}>{title}</h1><p className="max-w-sm text-sm text-gray-500">{text}</p><button onClick={onClick} className="mt-2 flex items-center gap-1 text-xs text-gray-500"><LogOut size={13} /> {action}</button></main>;
}
