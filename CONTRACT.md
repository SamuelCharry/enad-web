# ENAd Web: team contract

Read this before writing code. **Product truth:** `../PRODUCT.md`. **Data model and rules:** `../docs/contract.md`, which is binding, especially §2 schema and §7 amendments. **Source of truth for logic:** the Flutter app in `../lib/`. Port behavior 1:1; never invent new document shapes. The web and the mobile app share the Firebase project `enad-entrega-final`, so anything the web writes must be byte-compatible with what the app writes.

All UI copy is in **Spanish (Colombia)**. Dates are `YYYY-MM-DD` in Colombia time (UTC-5). Timestamps are ISO strings.

## Stack
Vite + React 19 + TypeScript (strict), `react-router-dom` **HashRouter**, Firebase JS SDK v13 (`src/data/firebase.ts` exports `app`, `auth`, `db`, `firebaseConfig`), Vitest + jsdom, oxlint. Use plain CSS with custom properties from `src/ui/tokens.css`: no Tailwind, no UI kits, no chart libs (charts are SVG in `src/ui/charts/`). Excel uses `xlsx`; OCR uses `tesseract.js` (`spa`).

Commands, all of which must pass before you finish: `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`.

## Ownership (only edit files you own; anything else goes through the lead)
| Team | Owns |
|---|---|
| A, Marca, shell y landing | `src/ui/**`, `src/landing/**`, `src/app/**` (router, login, home, header, role gate), `index.html`, `public/**`, `DESIGN.md` at the repo root |
| B, Dominio y datos | `src/domain/**`, `src/data/**` (except `firebase.ts`, which is read-only) |
| C, Recolección | `src/features/collect/**` |
| D, Visualización | `src/features/reports/**` |
| E, Infra | `.github/**`, `README.md`, `scripts/**`, `vite.config.ts`, `package.json` scripts |

The stub files below already exist with these exact exports. Implement them; **do not rename or change their signatures**. If you need something new from another team, add a `TODO(team-X)` note in your final report instead of editing their files. You may add new private files inside the folders you own.

## Routes (HashRouter)
- `/` → `src/landing/Landing.tsx` (public)
- `/login` → `src/app/Login.tsx`
- `/portal` → `src/app/Home.tsx`: two big buttons, **Recolección de datos** → `/recoleccion` and **Visualización de datos** → `/visualizacion`
- `/recoleccion/*` → `CollectRoutes` from `src/features/collect/index.tsx`
- `/visualizacion/*` → `ReportRoutes` from `src/features/reports/index.tsx`

`src/app/` wraps `/portal`, `/recoleccion/*` and `/visualizacion/*` in `RequireSession` (it redirects to `/login`) and `PortalLayout`, which provides the header (isotipo, portal name by role, first name, "Cambiar usuario"). Feature modules render only their page content plus their own sub-navigation.

## Shared types: `src/domain/types.ts` (Team B; others import)
```ts
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
```

## Domain modules: `src/domain/*` (Team B, pure and unit-tested)
- `levels.ts`: `SUBJECTS`, `MOMENTS`, `LEVELS: Record<Subject, string[]>` (ordered), `levelLabel(subject, level)`, `momentLabel(m)`, `subjectLabel(s)`, `MOMENT_ORDER`, `shouldOverwriteLevel(current?: Moment, next: Moment): boolean`. Port from `lib/data/mapper/student_api_adapter.dart` and `classification_viewmodel.dart`.
- `levelPalette.ts`: `levelColor(index0to5)`, `{bg, fg}`. Port from `lib/ui/theme/level_palette.dart`.
- `weeks.ts`: `weekOf(date, cfg): number | null`, `rangeOf(week, cfg): {from, to}`, `weeksElapsed(cfg, today)`, `colombiaToday(): string`. Port from `lib/domain/model/implementation_week.dart`.
- `nameKey.ts`: `nameKey(fullName)`. See contract §5 and `lib/domain/text/name_normalizer.dart`.
- `hoursReason.ts`: `REASON_CATEGORIES`, `formatReason(cat, detail)`, `parseReason(s)`, `validateHours({planned, worked, reason})`.
- `groupSuggester.ts`: `suggestGroups(students, subject, moment, teacherCount)`. Port of `lib/domain/grouping/group_suggester.dart`.
- `ocr/rowParser.ts`, `ocr/rowValidator.ts`, `ocr/rosterMatcher.ts`: ports of `lib/domain/ocr/*`.
- `import/schema.ts`, `import/parser.ts`, `import/templates.ts`: ports of `lib/domain/import/*` (template and parse .xlsx/.csv via `xlsx`).
- `export/excel.ts`: `buildExcelExport(exportData): Blob`. Port of `lib/domain/export/excel_export.dart`.

