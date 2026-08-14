import Foundation

// Значения совпадают с back/constants.py
enum Role {
    static let sender = "sender"
    static let manager = "manager"
    static let reviewer = "reviewer"
    static let hr = "hr"
    static let finance = "finance"
    static let operations = "operations"
    static let admin = "admin"
}
enum WStatus {
    static let pending = "pending"
    static let approved = "approved"
    static let rejected = "rejected"
}
enum WType {
    static let noDeduction = "no_deduction"
    static let withDeduction = "with_deduction"
}
enum IikoStatus {
    static let synced = "synced"
    static let failed = "failed"
}

struct Store: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    var address: String?
    var iikoStoreId: String?
    var isActive: Bool?
}

struct Employee: Codable, Identifiable, Hashable {
    let id: Int
    let fullName: String
    var position: String?
    var storeId: Int?
    var isActive: Bool?
    var iikoEmployeeId: String?
}

struct UserRef: Codable, Hashable {
    let id: Int
    let fullName: String
    var username: String?
}

struct Photo: Codable, Identifiable, Hashable {
    let id: Int
    let url: String
}

struct User: Codable, Identifiable, Hashable {
    let id: Int
    let username: String
    var email: String?
    var phone: String?
    let fullName: String
    let role: String
    var storeId: Int?
    var store: Store?
    var employeeId: Int?
    var employee: Employee?
    var supervisedStoreIds: [Int]?
    var isActive: Bool?
    var storeScopes: [UserStoreScope]?
}

struct UserStoreScope: Codable, Identifiable, Hashable {
    let id: Int
    let storeId: Int
    let scope: String
    let store: Store?
}

struct WriteOff: Codable, Identifiable, Hashable {
    let id: Int
    var storeId: Int?
    var store: Store?
    let type: String
    var deductionEmployeeId: Int?
    var deductionEmployee: Employee?
    var deductionEmployees: [Employee]?
    var deductAll: Bool?
    var productName: String?
    var items: [WriteOffItem]?
    let comment: String
    let status: String
    var reviewer: UserRef?
    var rejectionReason: String?
    var reviewedAt: String?
    var iikoActId: String?
    var iikoSyncStatus: String?
    var photos: [Photo]?
    var author: UserRef?
    var createdAt: String?
}
struct WriteOffItem: Codable, Hashable { let productName: String; var quantity: Double?; var unit: String? }

struct Pagination: Codable { let page: Int; let perPage: Int; let total: Int; let pages: Int }
struct Stats: Codable { let pending: Int; let approved: Int; let rejected: Int; let total: Int
    static let zero = Stats(pending: 0, approved: 0, rejected: 0, total: 0)
}

struct WriteOffAnalytics: Codable {
    let totals: WriteOffAnalyticsTotals
    let withHold: Int
    let noHold: Int
    let avgLoss: Int
    let lossTotal: Int
    let byStore: [WriteOffAnalyticsGroup]
    let byEmployee: [WriteOffAnalyticsGroup]
    let trend: [WriteOffAnalyticsPoint]
}

struct WriteOffAnalyticsTotals: Codable {
    let total: Int
    let pending: Int
    let approved: Int
    let rejected: Int
}

struct WriteOffAnalyticsGroup: Codable, Identifiable {
    var id: String { "\(storeId ?? employeeId ?? 0)-\(name)" }
    var storeId: Int?
    var employeeId: Int?
    let name: String
    let count: Int
    let loss: Int
}

struct WriteOffAnalyticsPoint: Codable, Identifiable {
    var id: String { date }
    let date: String
    let count: Int
}

// Обёртки ответов API
struct LoginResponse: Codable { let user: User; let accessToken: String; let refreshToken: String }
struct MeResponse: Codable { let user: User }
struct RefreshResponse: Codable { let accessToken: String }
struct WriteOffResponse: Codable { let writeOff: WriteOff }
struct WriteOffsResponse: Codable { let writeOffs: [WriteOff]; var pagination: Pagination? }
struct StoresResponse: Codable { let stores: [Store] }
struct EmployeesResponse: Codable { let employees: [Employee] }
struct UsersResponse: Codable { let users: [User] }
// Результат распознавания ИИ по фото (тип продукта + испорченность).
struct DetectedItem: Codable, Hashable {
    let product: String
    let state: String        // spoiled | defect | good
    let confidence: Double
    let requiresWriteoff: Bool
}
struct Recognition: Codable, Hashable {
    var detectedItems: [DetectedItem] = []
    var suggestedReason: String?
    var writeoffRequired: Bool?
}
struct UploadResponse: Codable { let url: String; let filename: String; var recognition: Recognition? }
struct UserResponse: Codable { let user: User }
struct StoreResponse: Codable { let store: Store }
struct EmployeeResponse: Codable { let employee: Employee }
struct ScopesResponse: Codable { let scopes: [UserStoreScope] }
