const TERMS_SECTIONS = [
  {
    id: "acceptance-of-terms",
    title: "Acceptance of Terms",
    body: [
      "By accessing or using Lurk, you agree to these Terms and Conditions and our related policies. If you do not agree, do not use the platform.",
      "Your continued use of Lurk after updates to these terms means you accept the revised version.",
    ],
  },
  {
    id: "account-rules",
    title: "Account Rules",
    body: [
      "You are responsible for activity on your account and for keeping login credentials secure.",
      "You must provide accurate registration information and may not impersonate others or create accounts for abuse, evasion, or fraud.",
    ],
  },
  {
    id: "acceptable-use-policy",
    title: "Acceptable Use Policy",
    body: [
      "You may not use Lurk to harass, threaten, exploit, or harm others, distribute malware, or engage in unlawful activity.",
      "Automated abuse, scraping beyond authorized limits, attempts to bypass safety controls, and interference with service operation are prohibited.",
    ],
  },
  {
    id: "user-generated-content",
    title: "User Generated Content",
    body: [
      "You retain ownership of content you submit, but you grant Lurk a non-exclusive license to host, process, moderate, and display it as needed to operate the service.",
      "You are solely responsible for content you post and must have rights to upload and share it.",
    ],
  },
  {
    id: "playables",
    title: "Playables",
    body: [
      "Playables are provided for entertainment and may change, be removed, or be unavailable without notice.",
      "Gameplay data, scores, and session state may be stored or processed to support features, moderation, and platform reliability.",
    ],
  },
  {
    id: "developer-portal-terms",
    title: "Developer Portal Terms",
    body: [
      "Developers must submit only original or properly licensed work and must not upload content that infringes third-party rights.",
      "Lurk may review, reject, remove, or request modification of submissions for safety, legal, policy, or quality reasons.",
    ],
  },
  {
    id: "intellectual-property",
    title: "Intellectual Property",
    body: [
      "Lurk branding, platform code, designs, and service materials are protected by applicable intellectual property laws.",
      "Except where expressly permitted, you may not copy, modify, reverse engineer, or redistribute protected platform materials.",
    ],
  },
  {
    id: "termination-clause",
    title: "Termination Clause",
    body: [
      "We may suspend, restrict, or terminate access to accounts or features when needed for policy enforcement, safety, legal compliance, or operational security.",
      "You may stop using Lurk at any time. Certain obligations, including legal and liability sections, survive termination.",
    ],
  },
  {
    id: "disclaimer-of-warranties",
    title: "Disclaimer of Warranties",
    body: [
      "Lurk is provided on an \"as is\" and \"as available\" basis without warranties of any kind, express or implied, to the fullest extent permitted by law.",
      "We do not guarantee uninterrupted availability, error-free operation, or that all content will be accurate or suitable for every use case.",
    ],
  },
  {
    id: "limitation-of-liability",
    title: "Limitation of Liability",
    body: [
      "To the maximum extent permitted by law, Lurk and its operators are not liable for indirect, incidental, special, consequential, or punitive damages.",
      "Total liability for claims arising from use of the service is limited to amounts you paid to Lurk, if any, during the twelve months before the event giving rise to the claim.",
    ],
  },
  {
    id: "arbitration-law",
    title: "Arbitration Law",
    body: [
      "Where legally enforceable, disputes related to these terms may be resolved through binding arbitration instead of court proceedings, except for eligible small claims.",
      "You and Lurk agree to pursue claims individually and not as part of class or representative actions unless prohibited by applicable law.",
    ],
  },
];

const COPYRIGHT_CONTACT_EMAIL =
  process.env.COPYRIGHT_CONTACT_EMAIL ?? "copyright@lurk-app.com";
const LEGAL_CONTACT_EMAIL = process.env.LEGAL_CONTACT_EMAIL ?? "legal@lurk-app.com";
const ABUSE_CONTACT_EMAIL = process.env.ABUSE_CONTACT_EMAIL ?? "abuse@lurk-app.com";
const ACCESSIBILITY_CONTACT_EMAIL =
  process.env.ACCESSIBILITY_CONTACT_EMAIL ?? "accessibility@lurk-app.com";

