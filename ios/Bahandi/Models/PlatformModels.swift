import Foundation

struct PlatformBootstrap: Decodable {
    let user: User
    let permissions: [String]
    let featureFlags: [String: Bool]
    let shifts: [PlatformShift]
    let tasks: [PlatformTask]
    let timeTracking: PlatformTimeState
    let unreadNotifications: Int
    let employeeServices: EmployeeServicesPayload?
}

struct PlatformTimeState: Decodable {
    let state: String
    let lastEvent: TimeEventRecord?
    let timecard: PlatformTimecard?
    let allowedActions: [String]?
}

struct PlatformShift: Decodable, Identifiable, Hashable {
    let id: Int
    let storeId: Int
    let store: Store?
    let title: String
    let roleName: String?
    let startsAt: String
    let endsAt: String
    let breakMinutes: Int
    let status: String
    let notes: String?
    let version: Int
    let openSlots: Int?
    let assignments: [ShiftAssignment]?
}

struct ShiftAssignment: Decodable, Identifiable, Hashable {
    let id: Int
    let userId: Int
    let status: String
    let user: UserRef?
}

struct ShiftRequestRecord: Decodable, Identifiable, Hashable {
    let id: Int
    let requestType: String
    let shiftId: Int
    let targetShiftId: Int?
    let comment: String?
    let status: String
    let decisionReason: String?
    let version: Int
    let createdAt: String?
}

struct PlatformTask: Decodable, Identifiable, Hashable {
    let id: Int
    let title: String
    let description: String?
    let taskType: String
    let storeId: Int
    let assigneeId: Int?
    let shiftId: Int?
    let dueAt: String?
    let status: String
    let done: Bool
    let progress: Int?
    let version: Int
    let steps: [PlatformTaskStep]
}

struct PlatformTaskStep: Decodable, Identifiable, Hashable {
    let id: Int
    let title: String
    let position: Int
    let done: Bool
    let comment: String?
    let evidenceUrl: String?
}

struct TimeEventRecord: Decodable, Identifiable, Hashable {
    let id: Int
    let storeId: Int
    let shiftId: Int?
    let eventType: String
    let occurredAt: String
}

struct PlatformTimecard: Decodable, Identifiable, Hashable {
    let id: Int
    let userId: Int
    let storeId: Int
    let shiftId: Int?
    let clockInAt: String
    let clockOutAt: String?
    let breakMinutes: Int
    let workedMinutes: Int
    let status: String
    let version: Int
}

struct SupportCaseRecord: Decodable, Identifiable, Hashable {
    let id: Int
    let reference: String
    let authorId: Int
    let authorName: String?
    let storeId: Int?
    let category: String
    let subject: String
    let status: String
    let priority: String
    let assignedToId: Int?
    let assignedToName: String?
    let messages: [CaseMessageRecord]
    let updatedAt: String?
}

struct CaseMessageRecord: Decodable, Identifiable, Hashable {
    let id: Int
    let authorId: Int
    let body: String
    let createdAt: String?
}

struct NewsRecord: Decodable, Identifiable, Hashable {
    let id: Int
    let title: String
    let excerpt: String?
    let body: String
    let category: String?
    let publishedAt: String?
    let isRead: Bool
}

extension NewsRecord {
    func markedRead() -> NewsRecord {
        NewsRecord(id: id, title: title, excerpt: excerpt, body: body, category: category,
                   publishedAt: publishedAt, isRead: true)
    }
}

struct LearningProgressRecord: Decodable, Identifiable, Hashable {
    let id: Int
    let courseId: String
    let completedModuleIds: [String]
    let assessmentScore: Int?
    let assessmentPassed: Bool
}

struct DocumentRequestRecord: Decodable, Identifiable, Hashable {
    var id: Int { requestId }
    let requestId: Int
    let reference: String
    let documentId: String
    let title: String
    let status: String
    let fileUrl: String?
    let decisionReason: String?
    let version: Int
    let createdAt: String?
}

struct LeaveRequestRecord: Decodable, Identifiable, Hashable {
    var id: Int { requestId }
    let requestId: Int
    let reference: String
    let leaveType: String
    let startsOn: String
    let endsOn: String
    let days: Int
    let comment: String?
    let status: String
    let decisionReason: String?
    let version: Int
    let createdAt: String?
}

struct LeaveBalance: Decodable, Hashable {
    let year: Int
    let annualAllowanceDays: Int
    let externalUsedDays: Int
    let approvedDays: Int
    let availableDays: Int
    let preliminary: Bool
}

struct PlatformNotification: Decodable, Identifiable, Hashable {
    let id: Int
    let kind: String
    let title: String
    let body: String?
    let writeOffId: Int?
    let entityType: String?
    let entityId: Int?
    let actionUrl: String?
    let priority: String
    let isRead: Bool
    let readAt: String?
    let createdAt: String?
}

struct NotificationsPayload: Decodable {
    let notifications: [PlatformNotification]
    let unread: Int
}

struct NotificationPayload: Decodable { let notification: PlatformNotification }
struct UpdatedPayload: Decodable { let updated: Int }
struct TimeCorrectionPayload: Decodable { let correction: TimeCorrectionRecord }
struct TimeCorrectionRecord: Decodable, Identifiable, Hashable {
    let id: Int
    let timecardId: Int
    let requesterId: Int
    let proposedClockInAt: String?
    let proposedClockOutAt: String?
    let proposedBreakMinutes: Int?
    let reason: String
    let status: String
    let decisionReason: String?
    let version: Int
    let createdAt: String?
}

struct EmployeeServicesPayload: Decodable {
    let learningProgress: [LearningProgressRecord]?
    let documentRequests: [DocumentRequestRecord]?
    let leaveRequests: [LeaveRequestRecord]?
    let leaveBalance: LeaveBalance?
}

struct ShiftsPayload: Decodable { let shifts: [PlatformShift] }
struct ShiftRequestsPayload: Decodable { let requests: [ShiftRequestRecord] }
struct ShiftRequestPayload: Decodable { let request: ShiftRequestRecord }
struct TasksPayload: Decodable { let tasks: [PlatformTask] }
struct TimecardsPayload: Decodable { let timecards: [PlatformTimecard] }
struct CasesPayload: Decodable { let cases: [SupportCaseRecord] }
struct NewsPayload: Decodable { let news: [NewsRecord] }
struct TimeEventPayload: Decodable { let event: TimeEventRecord; let timecard: PlatformTimecard }
struct TaskPayload: Decodable { let task: PlatformTask }
struct CasePayload: Decodable { let `case`: SupportCaseRecord }
struct DocumentRequestPayload: Decodable { let request: DocumentRequestRecord }
struct LeaveRequestPayload: Decodable { let request: LeaveRequestRecord; let leaveBalance: LeaveBalance? }

extension String {
    var platformDate: Date? {
        ISO8601DateFormatter.platformFractional.date(from: self) ?? ISO8601DateFormatter.platform.date(from: self)
    }
}

extension ISO8601DateFormatter {
    static let platformFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
    static let platform: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}
