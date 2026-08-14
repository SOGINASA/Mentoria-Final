import SwiftUI

@MainActor
final class PlatformStore: ObservableObject {
    @Published private(set) var isLoading = false
    @Published private(set) var isMutating = false
    @Published var errorMessage: String?
    @Published private(set) var permissions: [String] = []
    @Published private(set) var featureFlags: [String: Bool] = [:]
    @Published private(set) var shifts: [PlatformShift] = []
    @Published private(set) var openShifts: [PlatformShift] = []
    @Published private(set) var shiftRequests: [ShiftRequestRecord] = []
    @Published private(set) var tasks: [PlatformTask] = []
    @Published private(set) var timecards: [PlatformTimecard] = []
    @Published private(set) var timeState = "idle"
    @Published private(set) var allowedTimeActions: [String] = ["clock_in"]
    @Published private(set) var currentTimecard: PlatformTimecard?
    @Published private(set) var cases: [SupportCaseRecord] = []
    @Published private(set) var news: [NewsRecord] = []
    @Published private(set) var learning: [LearningProgressRecord] = []
    @Published private(set) var documents: [DocumentRequestRecord] = []
    @Published private(set) var leaveRequests: [LeaveRequestRecord] = []
    @Published private(set) var leaveBalance: LeaveBalance?
    @Published private(set) var roleWorkspace: [String: Any] = [:]
    @Published private(set) var notifications: [PlatformNotification] = []
    @Published private(set) var unreadNotifications = 0

    var shiftActive: Bool { timeState != "idle" }
    var pendingTasks: [PlatformTask] { tasks.filter { !$0.done } }
    var platformEnabled: Bool { featureFlags["staff_platform"] != false }
    func feature(_ key: String) -> Bool { platformEnabled && featureFlags[key] != false }
    func hasPermission(_ permission: String) -> Bool { permissions.contains("*") || permissions.contains(permission) }

    func load(role: String, force: Bool = false) async {
        if isLoading || (!force && !permissions.isEmpty) { return }
        isLoading = true
        errorMessage = nil
        do {
            let bootstrap = try await APIClient.shared.platformBootstrap()
            permissions = bootstrap.permissions
            featureFlags = bootstrap.featureFlags
            shifts = bootstrap.shifts
            tasks = bootstrap.tasks
            timeState = bootstrap.timeTracking.state
            allowedTimeActions = bootstrap.timeTracking.allowedActions ?? defaultTimeActions(for: timeState)
            currentTimecard = bootstrap.timeTracking.timecard
            apply(bootstrap.employeeServices)
            unreadNotifications = bootstrap.unreadNotifications
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "Не удалось загрузить платформу"
            isLoading = false
            return
        }

        // Вторичные разделы загружаются независимо: временная недоступность
        // новостей или уведомлений не должна блокировать смены и главный экран.
        if feature("shifts") {
            if let result = try? await APIClient.shared.openShifts() { openShifts = result.shifts }
            if let result = try? await APIClient.shared.shiftRequests() { shiftRequests = result.requests }
        } else { openShifts = []; shiftRequests = [] }

        if feature("time_tracking") {
            if let result = try? await APIClient.shared.timecards() { timecards = result.timecards }
            if let current = try? await APIClient.shared.currentTimeState() {
                timeState = current.state
                allowedTimeActions = current.allowedActions ?? defaultTimeActions(for: current.state)
                currentTimecard = current.timecard
            }
        } else { timecards = [] }

        if feature("support_cases"), let result = try? await APIClient.shared.supportCases() { cases = result.cases }
        else if !feature("support_cases") { cases = [] }
        if feature("news"), let result = try? await APIClient.shared.platformNews() { news = result.news }
        else if !feature("news") { news = [] }
        if let result = try? await APIClient.shared.notifications() {
            notifications = result.notifications
            unreadNotifications = result.unread
        }
        do { try await loadRoleWorkspace(role) }
        catch { errorMessage = (error as? LocalizedError)?.errorDescription ?? "Не удалось загрузить кабинет" }
        isLoading = false
    }

