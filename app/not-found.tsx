import { ConsoleNotice, ConsoleNoticeLink } from "@/components/ui/ConsoleNotice";
import { DocumentTitle } from "@/components/ui/DocumentTitle";

export default function NotFound() {
  return (
    <>
      <DocumentTitle title="Signal not found | Dynamica Command" />
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
    </>
  );
}
