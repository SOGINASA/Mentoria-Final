import Foundation

extension APIClient {
    func platformBootstrap() async throws -> PlatformBootstrap { try await get("platform/bootstrap") }
    func openShifts() async throws -> ShiftsPayload { try await get("shifts?open=1") }
    func shiftRequests() async throws -> ShiftRequestsPayload { try await get("shifts/requests") }
    func requestShift(_ shiftId: Int, type: String, targetShiftId: Int? = nil,
                      comment: String? = nil) async throws -> ShiftRequestPayload {
        try await post("shifts/\(shiftId)/requests", body: [
            "request_type": type, "target_shift_id": targetShiftId, "comment": comment,
        ])
    }
    func timecards() async throws -> TimecardsPayload { try await get("time/timecards") }
    func currentTimeState() async throws -> PlatformTimeState { try await get("time/current") }
    func recordTimeEvent(_ type: String, shiftId: Int?, storeId: Int?) async throws -> TimeEventPayload {
        try await request("time/events", method: "POST", body: [
            "event_type": type, "shift_id": shiftId, "store_id": storeId, "method": "device",
        ], headers: ["Idempotency-Key": UUID().uuidString])
    }
    func requestTimeCorrection(_ cardId: Int, clockIn: String?, clockOut: String?, breakMinutes: Int?, reason: String) async throws -> TimeCorrectionPayload {
        try await post("time/timecards/\(cardId)/corrections", body: [
            "clock_in_at": clockIn, "clock_out_at": clockOut,
            "break_minutes": breakMinutes, "reason": reason,
        ])
    }
    func platformTasks() async throws -> TasksPayload { try await get("tasks") }
    func updateTaskStep(taskId: Int, stepId: Int, done: Bool) async throws -> TaskPayload {
        try await patch("tasks/\(taskId)/steps/\(stepId)", body: ["done": done])
    }
    func completeTask(_ id: Int) async throws -> TaskPayload { try await post("tasks/\(id)/complete") }
    func reopenTask(_ id: Int) async throws -> TaskPayload { try await post("tasks/\(id)/reopen") }
    func supportCases() async throws -> CasesPayload { try await get("cases") }
    func createSupportCase(category: String, subject: String, message: String) async throws -> CasePayload {
        try await post("cases", body: ["category": category, "subject": subject, "message": message])
    }
    func addCaseMessage(_ id: Int, body: String) async throws -> CasePayload {
        try await request("cases/\(id)/messages", method: "POST", body: ["body": body],
                          headers: ["Idempotency-Key": UUID().uuidString])
    }
    func platformNews() async throws -> NewsPayload { try await get("news") }
    func markNewsRead(_ id: Int) async throws -> EmptyResponse { try await post("news/\(id)/read") }
    func employeeServices() async throws -> EmployeeServicesPayload { try await get("employee-services") }
    func completeLearningModule(courseId: String, moduleId: String) async throws -> ProgressPayload {
        try await post("employee-services/learning/\(courseId)/modules/\(moduleId)/complete")
    }
    func completeAssessment(courseId: String, answer: String) async throws -> ProgressPayload {
        try await post("employee-services/learning/\(courseId)/assessment", body: ["answer": answer])
    }
    func requestDocument(_ documentId: String) async throws -> DocumentRequestPayload {
        try await post("employee-services/documents/requests", body: ["document_id": documentId])
    }
    func requestLeave(type: String, startsOn: String, endsOn: String, comment: String) async throws -> LeaveRequestPayload {
        try await post("employee-services/leave/requests", body: [
            "leave_type": type, "starts_on": startsOn, "ends_on": endsOn, "comment": comment,
        ])
    }
    func cancelLeave(_ id: Int, version: Int) async throws -> LeaveRequestPayload {
        try await post("employee-services/leave/requests/\(id)/cancel", body: ["version": version])
    }
    func notifications() async throws -> NotificationsPayload { try await get("notifications?per_page=100") }
    func markNotificationRead(_ id: Int) async throws -> NotificationPayload { try await post("notifications/\(id)/read") }
    func markAllNotificationsRead() async throws -> UpdatedPayload { try await post("notifications/read-all") }

    func decideShiftRequest(_ id: Int, decision: String, version: Int, reason: String?) async throws -> ShiftRequestPayload {
        try await request("shifts/manager/requests/\(id)/decision", method: "POST", body: [
            "decision": decision, "version": version, "reason": reason,
        ], headers: ["Idempotency-Key": UUID().uuidString])
    }

    func decideDocumentRequest(_ id: Int, decision: String, version: Int, reason: String?) async throws -> DocumentRequestPayload {
        try await request("employee-services/manager/documents/requests/\(id)/decision", method: "POST", body: [
            "decision": decision, "version": version, "reason": reason,
        ], headers: ["Idempotency-Key": UUID().uuidString])
    }

    func decideLeaveRequest(_ id: Int, decision: String, version: Int, reason: String?) async throws -> LeaveRequestPayload {
        try await request("employee-services/manager/leave/requests/\(id)/decision", method: "POST", body: [
            "decision": decision, "version": version, "reason": reason,
        ], headers: ["Idempotency-Key": UUID().uuidString])
    }
}

struct EmptyResponse: Decodable {}
struct ProgressPayload: Decodable { let progress: LearningProgressRecord }
