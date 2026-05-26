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
  title: "Terms of Service | sub5tr4cker",
  description:
    "The terms that govern your use of this sub5tr4cker instance, including acceptable use, payments, warranties, and liability.",
};

// reads operator details from runtime settings, so render per-request rather than baking at build
export const dynamic = "force-dynamic";

const toc = [
  { id: "acceptance", label: "Acceptance" },
  { id: "service", label: "The service" },
  { id: "eligibility", label: "Eligibility" },
  { id: "accounts", label: "Accounts" },
  { id: "acceptable-use", label: "Acceptable use" },
  { id: "payments", label: "Payments" },
  { id: "your-content", label: "Your content & members" },
  { id: "third-party", label: "Third-party services" },
  { id: "open-source", label: "Open-source software" },
  { id: "warranty", label: "No warranty" },
  { id: "liability", label: "Limitation of liability" },
  { id: "termination", label: "Suspension & termination" },
  { id: "changes", label: "Changes" },
  { id: "law", label: "Governing law" },
  { id: "contact", label: "Contact" },
];

export default async function TermsPage() {
  const legal = await getLegalConfig();
  const showPlaceholderNotice = legal.entityIsPlaceholder;

  return (
    <LegalContainer>
      <LegalTitle title="Terms of Service" lastUpdated={legal.lastUpdated}>
        <p>
          These Terms govern your use of this {legal.appName} instance operated by{" "}
          <strong>{legal.entityName}</strong>. By using the service you agree to
          them. If you do not agree, please do not use the service.
        </p>
      </LegalTitle>

      {showPlaceholderNotice ? <PlaceholderNotice /> : null}

      <LegalToc items={toc} />

      <LegalProse>
        <h2 id="acceptance">1. Acceptance of these terms</h2>
        <p>
          By creating an account, joining a group, or otherwise using this{" "}
          {legal.appName} instance, you agree to be bound by these Terms and by our{" "}
          <Link href="/privacy">Privacy Policy</Link> and{" "}
          <Link href="/cookies">Cookie Policy</Link>. If you use the service on
          behalf of an organisation, you confirm you are authorised to accept
          these Terms for it.
        </p>

        <h2 id="service">2. The service</h2>
        <p>
          {legal.appName} helps a group of people share the cost of a subscription:
          one person pays the provider, and the app splits the cost, sends payment
          reminders, and tracks who has paid via email and Telegram. The service
          is a <strong>tracking and reminder tool only</strong> — it does not buy
          subscriptions for you and does not move money between users.
        </p>

        <h2 id="eligibility">3. Eligibility</h2>
        <p>
          You must be at least 16 years old (or the minimum age of digital consent
          in your country) to use the service. By using it, you confirm that you
          meet this requirement.
        </p>

        <h2 id="accounts">4. Your account</h2>
        <ul>
          <li>
            You are responsible for the information you provide and for keeping
            your login credentials confidential.
          </li>
          <li>
            You are responsible for activity that happens under your account. Tell
            the operator promptly if you suspect unauthorised use.
          </li>
          <li>
            You agree to provide accurate information and to keep it up to date.
          </li>
        </ul>

        <h2 id="acceptable-use">5. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>use the service for any unlawful, fraudulent, or harmful purpose;</li>
          <li>
            add people to a group, or send them reminders, without a lawful basis
            to contact them;
          </li>
          <li>
            attempt to gain unauthorised access to the service, other users&apos;
            data, or the underlying infrastructure;
          </li>
          <li>
            interfere with or disrupt the service, or circumvent its security or
            rate limits;
          </li>
          <li>
            use the service to violate a subscription provider&apos;s own terms of
            service.
          </li>
        </ul>

        <h2 id="payments">6. Payments between members</h2>
        <p>
          {legal.appName} records who owes what and surfaces the payment details a
          group admin chooses to share (for example a PayPal, Revolut, or
          bank-transfer link). <strong>Actual payments happen outside the app</strong>,
          directly between members and the admin through a third-party payment
          service. We are not a party to those payments, do not hold funds, and
          are not responsible for the accuracy of amounts, for refunds, chargebacks,
          or for any dispute between members. Marking a payment as “confirmed” is a
          record-keeping action, not a financial guarantee.
        </p>

        <h2 id="your-content">7. Your content and group members</h2>
        <p>
          You retain ownership of the information you enter (group details, member
          nicknames, contact addresses, notes, etc.). You grant the operator the
          limited rights needed to store and process that information to run the
          service. If you are a group admin and add other people&apos;s contact
          details, you confirm you have a lawful basis to do so and to have the
          service contact them on your behalf.
        </p>

        <h2 id="third-party">8. Third-party services</h2>
        <p>
          The service integrates with third parties such as email delivery
          (Resend), Telegram, and any configured single sign-on or hosting
          provider. Your use of those services is subject to their own terms and
          privacy policies, and we are not responsible for them.
        </p>

        <h2 id="open-source">9. Open-source software</h2>
        <p>
          {legal.appName} is open-source software, available at{" "}
          <a href={legal.repoUrl} target="_blank" rel="noopener noreferrer">
            {legal.repoUrl.replace(/^https:\/\//, "")}
          </a>
          . The source code is provided under the licence stated in that
          repository. These Terms govern your use of <em>this hosted instance</em>{" "}
          and are separate from the software licence. If you self-host the
          software, the open-source licence governs your use of the code.
        </p>

        <h2 id="warranty">10. Disclaimer — no warranty</h2>
        <p>
          The service is provided <strong>“as is” and “as available”</strong>,
          without warranties of any kind, whether express or implied, including
          fitness for a particular purpose, merchantability, and
          non-infringement. We do not warrant that the service will be
          uninterrupted, error-free, or that reminders will always be delivered on
          time. You are responsible for keeping your own records.
        </p>

        <h2 id="liability">11. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, {legal.entityName} and its
          contributors will not be liable for any indirect, incidental, special,
          consequential, or punitive damages, or for any loss of data, profits, or
          payments arising out of or relating to your use of the service. Nothing
          in these Terms excludes liability that cannot be excluded under
          applicable law (such as liability for death or personal injury caused by
          negligence, or for fraud). Where liability cannot be excluded but can be
          limited, it is limited to the maximum extent permitted by law.
        </p>

        <h2 id="termination">12. Suspension and termination</h2>
        <p>
          You may stop using the service at any time and ask the operator to delete
          your account. We may suspend or terminate access if you breach these
          Terms, if required by law, or to protect the service and its users.
          Provisions that by their nature should survive termination (such as the
          disclaimers and liability limits) will continue to apply.
        </p>

        <h2 id="changes">13. Changes to the service and these terms</h2>
        <p>
          We may modify the service or these Terms from time to time. When we make
          material changes to these Terms, we will update the “Last updated” date
          above. Continued use of the service after changes take effect means you
          accept the updated Terms.
        </p>

        <h2 id="law">14. Governing law</h2>
        <p>
          These Terms are governed by the laws of {legal.jurisdiction}, without
          regard to its conflict-of-laws rules. Any disputes will be subject to the
          courts of that jurisdiction, unless mandatory consumer-protection law
          gives you the right to bring proceedings elsewhere.
        </p>

        <h2 id="contact">15. Contact</h2>
        <p>
          Questions about these Terms? Contact <strong>{legal.entityName}</strong>{" "}
          at <a href={`mailto:${legal.contactEmail}`}>{legal.contactEmail}</a>
          {legal.contactAddress ? <>, or by post at {legal.contactAddress}</> : null}.
        </p>

        <LegalCallout>
          These Terms are provided as an informational template for operators of{" "}
          {legal.appName}. They are not legal advice. The operator is responsible
          for adapting them to their jurisdiction and circumstances and should seek
          professional advice where needed.
        </LegalCallout>
      </LegalProse>
    </LegalContainer>
  );
}
