import styles from "./page.module.css";

export const metadata = {
  title: "LurkGuard | Lurk",
  description:
    "Download LurkGuard, a private Android Phone and SMS client with commitment-based contact blocking and optional Device Owner protection.",
};

const APP_SHA = "f749afa545e6388e985966480580ad590dac614f81b4c6f71ef9a6b85a398325";
const CONTROLLER_SHA = "d4bada3d0c13b43464b00c9c5ffca745963108b1620ed29958c98855d6946202";

const capabilities = [
  ["Focused Phone + SMS", "A compact neon-blue dialer, call history, SMS/MMS inbox, search, contact suggestions, message deletion with Undo, and Android or custom notification sounds."],
  ["Commitment blacklist", "Block incoming cellular calls and SMS/MMS for selected numbers. An unblock request requires biometric verification plus the Blacklist PIN, then waits 90 device-on days."],
  ["Fast re-blocking", "Cancel a pending unblock and keep the contact blocked with the Blacklist PIN. A later request starts a fresh waiting period."],
  ["Optional hardening", "The separate Controller can protect LurkGuard from uninstall, clear-data, force-stop, and default-app changes when it is enrolled as Android Device Owner."],
  ["Private by design", "Blacklist state, PIN material, messages, and call history stay on the device. LurkGuard has no hosted message or blacklist backend."],
  ["Writing assistance", "An optional Gemini writing area can use selected-message context and insert a suggestion into a draft. It requires your own Gemini Developer API key."],
];

const releases = [
  ["3.0", "Current", "Adds safe Open in LurkGuard actions for Lurk profiles, discussions, rooms, and reports. Website links open the matching message, call, or Blacklist screen and still require confirmation in LurkGuard."],
  ["2.9", "Settings redesign", "Moves Blacklist, sound controls, app setup, Controller access, and Contacts into a Google Phone-inspired Settings screen. The main navigation now focuses on Phone and Messages."],
  ["2.8", "Dialer refinement", "Keeps dialed numbers prominent while rendering ABC/DEF letter groups smaller and muted."],
  ["2.7", "Phone redesign", "Introduces the always-open Android-style dialpad and modern in-call controls."],
  ["2.5–2.6", "Calls and sound", "Adds ringtone/message tone selection, custom audio files, and a full-screen active-call interface."],
  ["2.4", "Messages", "Adds swipe-to-delete, instant removal animation, five-second Undo, and the optional Gemini writing workspace."],
  ["2.3", "Controller integration", "Adds the two-app Device Owner design and 90-device-on-day removal request flow."],
];

function DownloadCard({ title, version, href, hash, children }) {
  return (
    <article className={styles.downloadCard}>
      <div>
        <span className={styles.eyebrow}>{version}</span>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
      <a className={styles.downloadButton} href={href} download>
        Download APK
      </a>
      <div className={styles.hashBlock}>
        <span>SHA-256</span>
        <code>{hash}</code>
      </div>
    </article>
  );
}