const PRIVACY_SECTIONS = [
  {
    id: "privacy-data-collected",
    title: "Data We Collect",
    intro: [
      "Lurk collects and processes account, technical, and service data to operate the platform.",
      "Below is an explicit list of personal and service-related data categories collected by Lurk.",
    ],
    bullets: [
      "Email: used as a primary account identifier and for account communications (verification, security, support).",
      "Username / Display Name: profile identifier shown to other users and used in moderation workflows.",
      "IP Addresses: captured at sign in and service interaction for abuse prevention, fraud detection, and security logging.",
      "Device Information: browser type, OS, app/device identifiers, language, network type, and client capabilities.",
      "Usage Data: page views, feature interactions, session timestamps, clicks, and platform behavior events.",
      "Chat Logs: text chat messages, timestamps, room references, and related moderation metadata.",
      "Voice / Video Metadata: call join and leave times, participant IDs, mute/camera states, device capability flags, and connection diagnostics.",
      "Cookies and Similar Technologies: session cookies, authentication state tokens, and preference or analytics cookies where applicable.",
      "Developer Information: developer account status, submission metadata, build URLs, source links, notes, and moderation/review history.",
      "Payment Data: billing metadata, transaction status, and processor reference IDs where payments are enabled (full payment card data is handled by payment processors, not stored directly by Lurk).",
    ],
  },
  {
    id: "privacy-how-we-use-data",
    title: "How We Use Information",
    intro: [
      "Lurk uses collected data only for defined operational, safety, and compliance purposes.",
    ],
    bullets: [
      "Account Management: authentication, account recovery, profile setup, account preferences, and support responses.",
      "Moderation and Trust & Safety: content review, abuse detection, policy enforcement, and dispute handling.",
      "Security: intrusion detection, suspicious activity monitoring, fraud prevention, and platform integrity controls.",
      "Analytics: understanding usage patterns, reliability metrics, and performance monitoring.",
      "Service Improvement: feature iteration, bug fixing, quality tuning, and product development decisions.",
      "Legal Compliance: responding to legal obligations, lawful requests, audits, and enforcement of platform terms.",
    ],
  },
  {
    id: "privacy-data-sharing",
    title: "Data Sharing Policy",
    intro: [
      "Lurk does not sell personal data. Lurk may share data only with the categories below when required to operate or comply with law.",
    ],
    bullets: [
      "Cloud Providers: infrastructure, storage, networking, and uptime/security operations.",
      "Analytics Services: product analytics and operational telemetry providers used to measure platform performance and usage.",
      "Payment Processors: billing and transaction processors for payment authorization, settlement, and fraud checks.",
      "Law Enforcement and Regulators: disclosures made when legally required, including valid subpoenas, court orders, or other lawful process.",
    ],
  },
  {
    id: "privacy-data-retention",
    title: "Data Retention",
    intro: [
      "Lurk keeps data only for as long as needed for service operation, safety, legal obligations, and legitimate business purposes.",
    ],
    bullets: [
      "Chat Logs: retained for moderation, abuse investigation, and security review for a limited period, then deleted or de-identified per retention schedules.",
      "Account Data: core account records (email, username, security history, settings) retained while the account is active and for a defined post-closure period where required by law or safety controls.",
      "Deleted Accounts: account content and profile data are removed or de-identified after deletion workflows complete, subject to legal holds, fraud prevention, and required compliance retention.",
    ],
  },
  {
    id: "privacy-user-rights",
    title: "User Rights",
    intro: [
      "Depending on your location, you may have rights related to your personal information.",
    ],
    bullets: [
      "Access: request a copy of personal data Lurk maintains about your account.",
      "Deletion: request deletion of eligible personal data and/or account closure.",
      "Correction: request correction of inaccurate profile or account information.",
      "Opt-Out Controls: opt out of certain non-essential processing where applicable (for example, non-essential analytics or marketing preferences).",
    ],
  },
  {
    id: "privacy-security-measures",
    title: "Security Measures",
    intro: [
      "Lurk uses layered administrative, technical, and operational controls to protect data.",
    ],
    bullets: [
      "Encryption: encryption in transit and security controls for sensitive records at rest.",
      "Secure Hosting: hosted in managed cloud environments with access control and monitoring.",
      "Industry Best Practices: least-privilege access, logging, patching, vulnerability management, and incident response procedures.",
    ],
  },
  {
    id: "privacy-childrens-privacy",
    title: "Children's Privacy (COPPA)",
    intro: [
      "Lurk is intended for users who meet legal age requirements in their jurisdiction and is designed to remain COPPA compliant.",
      "Lurk does not knowingly collect personal information from children under 13. If Lurk learns that data from a child under 13 has been collected, Lurk will take steps to delete that data and restrict the account as required by law.",
    ],
    bullets: [
      "Parents or guardians who believe a child under 13 has provided personal data may contact Lurk to request review and deletion.",
    ],
  },
];

