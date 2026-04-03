import type { Metadata } from "next";

import { PolicyDecoderApp } from "@/components/policy-decoder-app";

export const metadata: Metadata = {
  title: "Policy Lens Demo",
  description:
    "Try Policy Lens with a preloaded auto policy and live quote comparison controls.",
};

export default function DemoPage() {
  return <PolicyDecoderApp mode="demo" />;
}

