import type { ReactNode } from "react";
import { ButtonLink } from "../../components/ui/Button";
import { Accordion, Badge } from "../../components/ui/Feedback";
import { Icon, type IconName } from "../../components/ui/Icon";
import { Reveal } from "../../lib/motion";
import { Link } from "../../lib/router";
import { ASSESSMENTS, PRICING, SITE, formatPrice } from "../../lib/config";
import { usePageMeta } from "../../lib/meta";
import { HeroPreview } from "./HeroPreview";

const PROBLEMS: { icon: IconName; problem: string; answer: string }[] = [
  {
    icon: "layers",
    problem: "Revision material is scattered across chats, cyber cafes and old PDFs.",
    answer: "Practise from your own PDF, DOCX or TXT notes, or from MDQ’s built-in textbooks, in one place.",
  },
  {
    icon: "target",
    problem: "Reading the notes feels like knowing them, until you have to recall under pressure.",
    answer: "Every CAT and exam makes you answer from memory, then shows you what you got right and wrong.",
  },
  {
    icon: "timer",
    problem: "There’s little structured, timed practice before the real thing.",
    answer: "Take a CAT for quick retrieval or a timed full exam as a dress rehearsal.",
  },
  {
    icon: "barChart",
    problem: "You’re not sure which subjects and question types are actually weak.",
    answer: "See your score by subject and by MCQ versus written answers, with strengths and areas to improve.",
  },
  {
    icon: "chartLine",
    problem: "It’s hard to see whether you’re improving across attempts.",
    answer: "Every completed assessment is saved with its score, answers and feedback so you can compare over time.",
  },
];

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: "listChecks", title: "CAT practice", text: "50 multiple-choice questions on a subject, topic and year of your choice." },
  { icon: "graduationCap", title: "Full exam practice", text: "90 MCQs, 3 short-answer questions and 1 essay in one sitting." },
  { icon: "fileText", title: "MCQ, SAQ and essay", text: "Written answers are marked and returned with feedback." },
  { icon: "timer", title: "Timed assessments", text: "A 45-minute CAT and a 2 hour 15 minute full exam, so the clock is never a surprise." },
  { icon: "bookOpen", title: "Results with feedback", text: "Explanations for every MCQ and verified source passages where they’re available." },
  { icon: "chartLine", title: "Performance history", text: "Every attempt saved, filterable by CAT or exam, ready to review again." },
  { icon: "target", title: "Strengths and gaps", text: "Subject and question-type scores highlight what to revisit next." },
  { icon: "share", title: "Share a CAT", text: "Send a classmate a link to the same CAT. Your answers stay private." },
  { icon: "upload", title: "Your own notes", text: "Upload PDF, DOCX or TXT (up to 10 MB each) to focus practice on what you study." },
];

const STEPS: { title: string; text: string }[] = [
  { title: "Create an account", text: "Sign up with your student email and WhatsApp number." },
  { title: "Verify your email", text: "Enter the six-digit code we send to your student inbox." },
  { title: "Use your free assessments", text: "Verified accounts get one free CAT and one free full exam." },
  { title: "Choose a CAT or full exam", text: "Pick your year, subject and topic, and optionally upload your notes." },
  { title: "Complete the assessment", text: "Answer under the timer, then submit for marking." },
  { title: "Review and track progress", text: "See your score, feedback and history on your dashboard." },
  { title: "Pay only when you need more", text: `After your free ones, pay per assessment through M-Pesa: ${formatPrice(PRICING.cat)} per CAT, ${formatPrice(PRICING.exam)} per full exam.` },
];

