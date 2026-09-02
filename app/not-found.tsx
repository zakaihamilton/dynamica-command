import type { Metadata } from "next";
import { ConsoleNotice, ConsoleNoticeLink } from "@/components/ui/ConsoleNotice";

export const metadata: Metadata = {
  title: {
    absolute: "Signal not found | Dynamica Command",
  },
};

export default function NotFound() {
  return (
    <ConsoleNotice
      eyebrow="This frequency is dark"
      title="Signal not found"
      detail="That route is not on the command net."
      testId="not-found"
    >
      <ConsoleNoticeLink href="/" muted testId="home-link">
        Return to menu
      </ConsoleNoticeLink>
    </ConsoleNotice>
  );
}
