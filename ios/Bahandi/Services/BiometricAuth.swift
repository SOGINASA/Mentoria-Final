import Foundation
import LocalAuthentication

// Пользователь отменил биометрию (Cancel / свайп) — не показываем как ошибку.
struct BiometricCancelled: Error {}

// Обёртка над LocalAuthentication (Face ID / Touch ID).
enum BiometricAuth {
    /// Доступна ли биометрия на устройстве (есть сенсор + что-то enrolled).
    static func isAvailable() -> Bool {
        var error: NSError?
        return LAContext().canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    /// «Face ID» / «Touch ID» / «Биометрия».
    static func typeLabel() -> String {
        let ctx = LAContext()
        _ = ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        switch ctx.biometryType {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        default: return "Биометрия"
        }
    }

    /// Запросить биометрию. Бросает BiometricCancelled при отмене пользователем.
    static func authenticate(reason: String) async throws {
        let ctx = LAContext()
        ctx.localizedFallbackTitle = "" // без «Введите пароль» — только биометрия
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            ctx.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { ok, err in
                if ok {
                    cont.resume()
                } else if let e = err as? LAError,
                          [.userCancel, .appCancel, .systemCancel].contains(e.code) {
                    cont.resume(throwing: BiometricCancelled())
                } else {
                    cont.resume(throwing: err ?? BiometricCancelled())
                }
            }
        }
    }
}
