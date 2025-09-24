// apps/web/app/terms/page.tsx
export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 text-white py-12 px-4 flex items-center justify-center">
      <section className="glass w-full max-w-3xl rounded-2xl shadow-glass p-8 md:p-10">
        <h1 className="text-3xl font-extrabold text-gold-500 mb-2">Terms of Service</h1>
        <p className="text-xs text-steel-400 mb-6">Last updated: 20 Sep 2025</p>

        <div className="space-y-6 text-sm text-steel-200 leading-relaxed">
          <section>
            <h2 className="font-bold text-mint-400 mb-2">1) Acceptance</h2>
            <p>
              By accessing or using BrainBot (“Service”), you agree to these Terms of Service
              (“Terms”). If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-mint-400 mb-2">2) Eligibility</h2>
            <p>
              You must be old enough to consent to these Terms under your local laws. If you are
              under the age of majority, you may use the Service only with a parent/guardian’s
              consent and supervision.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-mint-400 mb-2">3) Accounts & Linking</h2>
            <p>
              You may link a web account (“WID”) with your Telegram account to use features like
              session history and progress tracking. You are responsible for maintaining the
              security of your devices and any credentials. Do not share link codes or tokens.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-mint-400 mb-2">4) Payments & Refunds</h2>
            <p>
              Paid plans (e.g., Lite, Steady, Serious, Elite, Limited) are processed securely
              via M-PESA. Prices and features may change. Unless required by law, fees are
              non-refundable once access is granted, except for documented billing errors.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-mint-400 mb-2">5) Acceptable Use</h2>
            <ul className="list-disc ml-5 space-y-1">
              <li>No illegal activity, harassment, or abuse.</li>
              <li>No attempts to probe, scan, or break security.</li>
              <li>No automated scraping or rate-limit evasion.</li>
              <li>No misrepresentation or plagiarism of generated feedback.</li>
            </ul>
            <p className="mt-2">
              We may suspend or terminate accounts that violate these Terms or harm the Service or
              other users.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-mint-400 mb-2">6) Your Content & License</h2>
            <p>
              You retain ownership of content you upload (e.g., answers, images, audio). You grant
              us a limited, worldwide, non-exclusive license to process that content to operate and
              improve the Service (e.g., marking, analytics, model tuning), consistent with our{" "}
              <a href="/privacy" className="underline text-mint-400">Privacy Policy</a>.
              Do not upload content you don’t have rights to share.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-mint-400 mb-2">7) Privacy</h2>
            <p>
              Our data practices are described in the{" "}
              <a href="/privacy" className="underline text-mint-400">Privacy Policy</a>.
              By using the Service, you consent to those practices.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-mint-400 mb-2">8) Availability & Changes</h2>
            <p>
              The Service may change, pause, or end without notice. Features may vary by plan and
              region. We may update these Terms from time to time; continued use after changes
              constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-mint-400 mb-2">9) Disclaimers</h2>
            <p>
              The Service is provided “as is” without warranties of any kind. We do not guarantee
              accuracy of grading/feedback or outcomes (e.g., exam results). You are responsible for
              verifying information and using your own judgment.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-mint-400 mb-2">10) Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, we will not be liable for indirect, incidental,
              special, consequential, or punitive damages, or any loss of data, profits, or revenues,
              arising from or related to your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-mint-400 mb-2">11) Termination</h2>
            <p>
              You may stop using the Service at any time. We may suspend or terminate your access
              for any breach of these Terms or to protect the Service or other users. Provisions
              that by their nature should survive termination will survive (e.g., ownership,
              disclaimers, limitation of liability).
            </p>
          </section>

          <section>
            <h2 className="font-bold text-mint-400 mb-2">12) Governing Law</h2>
            <p>
              These Terms are governed by the laws of Kenya, without regard to its conflict of law
              principles. Courts located in Nairobi County shall have exclusive jurisdiction, unless
              applicable law requires otherwise.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-mint-400 mb-2">13) Contact</h2>
            <p>
              Questions about these Terms? Email{" "}
              <a className="underline text-mint-400" href="mailto:chariee@proton.me">
                chariee@proton.me
              </a>.
            </p>
          </section>

          <p className="text-xs text-steel-400">
            This page is provided for convenience and does not constitute legal advice.
            Consult your counsel for any mandatory clauses in your jurisdiction.
          </p>
        </div>
      </section>
    </main>
  );
}