const LEGAL_SECTIONS = [
  {
    id: "legal-dmca-policy",
    title: "DMCA Policy",
    intro: [
      "Lurk responds to valid copyright notices under applicable law, including the Digital Millennium Copyright Act (DMCA).",
      "If you believe content on Lurk infringes your copyright, submit a complete notice with required legal details so we can review and act.",
    ],
    bullets: [],
  },
  {
    id: "legal-copyright-agent-contact",
    title: "Copyright Agent Contact",
    intro: [
      "Copyright notices and counter-notices should be directed to Lurk's designated copyright contact.",
      `Contact: ${COPYRIGHT_CONTACT_EMAIL}`,
    ],
    bullets: [],
  },
  {
    id: "legal-trademark-claims",
    title: "Trademark Claims",
    intro: [
      "Lurk reviews trademark complaints that include ownership details, the challenged material, and a good-faith statement.",
      `Trademark reports may be submitted to ${LEGAL_CONTACT_EMAIL} with supporting information.`,
    ],
    bullets: [],
  },
  {
    id: "legal-abuse-reporting-contact",
    title: "Abuse Reporting Contact",
    intro: [
      "For harassment, fraud, harmful behavior, or platform abuse, use in-product reporting tools when available.",
      `You may also contact ${ABUSE_CONTACT_EMAIL} for urgent abuse and safety concerns.`,
    ],
    bullets: [],
  },
  {
    id: "legal-law-enforcement-contact",
    title: "Law Enforcement Contact",
    intro: [
      "Government and law enforcement requests must be submitted through lawful process and include sufficient legal authority.",
      `Requests may be directed to ${LEGAL_CONTACT_EMAIL} and should include jurisdiction, case reference, and requested records scope.`,
    ],
    bullets: [],
  },
  {
    id: "legal-export-compliance-statement",
    title: "Export Compliance Statement",
    intro: [
      "Lurk and related services are subject to applicable export control and sanctions laws.",
      "You may not use, export, or re-export Lurk in violation of applicable trade restrictions or prohibited party rules.",
    ],
    bullets: [],
  },
  {
    id: "legal-accessibility-statement",
    title: "Accessibility Statement",
    intro: [
      "Lurk aims to improve accessibility and usability across devices and assistive technologies.",
      `If you encounter accessibility barriers, contact ${ACCESSIBILITY_CONTACT_EMAIL} so we can review and prioritize fixes.`,
    ],
    bullets: [],
  },
];

export default function AboutPage() {
  return (
    <main className="about-page">
      <section className="about-shell">
        <header className="about-header">
          <div>
            <h1>About Lurk</h1>
            <p>
              Lurk is built for fast, lightweight, real-time interaction. This page
              contains our Terms and Conditions and Privacy Policy in a compact
              legal format.
            </p>
          </div>
          <div className="about-header-meta">
            <span>Terms &amp; Conditions + Privacy Policy</span>
            <span>Last updated: February 24, 2026</span>
          </div>
        </header>

        <section className="about-terms">
          <div className="about-terms-intro">
            <h2>Terms and Conditions</h2>
          </div>

          <div className="about-terms-list">
            {TERMS_SECTIONS.map((section) => (
              <details key={section.id} id={section.id} className="about-term-item">
                <summary>{section.title}</summary>
                <div className="about-term-body">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="about-privacy">
          <div className="about-terms-intro">
            <h2>Privacy Policy</h2>
          </div>

          <div className="about-terms-list">
            {PRIVACY_SECTIONS.map((section) => (
              <details key={section.id} id={section.id} className="about-term-item">
                <summary>{section.title}</summary>
                <div className="about-term-body">
                  {section.intro.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {section.bullets.length ? (
                    <ul className="about-term-list">
                      {section.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="about-legal">
          <div className="about-terms-intro">
            <h2>Legal</h2>
          </div>

          <div className="about-terms-list">
            {LEGAL_SECTIONS.map((section) => (
              <details key={section.id} id={section.id} className="about-term-item">
                <summary>{section.title}</summary>
                <div className="about-term-body">
                  {section.intro.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {section.bullets.length ? (
                    <ul className="about-term-list">
                      {section.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
