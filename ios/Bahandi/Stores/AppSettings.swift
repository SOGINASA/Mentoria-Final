import SwiftUI

enum AppTheme: String, CaseIterable { case system, light, dark }

@MainActor
final class AppSettings: ObservableObject {
    @Published var lang: String { didSet { UserDefaults.standard.set(lang, forKey: "bahandi_lang") } }
    @Published var theme: AppTheme { didSet { UserDefaults.standard.set(theme.rawValue, forKey: "bahandi_theme") } }
    @Published var toast: String?

    init() {
        lang = UserDefaults.standard.string(forKey: "bahandi_lang") ?? "ru"
        theme = AppTheme(rawValue: UserDefaults.standard.string(forKey: "bahandi_theme") ?? "system") ?? .system
    }

    var colorScheme: ColorScheme? {
        switch theme {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }

    /// Локализованная строка по ключу.
    func t(_ key: String) -> String {
        let dict = lang == "kz" ? Strings.kz : Strings.ru
        return dict[key] ?? Strings.ru[key] ?? key
    }

    private var toastTask: Task<Void, Never>?
    func showToast(_ message: String) {
        toast = message
        toastTask?.cancel()
        toastTask = Task {
            try? await Task.sleep(nanoseconds: 2_600_000_000)
            if !Task.isCancelled { toast = nil }
        }
    }
}