export default function LurkGuardPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>A Lurk product for Android</span>
          <h1>LurkGuard</h1>
          <p className={styles.lede}>
            A private Phone and SMS client built around a simple commitment: when you block
            a contact, changing that decision can require verification and a real waiting period.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href="/downloads/lurkguard/LurkGuard-3.0.apk" download>
              Download LurkGuard 3.0
            </a>
            <a className={styles.secondaryButton} href="#install">
              Installation guide
            </a>
          </div>
          <div className={styles.statusRow} aria-label="Release status">
            <span>Android 11+</span>
            <span>Private sideload</span>
            <span>SMS/MMS</span>
            <span>Released Sep 21, 2026</span>
          </div>
        </div>
        <div className={styles.shieldWrap}>
          <img src="/lurkguard/neon-shield.svg" alt="LurkGuard neon blue shield" />
          <span>GUARD THE DECISION</span>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="screens-title">
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>The interface</span>
          <h2 id="screens-title">Phone and messages without the clutter</h2>
          <p>Android 17 VM screenshots of the interface retained in the 3.0 release offered below.</p>
        </div>
        <div className={styles.screenshotGrid}>
          <figure>
            <img src="/lurkguard/screenshots/phone.png" alt="LurkGuard Phone screen with call history and always-open dialpad" />
            <figcaption>Phone · searchable history and always-open dialpad</figcaption>
          </figure>
          <figure>
            <img src="/lurkguard/screenshots/messages.png" alt="LurkGuard Messages conversation list" />
            <figcaption>Messages · compact SMS/MMS conversations</figcaption>
          </figure>
          <figure>
            <img src="/lurkguard/screenshots/settings.png" alt="LurkGuard Settings screen" />
            <figcaption>Settings · Blacklist, sounds, Controller, and permissions</figcaption>
          </figure>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="capabilities-title">
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>Capabilities</span>
          <h2 id="capabilities-title">A communication app with deliberate friction</h2>
        </div>
        <div className={styles.capabilityGrid}>
          {capabilities.map(([title, body], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
        <p className={styles.limitNote}>
          LurkGuard supports carrier SMS/MMS and cellular calls. It does not support RCS,
          Google spam screening, visual voicemail, or Internet-app blocking.
        </p>
      </section>

      <section className={`${styles.section} ${styles.downloadSection}`} id="downloads" aria-labelledby="downloads-title">
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>Verified downloads</span>
          <h2 id="downloads-title">Choose the level of protection</h2>
          <p>Both release APKs are non-debuggable. Verify the SHA-256 value before installing.</p>
        </div>
        <div className={styles.downloadGrid}>
          <DownloadCard
            title="LurkGuard"
            version="Version 3.0 · Android 11+"
            href="/downloads/lurkguard/LurkGuard-3.0.apk"
            hash={APP_SHA}
          >
            The Phone, SMS/MMS, Blacklist, sounds, and writing-assistant application.
          </DownloadCard>
          <DownloadCard
            title="LurkGuard Controller"
            version="Version 1.1 · Android 14+"
            href="/downloads/lurkguard/LurkGuard-Controller-1.1.apk"
            hash={CONTROLLER_SHA}
          >
            Optional Device Owner policy app for uninstall and settings protection. A normal
            sideload is intentionally inert.
          </DownloadCard>
        </div>
        <a className={styles.checksumLink} href="/downloads/lurkguard/SHA256SUMS.txt" download>
          Download SHA256SUMS.txt
        </a>
      </section>

      <section className={styles.section} id="install" aria-labelledby="install-title">
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>Installation</span>
          <h2 id="install-title">Sideload normally or enroll the protected setup</h2>
        </div>
        <div className={styles.installGrid}>
          <article>
            <span className={styles.stepTag}>Standard installation</span>
            <h3>No reset required</h3>
            <ol>
              <li>Download LurkGuard 3.0 and verify its SHA-256 checksum.</li>
              <li>Allow your browser or file manager to install unknown apps, then open the APK.</li>
              <li>Open LurkGuard → Settings → App setup &amp; permissions.</li>
              <li>Grant the requested permissions and select LurkGuard as the default Phone and SMS app.</li>
              <li>Keep RCS disabled in Google Messages while LurkGuard is the SMS default.</li>
            </ol>
            <p>The Controller can also be installed normally, but it cannot enforce policy without Device Owner enrollment.</p>
          </article>
          <article className={styles.protectedCard}>
            <span className={styles.stepTag}>Protected installation</span>
            <h3>Factory reset and Device Owner enrollment required</h3>
            <ol>
              <li>Back up the phone, Authenticator entries, and independent account recovery methods before erasing anything.</li>
              <li>Factory-reset, finish minimal setup without adding a Google account, then enable USB debugging.</li>
              <li>Install the Controller from a trusted PC and enroll it before adding any account.</li>
              <li>Install LurkGuard, assign Phone/SMS defaults, then create the Controller PIN and activate protection.</li>
              <li>Add the Google account and restore data only after Device Owner status is confirmed.</li>
            </ol>
            <pre><code>{`adb install LurkGuard-Controller-1.1.apk
adb shell dpm set-device-owner local.lurkguard.controller/local.lurkguard.controller.AdminReceiver
adb shell dpm list-owners
adb install LurkGuard-3.0.apk`}</code></pre>
          </article>
        </div>
        <div className={styles.warning}>
          <strong>Read before enrolling:</strong> the Controller&apos;s 90-day period counts device-on
          time. After it releases LurkGuard, the Controller remains Device Owner. Returning the
          phone to an unmanaged state requires another factory reset.
        </div>
      </section>

      <section className={styles.section} aria-labelledby="releases-title">
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>Release notes</span>
          <h2 id="releases-title">How LurkGuard reached 3.0</h2>
        </div>
        <div className={styles.timeline}>
          {releases.map(([version, label, body]) => (
            <article key={version}>
              <div><strong>{version}</strong><span>{label}</span></div>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.maintainer}`} aria-labelledby="render-title">
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>Maintainers</span>
          <h2 id="render-title">Build and deploy on Render</h2>
        </div>
        <div className={styles.maintainerGrid}>
          <div>
            <h3>Render locally</h3>
            <pre><code>{`npm ci
npm run build
npm start
# Open http://localhost:8080/lurkguard`}</code></pre>
          </div>
          <div>
            <h3>Deployment behavior</h3>
            <p>
              This repository&apos;s <code>render.yaml</code> sets <code>autoDeploy: true</code> and builds
              the Next.js static export before starting the Express server. A push to the connected
              production branch triggers a new deploy automatically.
            </p>
            <p>
              You do not need to press Manual Deploy after a successful automatic build. Use
              Render&apos;s <strong>Manual Deploy → Deploy latest commit</strong> only when auto-deploy is
              disabled, cancelled, or failed before the new commit was published.
            </p>
          </div>
        </div>
        <a className={styles.sourceLink} href="https://github.com/zlinz1995/lurk" target="_blank" rel="noreferrer">
          View source on GitHub
        </a>
      </section>
    </main>
  );
}