## Data modules: `src/data/*` (Team B; Firestore via `db`)
Every function enforces the same role scope and validation as `lib/data/remote/firestore_gateway.dart` and `lib/data/remote/gateway/*.dart`, and throws `ApiError(status, mensajeEs)`. Writes use batches of ≤400. **Live:** the `watch*` functions use `onSnapshot` and return an unsubscribe function, and the React hooks wrap them. This is what makes changes from the phone appear without reload.
- `session.ts`: `signIn(usernameOrEmail, password)` (bare username → `@enad.app`), `signOut()`, `useSession(): { loading: boolean; user: User | null; profile: UserProfile | null; error?: string }` (profile is live from `users/{uid}`), `canWrite(profile)`.
- `scope.ts`: `useSchools(): { schools: School[]; loading }` (schools visible to the caller, live), `useProgramConfig()`.
- `students.ts`: `watchStudents(schoolId, cb)`, `useStudents(schoolId)`, `createStudent(input)`, `patchStudent(id, fields)`, `importStudents(schoolId, rows)`, `getStudentHistory(id): Promise<{ attendance: AttendanceMark[]; evaluations: Evaluation[] }>`.
- `groups.ts`: `useGroups(schoolId?, opts?: { mine?: boolean })`, `createGroup({name, subject, schoolId, campus, teacherId?})`, `patchGroup(id, fields)`, `deleteGroup(id)`, `addStudentsToGroup(id, studentIds)`, `removeStudentFromGroup(id, sid)`.
- `attendance.ts`: `useGroupAttendance(groupId, date): Record<studentId, AttendanceStatus>`, `saveGroupAttendance(groupId, date, marks)`.
- `evaluations.ts`: `saveEvaluation({studentId, subject, moment, level, sample, gender, age, groupId?})` does the PATCH demographics, then the idempotent evaluation and the level overwrite rule (contract §7.5).
- `hours.ts`: `useMyHours(from, to)`, `saveHours({date, schoolId, plannedHours, workedHours, reason})` (doc id `{uid}_{schoolId}_{date}`).
- `profile.ts`: `updateMyName(fullName)`.
- `admin.ts`: `saveProgramConfig`, `upsertSchool`, `createTeacher` (secondary FirebaseApp; returns `{username, password}`), `patchUser(uid, fields)`, `useUsers(role?)`, `adminImport(kind, rows)` (logs to `imports/`).
- `reports.ts`: `getSummary(f)`, `getSubmissions(f, week?)`, `getLevels(f, subject, moments)`, `getAttendanceReport(f)`, `getHoursReport(f)`, `getExport(f)`, `getTeacherMetrics(uid)`. These port `lib/data/remote/gateway/gateway_reports.dart` exactly, with the same return shapes as JSON, plus a 5-minute cache per (uid, role, report, filters) that is cleared on any write. Also `useFilterOptions(filters)` for the cascading Proyecto → Departamento → Municipio → Institución → Sede bar.

## Feature modules
- **C, `src/features/collect/index.tsx` → `export function CollectRoutes()`**
  - Docente: Asistencia, Evaluación formativa, Horas, Grupos (CRUD, members, "Sugerir grupos"), Estudiantes (add, OCR photo, upload file).
  - Admin: "Carga de datos": Instituciones y sedes, Docentes, Estudiantes, Grupos, Evaluaciones históricas, Configuración del programa, plus imports with templates and user activation.
  - Coordinador and fundación: a read-only notice that links to Visualización.
  - Mirror the flows and validations of `lib/screens/teacher/**`, `lib/feature/**` and `lib/screens/admin_data/**`.
- **D, `src/features/reports/index.tsx` → `export function ReportRoutes()`**
  - Coordinador, fundación and admin: Resumen, Seguimiento, Instituciones (drill-down), Horas y asistencia, Niveles, all with the filter bar and Exportar Excel.
  - Docente: "Mis datos" (indicators, hours history of the last 30 days, student profile and history).
  - Mirror `lib/screens/foundation/**` and `lib/feature/misdatos/**`.

## UI kit: `src/ui/*` (Team A; C and D import, never fork)
- `tokens.css`: all colors, type scale, spacing, radii and motion as CSS variables. Imported once in `main.tsx`.
- `components.tsx` exports `Button` (variants primary, secondary, ghost, danger; `loading`), `Card`, `Field`, `TextInput`, `Select`, `Segmented`, `DateInput`, `NumberInput`, `Dialog`, `Toast`/`useToast`, `EmptyState`, `Spinner`, `Table`, `Tabs`, `Badge`, `LevelChip`, `PageHeader`, `SyncStatus` ("Guardado" / "Pendiente de envío").
- `charts/`: `BarChart`, `StackedBar`, `LineChart`, `Donut`, `Histogram` in SVG, accessible, with tokens only.
- **Until Team A lands the kit,** C and D build against the exported names. The stubs render plain elements, so the build passes.

## Definition of done (every team)
- Typecheck, test, lint and build are all green.
- Spanish copy throughout.
- Works at 375 px and 1440 px.
- No `any` without a comment.
- No secrets.
- No changes outside owned paths.
- End with a short report: what you built, what's stubbed, and any TODOs for other teams.
