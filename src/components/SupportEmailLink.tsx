import React from "react";

type SupportEmailLinkProps = {
  children?: React.ReactNode;
  className?: string;
  subject?: string;
};

const SUPPORT_EMAIL = "vantalumstudio@gmail.com";

function buildSupportEmailComposeUrl(subject?: string) {
  const normalizedSubject = subject?.trim();
  return normalizedSubject
    ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(normalizedSubject)}`
    : `mailto:${SUPPORT_EMAIL}`;
}

export default function SupportEmailLink({
  children,
  className,
  subject,
}: SupportEmailLinkProps) {
  return (
    <a
      href={buildSupportEmailComposeUrl(subject)}
      className={className}
      title={`Email ${SUPPORT_EMAIL}`}
    >
      {children || SUPPORT_EMAIL}
    </a>
  );
}

export { SUPPORT_EMAIL, buildSupportEmailComposeUrl };