    func refresh(role: String) async { await load(role: role, force: true) }

    func performTimeAction(_ type: String) async throws {
        try await mutate {
            let scheduled = self.currentTimecard?.shiftId.flatMap { id in self.shifts.first { $0.id == id } }
                ?? self.currentScheduledShift
            let response = try await APIClient.shared.recordTimeEvent(
                type, shiftId: scheduled?.id, storeId: scheduled?.storeId
            )
            self.timeState = type == "clock_out" ? "idle" : type
            self.allowedTimeActions = self.defaultTimeActions(for: self.timeState)
            self.currentTimecard = type == "clock_out" ? nil : response.timecard
            self.timecards.removeAll { $0.id == response.timecard.id }
            self.timecards.insert(response.timecard, at: 0)
        }
    }

    func toggleShift() async throws { try await performTimeAction(timeState == "idle" ? "clock_in" : "clock_out") }

    func requestTimeCorrection(card: PlatformTimecard, clockIn: Date?, clockOut: Date?, breakMinutes: Int?, reason: String) async throws {
        try await mutate {
            _ = try await APIClient.shared.requestTimeCorrection(
                card.id, clockIn: clockIn.map { ISO8601DateFormatter.platform.string(from: $0) },
                clockOut: clockOut.map { ISO8601DateFormatter.platform.string(from: $0) },
                breakMinutes: breakMinutes, reason: reason
            )
        }
    }

    func markNotificationRead(_ item: PlatformNotification) async {
        guard !item.isRead else { return }
        if let response = try? await APIClient.shared.markNotificationRead(item.id) {
            notifications.removeAll { $0.id == item.id }; notifications.insert(response.notification, at: 0)
            unreadNotifications = max(0, unreadNotifications - 1)
        }
    }

    func markAllNotificationsRead() async {
        guard (try? await APIClient.shared.markAllNotificationsRead()) != nil else { return }
        if let response = try? await APIClient.shared.notifications() {
            notifications = response.notifications; unreadNotifications = response.unread
        }
    }

    func markNewsRead(_ item: NewsRecord) async {
        guard !item.isRead, (try? await APIClient.shared.markNewsRead(item.id)) != nil else { return }
        news = news.map { $0.id == item.id ? $0.markedRead() : $0 }
    }

    func requestOpenShift(_ shift: PlatformShift) async throws {
        try await mutate {
            let response = try await APIClient.shared.requestShift(shift.id, type: "open_shift")
            self.shiftRequests.removeAll { $0.id == response.request.id }
            self.shiftRequests.insert(response.request, at: 0)
        }
    }

    func requestShiftChange(_ shift: PlatformShift, type: String, comment: String) async throws {
        try await mutate {
            let response = try await APIClient.shared.requestShift(shift.id, type: type, comment: comment)
            self.shiftRequests.removeAll { $0.id == response.request.id }
            self.shiftRequests.insert(response.request, at: 0)
        }
    }

    func toggleStep(task: PlatformTask, step: PlatformTaskStep) async throws {
        try await mutate {
            let response = try await APIClient.shared.updateTaskStep(taskId: task.id, stepId: step.id, done: !step.done)
            self.replaceTask(response.task)
        }
    }

    func setTaskDone(_ task: PlatformTask, done: Bool) async throws {
        try await mutate {
            let response = done ? try await APIClient.shared.completeTask(task.id) : try await APIClient.shared.reopenTask(task.id)
            self.replaceTask(response.task)
        }
    }

    func createCase(category: String, subject: String, message: String) async throws {
        try await mutate {
            let response = try await APIClient.shared.createSupportCase(category: category, subject: subject, message: message)
            self.cases.insert(response.case, at: 0)
        }
    }

    func sendMessage(case item: SupportCaseRecord, body: String) async throws {
        try await mutate {
            let response = try await APIClient.shared.addCaseMessage(item.id, body: body)
            self.cases.removeAll { $0.id == item.id }
            self.cases.insert(response.case, at: 0)
        }
    }

