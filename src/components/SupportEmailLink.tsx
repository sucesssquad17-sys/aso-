import React from "react";

type SupportEmailLinkProps = {
  children?: React.ReactNode;
  className?: string;
  subject?: string;
};

const SUPPORT_EMAIL = "vantalumstudio@gmail.com";

function buildSupportEmailComposeUrl(subject?: string) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: SUPPORT_EMAIL,
  });
  if (subject?.trim()) {
    params.set("su", subject.trim());
  }
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export default function SupportEmailLink({
  children,
  className,
  subject,
}: SupportEmailLinkProps) {
  return (
    <a
      href={buildSupportEmailComposeUrl(subject)}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title={`Email ${SUPPORT_EMAIL}`}
    >
      {children || SUPPORT_EMAIL}
    </a>
  );
}

export { SUPPORT_EMAIL, buildSupportEmailComposeUrl };
