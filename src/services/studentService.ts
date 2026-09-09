import { supabase } from '../lib/supabase';
import type { Announcement, Assignment, Certificate, Enrollment, Lesson, Payment, Project, StudentRecord } from '../types';

export interface StudentContext { student: StudentRecord; enrollment: Enrollment }
async function checked<T>(promise: PromiseLike<{data:T;error:{message:string}|null}>):Promise<T>{const {data,error}=await promise;if(error)throw new Error(error.message);return data}

export async function getStudentContext(profileId:string):Promise<StudentContext|null>{
  const student=await checked(supabase.from('students').select('id, profile_id, application_id, enrollment_id, status, certificate_eligible').eq('profile_id',profileId).maybeSingle()) as StudentRecord|null;
  if(!student)return null;
  const enrollment=await checked(supabase.from('enrollments').select('id, student_id, program_id, batch_id, status, progress_percentage, current_week, program:programs(title,total_fee), batch:batches(name,live_day,start_time,timezone)').eq('student_id',student.id).eq('status','active').maybeSingle()) as unknown as Enrollment|null;
  return enrollment?{student,enrollment}:null;
}

export async function getLessons():Promise<Lesson[]>{return await checked(supabase.from('lessons').select('id,title,description,week,resource_links,file_url,video_url,github_url,published,lesson_progress(completed)').eq('published',true).order('week')) as unknown as Lesson[]}
export async function setLessonComplete(studentId:string,lessonId:string,completed:boolean){await checked(supabase.from('lesson_progress').upsert({student_id:studentId,lesson_id:lessonId,completed,completed_at:completed?new Date().toISOString():null},{onConflict:'student_id,lesson_id'}).select())}
export async function getAssignments():Promise<Assignment[]>{return await checked(supabase.from('assignments').select('id,title,week,instructions,due_date,created_at,assignment_submissions(id,assignment_id,submission_url,status,feedback)').eq('published',true).order('week')) as unknown as Assignment[]}
export async function saveAssignmentSubmission(studentId:string,assignmentId:string,submissionUrl:string,status:string){await checked(supabase.from('assignment_submissions').upsert({student_id:studentId,assignment_id:assignmentId,submission_url:submissionUrl,status,submitted_at:status==='submitted'?new Date().toISOString():null},{onConflict:'student_id,assignment_id'}).select())}
export async function getProjects():Promise<Project[]>{return await checked(supabase.from('projects').select('id,title,description,technologies,requirements,project_submissions(id,project_id,github_url,live_demo_url,status,feedback)').eq('published',true).order('created_at')) as unknown as Project[]}
export async function saveProjectSubmission(studentId:string,projectId:string,githubUrl:string,liveDemoUrl:string,status:string){await checked(supabase.from('project_submissions').upsert({student_id:studentId,project_id:projectId,github_url:githubUrl||null,live_demo_url:liveDemoUrl||null,status,submitted_at:status==='submitted'?new Date().toISOString():null},{onConflict:'student_id,project_id'}).select())}
export async function getPayments():Promise<Payment[]>{return await checked(supabase.from('payments').select('id,payment_type,amount,method,paid_at,receipt_number,receipt_url,status,notes').order('paid_at',{ascending:false})) as Payment[]}
export async function getCertificates():Promise<Certificate[]>{return await checked(supabase.from('certificates').select('id,certificate_id,program_name,issue_date,status,file_url').order('issue_date',{ascending:false})) as Certificate[]}
export async function getAnnouncements():Promise<Announcement[]>{return await checked(supabase.from('announcements').select('id,title,message,published_at,priority,active').eq('active',true).order('published_at',{ascending:false}).limit(10)) as Announcement[]}
export async function getAttendance(){return await checked(supabase.from('attendance').select('id,class_date,status').order('class_date')) as Array<{id:string;class_date:string;status:string}>}
