import nodemailer from "nodemailer";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

async function createMailer() {
  return nodemailer.createTransport({
    host: requiredEnv("SMTP_HOST"),
    port: Number(requiredEnv("SMTP_PORT")),
    secure: Number(process.env.SMTP_PORT ?? "587") === 465,
    auth: {
      user: requiredEnv("SMTP_LOGIN"),
      pass: requiredEnv("SMTP_PASSWORD"),
    },
  });
}

export async function sendPortalMail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const to = input.to.trim();
  if (!to) {
    throw new Error("Recipient email is required.");
  }
  const fromEmail = requiredEnv("SMTP_FROM_EMAIL");
  const fromName = process.env.SMTP_FROM_NAME?.trim() || "Mana Poster Ai";
  const mailer = await createMailer();
  await mailer.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
