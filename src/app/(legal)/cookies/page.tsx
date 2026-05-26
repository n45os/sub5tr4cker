import type { Metadata } from "next";
import Link from "next/link";
import { getLegalConfig } from "@/lib/legal/config";
import {
  LegalCallout,
  LegalContainer,
  LegalProse,
  LegalTitle,
} from "../_components/legal-ui";

export const metadata: Metadata = {
  title: "Cookie Policy | sub5tr4cker",
  description:
    "The cookies and local storage sub5tr4cker uses — all strictly necessary for sign-in and security. No tracking or advertising cookies.",
};

// reads operator details from runtime settings, so render per-request rather than baking at build
export const dynamic = "force-dynamic";

interface CookieRow {
  name: string;
  purpose: string;
  type: string;
  duration: string;
  when: string;
}

const cookies: CookieRow[] = [
  {
    name: "authjs.session-token (and __Secure-authjs.session-token over HTTPS)",
    purpose: "Keeps you signed in after login (encrypted session token).",
    type: "Strictly necessary",
    duration: "30 days",
    when: "Email/password & SSO login (multi-user mode)",
  },
  {
    name: "authjs.csrf-token",
    purpose: "Protects sign-in and form submissions against cross-site request forgery.",
    type: "Strictly necessary",
    duration: "Session",
    when: "Multi-user mode",
  },
  {
    name: "authjs.callback-url",
    purpose: "Remembers where to send you back to after signing in.",
    type: "Strictly necessary",
    duration: "Session",
    when: "Multi-user mode",
  },
  {
    name: "sub5tr4cker-local-auth",
    purpose: "Keeps you signed in when running the app in single-user (local) mode.",
    type: "Strictly necessary",
    duration: "30 days",
    when: "Local mode only",
  },
  {
    name: "s5_at / s5_rt",
    purpose:
      "Single sign-on access and refresh tokens used to keep your federated session alive.",
    type: "Strictly necessary",
    duration: "s5_at: short-lived · s5_rt: up to 7 days (sliding)",
    when: "Only when SSO is enabled",
  },
  {
    name: "theme (browser local storage, not a cookie)",
    purpose: "Remembers your light/dark/system theme preference.",
    type: "Functional",
    duration: "Until you clear it",
    when: "All modes",
  },
];

export default async function CookiePolicyPage() {
  const legal = await getLegalConfig();

  return (
    <LegalContainer>
      <LegalTitle title="Cookie Policy" lastUpdated={legal.lastUpdated}>
        <p>
          This Cookie Policy explains the cookies and similar storage that{" "}
          {legal.appName} uses, why we use them, and how you can control them. It
          forms part of our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </LegalTitle>

      <LegalProse>
        <h2 id="what-are-cookies">1. What are cookies?</h2>
        <p>
          Cookies are small text files a website stores in your browser. They are
          widely used to make sites work, to keep you signed in, and to remember
          preferences. Similar technologies, such as your browser&apos;s local
          storage, can store small amounts of data in the same way.
        </p>

        <h2 id="how-we-use">2. How we use them</h2>
        <p>
          {legal.appName} uses cookies and local storage <strong>only</strong> for
          purposes that are essential to providing the service you asked for:
          keeping you signed in, protecting forms against cross-site request
          forgery, and remembering your theme preference.
        </p>
        <p>
          We do <strong>not</strong> use analytics, advertising, marketing, or
          third-party tracking cookies, and we do not build profiles of you across
          sites. Because every cookie we set is strictly necessary (or a
          functional preference you control), no cookie-consent banner is required
          under the EU ePrivacy rules / GDPR.
        </p>

        <h2 id="cookies-we-use">3. Cookies and storage we use</h2>
        <p>
          The exact items below depend on how this instance is configured (for
          example, single-user “local” mode versus multi-user mode, and whether
          single sign-on is enabled).
        </p>
      </LegalProse>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-border/60">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Purpose</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">When set</th>
            </tr>
          </thead>
          <tbody>
            {cookies.map((cookie) => (
              <tr
                key={cookie.name}
                className="border-b border-border/40 align-top last:border-0"
              >
                <td className="px-4 py-3 font-mono text-xs text-foreground">
                  {cookie.name}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{cookie.purpose}</td>
                <td className="px-4 py-3 text-muted-foreground">{cookie.type}</td>
                <td className="px-4 py-3 text-muted-foreground">{cookie.duration}</td>
                <td className="px-4 py-3 text-muted-foreground">{cookie.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LegalProse>
        <h2 id="managing">4. Managing cookies</h2>
        <p>
          Because our cookies are strictly necessary, disabling them will stop you
          from signing in and using the app. You can still control cookies through
          your browser settings — most browsers let you view, block, or delete
          cookies for a site. Signing out, or clearing your browser data, removes
          the session cookies described above. Clearing local storage resets your
          theme preference.
        </p>

        <h2 id="changes">5. Changes to this policy</h2>
        <p>
          If we change the cookies we use, we will update this page and revise the
          “Last updated” date above.
        </p>

        <h2 id="contact">6. Contact</h2>
        <p>
          Questions about cookies? Contact <strong>{legal.entityName}</strong> at{" "}
          <a href={`mailto:${legal.contactEmail}`}>{legal.contactEmail}</a>.
        </p>

        <LegalCallout>
          This Cookie Policy is an informational template describing the{" "}
          {legal.appName} software&apos;s default behaviour. If the operator adds
          plugins or third-party services that set their own cookies, this page
          should be updated to reflect them.
        </LegalCallout>
      </LegalProse>
    </LegalContainer>
  );
}
