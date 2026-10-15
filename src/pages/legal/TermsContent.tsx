import { Link } from "../../lib/router";
import { LegalPage } from "../LegalPage";

const SECTIONS: [string, string][] = [
  ["introduction", "Introduction"],
  ["about-mdq", "About MDQ"],
  ["eligibility-and-your-account", "Eligibility and your account"],
  ["using-the-platform", "Using the platform"],
  ["study-materials-and-generated-assessments", "Study materials and generated assessments"],
  ["sharing-a-cat-result", "Sharing a CAT result"],
  ["free-trials-and-payments", "Free trials and payments"],
  ["intellectual-property", "Intellectual property"],
  ["availability-and-third-party-services", "Availability and third-party services"],
  ["suspension-and-termination", "Suspension and termination"],
  ["limitation-of-liability", "Limitation of liability"],
  ["changes-to-these-terms", "Changes to these terms"],
  ["governing-law-and-contact", "Governing law and contact"],
];

/** Text reproduced unchanged from the original terms.html. */
export default function TermsContent() {
  return (
    <LegalPage title="Terms of Service" updated="13 October 2026" path="/terms" sections={SECTIONS}>
      <h2 id="introduction">Introduction</h2>
      <p>These Terms of Service explain the terms that apply when you use MDQ, a medical study and assessment platform operated by Karimique Labs. By creating an account or using MDQ, you agree to these terms.</p>
      <h2 id="about-mdq">About MDQ</h2>
      <p>MDQ helps medical students create and take computer-assisted tests (CATs) and full exams from study material, review feedback, and track their practice. MDQ is an educational study aid, not a medical service.</p>
      <h2 id="eligibility-and-your-account">Eligibility and your account</h2>
      <p>You must provide accurate account details, use an eligible student email accepted by the signup form, and keep your contact information current. You are responsible for protecting your password and for activity carried out through your account. Do not share your login credentials or use another person's account without permission.</p>
      <p>You must verify the email address used to create your account. If it remains unverified, we may send daily reminder emails starting one day after signup. Accounts that remain unverified for seven days after signup will be deleted. You can avoid deletion by completing email verification within that period.</p>
      <h2 id="using-the-platform">Using the platform</h2>
      <p>You may use MDQ for lawful personal study. You agree not to:</p>
      <ul>
        <li>Use MDQ for unlawful, fraudulent, or harmful activity.</li>
        <li>Attempt to access another person's account or interfere with the platform's operation, security, or availability.</li>
        <li>Upload material that you do not have permission to use, or that contains confidential personal information such as identifiable patient records.</li>
        <li>Copy, misuse, or redistribute MDQ's platform or content except as permitted by law or with permission.</li>
      </ul>
      <h2 id="study-materials-and-generated-assessments">Study materials and generated assessments</h2>
      <p>You retain your rights to material you upload. You give MDQ permission to process that material to provide the requested study and assessment features. You are responsible for ensuring you have the necessary rights to submit it.</p>
      <p>MDQ uses automated systems to help generate assessments and mark written answers. Generated questions, explanations, and feedback may be incomplete or inaccurate. Review them critically and check important information against reliable sources.</p>
      <p>MDQ is for educational practice only. It does not provide medical advice, diagnosis, or treatment, and must not be used to make clinical decisions or replace professional judgement.</p>
      <h2 id="sharing-a-cat-result">Sharing a CAT result</h2>
      <p>If you choose to create a CAT share link, anyone with the link can view the CAT title, subject, study year, score, total marks, and question count. Your answers are not shared. Only create or share a link if you are comfortable making those result details available to people who receive it.</p>
      <h2 id="free-trials-and-payments">Free trials and payments</h2>
      <p>Any available free trial and its conditions are shown in MDQ. After a trial, CATs and full exams are charged individually at the price displayed before you start the assessment. There is no recurring subscription unless MDQ expressly introduces one and explains its terms.</p>
      <p>Payments are initiated through M-Pesa. Check the assessment type, price, and phone number before approving a payment prompt. If payment succeeds but the assessment does not appear, use the regenerate or retry option for that paid assessment. Do not pay a second time for the same assessment; contact <a href="mailto:support@karimique.com">support@karimique.com</a> if the issue continues.</p>
      <p>Once an assessment has been successfully rendered and made available in your account, its payment is non-refundable, including if you do not open or complete the assessment. This does not limit any rights that cannot lawfully be excluded.</p>
      <h2 id="intellectual-property">Intellectual property</h2>
      <p>Karimique Labs and its licensors retain rights in MDQ, including its software, branding, and platform materials. You retain rights to material you provide. Your permission for MDQ to process that material is limited to operating and improving the requested service in accordance with the <Link to="/privacy-policy">Privacy Policy</Link>.</p>
      <h2 id="availability-and-third-party-services">Availability and third-party services</h2>
      <p>MDQ may rely on third-party services for hosting, email, payment processing, analytics, or automated assessment features. Their services may be subject to their own terms and may occasionally be unavailable. We will make reasonable efforts to keep MDQ available, but do not guarantee uninterrupted or error-free operation.</p>
      <p>We may update or temporarily suspend features when reasonably necessary for maintenance, security, or service improvements.</p>
      <h2 id="suspension-and-termination">Suspension and termination</h2>
      <p>We may restrict or suspend access where reasonably necessary to protect users, the platform, or our legal rights, including where these terms are seriously or repeatedly breached. You may stop using MDQ and request account deletion by emailing <a href="mailto:support@karimique.com">support@karimique.com</a>. Information may be retained where required by law or for legitimate payment, security, or dispute records, as explained in the <Link to="/privacy-policy">Privacy Policy</Link>.</p>
      <h2 id="limitation-of-liability">Limitation of liability</h2>
      <p>To the extent permitted by law, Karimique Labs is not liable for losses arising from interruption or failure of third-party services, misuse of MDQ, or reliance on generated educational content without independent verification. Nothing in these terms excludes or limits liability where doing so would be unlawful.</p>
      <h2 id="changes-to-these-terms">Changes to these terms</h2>
      <p>We may update these terms to reflect changes to MDQ, our practices, or applicable law. We will update the date at the top of this page when we publish changes. Continued use of MDQ after an update means you accept the revised terms.</p>
      <h2 id="governing-law-and-contact">Governing law and contact</h2>
      <p>These terms are governed by the laws of Kenya. Disputes will be handled through the applicable legal processes in Kenya.</p>
      <p>For questions about these terms or MDQ, contact <a href="mailto:support@karimique.com">support@karimique.com</a>.</p>
    </LegalPage>
  );
}
