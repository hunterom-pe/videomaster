import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { Screen } from "@/components/Screen";
import { getCurrentUser } from "@/lib/session";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="vm-login">
      <Screen title="NEW OPERATOR ACCOUNT" status="CREATE YOUR ACCOUNT">
        <div className="vm-center">
          <h1 className="vm-brand">VIDEOMASTER</h1>
          <div className="vm-cyan">VIDEO RENTAL MANAGEMENT SYSTEM</div>
          <div className="vm-dim">VERSION 1.0</div>
        </div>
        <hr className="vm-rule" />
        <AuthForm mode="signup" />
      </Screen>
    </div>
  );
}
