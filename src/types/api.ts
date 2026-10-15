/**
 * Types describing the EXISTING backend contracts, as inferred from the original frontend
 * source. Fields the original code treats as optional are optional here. The backend is not
 * part of this repository, so anything not exercised by the original code is left loose.
 */

export interface User {
  id?: string | number;
  studentEmail: string;
  whatsAppNumber?: string;
  createdAt?: string;
  /** Present once the student has saved a name through PUT /api/me/name. */
  displayName?: string;
  emailVerified?: boolean;
}

export interface SourceEvidence {
  title?: string;
  reference?: string;
  type?: string;
  quote?: string;
}

export interface RawMcq {
  id?: string | number;
  question?: string;
  prompt?: string;
  options?: unknown[];
  correctAnswer?: string;
  explanation?: string;
  sourceEvidence?: SourceEvidence[];
  type?: string;
}

export interface RawSubQuestion {
  question?: string;
  marks?: number | string;
}

export interface RawSaq {
  id?: string | number;
  question?: string;
  prompt?: string;
  totalMarks?: number | string;
  subQuestions?: RawSubQuestion[];
  sourceEvidence?: SourceEvidence[];
  type?: string;
}

export interface RawEssay {
  id?: string | number;
  question?: string;
  prompt?: string;
  correctAnswer?: string;
  sourceEvidence?: SourceEvidence[];
  type?: string;
}

/** The object stored in localStorage["currentExam"] (response of POST /api/generate-test, or a saved record's exam). */
export interface ExamPayload {
  examId?: string | number;
  title?: string;
  examTitle?: string;
  subject?: string;
  course?: string;
  module?: string;
  year?: string | number;
  studyYear?: string | number;
  yearOfStudy?: string | number;
  examType?: string;
  testType?: string;
  type?: string;
  mcqs?: RawMcq[];
  questions?: RawMcq[];
  saqs?: RawSaq[];
  essay?: RawEssay[] | RawEssay;
  requiresPaymentConfirmation?: boolean;
  startedAt?: number;
  [extra: string]: unknown;
}

export interface MarkingItem {
  id: string | number;
  correct?: boolean;
  explanation?: string;
  feedback?: string;
  score?: number;
  maxScore?: number;
}

export interface ExamResult {
  totalScore: number;
  totalMarks: number;
  mcqScore?: number;
  mcqTotal?: number;
  writtenScore?: number;
  writtenTotal?: number;
  mcqResults?: MarkingItem[];
  writtenResults?: MarkingItem[];
}

/** One element of GET /api/exams → { exams: ExamRecord[] } */
export interface ExamRecord {
  examId?: string | number;
  attemptId?: string | number;
  testType?: string;
  title?: string;
  subject?: string;
  year?: string | number;
  exam?: ExamPayload;
  answers?: Record<string, unknown>;
  result?: ExamResult | null;
  completedAt?: string;
  generatedAt?: string;
}

export interface TrialsResponse {
  available?: Partial<Record<"cat" | "exam", boolean>>;
}

export interface PaymentStatus {
  status?: string;
  used?: boolean;
  testType?: string;
}

export interface AdminAssessment {
  testType?: string;
  title?: string;
  subject?: string;
  year?: string | number;
  completedAt?: string;
  score?: number | null;
  totalMarks?: number | null;
}

export interface AdminUser {
  id: string | number;
  displayName?: string;
  studentEmail?: string;
  whatsAppNumber?: string;
  emailVerified?: boolean;
  createdAt?: string;
  assessments?: AdminAssessment[];
}

export interface AdminUsersResponse {
  users?: AdminUser[];
  adminUserId?: string | number;
  verificationStats?: { recentlyDeleted?: number };
}

export interface SharedCat {
  title?: string;
  subject?: string;
  year?: string | number;
  totalScore: number;
  totalMarks: number;
  questionCount: number;
}
