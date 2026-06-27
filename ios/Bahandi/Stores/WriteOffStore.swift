import SwiftUI

@MainActor
final class WriteOffStore: ObservableObject {
    @Published var list: [WriteOff] = []
    @Published var stats: Stats = .zero
    @Published var listLoading = false
    @Published var acting = false

    @Published var stores: [Store] = []
    @Published var employees: [Employee] = []

    func loadList(status: String? = nil) async {
        listLoading = true
        defer { listLoading = false }
        do { list = try await APIClient.shared.writeOffs(status: status).writeOffs }
        catch { list = [] }
    }

    func loadStats(scope: String? = nil) async {
        if let s = try? await APIClient.shared.stats(scope: scope) { stats = s }
    }

    func load(id: Int) async throws -> WriteOff {
        try await APIClient.shared.writeOff(id).writeOff
    }

    func create(_ payload: [String: Any?]) async throws -> WriteOff {
        acting = true; defer { acting = false }
        return try await APIClient.shared.createWriteOff(payload).writeOff
    }

    func approve(_ id: Int) async throws -> WriteOff {
        acting = true; defer { acting = false }
        return try await APIClient.shared.approve(id).writeOff
    }

    func reject(_ id: Int, reason: String) async throws -> WriteOff {
        acting = true; defer { acting = false }
        return try await APIClient.shared.reject(id, reason: reason).writeOff
    }

    func loadStores() async {
        if let s = try? await APIClient.shared.stores().stores { stores = s }
    }

    func loadEmployees(storeId: Int?) async {
        do {
            employees = storeId != nil
                ? try await APIClient.shared.storeEmployees(storeId!).employees
                : try await APIClient.shared.employees().employees
        } catch { employees = [] }
    }
}
