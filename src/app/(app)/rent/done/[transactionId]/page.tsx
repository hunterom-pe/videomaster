import { redirect } from "next/navigation";

// Legacy completion URL: the receipt screen replaced it.
export default async function LegacyDonePage({ params }: { params: Promise<{ transactionId: string }> }) {
  const { transactionId } = await params;
  redirect(`/receipt/${transactionId}?new=1`);
}
