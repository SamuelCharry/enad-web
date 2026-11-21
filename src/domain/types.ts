export type Role = 'docente' | 'coordinador' | 'fundacion' | 'admin'
export type Subject = 'lectura' | 'matematicas'
export type Moment = 'linea_base' | 'linea_media_1' | 'linea_media_2' | 'linea_final' | 'verificacion'
export type AttendanceStatus = 'vino' | 'no_vino' | 'retirado'
export type Jornada = 'mañana' | 'tarde' | 'única'
export interface UserProfile { uid: string; rol: Role; activo: boolean; fullName: string; email: string; username?: string;
  schoolIds: string[]; campusIds: Record<string, string[]>; jornada: Jornada; projectId?: string; regions: string[] }
export interface Campus { id: string; name: string; jornada: Jornada }
export interface School { id: string; name: string; projectId: string; region: string; department: string; municipality: string;
  zone: 'urbana' | 'rural'; active: boolean; campuses: Campus[] }
export interface LevelMark { level: string; date: string; moment: Moment }
export interface Student { id: string; schoolId: string; campus: string; code: string; fullName: string; nameKey: string;
  grade: number; gender: 'F' | 'M' | ''; age: number | null; sample: number | null; retired: boolean; active: boolean;
  provisional: boolean; levels: Partial<Record<Subject, LevelMark>> }
export interface Group { id: string; name: string; subject: Subject; teacherId: string; teacherName: string; schoolId: string;
  campus: string; studentIds: string[] }
export interface AttendanceMark { groupId: string; date: string; status: AttendanceStatus; teacherId: string; schoolId: string; studentId: string; savedAt: string }
export interface Evaluation { id: string; subject: Subject; moment: Moment; level: string; sample: number | null; teacherId: string;
  groupId?: string; date: string; schoolId: string; studentId: string; savedAt: string }
export interface HoursEntry { teacherId: string; schoolId: string; date: string; week: number | null; plannedHours: number;
  workedHours: number; reason: string | null; savedAt: string }
export interface ProgramConfig { projectName: string; implementationStartDate: string; breaks: { from: string; to: string; label: string }[]; year: number }
export interface ReportFilters { projectId?: string; department?: string; municipality?: string; schoolId?: string; campus?: string; from?: string; to?: string }
export class ApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status } }
