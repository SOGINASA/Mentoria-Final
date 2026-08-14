import Foundation
import Security

// Токены хранятся в системном Keychain и не попадают в UserDefaults/backup.
enum TokenStore {
    private static let service = "com.itshechka.bahandi.auth"
    private static let accessKey = "access"
    private static let refreshKey = "refresh"

    static var access: String? {
        get { read(accessKey) }
        set { write(newValue, key: accessKey) }
    }
    static var refresh: String? {
        get { read(refreshKey) }
        set { write(newValue, key: refreshKey) }
    }
    static func clear() {
        write(nil, key: accessKey)
        write(nil, key: refreshKey)
    }

    private static func read(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private static func write(_ value: String?, key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
        guard let data = value?.data(using: .utf8) else { return }
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(item as CFDictionary, nil)
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
    func patch<T: Decodable>(_ path: String, body: [String: Any?]? = nil) async throws -> T {
        try await perform(path, method: "PATCH", body: body)
    }
    func delete<T: Decodable>(_ path: String) async throws -> T {
        try await perform(path, method: "DELETE")
    }

    func request<T: Decodable>(_ path: String, method: String, body: [String: Any?]? = nil,
                               headers: [String: String] = [:]) async throws -> T {
        var data = try await send(path, method: method, body: body, authorized: true,
                                  retryOn401: true, headers: headers)
        if data.isEmpty { data = Data("{}".utf8) }
        do { return try decoder.decode(T.self, from: data) }
        catch {
#if DEBUG
            print("[API] Не удалось декодировать \(path): \(error)")
#endif
            throw APIError(message: "Ошибка обработки ответа", status: 0)
        }
    }

    func json(_ path: String, method: String = "GET", body: [String: Any?]? = nil,
              headers: [String: String] = [:]) async throws -> [String: Any] {
        let data = try await send(path, method: method, body: body, authorized: true,
                                  retryOn401: true, headers: headers)
        guard let value = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw APIError(message: "Ошибка обработки ответа", status: 0)
        }
        return value
    }

    func data(_ path: String) async throws -> Data {
        try await send(path, method: "GET", body: nil, authorized: true, retryOn401: true)
    }

    // MARK: - Ядро
    private func perform<T: Decodable>(_ path: String, method: String, body: [String: Any?]? = nil, authorized: Bool = true) async throws -> T {
        var data = try await send(path, method: method, body: body, authorized: authorized, retryOn401: true)
        if data.isEmpty { data = "{}".data(using: .utf8)! }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
#if DEBUG
            print("[API] Не удалось декодировать \(path): \(error)")
#endif
            throw APIError(message: "Ошибка обработки ответа", status: 0)
        }
    }

    // Собираем URL конкатенацией, а не appendingPathComponent — иначе "?" и "&"
    // в query-строке экранируются (?→%3F) и сервер отдаёт 404.
    private func makeURL(_ path: String) -> URL? {
        URL(string: apiURL.absoluteString + "/" + path)
    }

    private func send(_ path: String, method: String, body: [String: Any?]?, authorized: Bool,
                      retryOn401: Bool, headers: [String: String] = [:]) async throws -> Data {
        guard let url = makeURL(path) else {
            throw APIError(message: "Некорректный адрес запроса", status: 0)
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.timeoutInterval = 30
        headers.forEach { req.setValue($0.value, forHTTPHeaderField: $0.key) }
        if authorized, let token = TokenStore.access {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let clean = body.compactMapValues { $0 }
            req.httpBody = try JSONSerialization.data(withJSONObject: clean)
        }

        let data: Data
        let response: URLResponse
        do { (data, response) = try await URLSession.shared.data(for: req) }
        catch let error as URLError {
            throw APIError(message: error.code == .timedOut ? "Сервер не ответил вовремя" : "Нет соединения с сервером", status: 0)
        }
        guard let http = response as? HTTPURLResponse else {
            throw APIError(message: "Нет соединения с сервером", status: 0)
        }

        if http.statusCode == 401, authorized, retryOn401, await refreshToken() {
            return try await send(path, method: method, body: body, authorized: true,
                                  retryOn401: false, headers: headers)
        }

        guard (200..<300).contains(http.statusCode) else {
            let msg = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
#if DEBUG
            print("[API] HTTP \(http.statusCode): \(url.absoluteString)")
#endif
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
    func uploadPhoto(_ imageData: Data, filename: String = "photo.jpg", recognize: Bool = false) async throws -> UploadResponse {
        let boundary = "Boundary-\(UUID().uuidString)"
        var req = URLRequest(url: apiURL.appendingPathComponent("uploads/photo"), timeoutInterval: 30)
        req.httpMethod = "POST"
        if let token = TokenStore.access { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"recognize\"\r\n\r\n".data(using: .utf8)!)
        body.append((recognize ? "1" : "0").data(using: .utf8)!)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        req.httpBody = body

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: req)
        } catch let urlError as URLError where urlError.code == .timedOut {
            throw APIError(message: "Сервер не ответил при загрузке фото. Попробуйте ещё раз.", status: 0)
        } catch {
            throw APIError(message: "Нет соединения с сервером", status: 0)
        }
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw APIError(message: "Не удалось загрузить фото", status: 0)
        }
        return try decoder.decode(UploadResponse.self, from: data)
    }

    func recognizePhoto(_ filename: String) async throws -> Recognition? {
        struct Response: Codable { let recognition: Recognition? }
        let response: Response = try await post("uploads/recognize", body: ["filename": filename])
        return response.recognition
    }
}
