// apps/web/app/privacy/page.tsx
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 text-white py-12 px-4 flex items-center justify-center">
      <section className="glass w-full max-w-2xl rounded-2xl shadow-glass p-8 md:p-10">
        <h1 className="text-3xl font-extrabold text-gold-500 mb-6">Privacy Policy</h1>

        <div className="space-y-4 text-sm text-steel-200 leading-relaxed">
          <p>
            We value your privacy. BrainBot only collects the minimum information needed
            to deliver your revision experience. Your data is <b>never sold</b> or shared
            with third parties, and all uploads and messages are encrypted in transit.
          </p>

          <p>
            You may request account deletion or data export at any time by emailing{" "}
            <a
              className="underline text-mint-400"
              href="mailto:chariee@proton.me"
            >
              chariee@proton.me
            </a>.
          </p>

          <p>
            Payments are processed securely via <b>M-PESA</b>. We do not store payment card data.
          </p>

          <p>
            For any privacy questions, please contact us at{" "}
            <a
              className="underline text-mint-400"
              href="mailto:rizzline@protonmail.com"
            >
              rizzline@protonmail.com
            </a>.
          </p>
        </div>
      </section>
    </main>
  );
}
