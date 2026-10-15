/**
 * Single source of truth for product facts that appear in several places
 * (home, learn guide, exam room, payment dialog, FAQ, legal-adjacent copy).
 *
 * PRICING — IMPORTANT
 * -------------------
 * The values below are the prices the ORIGINAL frontend displayed and the amounts its
 * payment dialog quoted: CAT KSh 30, full exam KSh 99. The frontend never sends the amount
 * to the server (POST /api/payments/stk-push only receives { phoneNumber, testType }), so
 * the amount actually charged by M-Pesa is decided by the backend. If the backend price
 * changes, change it here once and every screen follows. See README → "Pricing".
 */
export const PRICING = {
  currency: "KSh",
  cat: 30,
  exam: 99,
} as const;

export type TestType = "cat" | "exam";

export function formatPrice(amount: number): string {
  return `${PRICING.currency} ${amount}`;
}

export const ASSESSMENTS: Record<
  TestType,
  {
    label: string;
    short: string;
    price: number;
    questions: string;
    summary: string;
    detail: string;
    minutes: number;
  }
> = {
  cat: {
    label: "CAT",
    short: "Continuous Assessment Test",
    price: PRICING.cat,
    questions: "50 MCQs",
    summary: "Fast, targeted retrieval",
    detail:
      "Use a CAT after covering a topic or lecture. It concentrates on multiple-choice practice so you can quickly find weak areas.",
    minutes: 45,
  },
  exam: {
    label: "Full exam",
    short: "Timed full examination",
    price: PRICING.exam,
    questions: "90 MCQs · 3 SAQs · 1 essay",
    summary: "Full assessment rehearsal",
    detail:
      "Use a full exam when you need endurance and depth. It combines MCQs, short answers, and an essay with marking feedback.",
    minutes: 135,
  },
};

export const SITE = {
  name: "MDQ",
  by: "Karimique",
  url: "https://mdq.karimique.com",
  owner: "Karimique Labs",
  whatsappDisplay: "0700457508",
  whatsappUrl:
    "https://wa.me/254700457508?text=Hello%20Karimique%2C%20I%20would%20like%20to%20know%20more%20about%20your%20medical%20exam%20practice.",
  supportEmail: "support@karimique.com",
  /** Obfuscated like the original footer (kept out of plain HTML to deter scrapers). */
  generalEmail: () => atob("aW5mb0BrYXJpbWlxdWUuY29t"),
} as const;

/** Exactly the list used by the original login/signup validation. Do not widen casually. */
export const ALLOWED_EMAIL_DOMAINS: readonly string[] = [
  "students.jkuat.ac.ke",
  "students.uonbi.ac.ke",
  "students.mku.ac.ke",
  "students.mu.ac.ke",
  "students.ku.ac.ke",
  "kisiiuniversity.ac.ke",
  "student.maseno.ac.ke",
  "uzimauniversity.ac.ke",
  "student.egerton.ac.ke",
  "student.kemu.ac.ke",
  "student.mmust.ac.ke",
  "school.pu.ac.ke",
  "students.tum.ac.ke",
  "karimique.com",
];

export const SUBJECT_SUGGESTIONS: readonly string[] = [
  "Anaesthesia",
  "Anatomy",
  "Behavioral Sciences",
  "Biochemistry",
  "Community Health",
  "Dermatology",
  "Ear Nose and Throat",
  "Embryology",
  "Emergency Medicine",
  "Epidemiology",
  "Family Medicine",
  "Forensic Medicine",
  "General Pathology",
  "General Surgery",
  "Gross Anatomy",
  "Histology",
  "Human Anatomy",
  "Immunology",
  "Internal Medicine",
  "Medical Ethics",
  "Medical Genetics",
  "Medical Pharmacology",
  "Medical Physiology",
  "Medical Psychology",
  "Medical Statistics",
  "Microbiology",
  "Neuroanatomy",
  "Nutrition and Dietetics",
  "Obstetrics and Gynaecology",
  "Ophthalmology",
  "Orthopaedics",
  "Paediatrics and Child Health",
  "Palliative Care",
  "Parasitology",
  "Pathology",
  "Pharmacology",
  "Physiology",
  "Psychiatry",
  "Public Health",
  "Radiology",
  "Research Methods",
  "Systemic Pathology",
];

/** Payment status polling, identical to the original behaviour (every 3 s, up to 60 times). */
export const PAYMENT_POLL_INTERVAL_MS = 3000;
export const PAYMENT_POLL_ATTEMPTS = 60;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const SHARE_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The original login/signup/verify flows validate sharedCat tokens with this looser pattern. */
export const SHARED_CAT_PARAM_PATTERN = /^[0-9a-f-]{36}$/i;