const FAQ: { id: string; question: string; answer: ReactNode }[] = [
  {
    id: "who",
    question: "Who is MDQ designed for?",
    answer: "MDQ is built for Kenyan MBChB students who want structured CAT and full-exam practice, and a clear view of how they’re doing.",
  },
  {
    id: "register",
    question: "How do I register?",
    answer: (
      <>
        Create an account with your student email and WhatsApp number, then verify your email with the six-digit code we send you.{" "}
        <Link to="/signup">Start here</Link>.
      </>
    ),
  },
  {
    id: "verify",
    question: "Why must I verify my student email?",
    answer: "Accounts are for students, so sign-up only accepts email addresses from supported university domains. Verifying the email also unlocks your free assessments, and unverified accounts are removed after seven days.",
  },
  {
    id: "free",
    question: "What is included in the free offer?",
    answer: "After you verify your student email, you can take one free CAT and one free full exam. Each is available once per account.",
  },
  {
    id: "cat-price",
    question: "How much does an additional CAT cost?",
    answer: `${formatPrice(PRICING.cat)} per CAT after your free one. It’s a one-off payment for that assessment, not a subscription.`,
  },
  {
    id: "exam-price",
    question: "How much does an additional full exam cost?",
    answer: `${formatPrice(PRICING.exam)} per full exam after your free one. It’s a one-off payment for that assessment, not a subscription.`,
  },
  {
    id: "start",
    question: "How do I start an assessment?",
    answer: "Open the Exam Room, choose CAT or full exam, select your year of study and subject, add a topic or notes if you like, and press Start. Generating the assessment can take a few minutes, so keep the page open.",
  },
  {
    id: "mpesa",
    question: "How do M-Pesa payments work?",
    answer: "Once you’ve used a test type’s free trial, enter your M-Pesa number when you start another one and approve the payment prompt on your phone. The assessment begins after payment is confirmed. MDQ never asks for your M-Pesa PIN.",
  },
  {
    id: "results",
    question: "How do I view my results?",
    answer: "Submit your assessment and your score appears straight away. Open Performance at any time to review past attempts, answers and feedback.",
  },
  {
    id: "support",
    question: "How do I contact support?",
    answer: (
      <>
        Email <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> or message us on{" "}
        <a href={SITE.whatsappUrl} target="_blank" rel="noreferrer">
          WhatsApp ({SITE.whatsappDisplay})
        </a>
        .
      </>
    ),
  },
];

function SectionHead({ kicker, title, children, center = false }: { kicker: string; title: ReactNode; children?: ReactNode; center?: boolean }) {
  return (
    <Reveal className={`section-head ${center ? "section-head--center" : ""}`}>
      <p className="eyebrow">{kicker}</p>
      <h2 className="h2">{title}</h2>
      {children ? <p className="lead">{children}</p> : null}
    </Reveal>
  );
}

