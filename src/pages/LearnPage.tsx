import { ButtonLink } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { Reveal, Stagger } from "../lib/motion";
import { ASSESSMENTS, PRICING, formatPrice } from "../lib/config";
import { usePageMeta } from "../lib/meta";

const START = [
  { n: "01", title: "Create and verify", text: "Register with your student email, confirm the code sent to your inbox, and keep your WhatsApp number current." },
  { n: "02", title: "Bring useful material", text: "Upload clear PDFs, Word documents, or text notes. Focus each request on one subject and name the topic you want to practice." },
  { n: "03", title: "Review the result", text: "Complete the generated questions without checking the answer key, then use your score and feedback to choose your next revision." },
];

const ROUTINE = [
  ["Before", "choose one subject, year, and topic."],
  ["During", "answer from memory and watch the timer."],
  ["After", "read explanations, not only the score."],
  ["Next", "repeat the weak topic with a fresh test."],
] as const;

export default function LearnPage() {
  usePageMeta({
    title: "Learn | MDQ",
    path: "/learn",
    robots: "index, follow",
    description: "How to get the most from MDQ: build a study loop, choose between a CAT and a full exam, understand free trials and pricing.",
  });
  return (
    <div className="learn">
      <section className="learn__hero">
        <Reveal>
          <p className="eyebrow">Your MDQ field guide</p>
          <h1 className="h1">Study with more intention.</h1>
          <p className="lead">
            MDQ turns your medical study material into focused practice. Use the guide below to get better questions, stronger revision cycles, and a clearer view of your progress.
          </p>
          <ButtonLink to="/signup" size="lg" iconRight="arrowRight">
            Create your account
          </ButtonLink>
        </Reveal>
      </section>

      <section className="learn__section" aria-labelledby="start-title">
        <p className="eyebrow">01 / Start here</p>
        <h2 id="start-title" className="h2">
          Build your study loop
        </h2>
        <Stagger className="learn__grid">
          {START.map((item) => (
            <article key={item.n} className="card card--pad learn__card">
              <span className="learn__num">{item.n}</span>
              <h3 className="h4">{item.title}</h3>
              <p className="muted">{item.text}</p>
            </article>
          ))}
        </Stagger>
      </section>

      <section className="learn__section" aria-labelledby="choose-title">
        <p className="eyebrow">02 / Choose the right mode</p>
        <h2 id="choose-title" className="h2">
          CAT or full exam?
        </h2>
        <div className="learn__modes">
          <article className="card card--pad mode">
            <span className="badge badge--accent">CAT</span>
            <h3 className="h4">Fast, targeted retrieval</h3>
            <p className="muted">Use a CAT after covering a topic or lecture. It concentrates on multiple-choice practice so you can quickly find weak areas.</p>
          </article>
          <article className="card card--pad mode">
            <span className="badge badge--gold">EXAM</span>
            <h3 className="h4">Full assessment rehearsal</h3>
            <p className="muted">Use a full exam when you need endurance and depth. It combines MCQs, short answers, and an essay with marking feedback.</p>
          </article>
        </div>
      </section>

      <section className="learn__section" id="pricing" aria-labelledby="pricing-title">
        <p className="eyebrow">03 / Free trials and pricing</p>
        <h2 id="pricing-title" className="h2">
          One of each to get started.
        </h2>
        <p className="muted learn__intro">Verify your student email to use one free CAT and one free full exam. Each trial is available once per account.</p>
        <div className="learn__modes">
          <article className="card card--pad mode">
            <div className="mode__head">
              <h3 className="h4">CAT</h3>
              <span className="badge badge--gold">1 free CAT</span>
            </div>
            <p className="mode__price">
              {formatPrice(PRICING.cat)} <span>per CAT after your free one</span>
            </p>
            <p className="muted">Cheaper than printing. Faster than searching. Get {ASSESSMENTS.cat.questions} for your next topic.</p>
          </article>
          <article className="card card--pad mode">
            <div className="mode__head">
              <h3 className="h4">Full exam</h3>
              <span className="badge badge--gold">1 free full exam</span>
            </div>
            <p className="mode__price">
              {formatPrice(PRICING.exam)} <span>per full exam after your free one</span>
            </p>
            <p className="muted">Skip the search and the printing. Practice with 90 MCQs, 3 short-answer questions, and 1 essay.</p>
          </article>
        </div>
        <p className="note">
          <Icon name="smartphone" size={16} /> <strong>How payment works:</strong> Once you have used that test type’s free trial, enter your M-Pesa number when you start
          another one and approve the payment prompt. The assessment begins after payment is confirmed. Prices are per assessment; there is no subscription.
        </p>
        <ButtonLink to="/signup" size="lg" iconRight="arrowRight">
          Create your account
        </ButtonLink>
      </section>

      <section className="learn__section" aria-labelledby="max-title">
        <p className="eyebrow">04 / Get more from every session</p>
        <h2 id="max-title" className="h2">
          A stronger revision routine
        </h2>
        <ul className="learn__routine">
          {ROUTINE.map(([label, text]) => (
            <li key={label}>
              <strong>{label}:</strong> {text}
            </li>
          ))}
        </ul>
      </section>

      <section className="card card--pad learn__foot" aria-labelledby="support-title">
        <div>
          <p className="eyebrow">Account and access</p>
          <h2 id="support-title" className="h3">
            Keep your account ready.
          </h2>
          <p className="muted">Your profile contains your registered details. Use the password reset flow if you lose access.</p>
        </div>
        <ButtonLink to="/login" variant="secondary" iconRight="arrowRight">
          Log in to continue
        </ButtonLink>
      </section>
    </div>
  );
}