    func updateCaseStatus(_ item: SupportCaseRecord, status: String) async throws {
        try await mutate {
            let response: CasePayload = try await APIClient.shared.request(
                "cases/\(item.id)", method: "PATCH", body: ["status": status],
                headers: ["Idempotency-Key": UUID().uuidString]
            )
            self.cases.removeAll { $0.id == item.id }
            self.cases.insert(response.case, at: 0)
        }
    }

    func requestDocument(_ id: String) async throws {
        try await mutate {
            let response = try await APIClient.shared.requestDocument(id)
            self.documents.insert(response.request, at: 0)
        }
    }

    func requestLeave(type: String, start: Date, end: Date, comment: String) async throws {
        try await mutate {
            let formatter = DateFormatter()
            formatter.calendar = Calendar(identifier: .gregorian)
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "yyyy-MM-dd"
            let response = try await APIClient.shared.requestLeave(
                type: type, startsOn: formatter.string(from: start),
                endsOn: formatter.string(from: end), comment: comment
            )
            self.leaveRequests.insert(response.request, at: 0)
            if let balance = response.leaveBalance { self.leaveBalance = balance }
        }
    }

    func cancelLeave(_ item: LeaveRequestRecord) async throws {
        try await mutate {
            let response = try await APIClient.shared.cancelLeave(item.id, version: item.version)
            self.leaveRequests.removeAll { $0.id == item.id }
            self.leaveRequests.insert(response.request, at: 0)
            if let balance = response.leaveBalance { self.leaveBalance = balance }
        }
    }

    func reloadRoleWorkspace(role: String) async {
        do { try await loadRoleWorkspace(role) }
        catch { errorMessage = (error as? LocalizedError)?.errorDescription ?? "Не удалось загрузить кабинет" }
    }

    func reset() {
        permissions = []; featureFlags = [:]; shifts = []; openShifts = []; shiftRequests = []
        tasks = []; timecards = []; cases = []; news = []; learning = []; documents = []
        leaveRequests = []; leaveBalance = nil; roleWorkspace = [:]; timeState = "idle"; errorMessage = nil
        allowedTimeActions = ["clock_in"]; currentTimecard = nil; notifications = []; unreadNotifications = 0
    }

    private func apply(_ services: EmployeeServicesPayload?) {
        learning = services?.learningProgress ?? []
        documents = services?.documentRequests ?? []
        leaveRequests = services?.leaveRequests ?? []
        leaveBalance = services?.leaveBalance
    }

    private func replaceTask(_ task: PlatformTask) {
        tasks.removeAll { $0.id == task.id }
        tasks.insert(task, at: 0)
    }

    private func loadRoleWorkspace(_ role: String) async throws {
        let path: String?
        switch role {
        case Role.manager: path = "manager/workspace"
        case Role.hr: path = "hr/workspace"
        case Role.finance: path = "finance/workspace"
        case Role.operations: path = "operations/workspace?days=14"
        case Role.admin: path = "admin/platform/overview"
        default: path = nil
        }
        if let path {
            roleWorkspace = try await APIClient.shared.json(path)
        } else {
            roleWorkspace = [:]
        }
    }

    private func mutate(_ action: () async throws -> Void) async throws {
        guard !isMutating else { return }
        isMutating = true
        defer { isMutating = false }
        try await action()
    }

    private func defaultTimeActions(for state: String) -> [String] {
        switch state {
        case "clock_in", "break_end": return ["break_start", "clock_out"]
        case "break_start": return ["break_end"]
        default: return ["clock_in"]
        }
    }

    private var currentScheduledShift: PlatformShift? {
        let now = Date()
        return shifts.first { shift in
            guard let start = shift.startsAt.platformDate, let end = shift.endsAt.platformDate else { return false }
            return start.addingTimeInterval(-30 * 60) <= now && end.addingTimeInterval(30 * 60) >= now
        }
    }
}
