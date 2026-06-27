import Foundation

extension APIClient {
    // MARK: Auth
    func login(identifier: String, password: String) async throws -> LoginResponse {
        try await post("auth/login", body: ["identifier": identifier, "password": password], authorized: false)
    }
    func me() async throws -> MeResponse { try await get("auth/me") }

    // MARK: Write-offs
    func writeOffs(status: String? = nil, perPage: Int = 50) async throws -> WriteOffsResponse {
        var q = "write-offs?per_page=\(perPage)"
        if let status { q += "&status=\(status)" }
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

    // MARK: Справочники
    func stores() async throws -> StoresResponse { try await get("stores") }
    func storeEmployees(_ storeId: Int) async throws -> EmployeesResponse { try await get("stores/\(storeId)/employees") }
    func employees() async throws -> EmployeesResponse { try await get("stores/employees") }

    // MARK: Админ
    func adminUsers() async throws -> UsersResponse { try await get("admin/users") }
    func adminCreateUser(_ payload: [String: Any?]) async throws -> UserResponse { try await post("admin/users", body: payload) }
    func adminUpdateUser(_ id: Int, _ payload: [String: Any?]) async throws -> UserResponse { try await put("admin/users/\(id)", body: payload) }

    func adminCreateStore(_ payload: [String: Any?]) async throws -> StoreResponse { try await post("admin/stores", body: payload) }
    func adminUpdateStore(_ id: Int, _ payload: [String: Any?]) async throws -> StoreResponse { try await put("admin/stores/\(id)", body: payload) }

    func adminCreateEmployee(_ payload: [String: Any?]) async throws -> EmployeeResponse { try await post("admin/employees", body: payload) }
    func adminUpdateEmployee(_ id: Int, _ payload: [String: Any?]) async throws -> EmployeeResponse { try await put("admin/employees/\(id)", body: payload) }
}
