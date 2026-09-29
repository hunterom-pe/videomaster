import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getUserStore } from "@/lib/store-access";

// Entry point: route by account state.
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect((await getUserStore(user.id)) ? "/menu" : "/setup");
}
