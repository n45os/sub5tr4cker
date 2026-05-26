import type { Metadata } from "next";
import Link from "next/link";
import { getLegalConfig } from "@/lib/legal/config";
import {
  LegalCallout,
  LegalContainer,
  LegalProse,
  LegalTitle,
  LegalToc,
  PlaceholderNotice,
} from "../_components/legal-ui";

export const metadata: Metadata = {
  title: "Privacy Policy | sub5tr4cker",
  description:
    "How sub5tr4cker collects, uses, shares, and protects personal data, and the rights you have over it.",
};

// reads operator details from runtime settings, so render per-request rather than baking at build
export const dynamic = "force-dynamic";

const toc = [
  { id: "who-we-are", label: "Who we are" },
  { id: "scope", label: "Scope of this policy" },
  { id: "data-we-collect", label: "Information we collect" },
  { id: "how-we-use", label: "How we use it & legal bases" },
  { id: "cookies", label: "Cookies" },
  { id: "sharing", label: "Who we share it with" },
  { id: "transfers", label: "International transfers" },
  { id: "retention", label: "How long we keep it" },
  { id: "security", label: "How we protect it" },
  { id: "your-rights", label: "Your rights (GDPR)" },
  { id: "uk", label: "UK residents" },
  { id: "california", label: "California residents" },
  { id: "children", label: "Children" },
  { id: "changes", label: "Changes" },
  { id: "contact", label: "Contact" },
];

