import { FunctionKeys } from "@/components/FunctionKeys";
import { getCurrentUser } from "@/lib/session";
import { getUserStore } from "@/lib/store-access";

// Shared by every signed-in screen. (Each page still enforces its own authentication and store access.)
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const membership = user ? await getUserStore(user.id) : null;
  return (
    <>
      {membership?.store.settings?.functionKeys ? <FunctionKeys /> : null}
      {children}
    </>
  );
}
