import type { Metadata } from "next";

import { AuthScreen } from "@/components/AuthScreen";

export const metadata: Metadata = { title: "Create account · SplitBill" };

export default function RegisterPage() {
  return <AuthScreen mode="register" />;
}
