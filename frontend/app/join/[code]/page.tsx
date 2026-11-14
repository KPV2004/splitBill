import type { Metadata } from "next";
import { Suspense } from "react";

import { JoinFallback, JoinScreen } from "@/components/JoinScreen";

export const metadata: Metadata = { title: "Join a group · SplitBill" };

// The invite code is only known per request, so reading it waits inside Suspense.
export default function JoinPage({ params }: PageProps<"/join/[code]">) {
  return (
    <Suspense fallback={<JoinFallback />}>
      <JoinScreen params={params} />
    </Suspense>
  );
}
