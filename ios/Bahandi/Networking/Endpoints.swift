import Foundation

extension APIClient {
    // MARK: Auth
    func login(identifier: String, password: String) async throws -> LoginResponse {
        try await post("auth/login", body: ["identifier": identifier, "password": password], authorized: false)
    }
    func me() async throws -> MeResponse { try await get("auth/me") }
    func changePassword(current: String, new: String) async throws -> EmptyResponse {
        try await post("auth/change-password", body: ["current_password": current, "new_password": new])
    }

    // MARK: Write-offs
    func writeOffs(status: String? = nil, storeId: Int? = nil, page: Int = 1, perPage: Int = 50) async throws -> WriteOffsResponse {
        var q = "write-offs?per_page=\(perPage)"
        if let status { q += "&status=\(status)" }
        if let storeId { q += "&store_id=\(storeId)" }
        q += "&page=\(page)"
        return try await get(q)
    }
    func writeOff(_ id: Int) async throws -> WriteOffResponse { try await get("write-offs/\(id)") }
    func createWriteOff(_ payload: [String: Any?]) async throws -> WriteOffResponse {
        try await post("write-offs", body: payload)
    }
    func approve(_ id: Int) async throws -> WriteOffResponse { try await post("write-offs/\(id)/approve") }
    func reject(_ id: Int, reason: String) async throws -> WriteOffResponse {
        try await post("write-offs/\(id)/reject", body: ["rejection_reason": reason])
    }
    func stats(scope: String? = nil) async throws -> Stats {
        try await get("write-offs/stats" + (scope.map { "?scope=\($0)" } ?? ""))
    }
    func writeOffAnalytics(days: Int, storeId: Int? = nil) async throws -> WriteOffAnalytics {
        var path = "write-offs/analytics?days=\(days)"
        if let storeId { path += "&store_id=\(storeId)" }
        return try await get(path)
    }

    // MARK: Справочники
    func stores() async throws -> StoresResponse { try await get("stores") }
    func storeEmployees(_ storeId: Int) async throws -> EmployeesResponse { try await get("stores/\(storeId)/employees") }
    func employees() async throws -> EmployeesResponse { try await get("stores/employees") }

    // MARK: Админ
    func adminUsers() async throws -> UsersResponse { try await get("admin/users") }
    func adminStores() async throws -> StoresResponse { try await get("admin/stores") }
    func adminEmployees() async throws -> EmployeesResponse { try await get("admin/employees") }
    func adminCreateUser(_ payload: [String: Any?]) async throws -> UserResponse { try await post("admin/users", body: payload) }
    func adminUpdateUser(_ id: Int, _ payload: [String: Any?]) async throws -> UserResponse { try await put("admin/users/\(id)", body: payload) }
    func adminReplaceScopes(_ id: Int, _ scopes: [[String: Any]]) async throws -> ScopesResponse {
        try await put("admin/platform/users/\(id)/scopes", body: ["scopes": scopes])
    }

    func adminCreateStore(_ payload: [String: Any?]) async throws -> StoreResponse { try await post("admin/stores", body: payload) }
    func adminUpdateStore(_ id: Int, _ payload: [String: Any?]) async throws -> StoreResponse { try await put("admin/stores/\(id)", body: payload) }

    func adminCreateEmployee(_ payload: [String: Any?]) async throws -> EmployeeResponse { try await post("admin/employees", body: payload) }
    func adminUpdateEmployee(_ id: Int, _ payload: [String: Any?]) async throws -> EmployeeResponse { try await put("admin/employees/\(id)", body: payload) }
}
