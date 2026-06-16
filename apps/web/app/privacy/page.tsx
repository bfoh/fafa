import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Didi',
  description: 'How Didi collects, uses, and shares your information.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white text-gray-800">
      <div className="max-w-2xl mx-auto px-5 py-12">
        <h1 className="text-3xl font-extrabold text-gray-900">Privacy Policy — Didi</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: 16 June 2026</p>

        <p className="mt-6 leading-relaxed">
          This Privacy Policy explains how Didi (&quot;Didi&quot;, &quot;we&quot;, &quot;us&quot;) collects,
          uses, and shares information when you use the Didi mobile app and website at{' '}
          <a href="https://ghdidi.com" className="text-orange-600 underline">https://ghdidi.com</a>{' '}
          (the &quot;Service&quot;). Didi is a food-ordering platform connecting customers with local
          kitchens and restaurants in Ghana. By using the Service you agree to this policy.
        </p>

        <Section title="Information we collect">
          <p className="font-semibold text-gray-900">Information you provide</p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li><b>Account details (restaurant owners):</b> name, email address, phone number, restaurant name, and password.</li>
            <li><b>Order details (customers):</b> name, phone number, optional email, delivery address and notes. Customers can order without creating an account.</li>
            <li><b>Messages</b> you send to a restaurant through the app.</li>
          </ul>
          <p className="font-semibold text-gray-900 mt-4">Information collected automatically</p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li><b>Location:</b> with your permission, your device location is used to find kitchens near you and to calculate delivery fees. You can decline; some features will be limited.</li>
            <li><b>Device &amp; push tokens:</b> a push notification token and basic device/platform information, used to deliver order updates.</li>
            <li><b>Usage data:</b> basic, non-identifying information about how the app is used, to keep it reliable.</li>
          </ul>
          <p className="font-semibold text-gray-900 mt-4">Payment information</p>
          <p className="mt-1">
            Payments are processed by <b>ExpressPay</b>, a licensed Ghanaian payment provider. Card
            and Mobile Money details are entered with ExpressPay and are <b>not stored by Didi</b>. We
            receive only a payment confirmation and reference.
          </p>
          <p className="mt-3">
            We do <b>not</b> use third-party advertising networks and do <b>not</b> track you across
            other companies&apos; apps or websites.
          </p>
        </Section>

        <Section title="How we use your information">
          <ul className="list-disc pl-5 space-y-1">
            <li>To take, process, and deliver your orders.</li>
            <li>To calculate delivery fees and estimated times based on location.</li>
            <li>To send order updates and important notices by push notification, SMS, or email.</li>
            <li>To provide restaurant owners with their dashboard, orders, and analytics.</li>
            <li>To keep the Service secure, prevent fraud, and meet legal obligations.</li>
          </ul>
        </Section>

        <Section title="How information is shared">
          <p>We share information only as needed to run the Service:</p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li><b>With the restaurant</b> you order from (your name, phone, delivery address, and order details) so they can prepare and deliver your order.</li>
            <li><b>Service providers</b> that operate the platform on our behalf: Supabase (database &amp; authentication), ExpressPay (payments), Firebase Cloud Messaging / Apple Push Notification service (push notifications), and SMS/email providers (order and account notifications).</li>
            <li><b>Legal reasons</b> — if required by law or to protect rights, safety, and security.</li>
          </ul>
          <p className="mt-3">We do <b>not</b> sell your personal information.</p>
        </Section>

        <Section title="Data retention">
          <p>
            We keep your information for as long as your account is active or as needed to provide the
            Service, resolve disputes, and comply with legal obligations. You can request deletion of
            your account and associated personal data (see &quot;Your rights&quot;).
          </p>
        </Section>

        <Section title="Security">
          <p>
            We use industry-standard measures, including encryption in transit (HTTPS) and access
            controls, to protect your information. No method of transmission or storage is completely
            secure, but we work to protect your data and respond to incidents.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You may request to access, correct, or delete your personal information, or to withdraw
            permissions such as location or notifications (you can also change these in your device
            settings). To make a request, contact us at the email below and we will respond within a
            reasonable time.
          </p>
        </Section>

        <Section title="Children">
          <p>
            The Service is not directed to children under 13, and we do not knowingly collect personal
            information from them.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We may update this policy from time to time. Material changes will be posted on this page
            with a new &quot;Last updated&quot; date.
          </p>
        </Section>

        <Section title="Contact">
          <p>Questions or requests about this policy or your data:</p>
          <p className="mt-1">
            <b>Email:</b>{' '}
            <a href="mailto:ebenezer.barning@gmail.com" className="text-orange-600 underline">ebenezer.barning@gmail.com</a>
            <br />
            <b>Website:</b>{' '}
            <a href="https://ghdidi.com" className="text-orange-600 underline">https://ghdidi.com</a>
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      <div className="mt-2 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
