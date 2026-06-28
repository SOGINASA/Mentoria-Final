import Foundation
import Security

/// Хранилище для входа по биометрии.
///
/// Как на вебе: секрет не лежит в открытом виде. Пароль кладётся в **Keychain**
/// (доступен только на этом устройстве), а в UserDefaults — лишь лёгкая ПОДСКАЗКА
/// (identifier + имя) для приветствия на экране входа. Доступ к паролю гейтится
/// настоящим Face ID / Touch ID (см. BiometricAuth) перед входом через /auth/login.
enum BiometricStore {
    private static let hintKey = "bahandi_biometric_hint"
    private static let kcService = "kz.itshechka.bahandi.biometric"

    struct Hint: Codable { var identifier: String; var name: String }

    // MARK: подсказка (не секрет)
    private static func hint() -> Hint? {
        guard let data = UserDefaults.standard.data(forKey: hintKey) else { return nil }
        return try? JSONDecoder().decode(Hint.self, from: data)
    }
    private static func setHint(_ h: Hint?) {
        if let h, let data = try? JSONEncoder().encode(h) {
            UserDefaults.standard.set(data, forKey: hintKey)
        } else {
            UserDefaults.standard.removeObject(forKey: hintKey)
        }
    }

    static var isEnabled: Bool {
        guard let h = hint() else { return false }
        return keychainGet(account: h.identifier) != nil
    }
    static var name: String? { hint()?.name }
    static var identifier: String? { hint()?.identifier }

    static func enable(identifier: String, name: String, password: String) {
        keychainSet(password, account: identifier)
        setHint(Hint(identifier: identifier, name: name))
    }

    static func disable() {
        if let id = hint()?.identifier { keychainDelete(account: id) }
        setHint(nil)
    }

    static func credentials() -> (identifier: String, password: String)? {
        guard let h = hint(), let pass = keychainGet(account: h.identifier) else { return nil }
        return (h.identifier, pass)
    }

    // MARK: Keychain
    private static func keychainSet(_ value: String, account: String) {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: kcService,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(base as CFDictionary)
        var add = base
        add[kSecValueData as String] = Data(value.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }
    private static func keychainGet(account: String) -> String? {
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: kcService,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
    private static func keychainDelete(account: String) {
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: kcService,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(q as CFDictionary)
    }
}
