import SwiftUI

enum AuthStatus { case loading, authed, guest }

@MainActor
final class AuthStore: ObservableObject {
    @Published var user: User?
    @Published var status: AuthStatus = .loading

    var role: String { user?.role ?? "" }

    func restoreSession() async {
        guard TokenStore.access != nil else { status = .guest; return }
        do {
            user = try await APIClient.shared.me().user
            status = .authed
        } catch {
            TokenStore.clear()
            status = .guest
        }
    }

    /// Логин. Бросает APIError при неуспехе (для показа ошибки в форме).
    func login(identifier: String, password: String) async throws {
        let res = try await APIClient.shared.login(identifier: identifier, password: password)
        TokenStore.access = res.accessToken
        TokenStore.refresh = res.refreshToken
        user = res.user
        status = .authed
    }

    func logout() {
        TokenStore.clear()
        user = nil
        status = .guest
    }
}
