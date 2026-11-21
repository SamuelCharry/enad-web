// Integration boundary for Team B. Replace placeholders with re-exports from data/ and domain/.
// No local storage, Firestore access, or substitute implementation of domain rules.
import type { AttendanceMark, AttendanceStatus, Evaluation, Group, HoursEntry, Moment, ProgramConfig, Role, School, Student, Subject, UserProfile } from '../../domain/types'

function unavailable(): never { throw new Error('Esta función está pendiente de integración.') }
export type ImportKind = 'schools' | 'students' | 'teachers' | 'evaluations' | 'groups'
export type Cells = Record<string, unknown>
export interface ImportRow { number: number; data: Cells; errors: string[]; cells: Record<string, string> }
export interface ImportResult { created: number; skipped: number; errors: { row: number; message: string }[]; credentials: { username: string; password: string }[] }
export interface ParsedRow { rawText: string; name: string; code?: string | null; sex?: string | null; age?: number | null; grade?: number | null; issues: string[]; readingIssues: string[]; confidence: Record<string, number> }
export interface OcrLine { top: number; bottom: number; elements: { text: string; left: number; right: number; confidence?: number | null }[] }
export interface RosterStudent { id: string; name: string; code?: string | null; age?: number | null; sex?: string | null }
export interface RowDecision { status: 'matched' | 'review' | 'invalid' | 'newStudent'; candidates: { student: RosterStudent; score: number }[]; chosenStudentId?: string; reasons: string[] }
interface Proposal { studentIds: string[]; levelLabels: string[] }
type Receipt = { syncState: 'pending' | 'synced' }
type StudentFields = Partial<Record<'fullName' | 'grade' | 'gender' | 'age' | 'sample' | 'retired' | 'campus', unknown>>
type StudentInput = StudentFields & Pick<Student, 'schoolId' | 'fullName' | 'grade'> & Partial<Pick<Student, 'code' | 'provisional'>> & { clientId?: string }
type GroupInput = Pick<Group, 'name' | 'subject' | 'campus' | 'schoolId'> & { teacherId?: string }

export const useSchools = (): { schools: School[]; loading: boolean; error?: string } => ({ schools: [], loading: false })
export const useStudents = (_schoolId: string): { students: Student[]; loading: boolean; error?: string } => ({ students: [], loading: false })
export const useGroups = (_schoolId?: string, _opts?: { mine?: boolean }): { groups: Group[]; loading: boolean; error?: string } => ({ groups: [], loading: false })
export const useUsers = (_role?: Role): { users: UserProfile[]; loading: boolean; error?: string } => ({ users: [], loading: false })
export const useProgramConfig = (): { config: ProgramConfig | null; loading: boolean; error?: string } => ({ config: null, loading: false })
export const useMyHours = (_from: string, _to: string): { hours: HoursEntry[]; loading: boolean; error?: string } => ({ hours: [], loading: false })
export const useGroupAttendance = (_groupId: string, _date: string): Record<string, AttendanceStatus> => ({})
export const saveGroupAttendance: (groupId: string, date: string, marks: Record<string, AttendanceStatus>) => Promise<{ groupId: string; date: string; saved: number } & Receipt> = unavailable
export const saveHours: (input: Pick<HoursEntry, 'date' | 'schoolId' | 'plannedHours' | 'workedHours'> & { reason?: string | null }) => Promise<{ stored: boolean; report: HoursEntry & { id: string } } & Receipt> = unavailable
export const saveEvaluation: (input: Pick<Evaluation, 'studentId' | 'subject' | 'moment' | 'level' | 'groupId'> & { sample: number; gender: string; age: number }) => Promise<{ id: string } & Receipt> = unavailable
export const createStudent: (input: StudentInput) => Promise<Student & Receipt> = unavailable
export const patchStudent: (id: string, fields: StudentFields) => Promise<Student & Receipt> = unavailable
export const importStudents: (schoolId: string, rows: readonly (StudentFields & { code?: unknown })[]) => Promise<Receipt & { created: { id: string; code: string }[]; skipped: string[] }> = unavailable
export const getStudentHistory: (id: string) => Promise<{ attendance: AttendanceMark[]; evaluations: Evaluation[] }> = unavailable
export const createGroup: (input: GroupInput) => Promise<Group & { createdAt: string; updatedAt: string } & Receipt> = unavailable
export const patchGroup: (id: string, fields: Partial<Pick<Group, 'name' | 'campus' | 'teacherId'>>) => Promise<Group & Receipt> = unavailable
export const deleteGroup: (id: string) => Promise<{ id: string; deleted: boolean } & Receipt> = unavailable
export const addStudentsToGroup: (id: string, studentIds: string[]) => Promise<Group & Receipt> = unavailable
export const removeStudentFromGroup: (id: string, sid: string) => Promise<Group & Receipt> = unavailable
export const saveProgramConfig: (config: ProgramConfig) => Promise<ProgramConfig & Receipt> = unavailable
export const upsertSchool: (school: Partial<School>) => Promise<Partial<School> & { id: string } & Receipt> = unavailable
export const createTeacher: (input: Cells) => Promise<{ username: string; password: string }> = unavailable
export const patchUser: (uid: string, fields: Partial<UserProfile>) => Promise<UserProfile & Receipt> = unavailable
export const adminImport: (kind: ImportKind, rows: readonly Cells[]) => Promise<ImportResult> = unavailable

export const SUBJECTS: Subject[] = []
export const MOMENTS: Moment[] = []
export const LEVELS: Record<Subject, string[]> = { lectura: [], matematicas: [] }
export const subjectLabel: (subject: Subject) => string = unavailable
export const momentLabel: (moment: Moment) => string = unavailable
export const levelLabel: (subject: Subject, level: string) => string = unavailable
export const levelColor: (index: number) => { bg: string; fg: string } = unavailable
export const colombiaToday: () => string = unavailable
export const weekOf: (date: string, config: ProgramConfig) => number | null = unavailable
export const rangeOf: (week: number, config: ProgramConfig) => { from: string; to: string } = unavailable
export const REASON_CATEGORIES: string[] = []
export const formatReason: (category: string | null, detail: string) => string = unavailable
export const parseReason: (reason: string | null) => { category: string | null; detail: string } = unavailable
export const validateHours: (input: { planned: number; worked: number; reason?: string | null }) => string | null = unavailable
export const suggestGroups: (students: readonly Student[], subject: Subject, moment: Moment, teacherCount: number) => Proposal[] = unavailable
export const parseRows: (lines: OcrLine[]) => ParsedRow[] = unavailable
export const validateRows: (rows: ParsedRow[]) => ParsedRow[] = unavailable
export const matchRow: (row: ParsedRow, roster: RosterStudent[]) => RowDecision = unavailable
export const importColumns = {} as Record<ImportKind, { key: string; label: string }[]>
export const parseImport: (input: { kind: ImportKind; filename: string; bytes: Uint8Array | ArrayBuffer | number[]; schools: readonly School[]; existingStudents?: Iterable<Pick<Student, "schoolId" | "code">> }) => { rows: ImportRow[]; validRows: ImportRow[] } = unavailable
export const buildImportTemplate: (kind: ImportKind) => Blob = unavailable
