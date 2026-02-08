import type { ReactElement } from "react";

import { Resend } from "resend";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  react?: ReactElement;
};

export const sendEmail = async ({ to, subject, text, react }: SendEmailInput) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    throw new Error("Missing RESEND_API_KEY or RESEND_FROM environment variables.");
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to,
    subject,
    text,
    react,
  });
};