export default function HomePage() {
  usePageMeta({
    title: "MDQ | Personalized MBChB Exam Practice in Kenya",
    description: "Find your MBChB exam blindspots before the examiner does. Take a free CAT or a timed full exam built for Kenyan medical students.",
    path: "/",
    robots: "index, follow, max-image-preview:large",
    ogTitle: "MDQ | Personalized MBChB Exam Practice",
    ogDescription: "You've read the notes. Can you recall them under pressure? Take a free CAT and find your blindspots before the examiner does.",
  });

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__bg" aria-hidden="true" />
        <div className="container hero__grid">
          <div className="hero__copy">
            <Badge tone="accent" icon="heartPulse">
              Built for Kenyan MBChB students
            </Badge>
            <h1 id="hero-title" className="display">
              Know what you know. <span className="grad">Find what you don’t.</span> Walk into your exams prepared.
            </h1>
            <p className="lead hero__lead">
              MDQ helps you practise with CATs and full exams, see your knowledge gaps, and track how every attempt goes, with structured assessment and
              performance feedback.
            </p>
            <div className="hero__cta">
              <ButtonLink to="/signup" size="lg" iconRight="arrowRight">
                Start practising
              </ButtonLink>
              <ButtonLink to="/#how-it-works" variant="secondary" size="lg">
                Explore how it works
              </ButtonLink>
            </div>
            <p className="hero__note">
              <Icon name="checkCircle" size={16} /> 1 free CAT and 1 free full exam after you verify your student email. No credit card or M-Pesa needed to start.
            </p>
            <ul className="hero__facts" aria-label="Key facts">
              <li><strong>50</strong> question CATs</li>
              <li><strong>Timed</strong> full exams</li>
              <li><strong>MCQ · SAQ · Essay</strong></li>
            </ul>
          </div>
          <Reveal className="hero__visual" from="scale">
            <HeroPreview />
          </Reveal>
        </div>
      </section>

      <section className="proof" aria-label="MDQ capabilities">
        <div className="container proof__row">
          <span>Built for student doctors</span>
          <span>PDF · DOCX · TXT</span>
          <span>MCQ · SAQ · Essay</span>
          <span>Track every attempt</span>
        </div>
      </section>

      <section className="section" aria-labelledby="problem-title">
        <div className="container">
          <SectionHead kicker="The revision problem" title={<span id="problem-title">Revision feels productive. Exams test something else.</span>}>
            Here’s what MDQ is designed to help with, and how.
          </SectionHead>
          <div className="problem-grid">
            {PROBLEMS.map((item, index) => (
              <Reveal key={item.problem} className="problem" index={index}>
                <span className="problem__icon">
                  <Icon name={item.icon} size={22} />
                </span>
                <p className="problem__q">{item.problem}</p>
                <p className="problem__a">
                  <Icon name="arrowRight" size={16} /> {item.answer}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--tint" id="features" aria-labelledby="features-title">
        <div className="container">
          <SectionHead kicker="What you get" title={<span id="features-title">Turn revision time into evidence.</span>} center>
            Everything below is in the product today.
          </SectionHead>
          <div className="feature-grid">
            {FEATURES.map((feature, index) => (
              <Reveal key={feature.title} className="feature" index={index % 3}>
                <span className="feature__icon">
                  <Icon name={feature.icon} size={22} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="how-it-works" aria-labelledby="how-title">
        <div className="container">
          <SectionHead kicker="How it works" title={<span id="how-title">From sign-up to your next attempt.</span>} />
          <ol className="steps">
            {STEPS.map((step, index) => (
              <Reveal as="li" key={step.title} className="step" index={index % 3}>
                <span className="step__num" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section--tint" aria-labelledby="demo-title">
        <div className="container demo">
          <Reveal className="demo__copy">
            <p className="eyebrow">Inside the exam room</p>
            <h2 className="h2" id="demo-title">
              A focused screen for answering, and a clear one for learning.
            </h2>
            <ul className="checks">
              <li><Icon name="check" size={18} /> One question at a time, with a numbered navigator and a clock.</li>
              <li><Icon name="check" size={18} /> MCQs, short answers and an essay in a single full exam.</li>
              <li><Icon name="check" size={18} /> After submitting: your score, marking feedback and explanations.</li>
              <li><Icon name="check" size={18} /> Past attempts stay in Performance for review.</li>
            </ul>
            <ButtonLink to="/learn" variant="secondary" iconRight="arrowRight">
              Read the guide
            </ButtonLink>
          </Reveal>
          <Reveal className="demo__visual" from="right">
            <div className="phone">
              <img src="/images/mdq-image.webp" alt="Preview of MDQ medical exam practice on a phone" width="348" height="664" loading="lazy" decoding="async" />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section" id="pricing" aria-labelledby="pricing-title">
        <div className="container">
          <SectionHead kicker="Pricing" title={<span id="pricing-title">One of each to get started. Then pay per assessment.</span>} center>
            Prices are in Kenyan shillings and per assessment. There is no subscription.
          </SectionHead>
          <div className="pricing">
            <Reveal className="price price--free" index={0}>
              <Badge tone="gold" icon="checkCircle">
                Free starter offer
              </Badge>
              <p className="price__amount">
                {PRICING.currency} 0
              </p>
              <p className="price__sub">After you verify your student email</p>
              <ul className="checks">
                <li><Icon name="check" size={18} /> 1 free CAT per account</li>
                <li><Icon name="check" size={18} /> 1 free full exam per account</li>
                <li><Icon name="check" size={18} /> No credit card or M-Pesa required</li>
              </ul>
              <ButtonLink to="/signup" block iconRight="arrowRight">
                Claim your free assessments
              </ButtonLink>
            </Reveal>
            {(["cat", "exam"] as const).map((type, i) => (
              <Reveal key={type} className="price" index={i + 1}>
                <Badge tone="neutral">{ASSESSMENTS[type].label}</Badge>
                <p className="price__amount">
                  {formatPrice(ASSESSMENTS[type].price)}
                </p>
                <p className="price__sub">per {type === "cat" ? "CAT" : "full exam"}, after your free one</p>
                <ul className="checks">
                  <li><Icon name="check" size={18} /> {ASSESSMENTS[type].questions}</li>
                  <li><Icon name="check" size={18} /> Score, feedback and saved history</li>
                  <li><Icon name="check" size={18} /> Pay with M-Pesa when you start</li>
                </ul>
              </Reveal>
            ))}
          </div>
          <p className="fineprint">
            <Icon name="smartphone" size={16} /> Pay-per-assessment through M-Pesa: enter your number, approve the prompt, and your assessment begins once payment is confirmed.
          </p>
        </div>
      </section>

      <section className="section section--tint" id="faq" aria-labelledby="faq-title">
        <div className="container container--narrow">
          <SectionHead kicker="FAQ" title={<span id="faq-title">Questions, answered.</span>} center />
          <Reveal>
            <Accordion items={FAQ} />
          </Reveal>
        </div>
      </section>

      <section className="section" aria-labelledby="cta-title">
        <div className="container">
          <Reveal className="cta">
            <div>
              <p className="eyebrow">Your next session starts here</p>
              <h2 className="h2" id="cta-title">
                Find out what you don’t know, before the examiner does.
              </h2>
            </div>
            <ButtonLink to="/signup" size="lg" iconRight="arrowRight">
              Start practising free
            </ButtonLink>
          </Reveal>
        </div>
      </section>
    </>
  );
}
