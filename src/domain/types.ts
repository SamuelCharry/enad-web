/** Session role stored in users/{uid}. */
export type Role = 'docente' | 'coordinador' | 'fundacion'
/** Subject key shared by assessments and groups. */
export type Subject = 'lectura' | 'matematicas'
/** Evaluation moment stored by both clients. */
export type Moment = 'linea_base' | 'linea_media_1' | 'linea_media_2' | 'linea_final' | 'verificacion'
/** Attendance status for one group session. */
export type AttendanceStatus = 'vino' | 'no_vino' | 'retirado'
/** School shift. */
export type Jornada = 'mañana' | 'tarde' | 'única'
/** Signed-in account and its assigned schools. */
export interface UserProfile { uid: string; rol: Role; activo: boolean; fullName: string; email: string; username?: string;
  schoolIds: string[]; campusIds: Record<string, string[]>; jornada: Jornada; projectId?: string }
/** Campus embedded in a school document. */
export interface Campus { id: string; name: string; jornada: Jornada }
/** Institution and its program geography. */
export interface School { id: string; name: string; projectId: string; region: string; department: string; municipality: string;
  zone: 'urbana' | 'rural'; active: boolean; campuses: Campus[] }
/** Most advanced recorded implementation moment for one subject. */
export interface LevelMark { level: string; date: string; moment: Moment }
/** School roster entry and its current subject levels. */
export interface Student { id: string; schoolId: string; campus: string; code: string; fullName: string; nameKey: string;
  grade: number; gender: 'F' | 'M' | ''; age: number | null; sample: number | null; retired: boolean; active: boolean;
  provisional: boolean; needsReview?: boolean; reviewReasons?: string[]; source?: 'manual'|'ocr'|'import'; mergedInto?: string|null; ocrConfidence?: number|null; levels: Partial<Record<Subject, LevelMark>> }
/** Teaching group and student membership. */
export interface Group { syncState?: 'pending'|'synced'; id: string; name: string; subject: Subject; teacherId: string | null; teacherName: string; schoolId: string;
  campus: string; studentIds: string[] }
/** Student attendance event for one group and date. */
export interface AttendanceMark { groupId: string; date: string; status: AttendanceStatus; teacherId: string; schoolId: string; studentId: string; savedAt: string }
/** Idempotently keyed student assessment event. */
export interface Evaluation { id: string; subject: Subject; moment: Moment; level: string; sample: number | null; teacherId: string;
  groupId?: string; date: string; schoolId: string; studentId: string; savedAt: string }
/** Daily hours submitted by one teacher at one institution. */
export interface HoursEntry { teacherId: string; schoolId: string; date: string; week: number | null; plannedHours: number;
  workedHours: number; reason: string | null; savedAt: string }
/** Program implementation calendar. */
export interface ProgramConfig { projectName: string; implementationStartDate: string; breaks: { from: string; to: string; label: string }[]; year: number }
/** Geographic and date constraints for reports. */
export interface ReportFilters { projectId?: string; department?: string; municipality?: string; schoolId?: string; campus?: string; from?: string; to?: string }
/** Gateway failure with a status code and user-facing Spanish message. */
export class ApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status } }