export default async function PrivacyPolicyPage() {
  const legal = await getLegalConfig();
  const showPlaceholderNotice =
    legal.entityIsPlaceholder || legal.contactEmailIsPlaceholder;

  return (
    <LegalContainer>
      <LegalTitle title="Privacy Policy" lastUpdated={legal.lastUpdated}>
        <p>
          This Privacy Policy explains how <strong>{legal.entityName}</strong> (“we”,
          “us”) collects, uses, shares, and protects personal data when you use
          this {legal.appName} instance, and the rights you have over your data.
        </p>
      </LegalTitle>

      {showPlaceholderNotice ? <PlaceholderNotice /> : null}

      <LegalToc items={toc} />

      <LegalProse>
        <h2 id="who-we-are">1. Who we are</h2>
        <p>
          {legal.appName} is an open-source application for managing shared
          subscriptions. This instance is operated by{" "}
          <strong>{legal.entityName}</strong>, who acts as the{" "}
          <strong>data controller</strong> for the personal data described below
          and decides how and why it is processed.
        </p>
        {legal.contactAddress ? (
          <p>Registered/postal address: {legal.contactAddress}.</p>
        ) : null}
        <p>
          Because {legal.appName} is{" "}
          <a href={legal.repoUrl} target="_blank" rel="noopener noreferrer">
            open source
          </a>{" "}
          and self-hostable, each deployment is run independently. This policy
          describes how the software processes data and how the operator of{" "}
          <em>this</em> instance handles it. If you self-host {legal.appName} for
          your own use, you are the operator and controller for your own
          deployment.
        </p>

        <h2 id="scope">2. Scope of this policy</h2>
        <p>
          This policy covers the {legal.appName} web application, its dashboard,
          member portal, email notifications, and Telegram bot interactions. It
          does <strong>not</strong> cover third-party services that operate under
          their own terms and privacy policies — for example your email provider,
          Telegram, or the payment service you use to actually pay the group
          admin. Those services determine their own processing independently.
        </p>

        <h2 id="data-we-collect">3. Information we collect</h2>
        <p>We only collect what we need to run a shared-subscription tracker.</p>
        <h3>Account information</h3>
        <ul>
          <li>
            Your <strong>name</strong> and <strong>email address</strong>.
          </li>
          <li>
            A <strong>hashed password</strong> if you sign in with a password
            (passwords are hashed with bcrypt and never stored in plain text), or
            a federated identity reference if you sign in via single sign-on.
          </li>
          <li>
            Your <strong>role</strong> (admin or member) and{" "}
            <strong>notification preferences</strong> (whether you receive email
            and/or Telegram reminders and how often).
          </li>
          <li>An optional profile image URL, if provided.</li>
        </ul>
        <h3>Subscription &amp; billing data</h3>
        <ul>
          <li>
            The <strong>groups</strong> you belong to, your member nickname, the{" "}
            <strong>amount you owe</strong> each billing period, and your{" "}
            <strong>payment status</strong> (pending, member-confirmed,
            confirmed).
          </li>
          <li>
            Group-level <strong>payment method details</strong> entered by the
            admin — for example a PayPal, Revolut, or bank-transfer link and
            written instructions. We do <strong>not</strong> collect or store card
            numbers; actual payments happen on the external payment service you
            choose.
          </li>
        </ul>
        <h3>Telegram data (optional)</h3>
        <ul>
          <li>
            If you link Telegram, we store your <strong>Telegram chat ID</strong>{" "}
            and <strong>username</strong> so the bot can send you reminders and
            process your confirmations.
          </li>
        </ul>
        <h3>Technical &amp; usage data</h3>
        <ul>
          <li>
            <strong>Strictly necessary cookies</strong> used to keep you signed
            in and to protect forms (see our{" "}
            <Link href="/cookies">Cookie Policy</Link>).
          </li>
          <li>
            <strong>Server and audit logs.</strong> Like most web apps, the
            hosting environment may record technical information such as IP
            address, browser type, and timestamps for security and
            troubleshooting. The app also keeps an internal audit log of key
            actions (e.g. group changes, confirmations) and a log of
            notifications sent to you.
          </li>
        </ul>

        <h2 id="how-we-use">4. How we use your data and our legal bases</h2>
        <p>
          Where the EU/UK General Data Protection Regulation applies, we rely on
          the following lawful bases (Article 6 GDPR):
        </p>
        <ul>
          <li>
            <strong>Performance of a contract / taking steps at your request</strong>{" "}
            — to create and manage your account, calculate your share of a
            subscription, track payments, and process your confirmations.
          </li>
          <li>
            <strong>Legitimate interests</strong> — to send payment reminders and
            follow-ups for groups you have joined, to keep the service secure, to
            prevent abuse, and to maintain audit logs. We balance these against
            your rights and you can object (see below).
          </li>
          <li>
            <strong>Consent</strong> — where you opt in to a channel such as
            linking Telegram, or otherwise give consent. You can withdraw consent
            at any time without affecting prior processing.
          </li>
          <li>
            <strong>Legal obligation</strong> — where we must retain or disclose
            data to comply with applicable law.
          </li>
        </ul>
        <p>
          We do <strong>not</strong> sell your personal data, and we do not use it
          for advertising or for automated decisions that produce legal or
          similarly significant effects about you.
        </p>

        <h2 id="cookies">5. Cookies and similar technologies</h2>
        <p>
          {legal.appName} uses only <strong>strictly necessary</strong> cookies
          (for sign-in sessions and security) and a small browser preference for
          your light/dark theme. We do not use analytics, advertising, or
          tracking cookies, so no cookie-consent banner is required. Full details
          are in our <Link href="/cookies">Cookie Policy</Link>.
        </p>

        <h2 id="sharing">6. Who we share your data with</h2>
        <p>
          We do not sell or rent personal data. We share it only with service
          providers (“processors”/“sub-processors”) that help us run the service,
          and only as needed:
        </p>
        <ul>
          <li>
            <strong>Email delivery</strong> — when the email channel is enabled,
            transactional emails (reminders, confirmations, invites) are sent via{" "}
            <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
              Resend
            </a>
            , which processes the recipient address and message content to deliver
            the mail.
          </li>
          <li>
            <strong>Telegram</strong> — when you link Telegram, messages are
            delivered through the{" "}
            <a href="https://telegram.org/privacy" target="_blank" rel="noopener noreferrer">
              Telegram Bot API
            </a>
            , subject to Telegram&apos;s own privacy policy.
          </li>
          <li>
            <strong>Hosting &amp; database</strong> —{" "}
            {legal.hostingProvider
              ? `this instance and its database are hosted with ${legal.hostingProvider}.`
              : "this instance and its database are hosted by the operator's chosen hosting and database provider."}{" "}
            They store data on our behalf under their own security and privacy
            terms.
          </li>
          <li>
            <strong>Single sign-on (if enabled)</strong> — if this instance uses
            an external identity provider for login, that provider verifies your
            identity and shares basic profile information (such as your email and
            a user identifier) with us.
          </li>
          <li>
            <strong>Legal &amp; safety</strong> — we may disclose data if required
            by law, to enforce our terms, or to protect the rights, safety, or
            security of users and the service.
          </li>
        </ul>

        <h2 id="transfers">7. International data transfers</h2>
        <p>
          Depending on where this instance and its providers are located, your
          data may be processed in a country other than your own.{" "}
          {legal.hostingProvider
            ? `This instance is hosted with ${legal.hostingProvider}.`
            : ""}{" "}
          Where data is transferred outside the EEA/UK, we rely on an appropriate
          safeguard such as an adequacy decision or the European Commission&apos;s
          Standard Contractual Clauses (and the UK Addendum where relevant).
        </p>

        <h2 id="retention">8. How long we keep your data</h2>
        <ul>
          <li>
            <strong>Account data</strong> is kept while your account is active.
          </li>
          <li>
            <strong>Group and billing-period data</strong> is kept while the group
            exists and for as long as needed to maintain an accurate payment
            history.
          </li>
          <li>
            <strong>Notification and audit logs</strong> are kept for a limited
            period for security, troubleshooting, and dispute resolution, then
            deleted or anonymised.
          </li>
        </ul>
        <p>
          When you ask us to delete your data, or when it is no longer needed for
          the purposes above, we delete or anonymise it, subject to any legal
          retention obligations.
        </p>

        <h2 id="security">9. How we protect your data</h2>
        <p>
          We apply reasonable technical and organisational measures appropriate to
          the data: passwords are hashed with bcrypt, sensitive settings (such as
          API keys and signing secrets) are encrypted at rest, links in emails are
          signed with HMAC tokens to prevent tampering, and traffic is served over
          HTTPS in production. No system is perfectly secure, but we work to
          protect your data and to address any incident promptly. If a personal
          data breach is likely to result in a risk to your rights, we will notify
          the relevant authority and, where required, affected users.
        </p>

        <h2 id="your-rights">10. Your rights (GDPR / EEA)</h2>
        <p>
          If you are in the EEA, you have the following rights over your personal
          data:
        </p>
        <ul>
          <li>
            <strong>Access</strong> — get a copy of the data we hold about you.
          </li>
          <li>
            <strong>Rectification</strong> — correct inaccurate or incomplete data.
          </li>
          <li>
            <strong>Erasure</strong> — ask us to delete your data (“right to be
            forgotten”).
          </li>
          <li>
            <strong>Restriction</strong> — ask us to limit how we use your data.
          </li>
          <li>
            <strong>Portability</strong> — receive your data in a structured,
            commonly used, machine-readable format.
          </li>
          <li>
            <strong>Objection</strong> — object to processing based on legitimate
            interests, including reminders.
          </li>
          <li>
            <strong>Withdraw consent</strong> — where we rely on consent, withdraw
            it at any time.
          </li>
        </ul>
        <p>
          To exercise any of these, contact us using the details in the{" "}
          <a href="#contact">Contact</a> section. You also have the right to lodge
          a complaint with {legal.supervisoryAuthority}.
        </p>

        <h2 id="uk">11. UK residents</h2>
        <p>
          If you are in the United Kingdom, the UK GDPR and the Data Protection Act
          2018 give you the same core rights described above. Your supervisory
          authority is the{" "}
          <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer">
            Information Commissioner&apos;s Office (ICO)
          </a>
          , which you can contact if you have concerns about how your data is
          handled.
        </p>

        <h2 id="california">12. California residents (CCPA/CPRA)</h2>
        <p>
          If you are a California resident, the California Consumer Privacy Act, as
          amended by the CPRA, gives you the right to:
        </p>
        <ul>
          <li>
            <strong>Know</strong> what personal information we collect and how we
            use and disclose it.
          </li>
          <li>
            <strong>Access</strong> and <strong>delete</strong> the personal
            information we hold about you.
          </li>
          <li>
            <strong>Correct</strong> inaccurate personal information.
          </li>
          <li>
            <strong>Opt out</strong> of the “sale” or “sharing” of personal
            information.
          </li>
          <li>
            Not be <strong>discriminated against</strong> for exercising these
            rights.
          </li>
        </ul>
        <p>
          We do <strong>not</strong> sell or share your personal information as
          those terms are defined under the CPRA, and we do not process it for
          cross-context behavioural advertising. To exercise your California
          rights, contact us using the details below.
        </p>

        <h2 id="children">13. Children&apos;s privacy</h2>
        <p>
          {legal.appName} is not intended for children. We do not knowingly collect
          personal data from anyone under the age of 16 (or the minimum age of
          digital consent in your country). If you believe a child has provided us
          with personal data, please contact us and we will delete it.
        </p>

        <h2 id="changes">14. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. When we do, we will revise
          the “Last updated” date at the top of this page and, for material
          changes, take additional steps where required by law. Please review this
          page periodically.
        </p>

        <h2 id="contact">15. How to contact us</h2>
        <p>
          For privacy questions or to exercise any of your rights, contact{" "}
          <strong>{legal.entityName}</strong> at{" "}
          <a href={`mailto:${legal.contactEmail}`}>{legal.contactEmail}</a>
          {legal.contactAddress ? <>, or by post at {legal.contactAddress}</> : null}.
          We aim to respond within the timeframe required by applicable law (one
          month under the GDPR).
        </p>

        <LegalCallout>
          This Privacy Policy is provided as an informational template that
          reflects how the {legal.appName} software handles data. It is not legal
          advice. The operator of this instance is responsible for ensuring it is
          accurate and complete for their specific deployment and should seek
          professional advice where needed.
        </LegalCallout>
      </LegalProse>
    </LegalContainer>
  );
}
