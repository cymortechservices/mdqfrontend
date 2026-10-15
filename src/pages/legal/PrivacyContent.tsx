import { Link } from "../../lib/router";
import { LegalPage } from "../LegalPage";

const SECTIONS: [string, string][] = [
  ["introduction", "Introduction"],
  ["who-we-are", "Who we are"],
  ["information-we-collect", "Information we collect"],
  ["how-we-use-your-information", "How we use your information"],
  ["automated-assessment-and-service-providers", "Automated assessment and service providers"],
  ["legal-basis-for-processing", "Legal basis for processing"],
  ["how-we-share-your-information", "How we share your information"],
  ["data-security-and-retention", "Data security and retention"],
  ["your-rights", "Your rights"],
  ["children-s-privacy", "Children's privacy"],
  ["third-party-websites", "Third-party websites"],
  ["international-transfers", "International transfers"],
  ["changes-to-this-policy", "Changes to this policy"],
  ["contact-and-complaints", "Contact and complaints"],
];

/** Text reproduced unchanged from the original privacy-policy.html. */
export default function PrivacyContent() {
  return (
    <LegalPage title="Privacy Policy" updated="8 October 2026" path="/privacy-policy" sections={SECTIONS}>
      <h2 id="introduction">Introduction</h2>
      <p>Karimique Labs respects your privacy and is committed to protecting personal information handled through MDQ. This Privacy Policy explains what we collect, why we collect it, how it is used, and the choices and rights available to you.</p>
      <h2 id="who-we-are">Who we are</h2>
      <p>MDQ is a medical study and assessment platform operated by Karimique Labs. Karimique Labs determines how and why personal information collected through MDQ is used and acts as the data controller for that information.</p>
      <h2 id="information-we-collect">Information we collect</h2>
      <p>Depending on how you use MDQ, we may collect:</p>
      <ul>
        <li>Account details, including your student email address, WhatsApp number, password (stored in hashed form), and account and verification status.</li>
        <li>Study information, including subjects and topics, uploaded study material and extracted text, generated assessments, your answers, scores, and feedback.</li>
        <li>If you choose to create a CAT share link, the CAT title, subject, study year, score, total marks, and question count are visible to anyone with that link. Your answers are not shared.</li>
        <li>Payment records, including the M-Pesa phone number, amount, currency, payment status, and transaction or receipt references. Payment approval takes place through M-Pesa; MDQ does not ask for or receive your M-Pesa PIN.</li>
        <li>Account and service activity, including session-cookie information and basic usage information collected through website analytics.</li>
        <li>Information you choose to send when contacting us by email, WhatsApp, or another support channel.</li>
      </ul>
      <p>Uploaded files are processed to extract relevant study text. The temporary uploaded file is removed after processing; assessment records, source references, and generated content may be retained in your account.</p>
      <h2 id="how-we-use-your-information">How we use your information</h2>
      <p>We use personal information to:</p>
      <ul>
        <li>Create and secure accounts, verify email addresses, and provide password resets.</li>
        <li>Generate assessments from selected topics and supplied study material, and mark written answers.</li>
        <li>Save assessments, answers, scores, feedback, and progress for your use.</li>
        <li>Provide optional CAT result sharing when you create a share link.</li>
        <li>Initiate and confirm payments, prevent duplicate charges, and provide payment support.</li>
        <li>Respond to support requests and communicate important service information.</li>
        <li>Maintain, protect, and improve MDQ and meet legal obligations.</li>
      </ul>
      <h2 id="automated-assessment-and-service-providers">Automated assessment and service providers</h2>
      <p>To provide assessment generation and written-answer marking, relevant study text, questions, or answers may be shared with third-party service providers that support our automated AI features. Avoid uploading confidential information or personal information about other people. These providers' processing may be subject to their own privacy terms.</p>
      <p>We use third-party service providers to support automated AI features, send account emails, process M-Pesa payments, provide website analytics, and host and store information for MDQ. These providers process information as needed to perform their services and may be located outside Kenya.</p>
      <h2 id="legal-basis-for-processing">Legal basis for processing</h2>
      <p>We process personal information where there is a lawful basis under applicable data protection law. Depending on the purpose, this may include your consent, providing a service you request or taking steps before an agreement, complying with a legal obligation, or pursuing a legitimate interest that does not override your rights.</p>
      <h2 id="how-we-share-your-information">How we share your information</h2>
      <p>We do not sell your personal information. We share it with the service providers described above where necessary to operate MDQ, provide its features, or communicate with you. We may also disclose information where required by law or a lawful legal process.</p>
      <h2 id="data-security-and-retention">Data security and retention</h2>
      <p>We take reasonable technical and organisational steps to protect personal information against unauthorised access, loss, misuse, alteration, or disclosure. No method of electronic storage or transmission can be guaranteed completely secure.</p>
      <p>We retain personal information only for as long as reasonably necessary for the purposes described in this policy, including providing MDQ, maintaining payment and security records, resolving disputes, and meeting legal obligations. When information is no longer required, we take reasonable steps to delete, anonymise, or securely dispose of it.</p>
      <h2 id="your-rights">Your rights</h2>
      <p>Under applicable Kenyan data protection law, you may have the right to be informed about, access, or request correction or deletion of your personal information; object to or request restriction of certain processing; request portability where applicable; and withdraw consent where processing is based on consent. These rights are subject to legal limitations.</p>
      <p>To ask a privacy question or request access, correction, or deletion, email <a href="mailto:support@karimique.com">support@karimique.com</a>. We may need to verify your identity before acting on a request. Information we must retain for legal, payment, security, or dispute purposes may not be deleted immediately.</p>
      <h2 id="children-s-privacy">Children's privacy</h2>
      <p>MDQ is intended for medical students and is not designed for children. If you believe a child has provided personal information through MDQ, contact us so we can review the request.</p>
      <h2 id="third-party-websites">Third-party websites</h2>
      <p>MDQ may link to websites or services operated by third parties. This policy does not apply to those services; review their privacy information before providing them with personal information.</p>
      <h2 id="international-transfers">International transfers</h2>
      <p>Some service providers may process information outside Kenya. Where personal information is transferred outside Kenya, we take reasonable steps to ensure appropriate safeguards are in place and applicable data protection requirements are followed.</p>
      <h2 id="changes-to-this-policy">Changes to this policy</h2>
      <p>We may update this policy to reflect changes in MDQ, technology, law, or our data-handling practices. We will update the "Last updated" date at the top of this page when changes are published.</p>
      <h2 id="contact-and-complaints">Contact and complaints</h2>
      <p>For questions about this policy, to exercise your privacy rights, or to raise a concern, contact <a href="mailto:support@karimique.com">support@karimique.com</a>. We will consider and respond to requests in accordance with applicable data protection requirements.</p>
      <p>If you believe your information has been handled unlawfully, you may contact us first or lodge a complaint with the Office of the Data Protection Commissioner of Kenya (ODPC).</p>
    </LegalPage>
  );
}
