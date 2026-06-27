import Foundation

// Хранение токенов (для хакатона — UserDefaults; в проде заменить на Keychain).
enum TokenStore {
    private static let accessKey = "bahandi_access"
    private static let refreshKey = "bahandi_refresh"

    static var access: String? {
        get { UserDefaults.standard.string(forKey: accessKey) }
        set { UserDefaults.standard.set(newValue, forKey: accessKey) }
    }
    static var refresh: String? {
        get { UserDefaults.standard.string(forKey: refreshKey) }
        set { UserDefaults.standard.set(newValue, forKey: refreshKey) }
    }
    static func clear() {
        UserDefaults.standard.removeObject(forKey: accessKey)
        UserDefaults.standard.removeObject(forKey: refreshKey)
    }
}

struct APIError: LocalizedError {
    let message: String
    let status: Int
    var errorDescription: String? { message }
}

final class APIClient {
    static let shared = APIClient()

    // Адрес бэкенда берётся из единого конфига (AppConfig).
    // Переключение окружения (симулятор / LAN / прод) — там же, в одном месте.
    var baseURL = AppConfig.baseURL
    private var apiURL: URL { baseURL.appendingPathComponent("api") }

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    // MARK: - Публичные методы
    func get<T: Decodable>(_ path: String) async throws -> T {
        try await perform(path, method: "GET")
    }
    func post<T: Decodable>(_ path: String, body: [String: Any?]? = nil, authorized: Bool = true) async throws -> T {
        try await perform(path, method: "POST", body: body, authorized: authorized)
    }
    func put<T: Decodable>(_ path: String, body: [String: Any?]? = nil) async throws -> T {
        try await perform(path, method: "PUT", body: body)
    }
    func delete<T: Decodable>(_ path: String) async throws -> T {
        try await perform(path, method: "DELETE")
    }

    // MARK: - Ядро
    private func perform<T: Decodable>(_ path: String, method: String, body: [String: Any?]? = nil, authorized: Bool = true) async throws -> T {
        var data = try await send(path, method: method, body: body, authorized: authorized, retryOn401: true)
        if data.isEmpty { data = "{}".data(using: .utf8)! }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError(message: "Ошибка обработки ответа", status: 0)
        }
    }

    private func send(_ path: String, method: String, body: [String: Any?]?, authorized: Bool, retryOn401: Bool) async throws -> Data {
        var req = URLRequest(url: apiURL.appendingPathComponent(path))
        req.httpMethod = method
        if authorized, let token = TokenStore.access {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let clean = body.compactMapValues { $0 }
            req.httpBody = try JSONSerialization.data(withJSONObject: clean)
        }

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw APIError(message: "Нет соединения с сервером", status: 0)
        }

        if http.statusCode == 401, authorized, retryOn401, await refreshToken() {
            return try await send(path, method: method, body: body, authorized: true, retryOn401: false)
        }

        guard (200..<300).contains(http.statusCode) else {
            let msg = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw APIError(message: msg ?? "Ошибка \(http.statusCode)", status: http.statusCode)
        }
        return data
    }

    private func refreshToken() async -> Bool {
        guard let refresh = TokenStore.refresh else { return false }
        var req = URLRequest(url: apiURL.appendingPathComponent("auth/refresh"))
        req.httpMethod = "POST"
        req.setValue("Bearer \(refresh)", forHTTPHeaderField: "Authorization")
        guard let (data, response) = try? await URLSession.shared.data(for: req),
              let http = response as? HTTPURLResponse, http.statusCode == 200,
              let decoded = try? decoder.decode(RefreshResponse.self, from: data) else {
            return false
        }
        TokenStore.access = decoded.accessToken
        return true
    }

    // MARK: - Загрузка фото (multipart)
    func uploadPhoto(_ imageData: Data, filename: String = "photo.jpg") async throws -> UploadResponse {
        let boundary = "Boundary-\(UUID().uuidString)"
        var req = URLRequest(url: apiURL.appendingPathComponent("uploads/photo"))
        req.httpMethod = "POST"
        if let token = TokenStore.access { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        req.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw APIError(message: "Не удалось загрузить фото", status: 0)
        }
        return try decoder.decode(UploadResponse.self, from: data)
    }
}
