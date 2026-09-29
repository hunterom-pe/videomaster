import { redirect } from "next/navigation";
import { Screen } from "@/components/Screen";
import { StoreForm } from "@/components/StoreForm";
import { EMPTY_STORE } from "@/lib/form-defaults";
import { requireUser, getUserStore } from "@/lib/store-access";

export const metadata = { title: "STORE CONFIGURATION" };

export default async function SetupPage() {
  const user = await requireUser();
  if (await getUserStore(user.id)) redirect("/menu");
  return (
    <Screen title="STORE CONFIGURATION" userEmail={user.email} status="FIRST-RUN SETUP">
      <div className="vm-center">
        <h1>VIDEOMASTER STORE CONFIGURATION</h1>
        <div className="vm-cyan">COMPLETE THE FORM BELOW TO OPEN YOUR STORE</div>
      </div>
      <hr className="vm-rule" />
      <StoreForm mode="setup" initial={EMPTY_STORE} />
    </Screen>
  );
}
