import type { Metadata } from "next";

import { PolicyDecoderApp } from "@/components/policy-decoder-app";

export const metadata: Metadata = {
  title: "Policy Lens Demo",
  description:
    "Live demo view for Policy Lens with a preloaded auto policy and quote comparison story.",
};

export default function DemoPage() {
  return <PolicyDecoderApp mode="demo" />;
}
