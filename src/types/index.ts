export type UserRole = 'student' | 'admin';
export type ProgramCategory = 'software-development' | 'data-science' | 'artificial-intelligence' | 'career-program';
export type ProgramStatus = 'draft' | 'published';
export type AssignmentSubmissionType = 'link_only' | 'file_only' | 'link_or_file' | 'no_submission';
export type AssignmentSubmissionStatus = 'not_started' | 'in_progress' | 'submitted' | 'reviewed' | 'approved' | 'needs_revision';

export interface CurriculumModule { period: string; title: string; topics: string[] }
export interface Program {
  id: string;
  slug: string;
  code: string;
  title: string;
  shortTitle: string;
  category: ProgramCategory;
  duration: string;
  weeks: number;
  liveHours: number;
  level: string;
  description: string;
  registrationFee: number;
  monthlyFee: number;
  months: number;
  tuition: number;
  total: number;
  tools: string[];
  outcomes: string[];
  prerequisites: string[];
  audience: string[];
  curriculum: CurriculumModule[];
  portfolio: string[];
  capstone: string;
  included: string[];
  excluded: string[];
  bonus?: string;
  fullDescription: string;
  displayOrder: number;
  status: ProgramStatus;
  active: boolean;
  createdAt: string;
  courseOutlineName?: string;
  courseOutlineUrl?: string;
}

export interface Profile { id: string; full_name: string | null; email?: string | null; role: UserRole; avatar_url?: string | null; phone?: string | null }
export interface StudentRecord { id: string; profile_id: string; application_id: string | null; enrollment_id: string | null; status: string; certificate_eligible: boolean; profile?: Profile }
export interface Enrollment { id: string; student_id: string; program_id: string; batch_id: string | null; status: string; progress_percentage: number; current_week: number; program?: { title: string; total_fee: number }; batch?: { name: string; live_day: string; start_time: string; timezone: string } }
export interface Lesson { id: string; title: string; description: string | null; week: number; resource_links: string[]; file_url: string | null; video_url: string | null; github_url: string | null; published: boolean; lesson_progress?: { completed: boolean }[] }
export interface Assignment { id: string; title: string; week: number; instructions: string; due_date: string | null; created_at: string; submission_type: AssignmentSubmissionType; max_file_size_mb: number; allow_resubmission: boolean; assignment_submissions?: AssignmentSubmission[] }
export interface AssignmentSubmission { id: string; assignment_id: string; submission_url: string | null; file_path: string | null; file_name: string | null; file_size: number | null; file_mime_type: string | null; notes: string | null; status: AssignmentSubmissionStatus; feedback: string | null; submitted_at: string | null; reviewed_at: string | null }
export interface Project { id: string; title: string; description: string; technologies: string[]; requirements: string | null; project_submissions?: ProjectSubmission[] }
export interface ProjectSubmission { id: string; project_id: string; github_url: string | null; live_demo_url: string | null; status: string; feedback: string | null }
export interface Payment { id: string; payment_type: string; amount: number; method: string | null; paid_at: string | null; receipt_number: string | null; receipt_url: string | null; status: string; notes: string | null }
export interface Certificate { id: string; certificate_id: string | null; program_name: string; issue_date: string | null; status: string; file_url: string | null; file_path: string | null; student_name?: string }
export interface Announcement { id: string; title: string; message: string; published_at: string; priority: string; active: boolean }
