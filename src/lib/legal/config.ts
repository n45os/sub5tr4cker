import { getSetting } from "@/lib/settings/service";
import { APP_NAME, REPO_URL } from "@/lib/site";

// resolved operator details consumed by the public legal pages (privacy, cookies, terms).
// every field has a safe placeholder so the pages render even on a fresh install; operators
// fill the real values from dashboard → settings → "Legal & privacy".
export interface LegalConfig {
  appName: string;
  repoUrl: string;
  // legal entity / operator name acting as data controller
  entityName: string;
  // true when the operator has not set entityName yet (drives a "fill this in" notice)
  entityIsPlaceholder: boolean;
  // privacy / data-subject request contact
  contactEmail: string;
  contactEmailIsPlaceholder: boolean;
  // optional postal address; empty string when unset
  contactAddress: string;
  // governing law / where the operator is established
  jurisdiction: string;
  // data protection authority a user can complain to
  supervisoryAuthority: string;
  // where the instance + database are hosted; empty string when unset
  hostingProvider: string;
  // human-readable effective / last-updated date
  lastUpdated: string;
}

const ENTITY_PLACEHOLDER = "the operator of this sub5tr4cker instance";
const EMAIL_PLACEHOLDER = "privacy@your-domain.example";
const JURISDICTION_PLACEHOLDER = "the operator's country of establishment";
const AUTHORITY_PLACEHOLDER =
  "your local data protection authority (in the EU/EEA, the supervisory authority of your country)";

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function formatDate(iso: string): string {
  // accept a stored ISO date (YYYY-MM-DD) or fall back to today
  const date = iso ? new Date(iso) : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  return safe.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// loads operator legal details from settings (db-backed in advanced mode, config.json in local mode)
export async function getLegalConfig(): Promise<LegalConfig> {
  const [
    entityName,
    contactEmail,
    contactAddress,
    jurisdiction,
    supervisoryAuthority,
    hostingProvider,
    lastUpdated,
  ] = await Promise.all([
    getSetting("legal.entityName"),
    getSetting("legal.contactEmail"),
    getSetting("legal.contactAddress"),
    getSetting("legal.jurisdiction"),
    getSetting("legal.supervisoryAuthority"),
    getSetting("legal.hostingProvider"),
    getSetting("legal.lastUpdated"),
  ]);

  const entity = clean(entityName);
  const email = clean(contactEmail);
  const jurisdictionValue = clean(jurisdiction);
  const authority = clean(supervisoryAuthority);

  return {
    appName: APP_NAME,
    repoUrl: REPO_URL,
    entityName: entity || ENTITY_PLACEHOLDER,
    entityIsPlaceholder: !entity,
    contactEmail: email || EMAIL_PLACEHOLDER,
    contactEmailIsPlaceholder: !email,
    contactAddress: clean(contactAddress),
    jurisdiction: jurisdictionValue || JURISDICTION_PLACEHOLDER,
    supervisoryAuthority: authority || AUTHORITY_PLACEHOLDER,
    hostingProvider: clean(hostingProvider),
    lastUpdated: formatDate(clean(lastUpdated)),
  };
}
