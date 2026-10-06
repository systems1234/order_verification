"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const { status } = useSession();
  const router = useRouter();
  const error = useSearchParams().get("error");

  useEffect(() => {
    if (status === "authenticated") router.replace("/orders");
  }, [status, router]);

  return (
    <div className="login-wrap">
      <div className="login-inner">
        <div className="login-brand">
          <span className="name">order verification</span>
        </div>
        <div className="login-tag">Every order, checked against the record.</div>
        <div className="login-card">
          <h1>Sign in</h1>
          <p>Use your gempundit.com Google account. Access is limited to registered team members.</p>
          {error && (
            <div className="login-error">
              {error === "AccessDenied"
                ? "This account isn't registered for Order Verification. Ask your admin to add you."
                : "Something went wrong signing you in — please try again."}
            </div>
          )}
          <button type="button" className="sso-btn" onClick={() => signIn("google", { callbackUrl: "/orders" })}>
            <span className="sso-g">G</span>
            Continue with Google
          </button>
        </div>
        <div className="login-foot">
          Trouble signing in? Contact your workspace admin.
          <br />
          Protected by Google SSO · gempundit.com
        </div>
      </div>
    </div>
  );
}
