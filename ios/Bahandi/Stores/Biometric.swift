import Foundation

/// Локальное «включение» входа по биометрии.
///
/// ВАЖНО (demo): для прода тут должен быть Keychain + LocalAuthentication (Face ID/Touch ID).
/// Здесь, для демо, креды кладутся в UserDefaults (base64), чтобы вход по биометрии срабатывал.
enum BiometricStore {
    private static let key = "bahandi_biometric"

    struct Saved: Codable {
        var enabled: Bool
        var identifier: String
        var name: String
        var secret: String // base64(password)
    }

    static func saved() -> Saved? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(Saved.self, from: data)
    }

    static var isEnabled: Bool {
        guard let s = saved() else { return false }
        return s.enabled && !s.identifier.isEmpty && !s.secret.isEmpty
    }

    static var name: String? { saved()?.name }

    static func enable(identifier: String, name: String, password: String) {
        let secret = Data(password.utf8).base64EncodedString()
        let saved = Saved(enabled: true, identifier: identifier, name: name, secret: secret)
        if let data = try? JSONEncoder().encode(saved) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    static func disable() {
        UserDefaults.standard.removeObject(forKey: key)
    }

    static func credentials() -> (identifier: String, password: String)? {
        guard let s = saved(),
              let data = Data(base64Encoded: s.secret),
              let pass = String(data: data, encoding: .utf8) else { return nil }
        return (s.identifier, pass)
    }
}
